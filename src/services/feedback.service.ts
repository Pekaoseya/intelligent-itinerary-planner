/**
 * 反馈服务
 * 封装反馈相关的 API 调用
 */

export interface FeedbackData {
  userId: string
  type: 'bug' | 'feature' | 'other'
  description: string
  messages?: any[]
  userInfo?: {
    location?: any
    timestamp?: string
  }
}

export interface FeedbackResponse {
  code: number
  msg: string
  data: {
    id: string
    filename: string
  }
}

class FeedbackService {
  /**
   * 提交反馈
   */
  async submitFeedback(data: FeedbackData): Promise<FeedbackResponse> {
    const { Network } = await import('@/network')
    const res = await Network.request({
      url: '/api/feedback/submit',
      method: 'POST',
      data,
    })
    return res.data
  }
}

// 导出单例
export const feedbackService = new FeedbackService()
