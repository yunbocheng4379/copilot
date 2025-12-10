import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {McpMarket} from "@/types/mcp"
import {TopView} from "@/components/TopView"
import classNames from "classnames"
import {saveMcpMarket, updateMcpMarket} from '@/api/mcpMarkets'
import {message} from 'antd'
import {EditorState} from "@codemirror/state"
import {EditorView} from "@codemirror/view"
import {json} from "@codemirror/lang-json"
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language"
import {tags as t} from "@lezer/highlight"

interface ShowParams {
    market?: McpMarket
}

interface Props extends ShowParams {
    resolve: (data: any) => void
}

interface MarketFormValues {
    name: string
    url: string
    description: string
    authConfig: string
    status: 'ENABLED' | 'DISABLED'
}

const CustomModal = ({ children, title, open, onOk, onCancel, okText, cancelText, confirmLoading }) => {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
            <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-6">
                    <div className="relative w-full max-w-2xl transform rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                {title}
                            </h3>
                            <button
                                onClick={onCancel}
                                className="rounded-md p-1 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                            {children}
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200/80 dark:border-gray-700/80">
                            <button
                                type="button"
                                onClick={onCancel}
                                className={classNames(
                                    "px-4 py-2 text-sm font-medium rounded-lg",
                                    "text-gray-700 dark:text-gray-300",
                                    "bg-white dark:bg-gray-800",
                                    "border border-gray-300 dark:border-gray-600",
                                    "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                                    "focus:outline-none focus:ring-2 focus:ring-purple-500/50",
                                    "transition duration-150 ease-in-out"
                                )}
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={onOk}
                                disabled={confirmLoading}
                                className={classNames(
                                    "px-4 py-2 text-sm font-medium rounded-lg",
                                    "text-white",
                                    "bg-purple-600 hover:bg-purple-700",
                                    "dark:bg-purple-600 dark:hover:bg-purple-700",
                                    "focus:outline-none focus:ring-2 focus:ring-purple-500",
                                    "transition duration-150 ease-in-out",
                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                    "flex items-center gap-2"
                                )}
                            >
                                {confirmLoading && (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                )}
                                {okText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const FormField = ({ label, required, children, error }: {
    label: string
    required?: boolean
    children: React.ReactNode
    error?: string
}) => (
    <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
        </div>
        {children}
        {error && (
            <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
    </div>
)

const Input = ({ value, onChange, placeholder, disabled, className = "" }) => (
    <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={classNames(
            "w-full px-3 py-2 text-sm rounded-lg",
            "bg-white dark:bg-gray-900",
            "border border-gray-300 dark:border-gray-600",
            "focus:outline-none focus:ring-2 focus:ring-purple-500/50",
            "disabled:bg-gray-100 dark:disabled:bg-gray-800",
            "disabled:cursor-not-allowed",
            "placeholder-gray-400 dark:placeholder-gray-500",
            "transition duration-200",
            className
        )}
    />
)

const TextArea = ({ value, onChange, placeholder, rows = 3, className = "" }) => (
    <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={classNames(
            "w-full px-3 py-2 text-sm rounded-lg",
            "bg-white dark:bg-gray-900",
            "border border-gray-300 dark:border-gray-600",
            "focus:outline-none focus:ring-2 focus:ring-purple-500/50",
            "placeholder-gray-400 dark:placeholder-gray-500",
            "transition duration-200",
            "resize-y",
            className
        )}
    />
)

const RadioGroup = ({ value, onChange, options }: {
    value: string
    onChange: (value: string) => void
    options: Array<{ label: string; value: string }>
}) => (
    <div className="flex gap-2">
        {options.map((option) => (
            <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={classNames(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "transition duration-200",
                    value === option.value ? (
                        "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                    ) : (
                        "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    ),
                    "border border-gray-300 dark:border-gray-600"
                )}
            >
                {option.label}
            </button>
        ))}
    </div>
)

// JSON 编辑器样式（与 AddMcpServerPopup 保持一致）
const jsonHighlightStyle = HighlightStyle.define([
    { tag: t.string, color: "#CE9178" }, // 字符串值为红褐色
    { tag: t.propertyName, color: "#9CDCFE" }, // 属性名为浅蓝色
    { tag: t.number, color: "#B5CEA8" }, // 数字为浅绿色
    { tag: t.bool, color: "#569CD6" }, // 布尔值为蓝色
    { tag: t.null, color: "#569CD6" }, // null 为蓝色
    { tag: t.punctuation, color: "#D4D4D4" }, // 标点符号为浅灰色
    { tag: t.bracket, color: "#D4D4D4" }, // 括号为浅灰色
    { tag: t.invalid, color: "#F44747" }, // 无效的 JSON 为红色
])

// JSON 编辑器组件（与 AddMcpServerPopup 保持一致）
const JsonEditor = forwardRef<
    { format: () => void },
    {
        value: string
        onChange: (value: string) => void
        onFocus?: () => void
        onError?: (error: string) => void
        height?: string
    }
>(({ value, onChange, onFocus, onError, height = "400px" }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView>()
    const { t } = useTranslation()

    // 格式化方法
    const formatEditorContent = () => {
        if (!viewRef.current) return
        try {
            const currentText = viewRef.current.state.doc.toString()
            if (!currentText.trim()) return
            
            const parsed = JSON.parse(currentText)
            const formatted = JSON.stringify(parsed, null, 2)

            viewRef.current.dispatch({
                changes: {
                    from: 0,
                    to: viewRef.current.state.doc.length,
                    insert: formatted,
                },
            })

            onError?.("") // 清除错误信息
        } catch (error: any) {
            onError?.(error.message || t("settings.mcp.jsonFormatError"))
        }
    }

    // 初始化编辑器
    useEffect(() => {
        if (!editorRef.current) return

        const state = EditorState.create({
            doc: value || "",
            extensions: [
                EditorView.lineWrapping,
                json(),
                syntaxHighlighting(jsonHighlightStyle),
                EditorView.theme({
                    "&": {
                        fontSize: "13px",
                        height: height,
                        backgroundColor: "#1E1E1E", // VS Code 暗色主题背景色
                        isolation: "isolate",
                    },
                    ".cm-scroller": {
                        fontFamily: "Consolas, Monaco, monospace",
                        lineHeight: "1.5",
                        overflow: "auto",
                        padding: "8px 0",
                        isolation: "isolate",
                        scrollbarWidth: "thin",
                        "&::-webkit-scrollbar": {
                            width: "8px",
                            height: "8px",
                        },
                        "&::-webkit-scrollbar-track": {
                            background: "transparent",
                        },
                        "&::-webkit-scrollbar-thumb": {
                            background: "#555",
                            borderRadius: "4px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                            background: "#666",
                        },
                    },
                    ".cm-content": {
                        caretColor: "#D4D4D4",
                        minHeight: height,
                        padding: "0 12px",
                        color: "#D4D4D4",
                    },
                    ".cm-gutters": {
                        backgroundColor: "#1E1E1E",
                        border: "none",
                        borderRight: "1px solid #404040",
                        color: "#858585",
                        paddingRight: "8px",
                    },
                    ".cm-activeLineGutter": {
                        backgroundColor: "#282828",
                    },
                    ".cm-activeLine": {
                        backgroundColor: "#282828",
                    },
                    "&.cm-editor": {
                        "&.cm-focused": {
                            outline: "none",
                        },
                    },
                    ".cm-selectionBackground": {
                        backgroundColor: "#264F78",
                    },
                    "&.cm-focused .cm-selectionBackground": {
                        backgroundColor: "#264F78",
                    },
                    ".cm-cursor": {
                        borderLeftColor: "#D4D4D4",
                    },
                    ".cm-lineNumbers": {
                        minWidth: "40px",
                    },
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        const newValue = update.state.doc.toString()
                        onChange(newValue)
                        // 验证 JSON 格式
                        if (newValue.trim()) {
                            try {
                                JSON.parse(newValue)
                                onError?.("")
                            } catch (error: any) {
                                onError?.(error.message || "Invalid JSON")
                            }
                        } else {
                            onError?.("")
                        }
                    }
                }),
            ],
        })

        const view = new EditorView({
            state,
            parent: editorRef.current,
        })

        viewRef.current = view

        return () => {
            view.destroy()
        }
    }, []) // 只在组件挂载时初始化一次

    // 当 value 变化时更新编辑器内容（用于编辑模式回显）
    useEffect(() => {
        if (viewRef.current) {
            const currentValue = viewRef.current.state.doc.toString()
            if (value !== currentValue) {
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: viewRef.current.state.doc.length,
                        insert: value || "",
                    },
                })
            }
        }
    }, [value])

    // 暴露格式化方法
    useImperativeHandle(ref, () => ({
        format: formatEditorContent,
    }))

    return (
        <div
            ref={editorRef}
            className={classNames(
                "rounded-lg overflow-hidden",
                "border border-gray-200 dark:border-gray-700",
                "focus-within:ring-2 focus-within:ring-purple-500/50",
                "transition duration-200 ease-in-out"
            )}
            onFocus={onFocus}
            onWheel={(e) => e.stopPropagation()}
        />
    )
})

const PopupContainer: React.FC<Props> = ({ market, resolve }) => {
    const [open, setOpen] = useState(true)
    const { t } = useTranslation()
    const [formData, setFormData] = useState<MarketFormValues>({
        name: "",
        url: "",
        description: "",
        authConfig: "",
        status: "ENABLED"
    })
    const [errors, setErrors] = useState<Partial<Record<keyof MarketFormValues, string>>>({})
    const [loading, setLoading] = useState(false)
    const [jsonError, setJsonError] = useState("")
    const jsonEditorRef = useRef<{ format: () => void }>(null)

    useEffect(() => {
        if (market) {
            const validStatus = (market.status === 'ENABLED' || market.status === 'DISABLED') 
                ? market.status 
                : 'ENABLED'
            const newFormData = {
                name: market.name || "",
                url: market.url || "",
                description: market.description || "",
                authConfig: market.authConfig || "",
                status: validStatus
            }
            setFormData(newFormData)
        } else {
            // 重置表单
            setFormData({
                name: "",
                url: "",
                description: "",
                authConfig: "",
                status: "ENABLED"
            })
        }
    }, [market])

    const validateForm = () => {
        const newErrors: Partial<Record<keyof MarketFormValues, string>> = {}
        
        if (!formData.name || formData.name.trim() === '') {
            newErrors.name = '市场名称不能为空'
        }
        
        if (!formData.url || formData.url.trim() === '') {
            newErrors.url = 'URL不能为空'
        }
        
        if (formData.authConfig && formData.authConfig.trim() !== '') {
            try {
                JSON.parse(formData.authConfig)
            } catch (e) {
                newErrors.authConfig = '认证配置必须是有效的JSON格式'
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0 && !jsonError
    }

    const onOK = async () => {
        if (!validateForm()) return

        setLoading(true)
        try {
            const validStatus: 'ENABLED' | 'DISABLED' = 
                (formData.status === 'ENABLED' || formData.status === 'DISABLED') 
                    ? formData.status 
                    : 'ENABLED'
            
            const marketData: Partial<McpMarket> = {
                name: formData.name.trim(),
                url: formData.url.trim(),
                description: formData.description.trim() || null,
                authConfig: formData.authConfig.trim() || null,
                status: validStatus
            }

            let savedMarket: McpMarket
            if (market && market.id) {
                // 更新
                savedMarket = await updateMcpMarket({ ...marketData, id: market.id })
                message.success('更新成功')
            } else {
                // 新增
                savedMarket = await saveMcpMarket(marketData)
                message.success('添加成功')
            }

            setLoading(false)
            setOpen(false)
            TopView.hide(TopViewKey)
            resolve(savedMarket)
        } catch (error: any) {
            message.error(error.message || (market ? '更新失败' : '添加失败'))
            setLoading(false)
        }
    }

    const onCancel = () => {
        setOpen(false)
        TopView.hide(TopViewKey)
    }

    AddMarketPopup.hide = onCancel

    return (
        <CustomModal
            title={market ? "编辑市场" : "添加市场"}
            open={open}
            onOk={onOK}
            onCancel={onCancel}
            okText="保存"
            cancelText="取消"
            confirmLoading={loading}
        >
            <FormField label="市场名称" required error={errors.name}>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入市场名称"
                />
            </FormField>

            <FormField label="URL" required error={errors.url}>
                <Input
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="请输入市场 URL"
                />
            </FormField>

            <FormField label="描述" error={errors.description}>
                <TextArea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="请输入市场描述"
                    rows={3}
                />
            </FormField>

            <FormField label="认证配置" error={errors.authConfig || jsonError}>
                <div className="space-y-2">
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    if (formData.authConfig && formData.authConfig.trim()) {
                                        const parsed = JSON.parse(formData.authConfig)
                                        const formatted = JSON.stringify(parsed, null, 2)
                                        setFormData(prev => ({ ...prev, authConfig: formatted }))
                                        setErrors(prev => ({ ...prev, authConfig: undefined }))
                                        setJsonError("")
                                    }
                                } catch (error: any) {
                                    setErrors(prev => ({ ...prev, authConfig: '认证配置必须是有效的JSON格式' }))
                                    setJsonError(error.message || '认证配置必须是有效的JSON格式')
                                }
                            }}
                            className={classNames(
                                "px-3 py-1.5 text-sm font-medium rounded-lg",
                                "text-gray-700 dark:text-gray-300",
                                "bg-white dark:bg-gray-800",
                                "border border-gray-300 dark:border-gray-600",
                                "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                                "focus:outline-none focus:ring-2 focus:ring-purple-500/50",
                                "transition duration-150 ease-in-out",
                                "flex items-center gap-2"
                            )}
                        >
                            <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16m-7 6h7"
                                />
                            </svg>
                            格式化
                        </button>
                    </div>
                    <JsonEditor
                        ref={jsonEditorRef}
                        value={formData.authConfig}
                        onChange={(value) => {
                            setFormData(prev => ({ ...prev, authConfig: value }))
                            // 清除错误（如果有）
                            if (errors.authConfig) {
                                setErrors(prev => ({ ...prev, authConfig: undefined }))
                            }
                            if (jsonError) {
                                setJsonError("")
                            }
                        }}
                        onFocus={() => {
                            setErrors(prev => ({ ...prev, authConfig: undefined }))
                            setJsonError("")
                        }}
                        onError={(error) => {
                            if (error) {
                                setErrors(prev => ({ ...prev, authConfig: error }))
                                setJsonError(error)
                            } else {
                                setErrors(prev => ({ ...prev, authConfig: undefined }))
                                setJsonError("")
                            }
                        }}
                        height="400px"
                    />
                </div>
            </FormField>

            <FormField label="状态" required error={errors.status}>
                <RadioGroup
                    value={formData.status}
                    onChange={(value) => setFormData({ ...formData, status: value as 'ENABLED' | 'DISABLED' })}
                    options={[
                        { label: '启用', value: 'ENABLED' },
                        { label: '禁用', value: 'DISABLED' }
                    ]}
                />
            </FormField>
        </CustomModal>
    )
}

const TopViewKey = 'AddMarketPopup'

export default class AddMarketPopup {
    static hide() {
        TopView.hide(TopViewKey)
    }
    static show(props: ShowParams = {}) {
        return new Promise<any>((resolve) => {
            TopView.show(
                <PopupContainer
                    {...props}
                    resolve={(v) => {
                        resolve(v)
                        TopView.hide(TopViewKey)
                    }}
                />,
                TopViewKey
            )
        })
    }
}

