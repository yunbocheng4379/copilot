import React, {FC, useCallback, useEffect, useRef, useState, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {ConfigProvider, Button, Space, Tag, message, Popconfirm, Tooltip, Modal, Descriptions} from 'antd'
import {ProTable, LightFilter, ProFormText} from '@ant-design/pro-components'
import type {ProColumns, ActionType} from '@ant-design/pro-components'
import {
    EditOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    ExperimentOutlined,
    PlusOutlined,
    FileTextOutlined,
    EyeOutlined
} from '@ant-design/icons'
import {SettingContainer, SettingDivider, SettingGroup, SettingTitle} from '..'
import AddMcpServerPopup from './AddMcpServerPopup'
import EditMcpJsonPopup from './EditMcpJsonPopup'
import InstallNpxUv from './InstallNpxUv'
import useThemeStore from "@/stores/themeSlice"
import useMCPStore from "@/stores/useMCPSlice"
import classNames from 'classnames'
import {
    fetchMcpServers,
    deleteMcpServer,
    updateMcpServerStatus,
    testMcpTool,
    batchDeleteMcpServers
} from '@/api/mcpServers'
import type {McpToolData} from '@/types/mcp'

type MCPBrowserWindow = Window & {
    electron?: unknown
    myAPI?: {
        mcp?: {
            deleteServer?: (name: string) => Promise<void>
            setServerActive?: (name: string, isActive: boolean) => Promise<void>
        }
    }
}

const getBridgeWindow = (): MCPBrowserWindow | null => {
    if (typeof window === 'undefined') {
        return null
    }
    return window as MCPBrowserWindow
}

interface MCPSettingsProps {
    isActive?: boolean
}

const MCPSettings: FC<MCPSettingsProps> = ({isActive = false}) => {
    const { t } = useTranslation()
    const { isDarkMode } = useThemeStore()
    const servers = useMCPStore(state => state.servers)
    const setServers = useMCPStore(state => state.setServers)
    const deleteServer = useMCPStore(state => state.deleteServer)
    const setServerActive = useMCPStore(state => state.setServerActive)
    // 使用对象来区分不同操作的 loading 状态
    const [loadingStates, setLoadingStates] = useState<{
        status?: number | null
        test?: number | null
    }>({})
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [detailModalVisible, setDetailModalVisible] = useState(false)
    const [detailRecord, setDetailRecord] = useState<McpToolData | null>(null)
    const [tableData, setTableData] = useState<McpToolData[]>([])
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const tableDataRef = useRef<McpToolData[]>([])
    const actionRef = useRef<ActionType>()
    const formRef = useRef<any>()
    const hasFetchedOnceRef = useRef(false)
    const lastSearchKeywordRef = useRef<string | undefined>(undefined)
    const forceRefreshRef = useRef(false)

    const fetchRemoteServers = useCallback(async (params?: {
        keyword?: string
        type?: string
        status?: string
    }) => {
        try {
            const remoteServers = await fetchMcpServers(params)
            // 为了兼容旧的 store，将新数据转换为旧格式
            const convertedServers = remoteServers.map(tool => ({
                name: tool.name,
                description: tool.description || undefined,
                isActive: tool.status === 'ENABLED',
                id: tool.id
            }))
            setServers(convertedServers as any)
            // 更新本地表格数据
            setTableData(remoteServers)
            tableDataRef.current = remoteServers
            return remoteServers
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load MCP servers'
            setFetchError(errorMessage)
            console.error('Failed to load MCP servers:', error)
            throw error
        }
    }, [setServers])

    // 移除 useEffect 中的初始请求，让 ProTable 的 request 函数来处理初始加载
    // 这样可以避免重复请求

    const handleDelete = useCallback(async (id: number) => {
        try {
            const result = await deleteMcpServer(id)
            if (result.success) {
                message.success(result.message || t('settings.mcp.deleteSuccess'))
                // 乐观更新：从本地数据中移除已删除的项
                setTableData(prevData => {
                    const updated = prevData.filter(item => item.id !== id)
                    tableDataRef.current = updated
                    // 同步更新 store
                    const convertedServers = updated.map(tool => ({
                        name: tool.name,
                        description: tool.description || undefined,
                        isActive: tool.status === 'ENABLED',
                        id: tool.id
                    }))
                    setServers(convertedServers as any)
                    return updated
                })
            } else {
                message.error(result.message || t('settings.mcp.deleteError'))
            }
        } catch (error: any) {
            message.error(error.message || `${t('settings.mcp.deleteError')}: ${error.message}`)
        }
    }, [setServers, t])

    const handleBatchDelete = useCallback(async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录')
            return
        }

        try {
            const result = await batchDeleteMcpServers(selectedRowKeys as (number | string)[])
            if (result.success) {
                message.success(result.message || '批量删除成功')
                // 乐观更新：从本地数据中移除已删除的项
                setTableData(prevData => {
                    const updated = prevData.filter(item => !selectedRowKeys.includes(item.id))
                    tableDataRef.current = updated
                    // 同步更新 store
                    const convertedServers = updated.map(tool => ({
                        name: tool.name,
                        description: tool.description || undefined,
                        isActive: tool.status === 'ENABLED',
                        id: tool.id
                    }))
                    setServers(convertedServers as any)
                    return updated
                })
                // 清空选择
                setSelectedRowKeys([])
            } else {
                message.error(result.message || '批量删除失败')
            }
        } catch (error: any) {
            message.error(error.message || `批量删除失败: ${error.message}`)
        }
    }, [selectedRowKeys, setServers])

    const handleTest = async (id: number) => {
        setLoadingStates(prev => ({ ...prev, test: id }))
        try {
            const result = await testMcpTool(id)
            if (result.success) {
                alert('测试成功: ' + result.message)
            } else {
                alert('测试失败: ' + result.message)
            }
        } catch (error: any) {
            alert('测试失败: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, test: null }))
        }
    }

    const handleToggleActive = useCallback(async (id: number, currentStatus: 'ENABLED' | 'DISABLED') => {
        // 乐观更新：先更新本地状态
        const newStatus = currentStatus === 'ENABLED' ? 'DISABLED' : 'ENABLED'
        let previousData: McpToolData[] = []
        
        // 立即更新本地状态，实现乐观更新
        setTableData(prevData => {
            previousData = [...prevData]
            const updated = prevData.map(item => 
                item.id === id 
                    ? { ...item, status: newStatus as 'ENABLED' | 'DISABLED' }
                    : item
            )
            tableDataRef.current = updated
            return updated
        })
        
        setLoadingStates(prev => ({ ...prev, status: id }))
        
        try {
            const result = await updateMcpServerStatus(id, newStatus)
            if (result.success) {
                message.success(result.message || `状态已${newStatus === 'ENABLED' ? '启用' : '禁用'}`)
                // 同步更新 store
                setTableData(prevData => {
                    const convertedServers = prevData.map(tool => ({
                        name: tool.name,
                        description: tool.description || undefined,
                        isActive: tool.status === 'ENABLED',
                        id: tool.id
                    }))
                    setServers(convertedServers as any)
                    return prevData
                })
            } else {
                // 回滚状态
                setTableData(previousData)
                tableDataRef.current = previousData
                message.error(result.message || '状态更新失败')
            }
        } catch (error: any) {
            // 回滚状态
            setTableData(previousData)
            tableDataRef.current = previousData
            message.error(error.message || `${t('settings.mcp.toggleError')}: ${error.message}`)
        } finally {
            setLoadingStates(prev => ({ ...prev, status: null }))
        }
    }, [setServers, t])

    // 定义表格列 - 使用 useMemo 优化性能
    const columns: ProColumns<McpToolData>[] = useMemo(() => [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 150,
            ellipsis: true,
            hideInTable: false,
            hideInSearch: true, // 不在搜索区域显示，使用 toolbar filter
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            align: 'center',
            valueType: 'select',
            valueEnum: {
                REMOTE: { text: '远程', status: 'Default' },
                LOCAL: { text: '本地', status: 'Default' },
            },
            hideInSearch: true, // 不在搜索区域显示，只在列中筛选
            filters: true,
            onFilter: true,
            render: (_, record) => {
                const type = record.type
                return (
                    <Tag color={type === 'REMOTE' ? 'blue' : 'cyan'}>
                        {type === 'REMOTE' ? '远程' : '本地'}
                    </Tag>
                )
            },
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            width: 300,
            hideInSearch: true,
            hideInTable: true,
            ellipsis: {
                showTitle: false,
            },
            render: (text: string) => text || <span className="italic text-gray-400">无描述</span>,
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
            hideInSearch: true, // 不在搜索区域显示，只在列中筛选
            filters: true,
            onFilter: true,
            render: (_, record) => {
                // 直接从 record 获取状态值，确保是 ENABLED 或 DISABLED
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
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            width: 180,
            hideInSearch: true,
            hideInTable: true,
            align: 'center',
            render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
        },
        {
            title: '更新时间',
            dataIndex: 'updateTime',
            key: 'updateTime',
            width: 180,
            hideInSearch: true,
            hideInTable: true,
            align: 'center',
            render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            hideInSearch: true,
            align: 'center',
            fixed: 'right',
            render: (_, record) => {
                // 直接从 record 获取状态值，确保是 ENABLED 或 DISABLED
                const currentStatus = (record.status === 'ENABLED' || record.status === 'DISABLED') 
                    ? record.status as 'ENABLED' | 'DISABLED' 
                    : 'ENABLED'  // 默认启用状态
                const isEnabled = currentStatus === 'ENABLED'
                return (
                    <Space size="small">
                        <Tooltip title="查看详情">
                            <Button
                                type="link"
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => {
                                    setDetailRecord(record)
                                    setDetailModalVisible(true)
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="编辑">
                            <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={async () => {
                                    try {
                                        const result = await AddMcpServerPopup.show({ server: record })
                                        if (result && (result as McpToolData).id) {
                                            // 乐观更新：更新表格中对应的数据
                                            setTableData(prevData => {
                                                const updatedData = prevData.map(item => 
                                                    item.id === record.id 
                                                        ? (result as McpToolData)
                                                        : item
                                                )
                                                tableDataRef.current = updatedData
                                                // 同步更新 store
                                                const convertedServers = updatedData.map(tool => ({
                                                    name: tool.name,
                                                    description: tool.description || undefined,
                                                    isActive: tool.status === 'ENABLED',
                                                    id: tool.id
                                                }))
                                                setServers(convertedServers as any)
                                                return updatedData
                                            })
                                        }
                                    } catch (error: any) {
                                        // 错误已在 AddMcpServerPopup 中处理，这里不需要额外处理
                                        console.error('编辑 MCP 服务器失败:', error)
                                    }
                                }}
                            />
                        </Tooltip>
                        <Tooltip title={isEnabled ? '禁用' : '启用'}>
                            <Button
                                type="link"
                                size="small"
                                icon={isEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                                loading={loadingStates.status === record.id}
                                onClick={() => handleToggleActive(record.id, currentStatus)}
                            />
                        </Tooltip>
                        <Tooltip title="测试">
                            <Button
                                type="link"
                                size="small"
                                icon={<ExperimentOutlined />}
                                loading={loadingStates.test === record.id}
                                onClick={() => handleTest(record.id)}
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
                )
            },
        },
    ], [loadingStates, handleToggleActive, handleDelete, handleTest, setServers])

    return (
        <>
            <style>{`
                .mcp-table .ant-pro-card .ant-pro-card-body {
                    padding-inline: 0 !important;
                }
                .mcp-table .ant-pro-query-filter.ant-pro-query-filter {
                    padding: 12px !important;
                }
                .mcp-table .ant-pro-table-list-toolbar {
                    margin-bottom: 8px !important;
                    padding-bottom: 0 !important;
                }
                .mcp-table .ant-pro-table-search {
                    margin-bottom: 8px !important;
                    padding-bottom: 0 !important;
                }
                .mcp-table .ant-form {
                    margin-bottom: 8px !important;
                }
                .mcp-table .ant-pro-table-list-toolbar-container {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
                .mcp-table .ant-pro-table-search-query {
                    margin-bottom: 0 !important;
                }
                .mcp-table .ant-pro-table-search-query-row {
                    margin-bottom: 8px !important;
                }
                .mcp-table .ant-pro-table-search-query-row:last-child {
                    margin-bottom: 0 !important;
                }
                .mcp-table .ant-pro-table-search-query-form {
                    margin-bottom: 0 !important;
                }
                .mcp-table .ant-pro-table-search-query-form .ant-form-item {
                    margin-bottom: 8px !important;
                }
                .mcp-table .ant-pro-table-search-query-form .ant-form-item:last-child {
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
            <InstallNpxUv />
            <SettingGroup theme={isDarkMode ? 'dark' : 'light'}>

                {fetchError && (
                    <div className="mb-2 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/40 dark:bg-red-900/20 dark:text-red-200">
                        <span>{fetchError}</span>
                        <button
                            onClick={() => fetchRemoteServers()}
                            className="text-xs font-medium underline underline-offset-4"
                        >
                            重试
                        </button>
                    </div>
                )}
                <div className="w-full" style={{ margin: '0 -28px', padding: '0 28px' }}>
                    <ProTable<McpToolData>
                        actionRef={actionRef}
                        columns={columns}
                        rowKey="id"
                        dataSource={tableData}
                        formRef={formRef}
                        request={async (params, sort, filter) => {
                            // 从 formRef 中获取 LightFilter 的值
                            const formValues = formRef.current?.getFieldsValue?.() || {}
                            // 处理空字符串，转换为 undefined（空字符串表示清除搜索，应该获取全部数据）
                            const nameKeyword = formValues.name?.trim() || params.name?.trim() || undefined
                            
                            // 检查是否需要强制刷新（搜索值发生变化时）
                            const needForceRefresh = forceRefreshRef.current
                            forceRefreshRef.current = false // 重置标志
                            
                            // 检查是否有搜索或筛选参数
                            const hasSearchParams = nameKeyword || 
                                (filter && (filter.type || filter.status)) ||
                                (params.current && params.current > 1) // 分页也算需要请求
                            
                            // 检查是否有列筛选
                            const hasColumnFilter = filter && (filter.type || filter.status)
                            
                            // 如果没有搜索参数且 tableData 有数据且是第一页，且不需要强制刷新，直接返回（支持乐观更新）
                            // 但如果有列筛选，或者需要强制刷新，或者首次加载（tableData 为空），仍然需要请求服务器
                            if (!hasSearchParams && !hasColumnFilter && !needForceRefresh && tableData.length > 0 && (!params.current || params.current === 1)) {
                                // 直接返回本地数据（乐观更新）
                                return {
                                    data: tableData,
                                    success: true,
                                    total: tableData.length,
                                }
                            }
                            
                            // 标记首次加载已完成
                            if (!hasFetchedOnceRef.current) {
                                hasFetchedOnceRef.current = true
                            }
                            
                            try {
                                setFetchError(null)
                                // 从 filter 中获取类型和状态的筛选值
                                const typeFilter = filter?.type as string[] | string | undefined
                                const statusFilter = filter?.status as string[] | string | undefined
                                
                                const data = await fetchRemoteServers({
                                    keyword: nameKeyword || undefined, // 工具名模糊搜索，如果为空则传递 undefined 获取全部数据
                                    type: Array.isArray(typeFilter) ? typeFilter[0] : typeFilter,
                                    status: Array.isArray(statusFilter) ? statusFilter[0] : statusFilter,
                                })
                                // 更新本地表格数据
                                setTableData(data)
                                tableDataRef.current = data
                                return {
                                    data,
                                    success: true,
                                    total: data.length,
                                }
                            } catch (error) {
                                return {
                                    data: tableData.length > 0 ? tableData : [],
                                    success: false,
                                    total: tableData.length,
                                }
                            }
                        }}
                        rowSelection={{
                            selectedRowKeys,
                            onChange: (keys) => {
                                setSelectedRowKeys(keys)
                            },
                            getCheckboxProps: (record) => ({
                                name: record.name,
                            }),
                        }}
                        options={{
                            reload: true,
                        }}
                        search={false}
                        toolbar={{
                            title: 'MCP 服务器',
                            filter: (
                                <LightFilter
                                    formRef={formRef}
                                    onValuesChange={(values) => {
                                        // 当搜索值改变时（包括清除），触发表格重新加载
                                        const currentKeyword = values.name?.trim() || undefined
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
                                        name="name"
                                        label="工具名"
                                        placeholder="请输入（模糊搜索）"
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
                                        const result = await AddMcpServerPopup.show()
                                        if (result) {
                                            // 乐观更新：将新添加的数据添加到表格
                                            setTableData(prevData => {
                                                const updated = [...prevData, result as McpToolData]
                                                tableDataRef.current = updated
                                                // 同步更新 store
                                                const convertedServers = updated.map(tool => ({
                                                    name: tool.name,
                                                    description: tool.description || undefined,
                                                    isActive: tool.status === 'ENABLED',
                                                    id: tool.id
                                                }))
                                                setServers(convertedServers as any)
                                                return updated
                                            })
                                            // 刷新表格
                                            actionRef.current?.reload()
                                        }
                                    }}
                                >
                                    添加
                                </Button>,
                            ],
                        }}
                        tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => {
                            return (
                                <Space size={16}>
                                    <span>
                                        已选 {selectedRowKeys.length} 项
                                    </span>
                                    <a onClick={onCleanSelected}>取消选择</a>
                                    <Popconfirm
                                        title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                                        onConfirm={handleBatchDelete}
                                        okText="确定"
                                        cancelText="取消"
                                    >
                                        <Button
                                            danger
                                            icon={<DeleteOutlined />}
                                            disabled={selectedRowKeys.length === 0}
                                        >
                                            批量删除
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            )
                        }}
                        className="mcp-table"
                        style={{
                            paddingTop: 0,
                        }}
                        scroll={{
                            x: 'max-content',
                            y: 'calc(100vh - 480px)',
                        }}
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total) => `共 ${total} 条`,
                            pageSizeOptions: ['10', '20', '50', '100'],
                        }}
                            rowClassName={(record) => {
                                const status = record.status as string
                                return (status === 'DISABLED') ? 'opacity-70' : ''
                            }}
                        locale={{
                            emptyText: '未配置服务器',
                        }}
                        size="middle"
                    />
                </div>

                {/* 详情弹框 */}
                <Modal
                    title="工具详情"
                    open={detailModalVisible}
                    onCancel={() => setDetailModalVisible(false)}
                    footer={[
                        <Button key="close" onClick={() => setDetailModalVisible(false)}>
                            关闭
                        </Button>
                    ]}
                    width={800}
                >
                    {detailRecord && (
                        <Descriptions column={1} bordered>
                            <Descriptions.Item label="ID">{detailRecord.id}</Descriptions.Item>
                            <Descriptions.Item label="名称">{detailRecord.name}</Descriptions.Item>
                            <Descriptions.Item label="类型">
                                <Tag color={detailRecord.type === 'REMOTE' ? 'blue' : 'cyan'}>
                                    {detailRecord.type === 'REMOTE' ? '远程' : '本地'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="描述">
                                {detailRecord.description || <span className="italic text-gray-400">无描述</span>}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={(detailRecord.status as string) === 'ENABLED' ? 'green' : 'default'}>
                                    {(detailRecord.status as string) === 'ENABLED' ? '启用' : '禁用'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="配置信息">
                                <pre style={{
                                    maxHeight: '300px',
                                    overflow: 'auto',
                                    padding: '12px',
                                    background: isDarkMode ? '#1f1f1f' : '#f5f5f5',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}>
                                    {detailRecord.configJson ? JSON.stringify(JSON.parse(detailRecord.configJson), null, 2) : '无配置信息'}
                                </pre>
                            </Descriptions.Item>
                            <Descriptions.Item label="创建时间">
                                {detailRecord.createTime ? new Date(detailRecord.createTime).toLocaleString('zh-CN') : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="更新时间">
                                {detailRecord.updateTime ? new Date(detailRecord.updateTime).toLocaleString('zh-CN') : '-'}
                            </Descriptions.Item>
                        </Descriptions>
                    )}
                </Modal>
            </SettingGroup>
        </SettingContainer>
        </ConfigProvider>
        </>
    )
}

export default MCPSettings