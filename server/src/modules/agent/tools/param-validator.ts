/**
 * 工具参数校验器
 * 
 * 职责：
 * - 校验工具参数是否完整
 * - 生成友好的错误提示
 * - 提供正确的参数示例
 * - 自动修正常见的参数别名
 * 
 * 设计理念：
 * - 完全依赖 definitions.ts 中的元数据
 * - 新增工具时无需修改此文件
 */

import { TOOLS, ToolDefinition, ToolResult } from './definitions'

/**
 * 参数别名映射表
 * 用于自动修正 AI 常用的参数名变体
 */
const PARAM_ALIASES: Record<string, Record<string, string>> = {
  trip_plan: {
    // 出发地别名
    'start_point': 'origin',
    'start': 'origin',
    'from': 'origin',
    'departure': 'origin',
    'start_location': 'origin',
    // 目的地别名
    'end_point': 'destination',
    'end': 'destination',
    'to': 'destination',
    'arrival': 'destination',
    'end_location': 'destination',
    // 出发时间别名
    'departure_date': 'departure_time',
    'start_time': 'departure_time',
    'leave_time': 'departure_time',
    // 到达时间别名
    'arrival_date': 'arrival_time',
    'end_time': 'arrival_time',
  },
}

/**
 * 自动修正参数别名
 * 
 * @param toolName 工具名称
 * @param args 原始参数
 * @returns 修正后的参数
 */
function normalizeParamNames(toolName: string, args: Record<string, any>): Record<string, any> {
  const aliases = PARAM_ALIASES[toolName]
  let normalized: Record<string, any> = { ...args }
  const correctedParams: string[] = []

  // 1. 修正参数名别名
  if (aliases) {
    for (const [key, value] of Object.entries(args)) {
      if (aliases[key]) {
        normalized[aliases[key]] = value
        correctedParams.push(`${key} -> ${aliases[key]}`)
        delete normalized[key]
      }
    }
  }

  // 2. 修正 date_range 字符串格式（AI 可能传递 "2026-04-01,2026-04-02" 而不是对象）
  if (normalized.filter?.date_range && typeof normalized.filter.date_range === 'string') {
    const dateStr = normalized.filter.date_range as string
    // 支持多种分隔符：逗号、斜杠、横线
    const parts = dateStr.split(/[,,\/]/).map(s => s.trim()).filter(Boolean)
    
    if (parts.length >= 2) {
      normalized.filter.date_range = {
        start: parts[0],
        end: parts[1],
      }
      correctedParams.push(`date_range 字符串 -> 对象`)
    } else if (parts.length === 1) {
      // 如果只有一个日期，视为单日删除，使用 date 字段
      normalized.filter.date = parts[0]
      delete normalized.filter.date_range
      correctedParams.push(`date_range -> date`)
    }
  }

  if (correctedParams.length > 0) {
    console.log(`[ParamValidator] 自动修正参数: ${correctedParams.join(', ')}`)
  }

  return normalized
}

/**
 * 校验工具参数
 * 
 * @param toolName 工具名称
 * @param args 调用参数
 * @returns 校验结果，valid 为 true 表示通过，否则返回错误提示
 */
export function validateToolParams(
  toolName: string,
  args: Record<string, any>
): { valid: boolean; error?: string; retryHint?: ToolResult['retryHint']; normalizedArgs?: Record<string, any> } {
  // =============================================
  // Step 0: 自动修正参数别名
  // =============================================
  const normalizedArgs = normalizeParamNames(toolName, args)
  
  const toolDef = TOOLS[toolName]
  
  // 未知工具
  if (!toolDef) {
    return { 
      valid: false, 
      error: `未知工具: ${toolName}` 
    }
  }

  // 1. 检查必填参数（使用修正后的参数）
  const required = toolDef.parameters.required || []
  const missingParams: string[] = []
  
  for (const param of required) {
    if (normalizedArgs[param] === undefined || normalizedArgs[param] === null || normalizedArgs[param] === '') {
      missingParams.push(param)
    }
  }

  if (missingParams.length > 0) {
    return buildRetryHint(toolDef, `缺少必要参数: ${missingParams.join(', ')}`, normalizedArgs)
  }

  // 2. 执行自定义校验（如果有）
  if (toolDef.customValidate) {
    const customError = toolDef.customValidate(normalizedArgs)
    if (customError) {
      return buildRetryHint(toolDef, customError, normalizedArgs)
    }
  }

  // 校验通过，返回修正后的参数
  return { valid: true, normalizedArgs }
}

/**
 * 构建重试提示
 */
function buildRetryHint(
  toolDef: ToolDefinition,
  errorMessage: string,
  currentArgs: Record<string, any>
): { valid: false; error: string; retryHint: ToolResult['retryHint'] } {
  const allParams: Record<string, { type: string; description: string; enum?: string[] }> = {}
  const requiredParams: string[] = []
  
  for (const [name, param] of Object.entries(toolDef.parameters.properties)) {
    allParams[name] = {
      type: param.type,
      description: param.description,
      enum: param.enum,
    }
    if (param.required || toolDef.parameters.required?.includes(name)) {
      requiredParams.push(name)
    }
  }

  const error = formatErrorMessage(toolDef.name, errorMessage, allParams, requiredParams, toolDef.examples, currentArgs)

  return {
    valid: false,
    error,
    retryHint: {
      toolName: toolDef.name,
      message: errorMessage,
      requiredParams,
      allParams,
      examples: toolDef.examples,
    },
  }
}

/**
 * 格式化错误消息，提供给 AI 理解
 */
function formatErrorMessage(
  toolName: string,
  errorMessage: string,
  allParams: Record<string, { type: string; description: string; enum?: string[] }>,
  requiredParams: string[],
  examples?: Record<string, any>[],
  currentArgs?: Record<string, any>
): string {
  // 参数列表
  const paramList = Object.entries(allParams)
    .map(([name, def]) => {
      const required = requiredParams.includes(name) ? '【必填】' : '【可选】'
      const enumStr = def.enum ? `，可选值: ${def.enum.join('/')}` : ''
      return `  - ${name}: ${required}${def.description}${enumStr}`
    })
    .join('\n')

  // 示例
  const exampleStr = examples && examples.length > 0
    ? `\n\n正确示例:\n${examples.map(e => JSON.stringify(e, null, 2)).join('\n或\n')}`
    : ''

  // 当前参数（帮助 AI 对比）
  const currentStr = currentArgs && Object.keys(currentArgs).length > 0
    ? `\n\n你当前传递的参数:\n${JSON.stringify(currentArgs, null, 2)}`
    : ''

  return `工具「${toolName}」参数有误。

错误: ${errorMessage}

参数说明:
${paramList}${currentStr}${exampleStr}

请使用正确的参数名重新调用工具。`
}

/**
 * 批量校验多个工具的参数
 */
export function validateMultipleTools(
  toolCalls: Array<{ name: string; arguments: Record<string, any> }>
): Array<{ name: string; arguments: Record<string, any>; valid: boolean; error?: string }> {
  return toolCalls.map(tc => {
    const result = validateToolParams(tc.name, tc.arguments)
    return {
      name: tc.name,
      arguments: tc.arguments,
      valid: result.valid,
      error: result.error,
    }
  })
}
