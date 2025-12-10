import React, {FC, useCallback, useEffect, useRef, useState, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {ConfigProvider, Button, Space, Tag, message, Popconfirm, Tooltip, Descriptions} from 'antd'
import {ProTable, LightFilter, ProFormText} from '@ant-design/pro-components'
import type {ProColumns, ActionType} from '@ant-design/pro-components'
import {
    EditOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    PlusOutlined,
    EyeOutlined,
    ReloadOutlined,
    ArrowLeftOutlined,
    DownloadOutlined
} from '@ant-design/icons'
import {SettingContainer, SettingGroup} from '..'
import useThemeStore from "@/stores/themeSlice"
import {
    fetchMcpMarkets,
    fetchMarketTools,
    refreshMarketTools,
    batchLoadTools,
    loadToolToLocal,
    updateMarketStatus,
    deleteMcpMarket
} from '@/api/mcpMarkets'
import AddMarketPopup from './AddMarketPopup'
import type {McpMarket, McpMarketTool} from '@/types/mcp'

interface NpxSearchProps {
    isActive?: boolean
}

const NpxSearch: FC<NpxSearchProps> = ({isActive = false}) => {
    const { isDarkMode } = useThemeStore()
    const { t } = useTranslation()
    const [markets, setMarkets] = useState<McpMarket[]>([])
    const [selectedMarket, setSelectedMarket] = useState<McpMarket | null>(null)
    const [marketTools, setMarketTools] = useState<McpMarketTool[]>([])
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [loading, setLoading] = useState(false)
    const [toolsLoading, setToolsLoading] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [refreshButtonDisabled, setRefreshButtonDisabled] = useState(false)
    const actionRef = useRef<ActionType>()
    const toolsActionRef = useRef<ActionType>()
    const formRef = useRef<any>()
    const toolsFormRef = useRef<any>()
    const forceRefreshRef = useRef(false)
    const hasFetchedOnceRef = useRef(false)
    const lastSearchKeywordRef = useRef<string | undefined>(undefined)
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 获取市场列表
    const fetchMarkets = useCallback(async (params?: { keyword?: string; status?: string }) => {
        try {
            setLoading(true)
            setFetchError(null)
            const data = await fetchMcpMarkets(params)
            setMarkets(data)
            return data
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load markets'
            setFetchError(errorMessage)
            console.error('Failed to load markets:', error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [])

    // 获取市场工具列表
    const fetchTools = useCallback(async (marketId: number, page: number = 1, size: number = 10) => {
        try {
            setToolsLoading(true)
            const response = await fetchMarketTools(marketId, page, size)
            setMarketTools(response.data)
            return response
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load tools'
            message.error(errorMessage)
            console.error('Failed to load tools:', error)
            throw error
        } finally {
            setToolsLoading(false)
        }
    }, [])

    // 初始化加载 - 移除，让 ProTable 的 request 统一处理

    // 处理详情点击
    const handleViewDetail = useCallback(async (market: McpMarket) => {
        // 检查市场状态，如果禁用则不允许查看详情
        if (market.status === 'DISABLED') {
            message.warning('该市场已禁用，请先启用后再查看详情')
            return
        }
        
        setSelectedMarket(market)
        setSelectedRowKeys([])
        // 加载工具列表
        await fetchTools(market.id, 1, 10)
    }, [fetchTools])

    // 处理返回
    const handleBack = useCallback(() => {
        setSelectedMarket(null)
        setMarketTools([])
        setSelectedRowKeys([])
    }, [])

    // 处理刷新工具列表
    const handleRefreshTools = useCallback(async () => {
        if (!selectedMarket || refreshButtonDisabled) return
        
        // 显示提示信息
        message.info('刷新工具列表需要较长时间，请稍后查看结果')
        
        // 禁用按钮
        setRefreshButtonDisabled(true)
        
        // 清除之前的计时器（如果有）
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current)
        }
        
        // 设置10分钟后重新启用按钮
        refreshTimerRef.current = setTimeout(() => {
            setRefreshButtonDisabled(false)
            refreshTimerRef.current = null
        }, 10 * 60 * 1000) // 10分钟 = 600000毫秒
        
        try {
            // 调用后端接口（不等待结果，因为是长时间任务）
            refreshMarketTools(selectedMarket.id).catch((error: any) => {
                // 静默处理错误，因为这是后台任务
                console.error('刷新工具列表失败:', error)
            })
        } catch (error: any) {
            console.error('刷新工具列表失败:', error)
        }
    }, [selectedMarket, refreshButtonDisabled])
    
    // 组件卸载时清除计时器
    useEffect(() => {
        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current)
            }
        }
    }, [])

    // 处理批量加载
    const handleBatchLoad = useCallback(async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录')
            return
        }

        try {
            // 调用后端批量加载接口
            const result = await batchLoadTools(selectedRowKeys as number[])
            if (result.success) {
                message.success(result.message || `成功加载 ${result.successCount || 0} 个工具`)
                // 重新加载工具列表
                if (selectedMarket) {
                    await fetchTools(selectedMarket.id, 1, 10)
                }
                setSelectedRowKeys([])
            } else {
                message.error(result.message || '批量加载失败')
            }
        } catch (error: any) {
            message.error(error.message || '批量加载失败')
        }
    }, [selectedRowKeys, selectedMarket, fetchTools])

    // 处理单个工具加载
    const handleLoadTool = useCallback(async (toolId: number) => {
        try {
            const result = await loadToolToLocal(toolId)
            message.success(result.message || '加载成功')
            // 重新加载工具列表
            if (selectedMarket) {
                await fetchTools(selectedMarket.id, 1, 10)
            }
        } catch (error: any) {
            message.error(error.message || '加载失败')
        }
    }, [selectedMarket, fetchTools])

    // 处理启用/禁用
    const handleToggleStatus = useCallback(async (id: number, currentStatus: 'ENABLED' | 'DISABLED') => {
        const newStatus = currentStatus === 'ENABLED' ? 'DISABLED' : 'ENABLED'
        const previousData = [...markets]
        
        // 乐观更新
        setMarkets(prevData => {
            return prevData.map(item =>
                item.id === id
                    ? { ...item, status: newStatus }
                    : item
            )
        })
        
        try {
            const result = await updateMarketStatus(id, newStatus)
            if (result.success) {
                message.success(result.message || `状态已${newStatus === 'ENABLED' ? '启用' : '禁用'}`)
                // 刷新表格
                actionRef.current?.reload()
            } else {
                // 回滚
                setMarkets(previousData)
                message.error(result.message || '状态更新失败')
            }
        } catch (error: any) {
            // 回滚
            setMarkets(previousData)
            message.error(error.message || '状态更新失败')
        }
    }, [markets])

    // 处理删除
    const handleDelete = useCallback(async (id: number) => {
        const previousData = [...markets]
        
        // 乐观更新
        setMarkets(prevData => prevData.filter(item => item.id !== id))
        
        try {
            const result = await deleteMcpMarket(id)
            if (result.success) {
                message.success(result.message || '删除成功')
                // 刷新表格
                actionRef.current?.reload()
            } else {
                // 回滚
                setMarkets(previousData)
                message.error(result.message || '删除失败')
            }
        } catch (error: any) {
            // 回滚
            setMarkets(previousData)
            message.error(error.message || '删除失败')
        }
    }, [markets])

    // 市场列表列定义
    const marketColumns: ProColumns<McpMarket>[] = useMemo(() => [
        {
            title: '市场名称',
            dataIndex: 'name',
            key: 'name',
            width: 120,
            ellipsis: true,
            hideInSearch: true,
        },
        {
            title: 'URL',
            dataIndex: 'url',
            key: 'url',
            width: 200,
            ellipsis: true,
            hideInSearch: true,
            render: (text: string) => (
                <a href={text} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 dark:text-purple-400">
                    {text}
                </a>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            align: 'center',
            valueType: 'select',
            valueEnum: {
                ENABLED: { text: '启用', status: 'Success' },
                DISABLED: { text: '禁用', status: 'Default' },
            },
            hideInSearch: true,
            filters: true,
            onFilter: (value, record) => {
                if (value === undefined || value === null) return true
                return record.status === value
            },
            render: (_, record: McpMarket) => {
                // 直接从 record 中获取 status，确保使用正确的值
                const status = record.status
                const isEnabled = status === 'ENABLED'
    return (
                    <Tag color={isEnabled ? 'green' : 'default'}>
                        {isEnabled ? '启用' : '禁用'}
                    </Tag>
                )
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            hideInSearch: true,
            align: 'center',
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title={record.status === 'DISABLED' ? '该市场已禁用，请先启用后再查看详情' : '详情'}>
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDetail(record)}
                            disabled={record.status === 'DISABLED'}
                        />
                    </Tooltip>
                    <Tooltip title="编辑">
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={async () => {
                                const result = await AddMarketPopup.show({ market: record })
                                if (result) {
                                    // 乐观更新：更新表格中对应的数据
                                    setMarkets(prevData => {
                                        const updated = prevData.map(item => 
                                            item.id === record.id ? (result as McpMarket) : item
                                        )
                                        return updated
                                    })
                                    // 刷新表格
                                    actionRef.current?.reload()
                                }
                            }}
                        />
                    </Tooltip>
                    <Tooltip title={record.status === 'ENABLED' ? '禁用' : '启用'}>
                        <Button
                            type="link"
                            size="small"
                            icon={record.status === 'ENABLED' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            onClick={() => handleToggleStatus(record.id, record.status)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="确定要删除吗？"
                        onConfirm={() => handleDelete(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Tooltip title="删除">
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [handleViewDetail, handleToggleStatus, handleDelete])

    // 工具列表列定义
    const toolColumns: ProColumns<McpMarketTool>[] = useMemo(() => [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
            hideInSearch: true,
        },
        {
            title: '工具名称',
            dataIndex: 'toolName',
            key: 'toolName',
            width: 200,
            ellipsis: true,
            hideInSearch: true,
        },
        {
            title: '描述',
            dataIndex: 'toolDescription',
            key: 'toolDescription',
            width: 300,
            ellipsis: true,
            hideInSearch: true,
            render: (text: string) => text || <span className="italic text-gray-400">无描述</span>,
        },
        {
            title: '已加载',
            dataIndex: 'isLoaded',
            key: 'isLoaded',
            width: 100,
            align: 'center',
            hideInSearch: true,
            render: (isLoaded: boolean) => (
                <Tag color={isLoaded ? 'green' : 'default'}>
                    {isLoaded ? '是' : '否'}
                </Tag>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            width: 180,
            hideInSearch: true,
            align: 'center',
            render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            hideInSearch: true,
            align: 'center',
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    {record.isLoaded ? (
                        <span className="text-gray-400">已加载</span>
                    ) : (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => handleLoadTool(record.id)}
                        >
                            加载到本地
                        </Button>
                    )}
                </Space>
            ),
        },
    ], [handleLoadTool])

    // 如果选中了市场，显示详情页面
    if (selectedMarket) {
        return (
            <ConfigProvider
                theme={{
                    token: {
                        colorPrimary: '#9333EA',
                        colorPrimaryHover: '#A855F7',
                        colorPrimaryActive: '#7E22CE',
                        colorLink: '#9333EA',
                        colorLinkHover: '#A855F7',
                        colorLinkActive: '#7E22CE',
                    },
                    components: {
                        Button: {
                            colorPrimary: '#9333EA',
                            colorPrimaryHover: '#A855F7',
                            colorPrimaryActive: '#7E22CE',
                            borderRadius: 8,
                        },
                        Tag: {
                            borderRadiusSM: 12,
                        },
                    },
                }}
            >
                <SettingContainer theme={isDarkMode ? 'dark' : 'light'}>
                    <SettingGroup theme={isDarkMode ? 'dark' : 'light'}>
                        {/* 市场详情 */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold">市场详情: {selectedMarket.name}</h2>
                                <Space>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={handleRefreshTools}
                                        disabled={refreshButtonDisabled}
                                        loading={toolsLoading}
                                    >
                                        {refreshButtonDisabled ? '刷新中（请稍候）' : '刷新工具列表'}
                                    </Button>
                                    <Button
                                        icon={<ArrowLeftOutlined />}
                                        onClick={handleBack}
                                    >
                                        返回
                                    </Button>
                                </Space>
                            </div>
                            <Descriptions column={1} bordered>
                                <Descriptions.Item label="市场名称">{selectedMarket.name}</Descriptions.Item>
                                <Descriptions.Item label="URL">
                                    <a href={selectedMarket.url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 dark:text-purple-400">
                                        {selectedMarket.url}
                                    </a>
                                </Descriptions.Item>
                                <Descriptions.Item label="描述">
                                    {selectedMarket.description || <span className="italic text-gray-400">无描述</span>}
                                </Descriptions.Item>
                                <Descriptions.Item label="状态">
                                    <Tag color={selectedMarket.status === 'ENABLED' ? 'green' : 'default'}>
                                        {selectedMarket.status === 'ENABLED' ? '启用' : '禁用'}
                                    </Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="创建时间">
                                    {selectedMarket.createTime ? new Date(selectedMarket.createTime).toLocaleString('zh-CN') : '-'}
                                </Descriptions.Item>
                            </Descriptions>
                </div>

                        {/* 工具列表 */}
                        <div className="w-full" style={{ margin: '0 -28px', padding: '0 28px' }}>
                            <ProTable<McpMarketTool>
                                actionRef={toolsActionRef}
                                columns={toolColumns}
                                rowKey="id"
                                formRef={toolsFormRef}
                                request={async (params) => {
                                    try {
                                        const response = await fetchTools(
                                            selectedMarket.id,
                                            params.current || 1,
                                            params.pageSize || 10
                                        )
                                        return {
                                            data: response.data,
                                            success: true,
                                            total: response.total,
                                        }
                                    } catch (error) {
                                        return {
                                            data: [],
                                            success: false,
                                            total: 0,
                                        }
                                    }
                                }}
                                rowSelection={{
                                    selectedRowKeys,
                                    onChange: (keys) => {
                                        setSelectedRowKeys(keys)
                                    },
                                    getCheckboxProps: (record) => ({
                                        disabled: record.isLoaded, // 已加载的工具不能选择
                                    }),
                                }}
                                options={{
                                    reload: true,
                                }}
                                search={false}
                                headerTitle="工具列表"
                                toolBarRender={() => [
                                    <Button
                                        key="batchLoad"
                                        type="primary"
                                        icon={<DownloadOutlined />}
                                        disabled={selectedRowKeys.length === 0}
                                        onClick={handleBatchLoad}
                                    >
                                        批量加载到本地
                                    </Button>,
                                ]}
                                tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => {
                                    return (
                                        <Space size={16}>
                                            <span>
                                                已选 {selectedRowKeys.length} 项
                                            </span>
                                            <a onClick={onCleanSelected}>取消选择</a>
                                        </Space>
                                    )
                                }}
                                pagination={{
                                    pageSize: 10,
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    showTotal: (total) => `共 ${total} 条`,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                }}
                                loading={toolsLoading}
                                size="middle"
                                className="market-table"
                                style={{
                                    paddingTop: 0,
                                }}
                                scroll={{
                                    x: 'max-content',
                                }}
                            />
                        </div>
                    </SettingGroup>
                </SettingContainer>
            </ConfigProvider>
        )
    }

    // 市场列表页面
    return (
        <>
            <style>{`
                .market-table .ant-pro-card .ant-pro-card-body {
                    padding-inline: 0 !important;
                }
                .market-table .ant-pro-query-filter.ant-pro-query-filter {
                    padding: 12px !important;
                }
                .market-table .ant-pro-table-list-toolbar {
                    margin-bottom: 8px !important;
                    padding-bottom: 0 !important;
                }
                .market-table .ant-pro-table-search {
                    margin-bottom: 8px !important;
                    padding-bottom: 0 !important;
                }
                .market-table .ant-form {
                    margin-bottom: 8px !important;
                }
                .market-table .ant-pro-table-list-toolbar-container {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
                .market-table .ant-pro-table-search-query {
                    margin-bottom: 0 !important;
                }
                .market-table .ant-pro-table-search-query-row {
                    margin-bottom: 8px !important;
                }
                .market-table .ant-pro-table-search-query-row:last-child {
                    margin-bottom: 0 !important;
                }
                .market-table .ant-pro-table-search-query-form {
                    margin-bottom: 0 !important;
                }
                .market-table .ant-pro-table-search-query-form .ant-form-item {
                    margin-bottom: 8px !important;
                }
                .market-table .ant-pro-table-search-query-form .ant-form-item:last-child {
                    margin-bottom: 0 !important;
                }
            `}</style>
            <ConfigProvider
                theme={{
                    token: {
                        colorPrimary: '#9333EA',
                        colorPrimaryHover: '#A855F7',
                        colorPrimaryActive: '#7E22CE',
                        colorLink: '#9333EA',
                        colorLinkHover: '#A855F7',
                        colorLinkActive: '#7E22CE',
                    },
                    components: {
                        Button: {
                            colorPrimary: '#9333EA',
                            colorPrimaryHover: '#A855F7',
                            colorPrimaryActive: '#7E22CE',
                            borderRadius: 8,
                        },
                        Tag: {
                            borderRadiusSM: 12,
                        },
                    },
                }}
            >
                <SettingContainer theme={isDarkMode ? 'dark' : 'light'}>
                    <SettingGroup theme={isDarkMode ? 'dark' : 'light'}>
                        {fetchError && (
                            <div className="mb-2 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/40 dark:bg-red-900/20 dark:text-red-200">
                                <span>{fetchError}</span>
                    <button 
                                    onClick={() => fetchMarkets()}
                                    className="text-xs font-medium underline underline-offset-4"
                    >
                                    重试
                    </button>
                </div>
                        )}
                        <div className="w-full" style={{ margin: '0 -28px', padding: '0 28px' }}>
                            <ProTable<McpMarket>
                            actionRef={actionRef}
                            columns={marketColumns}
                            rowKey="id"
                            formRef={formRef}
                            request={async (params, sort, filter) => {
                                // 从 formRef 中获取 LightFilter 的值
                                const formValues = formRef.current?.getFieldsValue?.() || {}
                                // 处理空字符串，转换为 undefined（空字符串表示清除搜索，应该获取全部数据）
                                const nameKeyword = formValues.keyword?.trim() || undefined
                                
                                // 检查是否需要强制刷新（搜索值发生变化时）
                                const needForceRefresh = forceRefreshRef.current
                                forceRefreshRef.current = false // 重置标志
                                
                                // 检查是否有搜索或筛选参数
                                const hasSearchParams = nameKeyword || 
                                    (filter && filter.status) ||
                                    (params.current && params.current > 1)
                                
                                // 如果没有搜索参数且 markets 有数据且是第一页，且不需要强制刷新，直接返回（支持乐观更新）
                                // 但如果有列筛选，或者需要强制刷新，仍然需要请求服务器
                                const hasColumnFilter = filter && filter.status
                                // 首次加载时，如果 markets 为空，需要请求
                                const isFirstLoad = !hasFetchedOnceRef.current && markets.length === 0
                                if (!isFirstLoad && !hasSearchParams && !hasColumnFilter && !needForceRefresh && markets.length > 0 && (!params.current || params.current === 1)) {
                                    return {
                                        data: markets,
                                        success: true,
                                        total: markets.length,
                                    }
                                }
                                
                                // 标记已加载
                                if (!hasFetchedOnceRef.current) {
                                    hasFetchedOnceRef.current = true
                                }
                                
                                try {
                                    setFetchError(null)
                                    const statusFilter = filter?.status as string[] | string | undefined
                                    
                                    const data = await fetchMarkets({
                                        keyword: nameKeyword || undefined, // 市场名称模糊搜索，如果为空则传递 undefined 获取全部数据
                                        status: Array.isArray(statusFilter) ? statusFilter[0] : statusFilter,
                                    })
                                    // 更新本地 markets 状态
                                    setMarkets(data)
                                    return {
                                        data,
                                        success: true,
                                        total: data.length,
                                    }
                                } catch (error) {
                                    return {
                                        data: markets.length > 0 ? markets : [],
                                        success: false,
                                        total: markets.length,
                                    }
                                }
                            }}
                            options={{
                                reload: true,
                            }}
                            search={false}
                            toolbar={{
                                title: 'MCP 市场管理',
                                filter: (
                                    <LightFilter
                                        formRef={formRef}
                                        onValuesChange={(values) => {
                                            // 当搜索值改变时（包括清除），触发表格重新加载
                                            const currentKeyword = values.keyword?.trim() || undefined
                                            const previousKeyword = lastSearchKeywordRef.current
                                            
                                            // 如果搜索值发生变化，标记需要强制刷新
                                            if (previousKeyword !== currentKeyword) {
                                                forceRefreshRef.current = true
                                                // 更新上一次的搜索值
                                                lastSearchKeywordRef.current = currentKeyword
                                                // 延迟一下确保 formRef 已更新，然后强制重新加载
                                                setTimeout(() => {
                                                    actionRef.current?.reload()
                                                }, 0)
                                            }
                                        }}
                                    >
                                        <ProFormText
                                            name="keyword"
                                            label="市场名称"
                                            placeholder="请输入市场名称（模糊搜索）"
                                            fieldProps={{
                                                allowClear: true,
                                            }}
                                        />
                                    </LightFilter>
                                ),
                                actions: [
                                    <Button
                                        key="add"
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={async () => {
                                            const result = await AddMarketPopup.show()
                                            if (result) {
                                                // 乐观更新：将新添加的数据添加到表格
                                                setMarkets(prevData => {
                                                    const updated = [...prevData, result as McpMarket]
                                                    return updated
                                                })
                                                // 刷新表格
                                                actionRef.current?.reload()
                                            }
                                        }}
                                    >
                                        添加市场
                                    </Button>,
                                ],
                            }}
                            pagination={{
                                pageSize: 10,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total) => `共 ${total} 条`,
                                pageSizeOptions: ['10', '20', '50', '100'],
                            }}
                            loading={loading}
                            size="middle"
                            className="market-table"
                            style={{
                                paddingTop: 0,
                            }}
                            scroll={{
                                x: 'max-content',
                            }}
                        />
            </div>
        </SettingGroup>
            </SettingContainer>
        </ConfigProvider>
        </>
    )
}

export default NpxSearch
