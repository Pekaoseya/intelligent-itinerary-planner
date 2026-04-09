import { Controller, Post, Body, Res } from '@nestjs/common'
import { AgentService, AgentResponse } from './agent.service'
import { ConflictOptimizer } from './tools/conflict-optimizer'

interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly conflictOptimizer: ConflictOptimizer
  ) {}

  @Post('chat')
  async chat(
    @Body() body: { message: string; userId?: string; userLocation?: UserLocation }
  ): Promise<{ code: number; msg: string; data: AgentResponse }> {
    console.log('[AgentController] 收到消息:', body.message, '位置:', body.userLocation)
    
    const result = await this.agentService.chat(body.message, body.userId, body.userLocation)
    
    return {
      code: 200,
      msg: 'success',
      data: result,
    }
  }

  /**
   * SSE 流式聊天接口
   * 前端通过 EventSource 或 fetch 接收流式事件
   */
  /**
   * SSE 流式聊天接口
   * 前端通过 EventSource 或 fetch 接收流式事件
   */
  @Post('chat/stream')
  async chatStreamPost(
    @Body() body: { message: string; userId?: string; userLocation?: UserLocation },
    @Res() res: any
  ): Promise<void> {
    console.log('[AgentController] SSE 流式请求:', body.message)
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // 禁用 nginx 缓冲
    
    const { message, userId = 'default-user', userLocation } = body
    
    try {
      await this.agentService.chatStream(message, userId, userLocation, (event) => {
        console.log('[AgentController] 推送事件:', event.type)
        // SSE 格式: data: {...}\n\n
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        
        // 如果是完成事件，结束流
        if (event.type === 'done') {
          res.end()
        }
      })
    } catch (error: any) {
      console.error('[AgentController] 流式处理错误:', error)
      res.write(`data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`)
      res.end()
    }
  }

  /**
   * 冲突优化接口
   * 当检测到时间冲突时，AI 分析冲突并生成优化方案
   */
  @Post('optimize-conflicts')
  async optimizeConflicts(
    @Body() body: { conflicts: any[]; userId?: string }
  ): Promise<{ code: number; msg: string; data: any }> {
    console.log('[AgentController] 收到冲突优化请求:', body.conflicts.length, '个冲突')

    const { conflicts, userId = 'default-user' } = body

    const result = await this.conflictOptimizer.optimizeConflicts(conflicts, userId)

    return {
      code: 200,
      msg: 'success',
      data: result,
    }
  }
}
