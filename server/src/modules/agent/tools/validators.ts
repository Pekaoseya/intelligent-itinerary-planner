/**
 * 参数校验辅助函数
 * 
 * 提供通用的参数格式校验，用于工具参数校验
 */

// =============================================
// 常量定义
// =============================================

/** 有效的任务类型 */
export const VALID_TASK_TYPES = ['taxi', 'train', 'flight', 'meeting', 'dining', 'hotel', 'todo', 'other'] as const

/** 有效的任务状态 */
export const VALID_TASK_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const

/** 有效的交通方式 */
export const VALID_TRANSPORT_MODES = ['taxi', 'train', 'flight'] as const

// =============================================
// 格式校验函数
// =============================================

/**
 * 检测字符串是否为有效的 UUID 格式
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * 检测字符串是否为有效的日期格式（YYYY-MM-DD）
 */
export function isValidDate(str: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(str)) return false
  
  const date = new Date(str)
  return !isNaN(date.getTime())
}

/**
 * 检测字符串是否为有效的 ISO 时间格式
 */
export function isValidISOTime(str: string): boolean {
  // 支持 ISO 8601 格式，如 2025-01-15T14:00:00+08:00 或 2025-01-15T14:00:00Z
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/
  if (!isoRegex.test(str)) return false
  
  const date = new Date(str)
  return !isNaN(date.getTime())
}

/**
 * 检测 date 参数格式（支持字符串或数组）
 * - 字符串：必须是 YYYY-MM-DD 格式
 * - 数组：必须是两个有效的日期字符串
 */
export function isValidDateParam(date: unknown): { valid: boolean; error?: string } {
  if (typeof date === 'string') {
    if (!isValidDate(date)) {
      return { valid: false, error: `日期格式错误："${date}"，正确格式：YYYY-MM-DD（如 2025-01-15）` }
    }
    return { valid: true }
  }
  
  if (Array.isArray(date)) {
    if (date.length !== 2) {
      return { valid: false, error: `日期范围数组必须包含 2 个元素，当前有 ${date.length} 个` }
    }
    const [start, end] = date
    if (typeof start !== 'string' || typeof end !== 'string') {
      return { valid: false, error: '日期范围数组中的元素必须是字符串' }
    }
    if (!isValidDate(start)) {
      return { valid: false, error: `开始日期格式错误："${start}"，正确格式：YYYY-MM-DD` }
    }
    if (!isValidDate(end)) {
      return { valid: false, error: `结束日期格式错误："${end}"，正确格式：YYYY-MM-DD` }
    }
    // 检查开始日期是否小于等于结束日期
    if (new Date(start) > new Date(end)) {
      return { valid: false, error: `开始日期 ${start} 不能晚于结束日期 ${end}` }
    }
    return { valid: true }
  }
  
  return { valid: false, error: 'date 参数必须是字符串（单日）或数组（日期范围）' }
}

// =============================================
// 枚举校验函数
// =============================================

/**
 * 检测任务类型是否有效
 */
export function isValidTaskType(type: string): boolean {
  return VALID_TASK_TYPES.includes(type as any)
}

/**
 * 检测任务状态是否有效
 */
export function isValidTaskStatus(status: string): boolean {
  return VALID_TASK_STATUSES.includes(status as any)
}

/**
 * 检测交通方式是否有效
 */
export function isValidTransportMode(mode: string): boolean {
  return VALID_TRANSPORT_MODES.includes(mode as any)
}

// =============================================
// 组合校验函数
// =============================================

/**
 * 校验 task_id 格式
 */
export function validateTaskId(taskId: string): string | null {
  if (!taskId) {
    return 'task_id 不能为空'
  }
  if (!isValidUUID(taskId)) {
    return `task_id 格式错误：应该是一个有效的任务 ID（UUID 格式），而不是描述性文本。请使用 task_query 工具查询任务列表获取正确的任务 ID。`
  }
  return null
}

/**
 * 校验任务类型
 */
export function validateTaskType(type: string, fieldName: string = 'type'): string | null {
  if (!isValidTaskType(type)) {
    return `${fieldName} 值错误："${type}" 不是有效的任务类型。有效值: ${VALID_TASK_TYPES.join(', ')}`
  }
  return null
}

/**
 * 校验任务状态
 */
export function validateTaskStatus(status: string, fieldName: string = 'status'): string | null {
  if (!isValidTaskStatus(status)) {
    return `${fieldName} 值错误："${status}" 不是有效的任务状态。有效值: ${VALID_TASK_STATUSES.join(', ')}`
  }
  return null
}

/**
 * 校验时间格式
 */
export function validateScheduledTime(time: string, fieldName: string = 'scheduled_time'): string | null {
  if (!time) {
    return `${fieldName} 不能为空`
  }
  if (!isValidISOTime(time)) {
    return `${fieldName} 格式错误："${time}"，正确格式：ISO 8601（如 2025-01-15T14:00:00+08:00）`
  }
  return null
}

/**
 * 校验标题（非空且长度合理）
 */
export function validateTitle(title: string): string | null {
  if (!title || title.trim().length === 0) {
    return 'title 不能为空'
  }
  if (title.length > 100) {
    return 'title 长度不能超过 100 个字符'
  }
  return null
}

/**
 * 校验 limit 参数（必须是正整数，且不超过最大值）
 */
export function validateLimit(limit: number, maxLimit: number = 100): string | null {
  if (!Number.isInteger(limit) || limit <= 0) {
    return `limit 必须是正整数，当前值: ${limit}`
  }
  if (limit > maxLimit) {
    return `limit 不能超过 ${maxLimit}，当前值: ${limit}`
  }
  return null
}

/**
 * 校验关键词（非空且长度合理）
 */
export function validateKeyword(keyword: string): string | null {
  if (!keyword || keyword.trim().length === 0) {
    return 'keyword 不能为空'
  }
  if (keyword.length > 50) {
    return 'keyword 长度不能超过 50 个字符'
  }
  return null
}

// =============================================
// 参数名校验函数
// =============================================

/**
 * 已知参数名映射（常见错误参数名 -> 正确参数名）
 * 当 AI 使用错误参数名时，自动提示正确的参数名
 */
export const PARAM_NAME_MAPPINGS: Record<string, Record<string, string>> = {
  trip_plan: {
    'departure_location': 'origin',
    'departure_loc': 'origin',
    'from': 'origin',
    'departure_date': 'departure_time',
    'departure_datetime': 'departure_time',
    'time': 'departure_time',
    'preference': 'preferred_mode',
    'transport': 'preferred_mode',
    'transport_mode': 'preferred_mode',
    'mode': 'preferred_mode',
  },
  task_create: {
    'type_name': 'type',
    'task_type': 'type',
    'time': 'scheduled_time',
    'datetime': 'scheduled_time',
    'date': 'scheduled_time',
    'desc': 'description',
    'note': 'description',
    'content': 'description',
  },
  task_query: {
    'type_name': 'type',
    'task_type': 'type',
    'status_name': 'status',
    'task_status': 'status',
    'time': 'date',
    'datetime': 'date',
    'keyword': 'keyword',
  },
  task_delete: {
    'type_name': 'type',
    'task_type': 'type',
    'time': 'date',
    'datetime': 'date',
  },
}

/**
 * 检测未知参数名
 * @param toolName 工具名称
 * @param args 传入的参数
 * @param allowedParams 允许的参数名列表
 * @returns 错误信息，如果参数名都有效则返回 null
 */
export function validateParamNames(
  toolName: string,
  args: Record<string, any>,
  allowedParams: string[]
): string | null {
  const unknownParams: string[] = []
  const suggestions: string[] = []
  const mapping = PARAM_NAME_MAPPINGS[toolName] || {}
  
  for (const param of Object.keys(args)) {
    // 跳过特殊参数
    if (param === 'confirm') continue
    
    // 检查参数是否在允许列表中
    if (!allowedParams.includes(param)) {
      unknownParams.push(param)
      
      // 检查是否有映射建议
      if (mapping[param]) {
        suggestions.push(`"${param}" 应该是 "${mapping[param]}"`)
      }
    }
  }
  
  if (unknownParams.length === 0) {
    return null
  }
  
  // 构建错误信息
  const parts: string[] = []
  parts.push(`参数名错误：${unknownParams.map(p => `"${p}"`).join(', ')} 不是有效的参数名。`)
  
  if (suggestions.length > 0) {
    parts.push(`正确参数名：${suggestions.join('；')}。`)
  }
  
  parts.push(`该工具支持的参数：${allowedParams.join(', ')}。`)
  
  return parts.join('')
}
