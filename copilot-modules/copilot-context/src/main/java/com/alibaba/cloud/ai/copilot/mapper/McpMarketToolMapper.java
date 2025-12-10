package com.alibaba.cloud.ai.copilot.mapper;


import com.alibaba.cloud.ai.copilot.entity.McpMarketTool;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MCP 市场工具 Mapper 接口
 *
 * @author Administrator
 */
@Mapper
public interface McpMarketToolMapper extends BaseMapper<McpMarketTool> {

    /**
     * 根据市场ID查询工具列表
     *
     * @param marketId 市场ID
     * @return 工具列表
     */
    List<McpMarketTool> selectByMarketId(Long marketId);

    /**
     * 根据市场ID和加载状态查询工具列表
     *
     * @param marketId 市场ID
     * @param isLoaded 是否已加载
     * @return 工具列表
     */
    List<McpMarketTool> selectByMarketIdAndLoaded(Long marketId, Boolean isLoaded);

    /**
     * 更新工具的加载状态
     *
     * @param id       工具ID
     * @param isLoaded 是否已加载
     * @param localToolId 本地工具ID
     * @return 更新行数
     */
    int updateLoadedStatus(Long id, Boolean isLoaded, Long localToolId);

    /**
     * 根据市场ID和服务器ID查询工具（通过元数据中的id字段）
     *
     * @param marketId 市场ID
     * @param serverId 服务器ID（从元数据JSON中提取）
     * @return 工具实体
     */
    McpMarketTool selectByMarketIdAndServerId(@org.apache.ibatis.annotations.Param("marketId") Long marketId,
                                               @org.apache.ibatis.annotations.Param("serverId") String serverId);
}

