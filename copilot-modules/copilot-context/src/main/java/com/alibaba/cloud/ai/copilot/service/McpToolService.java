package com.alibaba.cloud.ai.copilot.service;


import com.alibaba.cloud.ai.copilot.entity.McpToolData;

import java.util.List;

/**
 * MCP 工具服务接口
 *
 * @author Administrator
 */
public interface McpToolService {

    /**
     * 保存或更新工具
     *
     * @param tool 工具实体
     * @return 保存后的工具
     */
    McpToolData saveOrUpdateInfo(McpToolData tool);

    /**
     * 根据ID查询工具
     *
     * @param id 工具ID
     * @return 工具实体
     */
    McpToolData getById(Long id);

    /**
     * 查询所有工具
     *
     * @return 工具列表
     */
    List<McpToolData> listAll();

    /**
     * 根据类型查询工具
     *
     * @param type 工具类型
     * @return 工具列表
     */
    List<McpToolData> listByType(String type);

    /**
     * 根据状态查询工具
     *
     * @param status 状态
     * @return 工具列表
     */
    List<McpToolData> listByStatus(String status);

    /**
     * 根据名称模糊查询
     *
     * @param name 工具名称
     * @return 工具列表
     */
    List<McpToolData> searchByName(String name);

    /**
     * 删除工具
     *
     * @param id 工具ID
     * @return 是否删除成功
     */
    boolean deleteById(Long id);

    /**
     * 批量删除工具
     *
     * @param ids 工具ID列表
     * @return 是否删除成功
     */
    boolean deleteBatch(List<Long> ids);

    /**
     * 更新工具状态
     *
     * @param id     工具ID
     * @param status 状态
     * @return 是否更新成功
     */
    boolean updateStatus(Long id, String status);
}

