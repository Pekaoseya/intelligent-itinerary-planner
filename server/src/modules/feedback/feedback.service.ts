import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

interface FeedbackData {
  userId: string
  type: 'bug' | 'feature' | 'other'
  description: string
  messages?: any[]
  userInfo?: {
    location?: any
    timestamp?: string
  }
}

@Injectable()
export class FeedbackService {
  private readonly feedbackDir = path.join(process.cwd(), 'feedbacks')

  constructor() {
    // 确保反馈目录存在
    if (!fs.existsSync(this.feedbackDir)) {
      fs.mkdirSync(this.feedbackDir, { recursive: true })
    }
  }

  async saveFeedback(data: FeedbackData): Promise<{ id: string; filename: string }> {
    const feedbackId = `${Date.now()}-${data.userId.substring(0, 8)}`
    const timestamp = new Date().toISOString()

    const feedback = {
      id: feedbackId,
      type: data.type,
      userId: data.userId,
      description: data.description,
      messages: data.messages || [],
      userInfo: data.userInfo || {},
      timestamp,
    }

    // 保存到文件
    const filename = `${feedbackId}.json`
    const filepath = path.join(this.feedbackDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(feedback, null, 2), 'utf-8')

    console.log(`[FeedbackService] 反馈已保存: ${filename}`)
    console.log(`[FeedbackService] 反馈类型: ${data.type}`)
    console.log(`[FeedbackService] 消息数量: ${data.messages?.length || 0}`)

    return {
      id: feedbackId,
      filename,
    }
  }

  /**
   * 获取所有反馈列表（仅用于开发调试）
   */
  async getAllFeedbacks(): Promise<any[]> {
    if (!fs.existsSync(this.feedbackDir)) {
      return []
    }

    const files = fs.readdirSync(this.feedbackDir)
    const feedbacks: any[] = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filepath = path.join(this.feedbackDir, file)
          const content = fs.readFileSync(filepath, 'utf-8')
          feedbacks.push(JSON.parse(content))
        } catch (error) {
          console.error(`[FeedbackService] 读取反馈文件失败: ${file}`, error)
        }
      }
    }

    // 按时间倒序排列
    return feedbacks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }
}
