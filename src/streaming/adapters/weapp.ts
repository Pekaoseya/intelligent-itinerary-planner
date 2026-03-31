/**
 * 流式输出模块 - 小程序适配器
 */

import { Network } from '@/network'
import { decodeChunk, clearIncompleteBuffer, utf8ArrayToString } from '@/utils/utf8-decoder'
import type { 
  StreamOptions, 
  StreamCallbacks, 
  StreamConnection,
  AdapterCapabilities,
  SSEEvent 
} from '../types'
import { BaseAdapter } from './base'

interface WeappRequestTask {
  abort: () => void
  onHeadersReceived?: (callback: (res: { header: Record<string, string> }) => void) => void
  onChunkReceived?: (callback: (res: { data: ArrayBuffer }) => void) => void
}

/**
 * 小程序平台适配器
 */
export class WeappAdapter extends BaseAdapter {
  getCapabilities(): AdapterCapabilities {
    return {
      streaming: true,
      abortable: true,
      platform: 'weapp',
      chunked: true,
    }
  }

  connect(options: StreamOptions, callbacks: StreamCallbacks): StreamConnection {
    let readyState: 'connecting' | 'open' | 'closed' = 'connecting'
    let requestTask: WeappRequestTask | null = null
    let hasReceivedChunk = false
    let isAborted = false
    
    this.resetParser()
    
    const uid = Math.random().toString(36).substring(2, 9)
    let sseBuffer = ''

    console.log('[WeappAdapter] ========== 开始连接 ==========')
    console.log('[WeappAdapter] URL:', options.url)
    console.log('[WeappAdapter] 请求数据:', JSON.stringify(options.data || {}).substring(0, 200))

    // @ts-ignore
    requestTask = Network.request({
      url: options.url,
      method: options.method || 'POST',
      data: options.data,
      header: {
        ...this.getDefaultHeaders(),
        ...options.headers,
      },
      enableChunked: true,
      responseType: 'arraybuffer',
      enableHttp2: false,
      timeout: options.timeout || 120000,
      success: (res: any) => {
        if (isAborted) return
        
        console.log('[WeappAdapter] 请求成功, statusCode:', res.statusCode)
        console.log('[WeappAdapter] hasReceivedChunk:', hasReceivedChunk)
        
        if (!hasReceivedChunk) {
          console.log('[WeappAdapter] onChunkReceived 未触发，处理完整响应')
          
          if (res.statusCode === 200 && res.data) {
            try {
              let responseText: string
              
              if (res.data instanceof ArrayBuffer) {
                responseText = utf8ArrayToString(new Uint8Array(res.data))
              } else if (typeof res.data === 'string') {
                responseText = res.data
              } else if (typeof res.data === 'object' && res.data !== null) {
                responseText = JSON.stringify(res.data)
              } else {
                responseText = String(res.data)
              }
              
              console.log('[WeappAdapter] 完整响应内容:', responseText)
              
              if (responseText) {
                this.parseAndDispatch(responseText, callbacks)
              } else {
                callbacks.onError?.({
                  message: '当前环境不支持流式输出',
                  code: 'CHUNKED_NOT_SUPPORTED',
                })
              }
            } catch (e) {
              console.error('[WeappAdapter] 解析响应失败:', e)
              callbacks.onError?.({
                message: '解析响应失败',
                code: 'PARSE_ERROR',
              })
            }
          } else if (res.statusCode !== 200) {
            callbacks.onError?.({
              message: `HTTP ${res.statusCode}`,
              code: 'HTTP_ERROR',
            })
          } else {
            callbacks.onError?.({
              message: '当前环境不支持流式输出',
              code: 'CHUNKED_NOT_SUPPORTED',
            })
          }
        }
        
        clearIncompleteBuffer(uid)
        readyState = 'closed'
        callbacks.onFinally?.()
      },
      fail: (err: any) => {
        if (isAborted) return
        
        console.error('[WeappAdapter] 请求失败:', err.errMsg)
        readyState = 'closed'
        callbacks.onError?.({ message: err.errMsg || '请求失败' })
        callbacks.onFinally?.()
        clearIncompleteBuffer(uid)
      },
    })

    if (requestTask && requestTask.onHeadersReceived) {
      requestTask.onHeadersReceived(() => {
        console.log('[WeappAdapter] 收到响应头')
      })
    }

    if (requestTask && requestTask.onChunkReceived) {
      console.log('[WeappAdapter] 支持 onChunkReceived，开始监听')
      
      requestTask.onChunkReceived((res: { data: ArrayBuffer }) => {
        if (isAborted || !res.data) return
        
        hasReceivedChunk = true
        readyState = 'open'
        
        try {
          // 解码二进制数据
          const text = decodeChunk(res.data, uid)
          console.log('[WeappAdapter] 解码后文本:', text)
          
          if (!text) {
            console.log('[WeappAdapter] 解码后文本为空，等待更多数据')
            return
          }
          
          // SSE 协议解析
          sseBuffer += text
          
          // 按 \n\n 分割消息
          const parts = sseBuffer.split('\n\n')
          
          // 如果只有 1 个元素，说明没有找到消息边界，等待更多数据
          if (parts.length <= 1) {
            console.log('[WeappAdapter] 未找到完整消息边界，等待更多数据')
            return
          }
          
          // 取出最后一个不完整的部分作为新 buffer
          sseBuffer = parts.pop() || ''
          
          console.log('[WeappAdapter] 完整 SSE 消息数量:', parts.length)
          
          // 处理完整的消息
          for (const part of parts) {
            if (!part.trim()) continue
            
            console.log('[WeappAdapter] 处理 SSE 消息:', part.substring(0, 150))
            
            const lines = part.split('\n')
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.replace(/^data:\s*/, '').trim()
                if (dataStr) {
                  // 方案1：直接解析 JSON 并分发，跳过 SSEParser 的二次解析
                  try {
                    const event = JSON.parse(dataStr)
                    console.log('[WeappAdapter] 直接分发事件:', event.type, JSON.stringify(event.data || {}).substring(0, 100))
                    this.dispatchEvent(event, callbacks)
                  } catch (parseError) {
                    console.warn('[WeappAdapter] JSON 解析失败:', dataStr.substring(0, 100), parseError)
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[WeappAdapter] 处理 chunk 失败:', e)
        }
      })
    } else {
      console.warn('[WeappAdapter] 不支持 onChunkReceived，将使用完整响应模式')
    }

    return {
      abort: () => {
        console.log('[WeappAdapter] 主动取消')
        isAborted = true
        requestTask?.abort()
        readyState = 'closed'
        clearIncompleteBuffer(uid)
      },
      getReadyState: () => readyState,
    }
  }

  /**
   * 解析并分发事件 - 处理完整响应（非流式情况）
   * 支持两种格式：
   * 1. SSE 格式：多行 data:xxx
   * 2. 纯 JSON 数组：[{type, data}, ...]
   */
  protected parseAndDispatch(chunk: string | ArrayBuffer, callbacks: StreamCallbacks): void {
    let text: string
    if (typeof chunk === 'string') {
      text = chunk
    } else {
      text = utf8ArrayToString(new Uint8Array(chunk))
    }
    
    console.log('[WeappAdapter] parseAndDispatch 输入:', text.substring(0, 200))
    
    // 尝试直接解析为 JSON 数组
    if (text.trim().startsWith('[')) {
      try {
        const events = JSON.parse(text)
        console.log('[WeappAdapter] 解析为 JSON 数组，事件数量:', events.length)
        events.forEach((event: SSEEvent) => {
          this.dispatchEvent(event, callbacks)
        })
        return
      } catch {
        // 不是 JSON 数组，继续尝试 SSE 解析
      }
    }
    
    // SSE 格式解析
    const events = this.parser.parse(chunk)
    console.log('[WeappAdapter] SSE 解析到事件数量:', events.length)
    
    events.forEach(event => {
      console.log('[WeappAdapter] 分发事件:', event.type, JSON.stringify(event.data).substring(0, 100))
      this.dispatchEvent(event, callbacks)
    })
  }
}
