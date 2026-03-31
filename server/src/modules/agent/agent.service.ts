/**
 * AI Agent 服务
 * 让 LLM 真正理解用户、调用工具、生成思考
 */

import { Injectable, Logger } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { TOOLS, TOOL_NAMES, ToolResult } from './tools/definitions'
import { executeTool, resetMultiSegmentState } from './tools'

// 用户位置信息
interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

// 用户统计数据
interface UserStats {
  travel: {
    total_trips: number
    by_type: { taxi: number; train: number; flight: number }
    top_locations: { name: string; count: number }[]
    time_distribution: { morning: number; afternoon: number; evening: number; night: number }
  } | null
  schedule: {
    total_tasks: number
    completed: number
    completion_rate: number
    by_type: Record<string, number>
  } | null
  preferences: {
    default_travel_type: string
    reminder_minutes: number
  } | null
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface AgentResponse {
  content: string
  reasoning: string[] // 思考过程（实时生成）
  tool_results: Array<{
    tool: string
    args: any
    result: ToolResult
  }>
  data?: any
}

// 存储的消息格式
interface StoredMessage {
  role: string
  content: string
}

@Injectable()
export class AgentService {
  private llmClient: LLMClient
  private supabase = getSupabaseClient()
  private readonly logger = new Logger(AgentService.name)

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  /**
   * 获取用户统计数据（用于 RAG 增强）
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    try {
      // 获取所有任务
      const { data: tasks } = await this.supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      const allTasks = tasks || []

      // 出行统计
      const travelTasks = allTasks.filter(t => ['taxi', 'train', 'flight'].includes(t.type))
      const travelByType = {
        taxi: travelTasks.filter(t => t.type === 'taxi').length,
        train: travelTasks.filter(t => t.type === 'train').length,
        flight: travelTasks.filter(t => t.type === 'flight').length,
      }

      // 常去地点
      const locationCount: Record<string, number> = {}
      allTasks.forEach(task => {
        if (task.destination_name) {
          locationCount[task.destination_name] = (locationCount[task.destination_name] || 0) + 1
        }
      })
      const topLocations = Object.entries(locationCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

      // 时段分布
      const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 }
      allTasks.forEach(task => {
        const date = new Date(task.scheduled_time)
        const hour = date.getHours()
        if (hour >= 6 && hour < 12) timeDistribution.morning++
        else if (hour >= 12 && hour < 18) timeDistribution.afternoon++
        else if (hour >= 18 && hour < 24) timeDistribution.evening++
        else timeDistribution.night++
      })

      // 日程统计
      const totalTasks = allTasks.length
      const completedTasks = allTasks.filter(t => t.status === 'completed').length

      // 类型分布
      const typeDistribution: Record<string, number> = {}
      allTasks.forEach(task => {
        typeDistribution[task.type] = (typeDistribution[task.type] || 0) + 1
      })

      // 获取用户偏好
      const { data: preferences } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      return {
        travel: {
          total_trips: travelTasks.length,
          by_type: travelByType,
          top_locations: topLocations,
          time_distribution: timeDistribution,
        },
        schedule: {
          total_tasks: totalTasks,
          completed: completedTasks,
          completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          by_type: typeDistribution,
        },
        preferences: preferences ? {
          default_travel_type: preferences.default_travel_type || 'taxi',
          reminder_minutes: preferences.reminder_minutes || 30,
        } : null,
      }
    } catch (error) {
      this.logger.error('获取用户统计失败:', error)
      return { travel: null, schedule: null, preferences: null }
    }
  }

  /**
   * 获取或创建用户的当前对话
   */
  private async getOrCreateConversation(userId: string): Promise<string> {
    // 查找用户最近的对话（24小时内）
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: existingConv } = await this.supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .gte('updated_at', oneDayAgo)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (existingConv) {
      return existingConv.id
    }

    // 创建新对话
    const { data: newConv, error } = await this.supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: '新对话',
      })
      .select('id')
      .single()

    if (error || !newConv) {
      this.logger.error('创建对话失败:', error)
      return 'default'
    }

    return newConv.id
  }

  /**
   * 加载最近的对话历史
   */
  private async loadRecentMessages(conversationId: string, limit: number = 10): Promise<StoredMessage[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      this.logger.error('加载历史消息失败:', error)
      return []
    }

    return (data || []).filter(m => m.role === 'user' || m.role === 'assistant')
  }

  /**
   * 保存消息到数据库
   */
  private async saveMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    reasoning?: string[],
    toolResults?: any[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        reasoning: reasoning?.join('\n'),
        tool_calls: toolResults,
      })

    if (error) {
      this.logger.error('保存消息失败:', error)
    }

    // 更新对话的 updated_at
    await this.supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  /**
   * 流式处理用户消息（SSE）
   * 通过回调函数实时推送进度
   */
  async chatStream(
    userMessage: string,
    userId: string,
    userLocation: UserLocation | undefined,
    onProgress: (event: { type: string; data: any }) => void
  ): Promise<AgentResponse> {
    this.logger.log(`[Agent] 用户消息: ${userMessage}, 位置: ${userLocation?.name || '未知'}`)

    // 重置多段行程状态（每次新请求都重置）
    resetMultiSegmentState()

    const reasoning: string[] = []
    const toolResults: AgentResponse['tool_results'] = []

    // 推送开始事件
    onProgress({ type: 'start', data: { message: '正在思考...' } })

    // =============================================
    // Step 1: 获取对话 ID、历史消息、用户统计数据
    // =============================================
    const conversationId = await this.getOrCreateConversation(userId)
    const historyMessages = await this.loadRecentMessages(conversationId, 10)
    const userStats = await this.getUserStats(userId)
    
    this.logger.log(`[Agent] 加载了 ${historyMessages.length} 条历史消息`)

    // =============================================
    // Step 2: 构建系统提示词（含用户偏好参考）
    // =============================================
    const systemPrompt = this.buildSystemPrompt(userId, userLocation, userStats)

    // 构建消息列表：系统提示 + 历史消息 + 当前消息
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
    ]

    // 添加历史消息
    for (const msg of historyMessages) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })
    }

    // 添加当前用户消息
    messages.push({ role: 'user', content: userMessage })

    // 保存用户消息
    await this.saveMessage(conversationId, userId, 'user', userMessage)

    // =============================================
    // Step 3: 使用流式调用 AI
    // =============================================
    reasoning.push('正在理解您的需求...')
    onProgress({ type: 'reasoning', data: { step: '正在理解您的需求...' } })

    // 使用流式调用
    const stream = this.llmClient.stream(
      messages.filter(m => m.role !== 'tool').map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      { model: 'doubao-seed-1-6-lite-251015', temperature: 0.3 }
    )

    let aiContent = ''
    try {
      for await (const chunk of stream) {
        if (chunk.content) {
          aiContent += chunk.content
          // 第一轮输出是 JSON 格式，不推送给前端（避免显示内部结构）
        }
      }
    } catch (streamError) {
      this.logger.error('流式调用失败:', streamError)
      // 降级为普通调用
      const fallbackResponse = await this.llmClient.invoke(
        messages.filter(m => m.role !== 'tool').map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
        { model: 'doubao-seed-1-6-lite-251015', temperature: 0.3 }
      )
      aiContent = fallbackResponse.content
    }

    this.logger.log(`[Agent] AI 原始响应: ${aiContent}`)

    // =============================================
    // Step 4: 解析 AI 响应，提取工具调用
    // =============================================
    const parsedResponse = this.parseAIResponse(aiContent)
    
    if (parsedResponse.reasoning) {
      reasoning.push(parsedResponse.reasoning)
      onProgress({ type: 'reasoning', data: { step: parsedResponse.reasoning } })
    }

    // =============================================
    // Step 5: 执行工具调用
    // =============================================
    if (parsedResponse.toolCalls && parsedResponse.toolCalls.length > 0) {
      for (const toolCall of parsedResponse.toolCalls) {
        reasoning.push(`准备执行: ${toolCall.name}`)
        onProgress({ type: 'reasoning', data: { step: `正在${this.getToolDisplayName(toolCall.name)}...` } })
        
        const result = await executeTool(toolCall.name, toolCall.arguments, userId, userLocation)
        
        toolResults.push({
          tool: toolCall.name,
          args: toolCall.arguments,
          result,
        })

        // 不再把 result.message 加入 reasoning，避免在思考过程中重复显示工具结果
        // tool_result 已经通过 onProgress 单独推送给前端处理
        onProgress({ type: 'tool_result', data: { tool: toolCall.name, success: result.success, message: result.message } })

        // 将结果返回给 AI 继续处理
        messages.push({
          role: 'tool',
          name: toolCall.name,
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }

      // 如果有工具调用，让 AI 生成最终回复
      if (toolResults.length > 0) {
        reasoning.push('正在生成回复...')
        onProgress({ type: 'reasoning', data: { step: '正在生成回复...' } })
        
        // 构建工具结果摘要
        const toolResultsSummary = toolResults.map(tr => 
          `工具 ${tr.tool}: ${tr.result.message || (tr.result.success ? '成功' : '失败')}`
        ).join('\n')
        
        // 让 AI 基于工具结果生成友好的回复
        const finalPrompt = `根据以下工具执行结果，用简洁友好的语言回复用户（不要输出JSON，直接说人话）：

工具执行结果：
${toolResultsSummary}

用户原始消息：${userMessage}`

        // 流式生成最终回复
        const finalStream = this.llmClient.stream(
          [{ role: 'user', content: finalPrompt }],
          { model: 'doubao-seed-1-6-lite-251015', temperature: 0.7 }
        )

        let finalContent = ''
        try {
          for await (const chunk of finalStream) {
            if (chunk.content) {
              finalContent += chunk.content
              onProgress({ type: 'content', data: { content: chunk.content } })
            }
          }
        } catch (streamError) {
          this.logger.error('最终回复流式调用失败:', streamError)
          const fallbackResponse = await this.llmClient.invoke(
            [{ role: 'user', content: finalPrompt }],
            { model: 'doubao-seed-1-6-lite-251015', temperature: 0.7 }
          )
          finalContent = fallbackResponse.content
        }

        // 清理可能存在的 JSON 代码块
        const cleanContent = this.cleanJsonFromContent(finalContent)

        // 保存 AI 响应
        await this.saveMessage(conversationId, userId, 'assistant', cleanContent, reasoning, toolResults)

        // 推送完成事件
        onProgress({ type: 'done', data: { 
          content: cleanContent, 
          reasoning, 
          tool_results: toolResults,
          data: this.extractDataFromResults(toolResults)
        }})

        return {
          content: cleanContent,
          reasoning,
          tool_results: toolResults,
          data: this.extractDataFromResults(toolResults),
        }
      }
    }

    // =============================================
    // Step 6: 没有工具调用，直接返回 AI 回复
    // =============================================
    const responseContent = this.cleanJsonFromContent(parsedResponse.content || aiContent)
    
    // 保存 AI 响应
    await this.saveMessage(conversationId, userId, 'assistant', responseContent, reasoning)

    // 推送完成事件
    onProgress({ type: 'done', data: { 
      content: responseContent, 
      reasoning, 
      tool_results: toolResults 
    }})

    return {
      content: responseContent,
      reasoning,
      tool_results: toolResults,
    }
  }

  /**
   * 获取工具的显示名称
   */
  private getToolDisplayName(toolName: string): string {
    const names: Record<string, string> = {
      task_create: '创建任务',
      task_delete: '删除任务',
      task_update: '更新任务',
      task_query: '查询任务',
    }
    return names[toolName] || toolName
  }

  /**
   * 非流式处理用户消息（保留兼容）
   */
  async chat(
    userMessage: string, 
    userId: string = 'default-user',
    userLocation?: UserLocation
  ): Promise<AgentResponse> {
    // 使用流式方法但不处理进度回调
    return this.chatStream(userMessage, userId, userLocation, () => {})
  }

  /**
   * 清理内容中的 JSON 代码块
   */
  private cleanJsonFromContent(content: string): string {
    if (!content) return ''
    
    // 移除 ```json ... ``` 代码块
    let cleaned = content.replace(/```json\s*[\s\S]*?```/g, '').trim()
    
    // 移除单独的 ``` ... ``` 代码块
    cleaned = cleaned.replace(/```\s*[\s\S]*?```/g, '').trim()
    
    // 如果内容只剩下 JSON 对象，尝试提取 content 字段
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleaned)
        if (parsed.content) {
          return parsed.content
        }
      } catch {
        // 解析失败，返回原内容
      }
    }
    
    return cleaned || content
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(userId: string, userLocation?: UserLocation, userStats?: UserStats): string {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 5)
    
    // 计算常用日期
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    const dayAfterTomorrow = new Date(now)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0]
    
    // 用户位置信息
    const locationInfo = userLocation 
      ? `- 经纬度: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}
- 地点名称: ${userLocation.name || '当前位置'}`
      : '- 未获取到位置（使用默认位置：杭州西湖）'

    // 用户统计数据 - 用于 RAG 增强
    let userContextSection = ''
    if (userStats) {
      const parts: string[] = []
      
      // 出行偏好
      if (userStats.travel && userStats.travel.total_trips > 0) {
        const { travel } = userStats
        const mostUsedType = Object.entries(travel.by_type)
          .sort((a, b) => b[1] - a[1])[0]
        const mostUsedTime = Object.entries(travel.time_distribution)
          .sort((a, b) => b[1] - a[1])[0]
        const timeNames: Record<string, string> = { morning: '上午', afternoon: '下午', evening: '晚间', night: '凌晨' }
        
        parts.push(`- 历史出行 ${travel.total_trips} 次，最常用 ${mostUsedType[0] === 'taxi' ? '打车' : mostUsedType[0] === 'train' ? '高铁' : '飞机'} (${mostUsedType[1]}次)`)
        if (travel.top_locations.length > 0) {
          parts.push(`- 常去地点: ${travel.top_locations.slice(0, 3).map(l => l.name).join('、')}`)
        }
        parts.push(`- 偏好出行时段: ${timeNames[mostUsedTime[0]] || mostUsedTime[0]}`)
      }
      
      // 日程习惯
      if (userStats.schedule && userStats.schedule.total_tasks > 0) {
        const { schedule } = userStats
        const mostType = Object.entries(schedule.by_type)
          .sort((a, b) => b[1] - a[1])[0]
        parts.push(`- 累计任务 ${schedule.total_tasks} 个，完成率 ${schedule.completion_rate}%`)
        if (mostType) {
          const typeNames: Record<string, string> = { meeting: '会议', taxi: '打车', train: '高铁', flight: '飞机', dining: '用餐', hotel: '酒店', todo: '事务' }
          parts.push(`- 最常见任务类型: ${typeNames[mostType[0]] || mostType[0]} (${mostType[1]}次)`)
        }
      }
      
      // 用户偏好设置
      if (userStats.preferences) {
        const typeNames: Record<string, string> = { taxi: '打车', train: '高铁', flight: '飞机' }
        parts.push(`- 默认出行方式: ${typeNames[userStats.preferences.default_travel_type] || userStats.preferences.default_travel_type}`)
      }
      
      if (parts.length > 0) {
        userContextSection = `
## 用户偏好参考（基于历史数据）

${parts.join('\n')}

当用户未明确指定时，可参考以上偏好做推荐。
`
      }
    }

    return `你是一个智能任务管理助手。你可以帮助用户管理各种类型的任务：打车、火车、飞机、会议、餐饮、酒店、事务等。

## 当前时间
- 今天: ${today} (${this.getWeekday(now)})
- 当前时间: ${time}
- 明天: ${tomorrowStr} (${this.getWeekday(tomorrow)})
- 后天: ${dayAfterTomorrowStr} (${this.getWeekday(dayAfterTomorrow)})
${userContextSection}
## 用户当前位置
${locationInfo}

当用户说"去XXX"但没有指定起点时，默认从用户当前位置出发。

## 重要规则

1. **不确定就问，不要猜**：如果用户的表述有歧义或缺少关键信息，直接询问用户
2. **像人一样对话**：遇到不清楚的地方，自然地追问
3. **时间冲突由工具自动检测**：创建任务时工具会自动检查
4. **智能推算时间**：打车30分钟、火车提前30分钟、飞机提前2小时、会议1小时

## 日期参考

- 今天 = ${today}
- 明天 = ${tomorrowStr}
- 后天 = ${dayAfterTomorrowStr}

## 可用工具

${TOOL_NAMES.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## 响应格式

以 JSON 格式回复，包含 reasoning（思考过程）、tool_calls（工具调用）、content（直接回复用户）。
\``
  }

  /**
   * 解析 AI 响应
   */
  private parseAIResponse(content: string): {
    reasoning?: string
    toolCalls?: ToolCall[]
    content?: string
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1])
        return {
          reasoning: parsed.reasoning,
          toolCalls: parsed.tool_calls,
          content: parsed.content,
        }
      }

      // 尝试直接解析 JSON
      const directMatch = content.match(/\{[\s\S]*\}/)
      if (directMatch) {
        const parsed = JSON.parse(directMatch[0])
        return {
          reasoning: parsed.reasoning,
          toolCalls: parsed.tool_calls,
          content: parsed.content,
        }
      }
    } catch (e) {
      this.logger.error('解析 AI 响应失败:', e)
    }

    // 无法解析为 JSON，作为普通文本返回
    return { content }
  }

  /**
   * 从工具结果中提取数据
   * 收集任务参数预览，用于用户确认后批量执行
   */
  private extractDataFromResults(results: AgentResponse['tool_results']): any {
    const data: any = {}
    const pendingTasks: any[] = []
    const pendingDeleteTasks: any[] = []
    const pendingDeleteIds: string[] = []

    for (const r of results) {
      if (r.result.success && r.result.data) {
        // 根据工具类型提取数据
        if (r.tool === 'task_query') {
          data.tasks = r.result.data.tasks
        } else if (r.tool === 'task_create') {
          // 收集预览任务参数
          const resultData = r.result.data
          if (resultData.preview && resultData.task) {
            pendingTasks.push(resultData.task)
          }
        } else if (r.tool === 'task_update') {
          // 任务更新预览
          const resultData = r.result.data
          if (resultData.preview) {
            data.needConfirmation = true
            data.confirmType = 'modify'
            data.originalTask = resultData.originalTask
            data.updatedTask = resultData.updatedTask
            data.updates = resultData.updates
          }
        } else if (r.tool === 'task_delete') {
          // 收集待删除任务
          const resultData = r.result.data
          if (resultData.preview) {
            if (resultData.tasks && resultData.tasks.length > 0) {
              pendingDeleteTasks.push(...resultData.tasks)
              pendingDeleteIds.push(...(resultData.taskIds || resultData.tasks.map((t: any) => t.id)))
            }
          }
        }
      }
    }

    // 如果有待创建的任务
    if (pendingTasks.length > 0) {
      data.needConfirmation = true
      data.confirmType = 'batch_add'
      data.pendingTasks = pendingTasks
      data.pendingCount = pendingTasks.length
    }

    // 如果有待删除的任务
    if (pendingDeleteTasks.length > 0) {
      data.needConfirmation = true
      data.confirmType = 'batch_delete'
      data.pendingDeleteTasks = pendingDeleteTasks
      data.pendingDeleteIds = pendingDeleteIds
      data.pendingDeleteCount = pendingDeleteTasks.length
    }

    return Object.keys(data).length > 0 ? data : undefined
  }

  /**
   * 获取明天的日期
   */
  private getTomorrowDate(): string {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  /**
   * 获取星期几
   */
  private getWeekday(date: Date): string {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[date.getDay()]
  }
}
