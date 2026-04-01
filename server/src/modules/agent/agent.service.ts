/**
 * AI Agent 服务
 * 让 LLM 真正理解用户、调用工具、生成思考
 */

import { Injectable, Logger } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { TOOLS, TOOL_NAMES, ToolResult } from './tools/definitions'
import { executeTool, resetMultiSegmentState } from './tools'
import { UserContextService } from '../user-context/user-context.service'
import { type ProgressCallback, type AgentProgressEvent } from './progress'

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

  constructor(private readonly userContextService: UserContextService) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  /**
   * 获取用户统计数据（用于 RAG 增强）
   */
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
    // 获取用户上下文（用于 AI 模型）
    const userContextText = await this.userContextService.getModelContext(userId)
    
    this.logger.log(`[Agent] 加载了 ${historyMessages.length} 条历史消息`)

    // =============================================
    // Step 2: 构建系统提示词（含用户偏好参考）
    // =============================================
    const systemPrompt = this.buildSystemPrompt(userId, userLocation, userContextText)

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
      // 去重：避免 AI 返回重复的工具调用
      const uniqueToolCalls = parsedResponse.toolCalls.filter((tc, index, self) => 
        index === self.findIndex(t => t.name === tc.name && JSON.stringify(t.arguments) === JSON.stringify(tc.arguments))
      )
      
      for (const toolCall of uniqueToolCalls) {
        // 避免重复添加 reasoning
        const reasoningStep = `准备执行: ${toolCall.name}`
        if (!reasoning.includes(reasoningStep)) {
          reasoning.push(reasoningStep)
        }
        onProgress({ type: 'reasoning', data: { step: `正在${this.getToolDisplayName(toolCall.name)}...` } })
        
        // 创建子 Agent 进度回调，将进度推送给前端
        const toolProgressCallback: ProgressCallback = (event: AgentProgressEvent) => {
          onProgress({ 
            type: 'sub_agent_progress', 
            data: {
              agent: event.agent,
              phase: event.phase,
              message: event.message,
              messageKey: event.messageKey,
              data: event.data,
              timestamp: event.timestamp,
            }
          })
        }
        
        const result = await executeTool(toolCall.name, toolCall.arguments, userId, userLocation, toolProgressCallback)
        
        toolResults.push({
          tool: toolCall.name,
          args: toolCall.arguments,
          result,
        })

        // =============================================
        // 智能重试机制：当工具返回 retryHint 时，让 AI 重新理解参数
        // =============================================
        if (!result.success && result.retryHint) {
          this.logger.log(`[Agent] 工具 ${toolCall.name} 参数有误，触发智能重试`)
          
          // 构建重试提示，让 AI 理解正确的参数
          const retryPrompt = `${result.error}

你之前调用的参数是:
${JSON.stringify(toolCall.arguments, null, 2)}

请立即用正确的参数名重新调用工具。

必须返回 JSON 格式的工具调用，例如：
\`\`\`json
{
  "reasoning": "我理解了，应该使用 origin 和 destination 参数",
  "tool_calls": [
    {
      "name": "trip_plan",
      "arguments": {
        "origin": "杭州",
        "destination": "上海"
      }
    }
  ]
}
\`\`\`

现在请重新调用工具。`

          // 让 AI 重新生成工具调用
          const retryStream = this.llmClient.stream(
            [
              { role: 'system', content: this.buildSystemPrompt(userId, userLocation) },
              { role: 'user', content: retryPrompt }
            ],
            { model: 'doubao-seed-1-6-lite-251015', temperature: 0.1 }
          )

          let retryContent = ''
          try {
            for await (const chunk of retryStream) {
              if (chunk.content) {
                retryContent += chunk.content
              }
            }
          } catch (retryStreamError) {
            this.logger.error('重试流式调用失败:', retryStreamError)
          }

          this.logger.log(`[Agent] AI 重试响应: ${retryContent}`)

          // 解析重试响应，提取新的工具调用
          const retryParsed = this.parseAIResponse(retryContent)
          if (retryParsed.toolCalls && retryParsed.toolCalls.length > 0) {
            // 用新的工具调用替换原来失败的调用
            const retryToolCall = retryParsed.toolCalls[0]
            this.logger.log(`[Agent] AI 重试调用: ${retryToolCall.name}, 参数: ${JSON.stringify(retryToolCall.arguments)}`)
            
            // 重新执行工具
            const retryResult = await executeTool(retryToolCall.name, retryToolCall.arguments, userId, userLocation, toolProgressCallback)
            
            // 更新结果
            toolResults[toolResults.length - 1] = {
              tool: retryToolCall.name,
              args: retryToolCall.arguments,
              result: retryResult,
            }

            // 更新消息列表
            messages.push({
              role: 'tool',
              name: retryToolCall.name,
              tool_call_id: retryToolCall.id,
              content: JSON.stringify(retryResult),
            })
            
            onProgress({ type: 'tool_result', data: { tool: retryToolCall.name, success: retryResult.success, message: retryResult.message } })
            continue
          } else {
            // 重试失败：AI 没有返回有效的工具调用
            this.logger.warn(`[Agent] 智能重试失败，AI 未返回工具调用`)
            this.logger.log(`[Agent] AI 重试响应内容: ${retryContent}`)
            
            // 给用户友好的错误提示
            const friendlyError = `抱歉，工具参数有误，但我无法自动修复。错误信息：${result.error}`
            onProgress({ 
              type: 'tool_result', 
              data: { 
                tool: toolCall.name, 
                success: false, 
                message: friendlyError
              } 
            })
            
            // 推送失败结果，让 AI 生成回复告诉用户
            toolResults[toolResults.length - 1] = {
              tool: toolCall.name,
              args: toolCall.arguments,
              result: {
                success: false,
                error: friendlyError,
              },
            }
          }
        }

        // 不需要重试或重试未生成有效工具调用时，推送最终结果
        const finalResult = toolResults[toolResults.length - 1].result
        onProgress({ type: 'tool_result', data: { tool: toolCall.name, success: finalResult.success, message: finalResult.message } })

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
      trip_plan: '规划行程',
      taxi_call: '呼叫网约车',
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
  private buildSystemPrompt(userId: string, userLocation?: UserLocation, userContextText?: string): string {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 5)
    
    // 用户位置信息
    const locationInfo = userLocation 
      ? `- 经纬度: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}
- 地点名称: ${userLocation.name || '当前位置'}`
      : '- 未获取到位置（使用默认位置：杭州西湖）'

    // 用户上下文 - 用于 RAG 增强（由 UserContextService 生成）
    const userContextSection = userContextText || ''

    return `你是一个智能任务管理助手。你可以帮助用户管理各种类型的任务：打车、火车、飞机、会议、餐饮、酒店、事务等。

## 当前时间
- 日期: ${today} (${this.getWeekday(now)})
- 时间: ${time}
${userContextSection}
## 用户当前位置
${locationInfo}

## 重要规则

1. **不确定就问，不要猜**：如果用户的表述有歧义或缺少关键信息，直接询问用户
2. **像人一样对话**：遇到不清楚的地方，自然地追问
3. **使用具体日期时间调用工具**：当用户说"明天"、"下周三"等相对时间时，请转换为具体日期格式调用工具
4. **出行需求直接调用 trip_plan**：当用户说"去某地"、"去某地出差/开会"等出行需求时，直接调用 trip_plan 工具规划行程，工具会自动处理交通方式、时间等细节
5. **确认机制**：
   - **预览阶段**：当用户第一次表达意图（如"删除4月1日的任务"、"创建明天上午10点的会议"），系统会返回预览信息，不会真正执行
   - **确认阶段**：用户回复"确定"、"好的"、"是的"等确认词时，表示同意执行
   - **执行方式**：回顾之前的对话上下文，找到之前调用的工具名称和参数，然后带上 \`confirm: true\` 参数重新调用**相同的工具**
   - **示例**：
     - 用户："删除4月1日的任务" → 调用 \`task_delete\` 返回预览
     - 用户："确定" → 调用 \`task_delete\`（参数与之前相同 + \`confirm: true\`）

## 可用工具

${TOOL_NAMES.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## 常用参数

### trip_plan（行程规划）
- origin: 出发地
- destination: 目的地
- departure_time: 出发时间

### task_create / task_update（任务）
- scheduled_time: 任务时间
- location_name: 地点
- destination_name: 目的地

### task_delete / task_update
- task_id: 任务ID（UUID格式）
- filter: 筛选条件（包含 keyword、date、type 等）

### task_query
- date: 日期（YYYY-MM-DD）
- filter: 筛选条件对象

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
      // 尝试提取 JSON 代码块
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1])
        return this.normalizeParsedResponse(parsed)
      }

      // 尝试直接解析 JSON - 使用更健壮的方法
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = content.substring(jsonStart, jsonEnd + 1)
        try {
          const parsed = JSON.parse(jsonStr)
          return this.normalizeParsedResponse(parsed)
        } catch (parseError) {
          // 如果解析失败，尝试逐步缩小范围
          this.logger.warn('JSON 解析失败，尝试逐步缩小范围')
          for (let end = jsonEnd; end > jsonStart; end--) {
            if (content[end] === '}') {
              const subStr = content.substring(jsonStart, end + 1)
              try {
                const parsed = JSON.parse(subStr)
                return this.normalizeParsedResponse(parsed)
              } catch {
                continue
              }
            }
          }
          throw parseError
        }
      }
    } catch (e) {
      this.logger.error('解析 AI 响应失败:', e)
    }

    // 无法解析为 JSON，作为普通文本返回
    return { content }
  }

  /**
   * 标准化解析后的响应
   * 将 AI 返回的 parameters 字段映射到 arguments 字段
   * 为每个工具调用生成唯一的 id
   */
  private normalizeParsedResponse(parsed: any): {
    reasoning?: string
    toolCalls?: ToolCall[]
    content?: string
  } {
    const toolCalls: ToolCall[] = (parsed.tool_calls || []).map((tc: any, index: number) => ({
      id: tc.id || `tool_${Date.now()}_${index}`,
      name: tc.name,
      // AI 可能返回 parameters 或 arguments，统一映射到 arguments
      arguments: tc.arguments || tc.parameters || {},
    }))

    return {
      reasoning: parsed.reasoning,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      content: parsed.content,
    }
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
        } else if (r.tool === 'trip_plan') {
          // 行程规划预览
          const resultData = r.result.data
          if (resultData.preview && resultData.splitTasks) {
            data.needConfirmation = true
            data.confirmType = 'trip_plan'
            data.routes = resultData.routes
            data.recommendedIndex = resultData.recommendedIndex
            data.splitTasks = resultData.splitTasks
            data.summary = resultData.summary
            data.reasoning = resultData.reasoning
            // 也加入 pendingTasks，方便前端统一处理
            pendingTasks.push(...resultData.splitTasks)
          }
        }
      }
    }

    // 如果有待创建的任务
    if (pendingTasks.length > 0) {
      data.needConfirmation = true
      // 如果不是 trip_plan，则设置为 batch_add
      if (!data.confirmType) {
        data.confirmType = 'batch_add'
      }
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
