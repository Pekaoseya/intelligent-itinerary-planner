/**
 * SSE 流式请求工具
 * 支持 H5 和小程序双端
 */

import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { decodeChunk, clearIncompleteBuffer } from '@/utils/utf8-decoder'

interface SSEOptions {
  url: string
  data?: any
  headers?: Record<string, string>
  timeout?: number
  
  onMessage: (text: string) => void
  onError?: (error: Error) => void
  onComplete?: () => void
  onHeaders?: (headers: Record<string, string>) => void
}

interface SSEConnection {
  abort: () => void
}

/**
 * 解析 SSE 数据
 */
function parseSSE(text: string, buffer: { current: string }): string[] {
  buffer.current += text
  
  const messages: string[] = []
  const parts = buffer.current.split('\n\n')
  
  if (parts.length > 1) {
    buffer.current = parts.pop() || ''
  }
  
  for (const part of parts) {
    if (!part.trim()) continue
    
    const lines = part.split('\n')
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.replace(/^data:\s*/, '').trim()
        if (data) {
          messages.push(data)
        }
      }
    }
  }
  
  return messages
}

/**
 * 发起 SSE 流式请求
 */
export function requestSSE(options: SSEOptions): SSEConnection {
  const { url, data, headers = {}, timeout = 60000, onMessage, onError, onComplete, onHeaders } = options
  
  const uid = Math.random().toString(36).substring(2, 9)
  const sseBuffer = { current: '' }
  let requestTask: any = null
  let isAborted = false
  
  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
  
  if (isH5) {
    // H5 端使用 fetch（支持 TextDecoder）
    console.log('[SSE] H5 环境，使用 fetch')
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...headers,
      },
      body: JSON.stringify(data),
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (!response.body) throw new Error('ReadableStream not supported')
        
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value
        })
        onHeaders?.(responseHeaders)
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        
        function read(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done || isAborted) {
              if (sseBuffer.current.trim()) {
                parseSSE('', sseBuffer).forEach(msg => onMessage(msg))
              }
              onComplete?.()
              return
            }
            
            const text = decoder.decode(value, { stream: true })
            parseSSE(text, sseBuffer).forEach(msg => onMessage(msg))
            return read()
          })
        }
        
        return read()
      })
      .catch(error => {
        if (!isAborted) onError?.(error)
      })
    
    return { abort: () => { isAborted = true } }
  }
  
  // 小程序端
  console.log('[SSE] 小程序环境，使用 Network.request + onChunkReceived')
  
  // @ts-ignore
  requestTask = Network.request({
    url,
    method: 'POST',
    data,
    header: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...headers,
    },
    enableChunked: true,
    responseType: 'arraybuffer',
    enableHttp2: false,
    timeout,
    success: () => {
      if (isAborted) return
      console.log('[SSE] 请求成功')
      
      if (sseBuffer.current.trim()) {
        parseSSE('', sseBuffer).forEach(msg => onMessage(msg))
      }
      
      clearIncompleteBuffer(uid)
      onComplete?.()
    },
    fail: (err: any) => {
      if (!isAborted) {
        console.error('[SSE] 请求失败:', err)
        onError?.(new Error(err.errMsg || '请求失败'))
      }
      clearIncompleteBuffer(uid)
    },
  })
  
  if (requestTask.onHeadersReceived) {
    requestTask.onHeadersReceived((res: any) => {
      onHeaders?.(res.header || {})
    })
  }
  
  if (requestTask.onChunkReceived) {
    console.log('[SSE] 支持 onChunkReceived')
    
    requestTask.onChunkReceived((res: { data: ArrayBuffer }) => {
      if (isAborted || !res.data) return
      
      try {
        const text = decodeChunk(res.data, uid)
        if (text) {
          parseSSE(text, sseBuffer).forEach(msg => onMessage(msg))
        }
      } catch (e) {
        console.error('[SSE] 解析数据失败:', e)
      }
    })
  } else {
    console.warn('[SSE] 不支持 onChunkReceived')
  }
  
  return {
    abort: () => {
      isAborted = true
      requestTask?.abort()
      clearIncompleteBuffer(uid)
    },
  }
}

export { clearAllIncompleteBuffers } from '@/utils/utf8-decoder'
