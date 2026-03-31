/**
 * 流式输出模块 - SSE 解析器
 * 
 * 解析 Server-Sent Events 格式的数据流
 */

import { utf8ArrayToString } from '@/utils/utf8-decoder'
import type { SSEEvent } from './types'

/**
 * SSE 数据解析器
 */
export class SSEParser {
  private buffer = ''

  /**
   * 解析 SSE 数据块
   */
  parse(chunk: string | ArrayBuffer): SSEEvent[] {
    // 处理 ArrayBuffer - 使用纯 JS 解码，不依赖 TextDecoder
    let chunkStr: string
    if (typeof chunk === 'string') {
      chunkStr = chunk
    } else {
      chunkStr = utf8ArrayToString(new Uint8Array(chunk))
    }

    console.log('[SSEParser] 解析数据:', chunkStr.substring(0, 200))

    // 将新数据追加到缓冲区
    this.buffer += chunkStr

    const events: SSEEvent[] = []
    
    // 按 \n 分割
    const lines = this.buffer.split('\n')
    
    // 保留最后一个不完整的行
    this.buffer = lines.pop() || ''
    
    for (const line of lines) {
      // 跳过空行
      if (!line.trim()) continue
      
      // 解析 data: 开头的行
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5).trim()
        if (!jsonStr) continue
        
        try {
          const event = JSON.parse(jsonStr) as SSEEvent
          console.log('[SSEParser] 解析事件:', event.type, event.data)
          events.push(event)
        } catch (e) {
          console.warn('[SSEParser] JSON 解析失败:', jsonStr, e)
        }
      }
    }
    
    return events
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.buffer = ''
  }
}

export function createSSEParser(): SSEParser {
  return new SSEParser()
}
