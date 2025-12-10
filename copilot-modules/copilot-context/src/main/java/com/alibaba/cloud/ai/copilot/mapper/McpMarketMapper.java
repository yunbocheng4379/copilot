package com.alibaba.cloud.ai.copilot.mapper;


import com.alibaba.cloud.ai.copilot.entity.McpMarket;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MCP 市场 Mapper 接口
 *
 * @author Administrator
 */
@Mapper
public interface McpMarketMapper extends BaseMapper<McpMarket> {

    /**
     * 根据状态查询市场列表
     *
     * @param status 状态
     * @return 市场列表
     */
    List<McpMarket> selectByStatus(String status);

    /**
     * 根据名称模糊查询
     *
     * @param name 市场名称
     * @return 市场列表
     */
    List<McpMarket> selectByNameLike(String name);
}

