/**
 * 流式输出模块 - 主入口
 * 
 * 提供统一的流式输出 API，支持 H5 和小程序平台
 * 
 * 使用示例:
 * ```typescript
 * import { streamingClient, createStreamingClient } from '@/streaming'
 * 
 * // 使用单例
 * const connection = streamingClient.connect({
 *   url: '/api/agent/chat/stream',
 *   method: 'POST',
 *   data: { message: '你好' },
 * }, {
 *   onContent: (data) => {
 *     console.log('收到内容:', data.content)
 *   },
 *   onDone: (data) => {
 *     console.log('完成')
 *   },
 * })
 * 
 * // 取消连接
 * connection.abort()
 * ```
 */

// 导出类型
export type {
  SSEEvent,
  SSEEventType,
  StartData,
  ReasoningData,
  ToolResultData,
  ContentData,
  DoneData,
  ErrorData,
  StreamOptions,
  StreamCallbacks,
  StreamConnection,
  StreamClient,
  Platform,
  AdapterCapabilities,
} from './types'

// 导出解析器
export { SSEParser, createSSEParser } from './parser'

// 导出适配器
export { 
  BaseAdapter, 
  H5Adapter, 
  WeappAdapter, 
  FallbackAdapter 
} from './adapters'

// 导出客户端
export { 
  StreamingClient, 
  createStreamingClient, 
  streamingClient 
} from './client'
