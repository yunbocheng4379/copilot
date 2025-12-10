package com.alibaba.cloud.ai.copilot.mapper;


import com.alibaba.cloud.ai.copilot.entity.McpToolData;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MCP 工具 Mapper 接口
 *
 * @author Administrator
 */
@Mapper
public interface McpToolMapper extends BaseMapper<McpToolData> {

    /**
     * 根据类型查询工具列表
     *
     * @param type 工具类型
     * @return 工具列表
     */
    List<McpToolData> selectByType(String type);

    /**
     * 根据状态查询工具列表
     *
     * @param status 状态
     * @return 工具列表
     */
    List<McpToolData> selectByStatus(String status);

    /**
     * 根据名称模糊查询
     *
     * @param name 工具名称
     * @return 工具列表
     */
    List<McpToolData> selectByNameLike(String name);
}

