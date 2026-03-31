/**
 * 流式输出模块 - 类型定义
 * 
 * 定义 SSE 事件类型、客户端接口和回调函数类型
 */

// ============ SSE 事件类型 ============

/**
 * SSE 事件类型枚举
 */
export type SSEEventType = 
  | 'start'           // 开始处理
  | 'reasoning'       // 思考步骤
  | 'tool_result'     // 工具执行结果
  | 'content'         // 内容输出（流式）
  | 'done'            // 完成
  | 'error'           // 错误

/**
 * SSE 事件基础接口
 */
export interface SSEEvent<T = unknown> {
  type: SSEEventType
  data: T
}

/**
 * 开始事件数据
 */
export interface StartData {
  messageId: string
  timestamp: number
}

/**
 * 思考步骤事件数据
 */
export interface ReasoningData {
  step: string
  timestamp?: number
}

/**
 * 工具执行结果事件数据
 */
export interface ToolResultData {
  tool: string
  success: boolean
  message?: string
  error?: string
  data?: unknown
}

/**
 * 内容输出事件数据（流式）
 */
export interface ContentData {
  content: string
  index?: number
}

/**
 * 完成事件数据
 */
export interface DoneData {
  content?: string
  reasoning?: string[]
  tool_results?: ToolResultData[]
  data?: unknown
}

/**
 * 错误事件数据
 */
export interface ErrorData {
  message: string
  code?: number | string
  details?: unknown
}

// ============ 客户端类型 ============

/**
 * 流式请求选项
 */
export interface StreamOptions {
  /** 请求 URL（相对路径或绝对路径） */
  url: string
  /** HTTP 方法 */
  method?: 'GET' | 'POST'
  /** 请求数据 */
  data?: Record<string, unknown>
  /** 请求头 */
  headers?: Record<string, string>
  /** 超时时间（毫秒） */
  timeout?: number
  /** 重试次数 */
  retryCount?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
}

/**
 * 流式回调函数
 */
export interface StreamCallbacks {
  /** 开始处理 */
  onStart?: (data: StartData) => void
  /** 思考步骤 */
  onReasoning?: (data: ReasoningData) => void
  /** 工具执行结果 */
  onToolResult?: (data: ToolResultData) => void
  /** 内容输出（流式） */
  onContent?: (data: ContentData) => void
  /** 完成 */
  onDone?: (data: DoneData) => void
  /** 错误 */
  onError?: (error: ErrorData) => void
  /** 最终回调（无论成功或失败都会执行） */
  onFinally?: () => void
}

/**
 * 流式连接接口
 */
export interface StreamConnection {
  /** 取消连接 */
  abort: () => void
  /** 获取连接状态 */
  getReadyState: () => 'connecting' | 'open' | 'closed'
}

/**
 * 流式客户端接口
 */
export interface StreamClient {
  /** 建立连接 */
  connect: (options: StreamOptions, callbacks: StreamCallbacks) => StreamConnection
}

// ============ 适配器类型 ============

/**
 * 平台类型
 */
export type Platform = 'h5' | 'weapp' | 'fallback'

/**
 * 适配器能力描述
 */
export interface AdapterCapabilities {
  /** 是否支持真正的流式输出 */
  streaming: boolean
  /** 是否支持取消 */
  abortable: boolean
  /** 平台名称 */
  platform: Platform
  /** 是否支持分块传输 */
  chunked: boolean
}
