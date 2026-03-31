/**
 * AI Agent 服务
 * 封装 AI 对话相关的 API 调用
 */

import type { UserLocation } from '@/types'

// =============================================
// 类型定义
// =============================================

export interface ChatMessage {
  message: string
  userId: string
  userLocation?: UserLocation | null
}

export interface ChatResponse {
  content: string
  reasoning?: string[]
  tool_results?: any[]
  data?: any
  needConfirmation?: boolean
  confirmType?: string
  pendingTasks?: any[]
  pendingDeleteTasks?: any[]
  pendingDeleteIds?: string[]
  updatedTask?: any
  originalTask?: any
}

// =============================================
// Agent Service
// =============================================

class AgentService {
  /**
   * 发送消息给 AI Agent（非流式）
   */
  async sendMessage(params: ChatMessage): Promise<ChatResponse> {
    // 注意：实际使用中，AI 对话主要通过流式接口
    // 这里提供一个非流式的备选方案
    const { Network } = await import('@/network')
    const res = await Network.request({
      url: '/api/agent/chat',
      method: 'POST',
      data: params,
    })
    return res.data?.data || { content: '' }
  }

  /**
   * 获取流式对话的 URL
   */
  getStreamUrl(): string {
    return '/api/agent/chat/stream'
  }

  /**
   * 构建流式请求参数
   */
  buildStreamParams(message: string, userId: string, userLocation?: UserLocation | null) {
    return {
      message,
      userId,
      userLocation,
    }
  }
}

// 导出单例
export const agentService = new AgentService()
