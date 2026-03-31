/**
 * AI Agent 服务
 * 让 LLM 真正理解用户、调用工具、生成思考
 */

import { Injectable, Logger } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { TOOLS, TOOL_NAMES, ToolResult } from './tools/definitions'
import { executeTool, resetMultiSegmentState } from './tools/executor'

// 用户位置信息
interface UserLocation {
  latitude: number
  longitude: number
  name?: string
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
    // Step 1: 获取对话 ID 并加载历史消息
    // =============================================
    const conversationId = await this.getOrCreateConversation(userId)
    const historyMessages = await this.loadRecentMessages(conversationId, 10)
    
    this.logger.log(`[Agent] 加载了 ${historyMessages.length} 条历史消息`)

    // =============================================
    // Step 2: 构建系统提示词
    // =============================================
    const systemPrompt = this.buildSystemPrompt(userId, userLocation)

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
  private buildSystemPrompt(userId: string, userLocation?: UserLocation): string {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 5)
    
    // 用户位置信息
    const locationInfo = userLocation 
      ? `- 经纬度: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}
- 地点名称: ${userLocation.name || '当前位置'}`
      : '- 未获取到位置（使用默认位置：杭州西湖）'

    return `你是一个智能任务管理助手。你可以帮助用户管理各种类型的任务：打车、火车、飞机、会议、餐饮、酒店、事务等。

## 当前时间
- 日期: ${today}
- 时间: ${time}

## 用户当前位置
${locationInfo}

**重要**：当用户说"去XXX"但没有指定起点时，默认从用户当前位置出发！

## 可用工具
你可以调用以下工具来完成任务：

${TOOL_NAMES.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## 工具参数说明

### task_create 参数
- title (必需): 任务标题
- type (必需): taxi | train | flight | meeting | dining | hotel | todo | other
- scheduled_time (必需): 计划时间，ISO格式
- location_name: 地点名称（起点）
- destination_name: 目的地（出行类）
- metadata: 类型特定数据（JSON对象）

### task_delete 参数
- task_id: 直接删除指定ID的任务
- filter: 按条件删除
  - type: 按类型
  - date: 按日期 (YYYY-MM-DD)
  - keyword: 按关键词
  - expired: true 只删除过期的
  - all: true 删除所有
- confirm: true 确认删除（批量删除时需要）

### task_update 参数
- task_id: 任务ID
- filter: { keyword: "关键词" } 用于匹配任务
- updates: 要更新的字段

### task_query 参数
- filter: 筛选条件
  - date: 某天
  - type: 类型
  - keyword: 关键词
- limit: 返回数量

## 响应格式

你必须以 JSON 格式回复：

\`\`\`json
{
  "reasoning": "你的思考过程，告诉用户你在想什么",
  "tool_calls": [
    {
      "id": "call_1",
      "name": "工具名称",
      "arguments": { 工具参数 }
    }
  ],
  "content": "如果不调用工具，这里是对用户的回复"
}
\`\`\`

## 重要规则

1. **理解用户意图**：不要预设关键词，真正理解用户想做什么
2. **创建任务流程**（重要！）：
   - 第一步：先用 task_query 查询当天或相关时间段是否已有安排
   - 第二步：检查是否有时间冲突（会议默认1小时）
   - 第三步：如果无冲突，立即调用 task_create 创建任务
   - 第四步：如果有冲突，提醒用户并建议调整时间
3. **时间冲突检测**（重要！）：
   - 会议默认持续1小时，15:00的会议和15:30的会议会重叠
   - 如果新任务与现有任务时间重叠（±1小时内），必须提醒用户
   - 示例：已有15:00会议，用户要创建15:30会议 → 提醒"您15:00已有会议，建议改到16:00"
4. **删除任务规则**：
   - "删除XXX"或"撤回刚才的安排" → 只删除最近创建的任务
   - 不要删除更早的安排
5. **理解隐含意图**（重要！）：
   - "附近开会" = 本地会议，type=meeting，不需要交通
   - "去XX玩/旅游" = 跨城旅行，需要规划完整行程：
     * 去程交通（打车到车站/机场 + 高铁/飞机）
     * 目的地交通（打车到酒店/景点）
     * 住宿（type=hotel）
     * 餐饮（type=dining，午餐12:00、晚餐18:00）
     * 景点游览（type=todo）
     * 返程交通（飞机/高铁 + 打车回家）
   - 一次性创建所有任务，使用不同的 type（taxi/train/flight/hotel/dining/todo）
6. **避免重复创建**：
   - 创建任务前检查是否已有相似任务
   - 不要创建多个相同的任务
7. **智能推算时间**：
   - 打车：市内30分钟，跨区1小时
   - 火车：提前30分钟到站
   - 飞机：提前2小时到机场
   - 会议：默认1小时
   - 用餐：午餐12:00，晚餐18:00
   - 景点：每个2-3小时

## 示例

用户: "明天下午3点开会"
\`\`\`json
{
  "reasoning": "用户想创建明天下午3点的会议。我先查询明天是否有冲突，然后创建任务。",
  "tool_calls": [
    {
      "id": "call_1",
      "name": "task_query",
      "arguments": { "filter": { "date": "${this.getTomorrowDate()}" } }
    },
    {
      "id": "call_2",
      "name": "task_create",
      "arguments": {
        "title": "会议",
        "type": "meeting",
        "scheduled_time": "${this.getTomorrowDate()}T15:00:00"
      }
    }
  ]
}
\`\`\`

用户: "删除产品评审会"
\`\`\`json
{
  "reasoning": "用户想删除名为'产品评审会'的任务。我直接调用task_delete工具，使用关键词筛选。",
  "tool_calls": [{
    "id": "call_1",
    "name": "task_delete",
    "arguments": {
      "filter": { "keyword": "产品评审会" }
    }
  }]
}
\`\`\`

用户: "后天去上海玩两天"
\`\`\`json
{
  "reasoning": "用户要去上海玩两天，需要规划完整行程：去程交通、住宿、餐饮、景点、返程。后天出发，大后天返回。",
  "tool_calls": [
    { "id": "call_1", "name": "task_create", "arguments": { "title": "打车到火车站", "type": "taxi", "scheduled_time": "2026-03-26T07:30:00", "location_name": "家", "destination_name": "火车站" } },
    { "id": "call_2", "name": "task_create", "arguments": { "title": "高铁去上海", "type": "train", "scheduled_time": "2026-03-26T08:30:00", "location_name": "本地火车站", "destination_name": "上海虹桥站", "metadata": { "train_number": "Gxxxx" } } },
    { "id": "call_3", "name": "task_create", "arguments": { "title": "打车到酒店", "type": "taxi", "scheduled_time": "2026-03-26T11:00:00", "location_name": "上海虹桥站", "destination_name": "酒店" } },
    { "id": "call_4", "name": "task_create", "arguments": { "title": "午餐", "type": "dining", "scheduled_time": "2026-03-26T12:00:00", "location_name": "上海" } },
    { "id": "call_5", "name": "task_create", "arguments": { "title": "游览外滩", "type": "todo", "scheduled_time": "2026-03-26T14:00:00", "location_name": "外滩" } },
    { "id": "call_6", "name": "task_create", "arguments": { "title": "晚餐", "type": "dining", "scheduled_time": "2026-03-26T18:00:00", "location_name": "上海" } },
    { "id": "call_7", "name": "task_create", "arguments": { "title": "酒店住宿", "type": "hotel", "scheduled_time": "2026-03-26T20:00:00", "location_name": "上海" } },
    { "id": "call_8", "name": "task_create", "arguments": { "title": "返程高铁", "type": "train", "scheduled_time": "2026-03-27T16:00:00", "location_name": "上海虹桥站", "destination_name": "本地火车站" } },
    { "id": "call_9", "name": "task_create", "arguments": { "title": "打车回家", "type": "taxi", "scheduled_time": "2026-03-27T19:00:00", "location_name": "火车站", "destination_name": "家" } }
  ]
}
\`\`\`

用户: "删除所有行程"
\`\`\`json
{
  "reasoning": "用户想删除所有任务。我需要先查询有哪些任务，然后让用户确认。",
  "tool_calls": [{
    "id": "call_1",
    "name": "task_delete",
    "arguments": {
      "filter": { "all": true },
      "confirm": false
    }
  }]
}
\`\`\`

用户: "帮我叫个车去机场"
\`\`\`json
{
  "reasoning": "用户想打车去机场。我需要确认出发地和具体时间。",
  "content": "好的，我帮您叫车去机场。请问您现在在哪里出发？什么时候用车？"
}
\`\`\``
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
   */
  private extractDataFromResults(results: AgentResponse['tool_results']): any {
    const data: any = {}

    for (const r of results) {
      if (r.result.success && r.result.data) {
        // 根据工具类型提取数据
        if (r.tool === 'task_query') {
          data.tasks = r.result.data.tasks
        } else if (r.tool === 'task_create' || r.tool === 'task_update') {
          data.task = r.result.data
        } else if (r.tool === 'task_delete') {
          if (r.result.data.deleted) {
            data.deleted = r.result.data.deleted
          } else if (r.result.data.count) {
            data.deletedCount = r.result.data.count
          }
        }
      }
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
}
