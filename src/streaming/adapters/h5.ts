/**
 * 流式输出模块 - H5 适配器
 * 
 * 使用 Fetch API + ReadableStream 实现流式输出
 */

import type { 
  StreamOptions, 
  StreamCallbacks, 
  StreamConnection,
  AdapterCapabilities 
} from '../types'
import { BaseAdapter } from './base'

/**
 * H5 平台适配器
 * 
 * 使用 Fetch API 的 ReadableStream 实现真正的流式输出
 */
export class H5Adapter extends BaseAdapter {
  getCapabilities(): AdapterCapabilities {
    return {
      streaming: true,
      abortable: true,
      platform: 'h5',
      chunked: true,
    }
  }

  connect(options: StreamOptions, callbacks: StreamCallbacks): StreamConnection {
    const controller = new AbortController()
    let readyState: 'connecting' | 'open' | 'closed' = 'connecting'
    
    // 重置解析器
    this.resetParser()

    // 异步执行请求
    ;(async () => {
      try {
        console.log('[H5Adapter] 开始连接:', options.url)

        const response = await fetch(options.url, {
          method: options.method || 'POST',
          headers: {
            ...this.getDefaultHeaders(),
            ...options.headers,
          },
          body: options.method !== 'GET' ? JSON.stringify(options.data) : undefined,
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // 验证响应类型
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/event-stream') && !contentType.includes('text/plain')) {
          console.warn('[H5Adapter] 非预期的 Content-Type:', contentType)
        }

        readyState = 'open'
        console.log('[H5Adapter] 连接已建立')

        const reader = response.body?.getReader()
        
        if (!reader) {
          throw new Error('无法获取响应流')
        }

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            console.log('[H5Adapter] 流结束')
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          console.log('[H5Adapter] 收到 chunk:', chunk.length, '字节')
          
          // 解析并分发事件
          this.parseAndDispatch(chunk, callbacks)
        }

        readyState = 'closed'
        callbacks.onFinally?.()
      } catch (error: unknown) {
        readyState = 'closed'
        
        // 用户主动取消不报错
        if ((error as Error).name === 'AbortError') {
          console.log('[H5Adapter] 用户取消请求')
        } else {
          console.error('[H5Adapter] 连接错误:', error)
          callbacks.onError?.({ 
            message: (error as Error).message || '连接失败',
          })
        }
        
        callbacks.onFinally?.()
      }
    })()

    return {
      abort: () => {
        console.log('[H5Adapter] 主动取消')
        controller.abort()
        readyState = 'closed'
      },
      getReadyState: () => readyState,
    }
  }
}
