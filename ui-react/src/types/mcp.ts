export type MCPArgType = 'string' | 'list' | 'number'
export type MCPEnvType = 'string' | 'number'
export type MCPArgParameter = { [key: string]: MCPArgType }
export type MCPEnvParameter = { [key: string]: MCPEnvType }

export interface MCPServerParameter {
    name: string
    type: MCPArgType | MCPEnvType
    description: string
}

export interface MCPServer {
    name: string
    description?: string
    baseUrl?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    isActive: boolean
}

export interface MCPToolInputSchema {
    type: string
    title: string
    description?: string
    required?: string[]
    properties: Record<string, object>
}

export interface MCPTool {
    id: `${string}.${string}`
    serverName: string
    name: string
    description?: string
    inputSchema: MCPToolInputSchema
}

export interface MCPToolResponse {
    id: string // tool call id, it should be unique
    tool: MCPTool // tool info
    status: string // 'invoking' | 'done'
    response?: any
}

/**
 * MCP 工具类型
 */
export type MCPToolType = 'LOCAL' | 'REMOTE'

/**
 * MCP 工具状态
 */
export type MCPToolStatus = 'ENABLED' | 'DISABLED'

/**
 * 后端返回的 MCP 工具数据
 */
export interface McpToolData {
    id: number
    name: string
    description: string | null
    type: MCPToolType
    status: MCPToolStatus
    configJson: string | null
    createTime: string
    updateTime: string
}

/**
 * 后端 API 响应格式
 */
export interface McpServerListResponse {
    total: number
    data: McpToolData[]
    success: boolean
}

/**
 * MCP 市场实体
 */
export interface McpMarket {
    id: number
    name: string
    url: string
    description: string | null
    authConfig: string | null
    status: 'ENABLED' | 'DISABLED'
    createTime: string
    updateTime: string
}

/**
 * MCP 市场工具实体
 */
export interface McpMarketTool {
    id: number
    marketId: number
    toolName: string
    toolDescription: string | null
    toolVersion: string | null
    toolMetadata: string | null
    isLoaded: boolean
    localToolId: number | null
    createTime: string
}

/**
 * 市场列表响应
 */
export interface McpMarketListResponse {
    success: boolean
    data: McpMarket[]
    total: number
}

/**
 * 市场工具列表响应
 */
export interface McpMarketToolListResponse {
    success: boolean
    data: McpMarketTool[]
    total: number
    page: number
    size: number
    pages: number
}