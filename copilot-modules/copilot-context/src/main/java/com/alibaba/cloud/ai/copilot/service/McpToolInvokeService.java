package com.alibaba.cloud.ai.copilot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springaicommunity.mcp.annotation.McpTool;
import org.springaicommunity.mcp.annotation.McpToolParam;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Service;


import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MCP 工具调用服务
 * 负责直接调用已注册的 MCP 工具
 *
 * @author Administrator
 */
@Slf4j
@Service
public class McpToolInvokeService implements ApplicationListener<ApplicationReadyEvent> {

    @Resource
    private ApplicationContext applicationContext;

    // 工具名称 -> (Bean实例, 方法) 的映射
    private final Map<String, ToolMethodInfo> toolRegistry = new ConcurrentHashMap<>();
    
    private volatile boolean initialized = false;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        // 在应用完全启动后再扫描工具，避免循环依赖
        if (!initialized) {
            scanMcpTools();
            initialized = true;
            log.info("MCP 工具扫描完成，共找到 {} 个工具", toolRegistry.size());
        }
    }

    /**
     * 扫描所有 MCP 工具
     */
    private void scanMcpTools() {
        // 获取所有 Spring Bean
        String[] beanNames = applicationContext.getBeanNamesForType(Object.class);

        for (String beanName : beanNames) {
            Object bean = applicationContext.getBean(beanName);
            Class<?> beanClass = bean.getClass();

            // 扫描类中的所有方法
            Method[] methods = beanClass.getDeclaredMethods();
            for (Method method : methods) {
                McpTool annotation = method.getAnnotation(McpTool.class);
                if (annotation != null) {
                    String toolName = annotation.name();
                    if (toolName == null || toolName.isEmpty()) {
                        toolName = method.getName();
                    }
                    toolRegistry.put(toolName, new ToolMethodInfo(bean, method, annotation));
                    log.debug("注册 MCP 工具: {} -> {}.{}", toolName, beanClass.getSimpleName(), method.getName());
                }
            }
        }
    }

    /**
     * 调用 MCP 工具
     *
     * @param toolName 工具名称
     * @param params   参数 Map
     * @return 调用结果
     * @throws IllegalArgumentException 如果工具不存在或参数错误
     * @throws RuntimeException         如果工具调用失败
     */
    public Object invokeTool(String toolName, Map<String, Object> params) {
        // 如果还未初始化，先初始化（防止在应用启动过程中调用）
        if (!initialized) {
            synchronized (this) {
                if (!initialized) {
                    scanMcpTools();
                    initialized = true;
                }
            }
        }
        
        ToolMethodInfo toolInfo = toolRegistry.get(toolName);
        if (toolInfo == null) {
            throw new IllegalArgumentException("工具不存在: " + toolName + "，可用工具: " + toolRegistry.keySet());
        }

        Method method = toolInfo.method;
        Object bean = toolInfo.bean;

        try {
            // 准备方法参数
            Object[] methodArgs = prepareMethodArguments(method, params);

            log.debug("调用工具: {}，参数: {}", toolName, params);

            // 调用方法
            method.setAccessible(true);
            Object result = method.invoke(bean, methodArgs);

            log.debug("工具调用成功: {}，结果: {}", toolName, result);
            return result;

        } catch (IllegalArgumentException e) {
            log.error("工具调用参数错误: {}", toolName, e);
            throw e;
        } catch (Exception e) {
            log.error("工具调用失败: {}", toolName, e);
            Throwable cause = e.getCause();
            if (cause != null) {
                throw new RuntimeException("工具调用失败: " + cause.getMessage(), cause);
            }
            throw new RuntimeException("工具调用失败: " + e.getMessage(), e);
        }
    }

    /**
     * 准备方法参数
     */
    private Object[] prepareMethodArguments(Method method, Map<String, Object> params) {
        Parameter[] parameters = method.getParameters();
        Object[] args = new Object[parameters.length];

        for (int i = 0; i < parameters.length; i++) {
            Parameter param = parameters[i];
            String paramName = param.getName();

            // 检查是否有 @McpToolParam 注解
            McpToolParam toolParam = param.getAnnotation(McpToolParam.class);

            // 如果参数名是合成的（如 arg0, arg1），尝试从注解获取或使用索引
            if (paramName == null || paramName.startsWith("arg")) {
                // 尝试从参数位置推断（如果 params 是数组形式）
                // 或者使用参数索引作为备选
                paramName = "param" + i;
            }

            // 从 params Map 中获取参数值
            // 尝试多种可能的键名
            Object value = null;
            if (params != null) {
                // 1. 直接使用参数名
                value = params.get(paramName);

                // 2. 如果找不到，尝试小写
                if (value == null) {
                    value = params.get(paramName.toLowerCase());
                }

                // 3. 如果还找不到，尝试按位置（如果 params 是数组形式）
                if (value == null && params.containsKey(String.valueOf(i))) {
                    value = params.get(String.valueOf(i));
                }
            }

            // 如果参数是可选且为 null，使用默认值
            if (value == null) {
                if (toolParam != null && !toolParam.required()) {
                    // 可选参数，使用默认值
                    value = getDefaultValue(param.getType());
                } else {
                    if (toolParam != null) {
                        toolParam.required();
                    }// 必需参数但没有提供值，抛出异常
                    throw new IllegalArgumentException(
                            String.format("缺少必需参数: %s (位置: %d)", paramName, i));
                }
            }

            // 类型转换
            args[i] = convertValue(value, param.getType());
        }

        return args;
    }

    /**
     * 类型转换
     */
    private Object convertValue(Object value, Class<?> targetType) {
        ObjectMapper objectMapper = new ObjectMapper();
        if (value == null) {
            return getDefaultValue(targetType);
        }

        // 如果类型匹配，直接返回
        if (targetType.isAssignableFrom(value.getClass())) {
            return value;
        }

        // 基本类型转换
        if (targetType == int.class || targetType == Integer.class) {
            if (value instanceof Number) {
                return ((Number) value).intValue();
            }
            return Integer.parseInt(value.toString());
        }

        if (targetType == long.class || targetType == Long.class) {
            if (value instanceof Number) {
                return ((Number) value).longValue();
            }
            return Long.parseLong(value.toString());
        }

        if (targetType == double.class || targetType == Double.class) {
            if (value instanceof Number) {
                return ((Number) value).doubleValue();
            }
            return Double.parseDouble(value.toString());
        }

        if (targetType == float.class || targetType == Float.class) {
            if (value instanceof Number) {
                return ((Number) value).floatValue();
            }
            return Float.parseFloat(value.toString());
        }

        if (targetType == boolean.class || targetType == Boolean.class) {
            if (value instanceof Boolean) {
                return value;
            }
            return Boolean.parseBoolean(value.toString());
        }

        if (targetType == String.class) {
            return value.toString();
        }

        // 尝试使用 Jackson 进行 JSON 转换
        try {
            return objectMapper.convertValue(value, targetType);
        } catch (Exception e) {
            log.warn("无法转换值 {} 到类型 {}", value, targetType.getName());
            return value;
        }
    }

    /**
     * 获取默认值
     */
    private Object getDefaultValue(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == byte.class || type == short.class || type == int.class || type == long.class) {
            return 0;
        }
        if (type == float.class || type == double.class) {
            return 0.0;
        }
        if (type == char.class) {
            return '\u0000';
        }
        return null;
    }

    /**
     * 检查工具是否存在
     */
    public boolean hasTool(String toolName) {
        return toolRegistry.containsKey(toolName);
    }

    /**
     * 获取所有已注册的工具名称
     */
    public Set<String> getAllToolNames() {
        return new HashSet<>(toolRegistry.keySet());
    }

    /**
     * 获取工具信息
     */
    public ToolMethodInfo getToolInfo(String toolName) {
        return toolRegistry.get(toolName);
    }

    /**
     * 工具方法信息
     */
    public record ToolMethodInfo(Object bean, Method method, McpTool annotation) {
    }
}
