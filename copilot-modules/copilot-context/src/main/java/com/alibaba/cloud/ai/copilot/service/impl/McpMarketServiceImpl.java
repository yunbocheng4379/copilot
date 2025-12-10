package com.alibaba.cloud.ai.copilot.service.impl;


import com.alibaba.cloud.ai.copilot.dto.McpServerListResponse;
import com.alibaba.cloud.ai.copilot.entity.McpMarket;
import com.alibaba.cloud.ai.copilot.entity.McpMarketTool;
import com.alibaba.cloud.ai.copilot.entity.McpToolData;
import com.alibaba.cloud.ai.copilot.mapper.McpMarketMapper;
import com.alibaba.cloud.ai.copilot.mapper.McpMarketToolMapper;
import com.alibaba.cloud.ai.copilot.service.McpMarketService;
import com.alibaba.cloud.ai.copilot.service.McpToolRegistryService;
import com.alibaba.cloud.ai.copilot.service.McpToolService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * MCP 市场服务实现类
 *
 * @author Administrator
 */
@Slf4j
@Service
public class McpMarketServiceImpl extends ServiceImpl<McpMarketMapper, McpMarket> implements McpMarketService {

    @Resource
    private McpMarketToolMapper marketToolMapper;

    @Resource
    private RestTemplate restTemplate;

    @Resource
    private ApplicationContext applicationContext;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public McpMarket saveOrUpdateInfo(McpMarket market) {
        if (market.getId() == null) {
            market.setCreateTime(LocalDateTime.now());
        }
        market.setUpdateTime(LocalDateTime.now());
        if (market.getStatus() == null) {
            market.setStatus(McpMarket.Status.ENABLED);
        }
        super.saveOrUpdate(market);
        return market;
    }

    @Override
    public McpMarket getById(Long id) {
        return super.getById(id);
    }

    @Override
    public List<McpMarket> listAll() {
        return super.list(new LambdaQueryWrapper<McpMarket>().orderByDesc(McpMarket::getCreateTime));
    }

    @Override
    public List<McpMarket> listByStatus(String status) {
        return baseMapper.selectByStatus(status);
    }

    @Override
    public List<McpMarket> searchByName(String name) {
        return baseMapper.selectByNameLike(name);
    }

    @Override
    public boolean deleteById(Long id) {
        return super.removeById(id);
    }

    @Override
    public boolean updateStatus(Long id, String status) {
        McpMarket market = getById(id);
        if (market == null) {
            return false;
        }
        market.setStatus(status);
        market.setUpdateTime(LocalDateTime.now());
        return super.updateById(market);
    }

    @Override
    public List<McpMarketTool> getMarketTools(Long marketId) {
        return marketToolMapper.selectByMarketId(marketId);
    }

    @Override
    public Map<String, Object> getMarketToolsWithPage(Long marketId, Integer page, Integer size) {
        // 创建分页对象
        Page<McpMarketTool> pageObj = new Page<>(page, size);
        
        // 使用 LambdaQueryWrapper 构建查询条件
        LambdaQueryWrapper<McpMarketTool> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(McpMarketTool::getMarketId, marketId)
               .orderByDesc(McpMarketTool::getCreateTime);
        
        // 执行分页查询
        IPage<McpMarketTool> pageResult = marketToolMapper.selectPage(pageObj, wrapper);
        
        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("data", pageResult.getRecords());
        result.put("total", pageResult.getTotal());
        result.put("page", pageResult.getCurrent());
        result.put("size", pageResult.getSize());
        result.put("pages", pageResult.getPages());
        
        return result;
    }

    @Override
    public boolean refreshMarketTools(Long marketId) {
        try {
            McpMarket market = getById(marketId);
            if (market == null) {
                return false;
            }

            // 调用市场API获取工具列表
            String url = market.getUrl();

            HttpHeaders headers = new HttpHeaders();
            // GET 请求不需要设置 Content-Type

            // 如果有认证配置，添加到请求头
            if (market.getAuthConfig() != null && !market.getAuthConfig().isEmpty()) {
                try {
                    Map<String, String> authConfig = objectMapper.readValue(market.getAuthConfig(),
                            new TypeReference<>() {
                            });
                    if (authConfig.containsKey("apiKey")) {
                        headers.set("Authorization", "Bearer " + authConfig.get("apiKey"));
                    }
                } catch (Exception e) {
                    // 忽略认证配置解析错误
                }
            }

            // 分页获取所有数据，循环请求直到返回为空
            int pageSize = 40; // 每页大小
            int pageNumber = 1;
            Random random = new Random();
            boolean hasMore = true;

            while (hasMore) {
                // 构建带查询参数的 URL
                // https://mcpservers.cn/api/servers/list?tab=all&search=&page=1&pageSize=40&lang=zh
                String requestUrl = UriComponentsBuilder.fromUriString(url)
                        .queryParam("tab", "all")
                        .queryParam("search", "")
                        .queryParam("page", pageNumber)
                        .queryParam("pageSize", pageSize)
                        .queryParam("lang", "zh")
                        .toUriString();

                // GET 请求不需要请求体，只传递 headers
                HttpEntity<String> entity = new HttpEntity<>(headers);

                // 使用 GET 请求
                ResponseEntity<String> response = restTemplate.exchange(requestUrl, HttpMethod.GET, entity, String.class);

                if (!response.getStatusCode().is2xxSuccessful()) {
                    // 请求失败，停止请求
                    break;
                }
                // 解析响应
                McpServerListResponse responseData = objectMapper.readValue(
                        response.getBody(),
                        McpServerListResponse.class
                );

                if (responseData == null || responseData.getServers() == null) {
                    // 响应不成功或数据为空，停止请求
                    break;
                }
                List<McpServerListResponse.McpServerInfo> serverList = responseData.getServers();

                // 如果返回的列表为空，说明没有更多数据了
                if (serverList.isEmpty()) {
                    break;
                }

                // 保存或更新当前页的工具
                for (McpServerListResponse.McpServerInfo serverInfo : serverList) {
                    // 获取服务器ID作为唯一标识
                    String serverId = serverInfo.getId();
                    if (serverId == null || serverId.isEmpty()) {
                        continue; // 跳过没有ID的服务器
                    }

                    // 检查是否已存在（根据 marketId 和 serverId）
                    McpMarketTool existingTool = marketToolMapper.selectByMarketIdAndServerId(marketId, serverId);

                    // 获取工具名称（优先使用 title，其次使用 name）
                    String toolName = serverInfo.getTitle() != null && !serverInfo.getTitle().isEmpty()
                            ? serverInfo.getTitle()
                            : (serverInfo.getName() != null ? serverInfo.getName() : "");

                    // 获取描述
                    String description = serverInfo.getDescription() != null
                            ? serverInfo.getDescription()
                            : "";

                    // 构建完整的元数据
                    Map<String, Object> toolMetadata = new HashMap<>();
                    toolMetadata.put("id", serverId);
                    toolMetadata.put("name", serverInfo.getName() != null ? serverInfo.getName() : "");
                    toolMetadata.put("title", serverInfo.getTitle() != null ? serverInfo.getTitle() : "");
                    toolMetadata.put("description", description);
                    toolMetadata.put("author", serverInfo.getAuthor() != null ? serverInfo.getAuthor() : "");
                    toolMetadata.put("icon", serverInfo.getIcon() != null ? serverInfo.getIcon() : "");
                    toolMetadata.put("github_url", serverInfo.getGithubUrl() != null ? serverInfo.getGithubUrl() : "");
                    toolMetadata.put("orderBy", serverInfo.getOrderBy() != null ? serverInfo.getOrderBy() : 0);
                    toolMetadata.put("score", serverInfo.getScore() != null ? serverInfo.getScore() : "");
                    if (serverInfo.getCategory() != null) {
                        Map<String, Object> category = new HashMap<>();
                        category.put("id", serverInfo.getCategory().getId());
                        category.put("name", serverInfo.getCategory().getName());
                        category.put("label", serverInfo.getCategory().getLabel());
                        toolMetadata.put("category", category);
                    }

                    String metadataJson = objectMapper.writeValueAsString(toolMetadata);

                    if (existingTool != null) {
                        // 更新已存在的工具（保留加载状态）
                        existingTool.setToolName(toolName);
                        existingTool.setToolDescription(description);
                        existingTool.setToolMetadata(metadataJson);
                        // 不更新 isLoaded 和 localToolId，保留原有状态
                        marketToolMapper.updateById(existingTool);
                    } else {
                        // 添加新工具
                        McpMarketTool tool = McpMarketTool.builder()
                                .marketId(marketId)
                                .toolName(toolName)
                                .toolDescription(description)
                                .toolVersion(null) // API 响应中没有版本信息
                                .toolMetadata(metadataJson)
                                .isLoaded(false)
                                .createTime(LocalDateTime.now())
                                .build();
                        marketToolMapper.insert(tool);
                    }
                }

                // 判断是否还有更多数据
                int currentPageSize = serverList.size();
                if (currentPageSize < pageSize) {
                    // 返回的数据少于每页大小，说明已经是最后一页了
                    hasMore = false;
                } else {
                    // 还有更多数据，继续请求下一页
                    pageNumber++;
                }
            }
            return true;
        } catch (Exception e) {
            log.error("刷新市场工具列表失败", e);
        }
        return false;
    }

    @Override
    public boolean loadToolToLocal(Long marketToolId) {
        try {
            McpMarketTool marketTool = marketToolMapper.selectById(marketToolId);
            if (marketTool == null || marketTool.getIsLoaded()) {
                return false;
            }

            // 创建本地工具
            McpToolData localTool = McpToolData.builder()
                    .name(marketTool.getToolName())
                    .description(marketTool.getToolDescription())
                    .type(McpToolData.Type.REMOTE)
                    .status(McpToolData.Status.ENABLED)
                    .configJson(marketTool.getToolMetadata())
                    .build();

            // 保存本地工具
            McpToolService mcpToolService = applicationContext.getBean(McpToolService.class);
            McpToolData savedTool = mcpToolService.saveOrUpdateInfo(localTool);

            // 自动注册到 Spring AI MCP 系统
            try {
                McpToolRegistryService registryService = applicationContext.getBean(McpToolRegistryService.class);
                if (registryService.registerTool(savedTool)) {
                    log.info("工具加载后自动注册成功: {}", savedTool.getName());
                } else {
                    log.warn("工具加载后自动注册失败: {}", savedTool.getName());
                }
            } catch (Exception e) {
                log.error("工具加载后自动注册异常: {}", savedTool.getName(), e);
                // 注册失败不影响工具加载，继续执行
            }

            // 更新市场工具的加载状态
            marketToolMapper.updateLoadedStatus(marketToolId, true, savedTool.getId());

            return true;
        } catch (Exception e) {
            log.error("加载工具到本地失败", e);
            return false;
        }
    }

    @Override
    public int batchLoadToolsToLocal(List<Long> marketToolIds) {
        if (marketToolIds == null || marketToolIds.isEmpty()) {
            return 0;
        }

        int successCount = 0;
        McpToolService mcpToolService = applicationContext.getBean(McpToolService.class);

        for (Long marketToolId : marketToolIds) {
            try {
                McpMarketTool marketTool = marketToolMapper.selectById(marketToolId);
                if (marketTool == null || marketTool.getIsLoaded()) {
                    continue; // 跳过已加载或不存在的工具
                }

                // 创建本地工具
                McpToolData localTool = McpToolData.builder()
                        .name(marketTool.getToolName())
                        .description(marketTool.getToolDescription())
                        .type(McpToolData.Type.REMOTE)
                        .status(McpToolData.Status.ENABLED)
                        .configJson(marketTool.getToolMetadata())
                        .build();

                // 保存本地工具
                McpToolData savedTool = mcpToolService.saveOrUpdateInfo(localTool);

                // 更新市场工具的加载状态
                marketToolMapper.updateLoadedStatus(marketToolId, true, savedTool.getId());
                successCount++;
            } catch (Exception e) {
                log.error("批量加载工具失败: marketToolId={}", marketToolId, e);
                // 继续处理下一个工具，不中断批量操作
            }
        }

        return successCount;
    }
}

