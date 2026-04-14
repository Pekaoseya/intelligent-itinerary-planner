import { Controller, Post, Body } from '@nestjs/common'
import { FeedbackService } from './feedback.service'

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

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('submit')
  async submitFeedback(@Body() body: FeedbackData) {
    console.log('[FeedbackController] 收到反馈:', body.type, body.description?.substring(0, 100))

    const result = await this.feedbackService.saveFeedback(body)

    return {
      code: 200,
      msg: '反馈提交成功',
      data: result,
    }
  }
}
