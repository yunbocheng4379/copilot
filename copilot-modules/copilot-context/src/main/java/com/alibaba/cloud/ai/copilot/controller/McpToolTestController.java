package com.alibaba.cloud.ai.copilot.controller;

import com.alibaba.cloud.ai.copilot.entity.McpToolData;
import com.alibaba.cloud.ai.copilot.service.McpToolInvokeService;
import com.alibaba.cloud.ai.copilot.service.McpToolService;
import com.alibaba.cloud.ai.copilot.service.RemoteMcpToolInvokeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP 工具测试控制器
 * 提供工具测试接口
 *
 * @author Administrator
 */
@Slf4j
@RestController
@RequestMapping("/api/mcp/tools")
public class McpToolTestController {

    @Resource
    private McpToolService mcpToolService;

    @Resource
    private McpToolInvokeService mcpToolInvokeService;

    @Resource
    private RemoteMcpToolInvokeService remoteMcpToolInvokeService;

    /**
     * 测试工具调用
     *
     * @param toolId 工具ID
     * @param params 工具参数（JSON 字符串）
     * @return 测试结果
     */
    @PostMapping("/test/{toolId}")
    public ResponseEntity<Map<String, Object>> testTool(
            @PathVariable Long toolId,
            @RequestBody(required = false) Map<String, Object> params) {

        ObjectMapper objectMapper = new ObjectMapper();
        Map<String, Object> result = new HashMap<>();

        try {
            // 获取工具信息
            McpToolData tool = mcpToolService.getById(toolId);
            if (tool == null) {
                result.put("success", false);
                result.put("error", "工具不存在");
                return ResponseEntity.badRequest().body(result);
            }

            if (!McpToolData.Status.ENABLED.equals(tool.getStatus())) {
                result.put("success", false);
                result.put("error", "工具未启用");
                return ResponseEntity.badRequest().body(result);
            }

            // 根据工具类型选择调用方式
            long startTime = System.currentTimeMillis();
            Object toolResult;
            try {
                if (McpToolData.Type.REMOTE.equals(tool.getType())) {
                    // 远程工具调用
                    if (!remoteMcpToolInvokeService.isToolAvailable(tool)) {
                        result.put("success", false);
                        result.put("error", "远程工具不可用，请检查连接配置");
                        return ResponseEntity.badRequest().body(result);
                    }
                    // 注意：这里需要知道远程工具的实际工具名称
                    // 如果配置中有工具名称，使用配置中的；否则使用工具名称
                    String remoteToolName = tool.getName();
                    toolResult = remoteMcpToolInvokeService.invokeRemoteTool(tool, remoteToolName, params);
                } else {
                    // 本地工具调用
                    if (!mcpToolInvokeService.hasTool(tool.getName())) {
                        result.put("success", false);
                        result.put("error", "工具未注册到 MCP 系统，请确保工具类已正确加载");
                        return ResponseEntity.badRequest().body(result);
                    }
                    toolResult = mcpToolInvokeService.invokeTool(tool.getName(), params);
                }
                long duration = System.currentTimeMillis() - startTime;

                // 格式化返回结果
                String resultJson;
                if (toolResult instanceof String) {
                    resultJson = (String) toolResult;
                } else {
                    resultJson = objectMapper.writeValueAsString(toolResult);
                }

                result.put("success", true);
                result.put("toolId", toolId);
                result.put("toolName", tool.getName());
                result.put("request", params != null ? params : Map.of());
                result.put("response", toolResult);
                result.put("responseJson", resultJson);
                result.put("duration", duration + "ms");
                result.put("timestamp", System.currentTimeMillis());
            } catch (Exception e) {
                log.error("调用工具失败: {}", tool.getName(), e);
                result.put("success", false);
                result.put("error", e.getMessage());
                result.put("errorType", e.getClass().getSimpleName());
                result.put("toolId", toolId);
                result.put("toolName", tool.getName());
                return ResponseEntity.ok(result);
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("测试工具失败", e);
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("toolId", toolId);
            return ResponseEntity.internalServerError().body(result);
        }
    }

    /**
     * 获取工具信息（包括参数定义）
     *
     * @param toolId 工具ID
     * @return 工具信息
     */
    @GetMapping("/info/{toolId}")
    public ResponseEntity<Map<String, Object>> getToolInfo(@PathVariable Long toolId) {
        Map<String, Object> result = new HashMap<>();

        try {
            McpToolData tool = mcpToolService.getById(toolId);
            if (tool == null) {
                result.put("success", false);
                result.put("error", "工具不存在");
                return ResponseEntity.badRequest().body(result);
            }

            // 获取工具的方法信息（如果已注册）
            Map<String, Object> toolInfo = new HashMap<>();
            toolInfo.put("id", tool.getId());
            toolInfo.put("name", tool.getName());
            toolInfo.put("description", tool.getDescription() != null ? tool.getDescription() : "");
            toolInfo.put("type", tool.getType());
            toolInfo.put("status", tool.getStatus());
            toolInfo.put("config", parseConfig(tool.getConfigJson()));

            // 如果工具已注册，添加方法参数信息
            if (mcpToolInvokeService.hasTool(tool.getName())) {
                McpToolInvokeService.ToolMethodInfo methodInfo = mcpToolInvokeService.getToolInfo(tool.getName());
                if (methodInfo != null) {
                    toolInfo.put("registered", true);
                    toolInfo.put("parameters", extractParameterInfo(methodInfo.method()));
                } else {
                    toolInfo.put("registered", false);
                }
            } else {
                toolInfo.put("registered", false);
            }

            result.put("success", true);
            result.put("tool", toolInfo);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("获取工具信息失败", e);
            result.put("success", false);
            result.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(result);
        }
    }


    /**
     * 解析配置 JSON
     */
    private Map parseConfig(String configJson) {
        ObjectMapper objectMapper = new ObjectMapper();
        try {
            if (configJson == null || configJson.isEmpty()) {
                return Map.of();
            }
            return objectMapper.readValue(configJson, Map.class);
        } catch (Exception e) {
            log.warn("解析配置失败", e);
            assert configJson != null;
            return Map.of("raw", configJson);
        }
    }

    /**
     * 提取方法参数信息
     */
    private List<Map<String, Object>> extractParameterInfo(java.lang.reflect.Method method) {
        List<Map<String, Object>> params = new java.util.ArrayList<>();
        java.lang.reflect.Parameter[] parameters = method.getParameters();

        for (java.lang.reflect.Parameter param : parameters) {
            Map<String, Object> paramInfo = new HashMap<>();
            paramInfo.put("name", param.getName());
            paramInfo.put("type", param.getType().getSimpleName());

            org.springaicommunity.mcp.annotation.McpToolParam toolParam =
                    param.getAnnotation(org.springaicommunity.mcp.annotation.McpToolParam.class);
            if (toolParam != null) {
                paramInfo.put("description", toolParam.description());
                paramInfo.put("required", toolParam.required());
            } else {
                paramInfo.put("description", "");
                paramInfo.put("required", true);
            }

            params.add(paramInfo);
        }

        return params;
    }
}

