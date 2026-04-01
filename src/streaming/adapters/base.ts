/**
 * 流式输出模块 - 适配器基类
 * 
 * 定义所有平台适配器的公共行为
 */

import type { 
  StreamClient, 
  StreamOptions, 
  StreamCallbacks, 
  StreamConnection,
  SSEEvent,
  StartData,
  ReasoningData,
  SubAgentProgressData,
  ToolResultData,
  ContentData,
  DoneData,
  ErrorData,
  AdapterCapabilities 
} from '../types'
import { SSEParser } from '../parser'

/**
 * 适配器基类
 * 
 * 提供事件分发、解析器管理等通用功能
 */
export abstract class BaseAdapter implements StreamClient {
  protected parser: SSEParser
  protected capabilities: AdapterCapabilities

  constructor() {
    this.parser = new SSEParser()
    this.capabilities = this.getCapabilities()
  }

  /**
   * 获取适配器能力描述
   */
  abstract getCapabilities(): AdapterCapabilities

  /**
   * 建立连接
   */
  abstract connect(options: StreamOptions, callbacks: StreamCallbacks): StreamConnection

  /**
   * 分发 SSE 事件到对应的回调函数
   */
  protected dispatchEvent(event: SSEEvent, callbacks: StreamCallbacks): void {
    const { type, data } = event

    console.log('[BaseAdapter] dispatchEvent:', type, '回调存在:', !!callbacks['on' + type.charAt(0).toUpperCase() + type.slice(1)])

    switch (type) {
      case 'start':
        console.log('[BaseAdapter] 调用 onStart, data:', data)
        callbacks.onStart?.(data as StartData)
        break
      case 'reasoning':
        console.log('[BaseAdapter] 调用 onReasoning, step:', (data as ReasoningData).step)
        callbacks.onReasoning?.(data as ReasoningData)
        break
      case 'sub_agent_progress':
        console.log('[BaseAdapter] 调用 onSubAgentProgress, message:', (data as SubAgentProgressData).message)
        callbacks.onSubAgentProgress?.(data as SubAgentProgressData)
        break
      case 'tool_result':
        console.log('[BaseAdapter] 调用 onToolResult, tool:', (data as ToolResultData).tool)
        callbacks.onToolResult?.(data as ToolResultData)
        break
      case 'content':
        console.log('[BaseAdapter] 调用 onContent, content:', (data as ContentData).content)
        callbacks.onContent?.(data as ContentData)
        break
      case 'done':
        console.log('[BaseAdapter] 调用 onDone, content 长度:', (data as DoneData).content?.length)
        callbacks.onDone?.(data as DoneData)
        break
      case 'error':
        console.log('[BaseAdapter] 调用 onError, message:', (data as ErrorData).message)
        callbacks.onError?.(data as ErrorData)
        break
      default:
        console.warn('[BaseAdapter] 未知事件类型:', type)
    }
  }

  /**
   * 解析并分发事件
   */
  protected parseAndDispatch(chunk: string | ArrayBuffer, callbacks: StreamCallbacks): void {
    const events = this.parser.parse(chunk)
    events.forEach(event => this.dispatchEvent(event, callbacks))
  }

  /**
   * 重置解析器
   */
  protected resetParser(): void {
    this.parser.reset()
  }

  /**
   * 构建完整 URL
   */
  protected buildUrl(url: string, data?: Record<string, unknown>): string {
    // 如果是绝对路径，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    // 如果是 GET 请求，将参数拼接到 URL
    if (data && Object.keys(data).length > 0) {
      const params = new URLSearchParams()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      const separator = url.includes('?') ? '&' : '?'
      return `${url}${separator}${params.toString()}`
    }

    return url
  }

  /**
   * 获取默认请求头
   */
  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    }
  }
}
