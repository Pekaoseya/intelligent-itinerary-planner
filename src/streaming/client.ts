/**
 * 流式输出模块 - 统一客户端
 * 
 * 根据运行平台自动选择合适的适配器，提供统一的 API
 */

import Taro from '@tarojs/taro'
import type { 
  StreamOptions, 
  StreamCallbacks, 
  StreamConnection,
  StreamClient,
  Platform 
} from './types'
import { BaseAdapter } from './adapters/base'
import { H5Adapter } from './adapters/h5'
import { WeappAdapter } from './adapters/weapp'
import { FallbackAdapter } from './adapters/fallback'

/**
 * 流式客户端
 * 
 * 自动检测运行平台并选择合适的适配器
 * 提供重试、降级等增强功能
 */
export class StreamingClient implements StreamClient {
  private adapter: BaseAdapter
  private platform: Platform

  constructor() {
    // 检测运行平台
    this.platform = this.detectPlatform()
    this.adapter = this.createAdapter()
    
    console.log('[StreamingClient] 初始化完成，平台:', this.platform)
    console.log('[StreamingClient] 适配器能力:', this.adapter.getCapabilities())
  }

  /**
   * 检测运行平台
   */
  private detectPlatform(): Platform {
    const env = Taro.getEnv()
    
    if (env === Taro.ENV_TYPE.WEAPP) {
      return 'weapp'
    } else if (env === Taro.ENV_TYPE.WEB) {
      return 'h5'
    } else {
      return 'fallback'
    }
  }

  /**
   * 创建适配器
   */
  private createAdapter(): BaseAdapter {
    switch (this.platform) {
      case 'weapp':
        return new WeappAdapter()
      case 'h5':
        return new H5Adapter()
      default:
        return new FallbackAdapter()
    }
  }

  /**
   * 建立流式连接
   */
  connect(options: StreamOptions, callbacks: StreamCallbacks): StreamConnection {
    // 添加降级和重试逻辑
    let hasFallback = false
    let currentConnection: StreamConnection | null = null
    let isAborted = false

    const wrappedCallbacks: StreamCallbacks = {
      ...callbacks,
      onError: (error) => {
        console.log('[StreamingClient] 收到错误:', error)
        
        // 检查是否应该降级
        if (!isAborted && !hasFallback && this.shouldFallback(error)) {
          hasFallback = true
          console.log('[StreamingClient] 触发降级到 FallbackAdapter')
          
          // 使用降级适配器
          const fallbackAdapter = new FallbackAdapter()
          const fallbackOptions = this.getFallbackOptions(options)
          
          currentConnection = fallbackAdapter.connect(fallbackOptions, {
            ...callbacks,
            onError: (fallbackError) => {
              // 降级也失败，返回原始错误
              console.error('[StreamingClient] 降级也失败:', fallbackError)
              callbacks.onError?.(error)
            },
          })
        } else {
          // 已经降级过或不应该降级，直接返回错误
          callbacks.onError?.(error)
        }
      },
    }

    // 使用主适配器连接
    currentConnection = this.adapter.connect(options, wrappedCallbacks)

    // 返回包装的连接对象
    return {
      abort: () => {
        isAborted = true
        currentConnection?.abort()
      },
      getReadyState: () => currentConnection?.getReadyState() || 'closed',
    }
  }

  /**
   * 判断是否应该降级
   */
  private shouldFallback(error: { code?: number | string; message: string }): boolean {
    // 流式输出不支持时降级
    const fallbackCodes = [
      'CHUNKED_NOT_SUPPORTED',
      'CHUNKED_NOT_TRIGGERED',
    ]
    
    if (error.code && fallbackCodes.includes(String(error.code))) {
      return true
    }
    
    // 网络错误也尝试降级
    const networkErrors = [
      'request:fail',
      'NETWORK_ERROR',
    ]
    
    const errorMessage = error.message.toLowerCase()
    return networkErrors.some(e => errorMessage.includes(e.toLowerCase()))
  }

  /**
   * 获取降级选项
   */
  private getFallbackOptions(options: StreamOptions): StreamOptions {
    // 修改 URL 为非流式端点
    let fallbackUrl = options.url
    
    // 移除 /stream 后缀
    if (fallbackUrl.endsWith('/stream')) {
      fallbackUrl = fallbackUrl.slice(0, -7) // 移除 '/stream'
    }
    
    console.log('[StreamingClient] 降级 URL:', fallbackUrl, '(原:', options.url, ')')
    
    return {
      ...options,
      url: fallbackUrl,
    }
  }

  /**
   * 获取当前平台
   */
  getPlatform(): Platform {
    return this.platform
  }

  /**
   * 获取适配器能力
   */
  getCapabilities() {
    return this.adapter.getCapabilities()
  }
}

// ============ 便捷方法 ============

/**
 * 创建流式客户端实例
 */
export function createStreamingClient(): StreamingClient {
  return new StreamingClient()
}

// ============ 单例导出 ============

/**
 * 默认流式客户端实例
 * 
 * 使用示例:
 * ```typescript
 * import { streamingClient } from '@/streaming'
 * 
 * const connection = streamingClient.connect({
 *   url: '/api/agent/chat/stream',
 *   method: 'POST',
 *   data: { message: '你好' },
 * }, {
 *   onContent: (data) => {
 *     console.log('收到内容:', data.content)
 *   },
 *   onDone: (data) => {
 *     console.log('完成:', data.content)
 *   },
 * })
 * 
 * // 需要取消时
 * connection.abort()
 * ```
 */
export const streamingClient = new StreamingClient()
