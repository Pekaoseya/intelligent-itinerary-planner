/**
 * 工具参数校验与智能提示
 * 
 * 设计理念：
 * - 不维护复杂的参数别名映射
 * - 当参数校验失败时，返回完整的参数定义给 AI
 * - 让 AI 自己理解参数含义，重新生成正确的调用
 */

import { TOOLS } from './definitions'

/**
 * 参数校验失败时的重试提示
 */
export interface RetryHint {
  toolName: string
  message: string
  requiredParams: string[]
  allParams: Record<string, { type: string; description: string; enum?: string[] }>
  userIntent?: string
  example?: Record<string, any>
}

/**
 * 校验工具参数，如果缺失必要参数则返回重试提示
 */
export function validateToolParams(
  toolName: string,
  args: Record<string, any>
): { valid: boolean; hint?: RetryHint } {
  const toolDef = TOOLS[toolName as keyof typeof TOOLS]
  
  if (!toolDef) {
    return { valid: false, hint: { toolName, message: `未知工具: ${toolName}`, requiredParams: [], allParams: {} } }
  }

  const required = toolDef.parameters.required || []
  const missingParams: string[] = []

  for (const param of required) {
    if (args[param] === undefined || args[param] === null || args[param] === '') {
      missingParams.push(param)
    }
  }

  if (missingParams.length === 0) {
    return { valid: true }
  }

  // 构建重试提示
  const allParams: Record<string, { type: string; description: string; enum?: string[] }> = {}
  for (const [key, value] of Object.entries(toolDef.parameters.properties)) {
    const prop = value as any
    allParams[key] = {
      type: prop.type,
      description: prop.description,
      enum: prop.enum,
    }
  }

  // 生成示例
  const example = generateExample(toolName, missingParams)

  return {
    valid: false,
    hint: {
      toolName,
      message: `工具「${toolName}」缺少必要参数: ${missingParams.join(', ')}`,
      requiredParams: missingParams,
      allParams,
      example,
    },
  }
}

/**
 * 生成参数示例
 */
function generateExample(toolName: string, missingParams: string[]): Record<string, any> {
  const examples: Record<string, Record<string, any>> = {
    task_create: {
      title: '打车去机场',
      type: 'taxi',
      scheduled_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
    task_delete: {
      filter: { all: true },
    },
    task_update: {
      task_id: 'xxx',
      updates: { status: 'completed' },
    },
    trip_plan: {
      destination: '上海',
      departure_time: '明天下午',
    },
    taxi_call: {
      origin: '杭州西溪',
      destination: '杭州东站',
    },
  }

  return examples[toolName] || {}
}

/**
 * 构建给 AI 的重试提示消息
 */
export function buildRetryMessage(hint: RetryHint, userMessage?: string): string {
  const paramList = Object.entries(hint.allParams)
    .map(([name, def]) => {
      const required = hint.requiredParams.includes(name) ? '【必填】' : '【可选】'
      const enumStr = def.enum ? `，可选值: ${def.enum.join('/')}` : ''
      return `  - ${name}: ${required}${def.description}${enumStr}`
    })
    .join('\n')

  const exampleStr = hint.example ? `\n\n正确示例:\n${JSON.stringify(hint.example, null, 2)}` : ''

  return `你调用的工具「${hint.toolName}」参数有误。

错误信息: ${hint.message}

工具参数说明:
${paramList}
${exampleStr}

请根据用户意图"${userMessage || '...'}"，使用正确的参数名重新调用工具。`
}
