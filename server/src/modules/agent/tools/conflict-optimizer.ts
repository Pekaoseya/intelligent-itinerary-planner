/**
 * 冲突优化工具
 * 当检测到时间冲突时，AI 分析冲突并生成优化方案
 */

import { Injectable, Logger } from '@nestjs/common'
import { LLMClient } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

export interface ConflictInfo {
  newTask: any
  existingTask: any
  overlapMinutes: number
}

export interface ConflictOptimizationResult {
  success: boolean
  data?: {
    conflictAnalysis: string
    optimizationSuggestions: {
      type: 'adjust_time' | 'cancel_new' | 'cancel_existing' | 'merge'
      description: string
      affectedTasks: string[]
    }[]
    reasoning: string[]
    modifiedTasks: any[]
  }
  error?: string
}

@Injectable()
export class ConflictOptimizer {
  private readonly logger = new Logger(ConflictOptimizer.name)
  private supabase = getSupabaseClient()
  private readonly llmClient: LLMClient

  constructor() {
    this.llmClient = new LLMClient()
  }

  /**
   * 优化冲突方案
   */
  async optimizeConflicts(
    conflicts: ConflictInfo[],
    userId: string
  ): Promise<ConflictOptimizationResult> {
    try {
      this.logger.log(`[ConflictOptimizer] 开始优化 ${conflicts.length} 个冲突`)

      if (conflicts.length === 0) {
        return {
          success: true,
          data: {
            conflictAnalysis: '没有检测到冲突',
            optimizationSuggestions: [],
            reasoning: [],
            modifiedTasks: [],
          },
        }
      }

      // 构建冲突描述
      const conflictDescription = conflicts.map((conflict, index) => {
        const newTask = conflict.newTask
        const existingTask = conflict.existingTask

        return `冲突 ${index + 1}:
- 新任务: ${newTask.title}
  时间: ${new Date(newTask.scheduled_time).toLocaleString('zh-CN')}
  类型: ${newTask.type}
  时长: ${newTask.metadata?.duration || 60}分钟

- 已有任务: ${existingTask.title}
  时间: ${new Date(existingTask.scheduled_time).toLocaleString('zh-CN')}
  类型: ${existingTask.type}
  时长: ${existingTask.metadata?.duration || 60}分钟

- 重叠时间: ${conflict.overlapMinutes} 分钟`
      }).join('\n\n')

      // 构建提示词
      const prompt = `你是一个智能日程助手，负责分析时间冲突并提供优化方案。

## 当前冲突情况
${conflictDescription}

## 任务优先级参考
1. 会议 (meeting) - 通常需要固定时间，难以调整
2. 飞机 (flight) - 票务已定，难以调整
3. 火车 (train) - 票务已定，难以调整
4. 打车 (taxi) - 相对灵活
5. 餐饮 (dining) - 相对灵活
6. 酒店 (hotel) - 通常有入住时间要求
7. 事务 (todo) - 最灵活

## 请分析并提供优化方案

请以 JSON 格式回复，包含以下字段：
{
  "conflictAnalysis": "总结冲突情况，说明哪些任务会冲突，冲突的严重程度",
  "optimizationSuggestions": [
    {
      "type": "adjust_time|cancel_new|cancel_existing|merge",
      "description": "详细描述建议的操作，如'将新任务提前30分钟'、'取消新任务'、'取消已有任务'、'将两个任务合并'",
      "affectedTasks": ["new_task_title", "existing_task_title"]
    }
  ],
  "reasoning": [
    "分析步骤1: 识别冲突...",
    "分析步骤2: 评估任务重要性...",
    "分析步骤3: 生成优化方案..."
  ],
  "modifiedTasks": [
    {
      "title": "调整后的任务标题",
      "scheduled_time": "2026-04-09T10:30:00.000Z",
      "type": "meeting",
      "description": "调整原因说明",
      "originalTitle": "原标题"
    }
  ]
}

注意：
1. 优先保留重要任务（会议、飞机、火车）
2. 尽量少做调整，选择影响最小的方案
3. 如果可以合并，优先建议合并
4. 明确指出哪些任务会被修改
5. 提供详细的思考过程

现在请分析并提供优化方案。`

      // 调用 LLM
      const stream = this.llmClient.stream(
        [
          { role: 'system', content: '你是一个专业的智能日程助手，擅长分析时间冲突并提供合理的优化方案。' },
          { role: 'user', content: prompt },
        ],
        { model: 'doubao-seed-1-6-lite-251015', temperature: 0.3 }
      )

      let content = ''
      for await (const chunk of stream) {
        if (chunk.content) {
          content += chunk.content
        }
      }

      this.logger.log(`[ConflictOptimizer] AI 响应: ${content}`)

      // 解析 JSON - 先尝试提取 ```json 代码块
      let jsonStr = ''
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      } else {
        // 尝试直接解析 JSON - 找到第一个 { 和最后一个 }
        const jsonStart = content.indexOf('{')
        const jsonEnd = content.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          jsonStr = content.substring(jsonStart, jsonEnd + 1)
        }
      }

      if (!jsonStr) {
        throw new Error('AI 响应格式错误，未找到 JSON')
      }

      const result = JSON.parse(jsonStr)

      // 验证返回格式
      if (!result.conflictAnalysis || !result.optimizationSuggestions) {
        throw new Error('AI 响应格式不正确')
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      this.logger.error('[ConflictOptimizer] 优化失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '优化失败',
      }
    }
  }
}
