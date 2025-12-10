package com.alibaba.cloud.ai.copilot.controller;

import com.alibaba.cloud.ai.copilot.entity.McpToolData;
import com.alibaba.cloud.ai.copilot.service.McpToolService;
import jakarta.annotation.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP 工具管理控制器（REST API）
 *
 * @author Administrator
 */
@RestController
@RequestMapping("/api/mcp")
public class McpToolController {

    @Resource
    private McpToolService mcpToolService;

    /**
     * 获取工具列表
     */
    @GetMapping("/servers")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        List<McpToolData> tools;
        if (keyword != null && !keyword.isEmpty()) {
            tools = mcpToolService.searchByName(keyword);
        } else if (type != null && !type.isEmpty()) {
            tools = mcpToolService.listByType(type);
        } else if (status != null && !status.isEmpty()) {
            tools = mcpToolService.listByStatus(status);
        } else {
            tools = mcpToolService.listAll();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("data", tools);
        result.put("total", tools.size());
        return ResponseEntity.ok(result);
    }

    /**
     * 根据ID获取工具
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        McpToolData tool = mcpToolService.getById(id);
        Map<String, Object> result = new HashMap<>();
        if (tool == null) {
            result.put("success", false);
            result.put("message", "工具不存在");
            return ResponseEntity.notFound().build();
        }
        result.put("success", true);
        result.put("data", tool);
        return ResponseEntity.ok(result);
    }

    /**
     * 保存或更新工具
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> save(@RequestBody McpToolData tool) {
        Map<String, Object> result = new HashMap<>();
        try {
            McpToolData savedTool = mcpToolService.saveOrUpdateInfo(tool);
            result.put("success", true);
            result.put("message", "保存成功");
            result.put("data", savedTool);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "保存失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 更新工具
     */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable Long id, @RequestBody McpToolData tool) {
        Map<String, Object> result = new HashMap<>();
        try {
            tool.setId(id);
            McpToolData savedTool = mcpToolService.saveOrUpdateInfo(tool);
            result.put("success", true);
            result.put("message", "更新成功");
            result.put("data", savedTool);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "更新失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 删除工具
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        try {
            boolean success = mcpToolService.deleteById(id);
            if (success) {
                result.put("success", true);
                result.put("message", "删除成功");
            } else {
                result.put("success", false);
                result.put("message", "删除失败或工具不存在");
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "删除失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 批量删除工具
     */
    @DeleteMapping("/batch")
    public ResponseEntity<Map<String, Object>> deleteBatch(@RequestParam String ids) {
        Map<String, Object> result = new HashMap<>();
        try {
            List<Long> idList = Arrays.stream(ids.split(","))
                    .map(Long::parseLong)
                    .collect(Collectors.toList());
            boolean success = mcpToolService.deleteBatch(idList);
            if (success) {
                result.put("success", true);
                result.put("message", "批量删除成功");
            } else {
                result.put("success", false);
                result.put("message", "批量删除失败");
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "批量删除失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 更新工具状态
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        Map<String, Object> result = new HashMap<>();
        try {
            boolean success = mcpToolService.updateStatus(id, status);
            if (success) {
                result.put("success", true);
                result.put("message", "状态更新成功");
            } else {
                result.put("success", false);
                result.put("message", "状态更新失败");
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "状态更新失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }
}
