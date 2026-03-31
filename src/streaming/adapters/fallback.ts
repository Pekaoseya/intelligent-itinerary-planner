/**
 * 流式输出模块 - 降级适配器
 * 
 * 当流式输出不可用时，使用普通 HTTP 请求 + 模拟打字机效果
 */

import { Network } from '@/network'
import type { 
  StreamOptions, 
  StreamCallbacks, 
  StreamConnection,
  AdapterCapabilities,
  ToolResultData 
} from '../types'
import { BaseAdapter } from './base'

/**
 * 降级适配器
 * 
 * 使用普通 HTTP 请求获取完整响应，然后模拟流式输出效果
 * 注意：这不是真正的流式输出，仅作为降级方案
 */
export class FallbackAdapter extends BaseAdapter {
  getCapabilities(): AdapterCapabilities {
    return {
      streaming: false, // 不是真正的流式
      abortable: true,
      platform: 'fallback',
      chunked: false,
    }
  }

  connect(options: StreamOptions, callbacks: StreamCallbacks): StreamConnection {
    let aborted = false
    let readyState: 'connecting' | 'open' | 'closed' = 'connecting'
    
    // 重置解析器
    this.resetParser()

    console.log('[FallbackAdapter] 开始请求:', options.url)
    console.log('[FallbackAdapter] 请求数据:', JSON.stringify(options.data || {}).substring(0, 200))

    ;(async () => {
      try {
        // 使用普通 HTTP 请求
        const response = await Network.request({
          url: options.url,
          method: options.method || 'POST',
          data: options.data,
          header: {
            ...this.getDefaultHeaders(),
            ...options.headers,
          },
          timeout: options.timeout || 60000,
        })

        if (aborted) return

        readyState = 'open'
        console.log('[FallbackAdapter] 响应状态:', response.statusCode)
        
        // 安全地打印响应数据
        let responsePreview = ''
        try {
          if (response.data === null || response.data === undefined) {
            responsePreview = '(null or undefined)'
          } else if (typeof response.data === 'string') {
            responsePreview = response.data.length > 200 ? response.data.substring(0, 200) + '...' : response.data
          } else if (response.data instanceof ArrayBuffer) {
            responsePreview = `(ArrayBuffer, length: ${response.data.byteLength})`
          } else if (typeof response.data === 'object') {
            const str = JSON.stringify(response.data)
            responsePreview = str.length > 200 ? str.substring(0, 200) + '...' : str
          } else {
            responsePreview = String(response.data)
          }
        } catch {
          responsePreview = '(unable to stringify)'
        }
        console.log('[FallbackAdapter] 响应数据:', responsePreview)

        // ========== 空值检查 ==========
        // 处理各种空响应情况
        if (response.data === null || response.data === undefined) {
          console.error('[FallbackAdapter] 响应数据为 null 或 undefined')
          throw new Error('服务器返回空响应')
        }

        // 处理空字符串
        if (response.data === '') {
          console.error('[FallbackAdapter] 响应数据为空字符串')
          throw new Error('服务器返回空响应')
        }

        // 处理 ArrayBuffer 类型的响应
        let parsedData: any = response.data
        if (response.data instanceof ArrayBuffer) {
          try {
            const decoder = new TextDecoder('utf-8')
            const text = decoder.decode(response.data)
            console.log('[FallbackAdapter] ArrayBuffer 解码:', text.substring(0, 200))
            
            // 尝试解析 JSON
            if (text.trim()) {
              try {
                parsedData = JSON.parse(text)
              } catch {
                // 不是 JSON，直接使用文本
                parsedData = { content: text }
              }
            } else {
              throw new Error('服务器返回空响应')
            }
          } catch (e) {
            if ((e as Error).message === '服务器返回空响应') {
              throw e
            }
            console.error('[FallbackAdapter] ArrayBuffer 解码失败:', e)
            throw new Error('响应解码失败')
          }
        }

        // 解析响应 - 后端格式: { code, msg, data: { content, reasoning, tool_results, data } }
        const result = parsedData as { 
          code?: number
          msg?: string
          data?: {
            content?: string
            reasoning?: string[]
            tool_results?: Array<{
              tool: string
              args?: unknown
              result?: {
                success?: boolean
                message?: string
                error?: string
                data?: unknown
              }
            }>
            data?: unknown
          }
        }

        // 检查响应格式
        if (result.code && result.code !== 200) {
          throw new Error(result.msg || `请求失败: ${result.code}`)
        }

        const responseData = result.data
        
        if (!responseData) {
          console.warn('[FallbackAdapter] 响应没有 data 字段')
          
          // 尝试直接从 result 提取 content（兼容不同的响应格式）
          const anyResult = result as any
          if (anyResult.content) {
            // 格式: { content, reasoning, ... }
            const directContent = anyResult.content as string
            await this.dispatchContent(directContent, callbacks, aborted)
            return
          }
          
          throw new Error('响应格式错误：缺少 data 字段')
        }

        const content = responseData.content || ''
        console.log('[FallbackAdapter] 内容长度:', content.length)

        await this.dispatchContent(content, callbacks, aborted, responseData)

        readyState = 'closed'
        callbacks.onFinally?.()
      } catch (error: unknown) {
        if (!aborted) {
          readyState = 'closed'
          console.error('[FallbackAdapter] 请求失败:', error)
          callbacks.onError?.({ 
            message: (error as Error).message || '请求失败',
          })
          callbacks.onFinally?.()
        }
      }
    })()

    return {
      abort: () => {
        console.log('[FallbackAdapter] 主动取消')
        aborted = true
        readyState = 'closed'
      },
      getReadyState: () => readyState,
    }
  }

  /**
   * 分发内容到回调
   */
  private async dispatchContent(
    content: string,
    callbacks: StreamCallbacks,
    aborted: boolean,
    responseData?: {
      reasoning?: string[]
      tool_results?: Array<{
        tool: string
        result?: {
          success?: boolean
          message?: string
          error?: string
          data?: unknown
        }
      }>
      data?: unknown
    }
  ): Promise<void> {
    // 触发开始事件
    callbacks.onStart?.({
      messageId: Date.now().toString(),
      timestamp: Date.now(),
    })

    // 触发思考步骤
    if (responseData?.reasoning && responseData.reasoning.length > 0) {
      for (const step of responseData.reasoning) {
        if (aborted) return
        console.log('[FallbackAdapter] 推送 reasoning:', step)
        callbacks.onReasoning?.({ step })
        await this.delay(30)
      }
    }

    // 触发工具结果
    if (responseData?.tool_results && responseData.tool_results.length > 0) {
      for (const tr of responseData.tool_results) {
        if (aborted) return
        console.log('[FallbackAdapter] 推送 tool_result:', tr.tool)
        callbacks.onToolResult?.({
          tool: tr.tool,
          success: tr.result?.success ?? true,
          message: tr.result?.message,
          error: tr.result?.error,
          data: tr.result?.data,
        })
      }
    }

    // 模拟流式输出：按字符或词语分割
    const segments = this.splitContent(content)
    
    for (let i = 0; i < segments.length; i++) {
      if (aborted) return
      callbacks.onContent?.({ 
        content: segments[i], 
        index: i 
      })
      await this.delay(10)
    }

    if (!aborted) {
      console.log('[FallbackAdapter] 完成')
      callbacks.onDone?.({
        content,
        reasoning: responseData?.reasoning,
        tool_results: responseData?.tool_results?.map(tr => ({
          tool: tr.tool,
          success: tr.result?.success ?? true,
          message: tr.result?.message,
          error: tr.result?.error,
          data: tr.result?.data,
        })) as ToolResultData[],
        data: responseData?.data,
      })
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 分割内容为片段
   * 按词语分割，避免把汉字拆得太碎
   */
  private splitContent(content: string): string[] {
    if (!content) return []
    
    const segments: string[] = []
    let current = ''
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      current += char
      
      // 遇到标点符号或空格时分割
      if (/[，。！？、；：""''（）《》【】\s,.!?]/.test(char)) {
        if (current.trim()) {
          segments.push(current)
          current = ''
        }
      } else if (current.length >= 3) {
        // 每 3 个字符分割一次
        segments.push(current)
        current = ''
      }
    }
    
    // 添加剩余内容
    if (current.trim()) {
      segments.push(current)
    }
    
    return segments
  }
}
