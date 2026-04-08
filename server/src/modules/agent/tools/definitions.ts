/**
 * AI Agent 工具定义
 * 这些工具可以被 LLM 调用来执行实际操作
 * 
 * 设计理念：
 * - 参数扁平化，避免嵌套结构，降低 AI 理解成本
 * - 所有工具元数据集中定义（参数、示例、校验）
 * - 参数校验不可信任 AI 输入，必须严格校验
 */

import {
  isValidUUID,
  isValidDateParam,
  validateTaskId,
  validateTaskType,
  validateTaskStatus,
  validateScheduledTime,
  validateTitle,
  validateLimit,
  validateKeyword,
  isValidTransportMode,
  VALID_TASK_TYPES,
  VALID_TASK_STATUSES,
  VALID_TRANSPORT_MODES,
} from './validators'

// =============================================
// 类型定义
// =============================================

/**
 * 工具参数定义（支持嵌套对象）
 */
export interface ToolParameter {
  type: string
  description: string
  enum?: string[]
  required?: boolean
  // 支持嵌套对象
  properties?: Record<string, ToolParameter>
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
  // 工具使用示例（帮助 AI 理解正确用法）
  examples?: Record<string, any>[]
  // 自定义校验函数（可选，用于复杂校验逻辑）
  customValidate?: (args: Record<string, any>) => string | null // 返回错误信息，null 表示通过
}

// =============================================
// 工具定义
// =============================================

export const TOOLS: Record<string, ToolDefinition> = {
  // =============================================
  // 任务管理工具
  // =============================================
  
  task_create: {
    name: 'task_create',
    description: '创建一个新任务。支持打车、火车、飞机、会议、餐饮、酒店、事务等类型。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题', required: true },
        type: { 
          type: 'string', 
          enum: [...VALID_TASK_TYPES],
          description: '任务类型',
          required: true
        },
        scheduled_time: { type: 'string', description: '计划时间（ISO格式）', required: true },
        end_time: { type: 'string', description: '结束时间（可选）' },
        location_name: { type: 'string', description: '地点名称' },
        destination_name: { type: 'string', description: '目的地名称（出行类）' },
      },
      required: ['title', 'type', 'scheduled_time'],
    },
    examples: [
      { title: '打车去机场', type: 'taxi', scheduled_time: '2025-01-15T14:00:00+08:00' },
      { title: '团队周会', type: 'meeting', scheduled_time: '2025-01-15T10:00:00+08:00', location_name: '3号会议室' },
    ],
    customValidate: (args) => {
      if (args.title !== undefined) {
        const error = validateTitle(args.title)
        if (error) return error
      }
      if (args.type !== undefined) {
        const error = validateTaskType(args.type)
        if (error) return error
      }
      if (args.scheduled_time !== undefined) {
        const error = validateScheduledTime(args.scheduled_time)
        if (error) return error
      }
      if (args.end_time !== undefined && args.end_time !== null) {
        const error = validateScheduledTime(args.end_time, 'end_time')
        if (error) return error
      }
      return null
    },
  },

  task_delete: {
    name: 'task_delete',
    description: '删除任务。可按ID删除、按日期/类型/关键词批量删除、或删除所有任务。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务ID（按ID删除单个任务）' },
        date: {
          type: 'string',
          description: '日期筛选。单日如 "2025-01-15"；范围如 ["2025-01-15", "2025-01-16"]'
        },
        type: {
          type: 'string',
          enum: [...VALID_TASK_TYPES],
          description: '按类型筛选（必须是以下之一：taxi=打车、train=火车、flight=飞机、meeting=会议、dining=餐饮、hotel=酒店、todo=事务、other=其他）。注意：只能传一个类型值，不支持数组或多个值。'
        },
        keyword: { type: 'string', description: '按关键词筛选任务标题' },
        all: { type: 'boolean', description: '删除所有任务' },
        confirm: { type: 'boolean', description: '是否已确认删除' },
      },
      required: [],
    },
    examples: [
      { task_id: '550e8400-e29b-41d4-a716-446655440000' },
      { date: '2025-01-15' },
      { date: ['2025-01-15', '2025-01-16'] },
      { type: 'taxi' },
      { keyword: '晚餐' },
      { all: true },
    ],
    customValidate: (args) => {
      // 必须提供至少一个筛选条件
      if (!args.task_id && !args.date && !args.type && !args.keyword && !args.all) {
        return '请提供删除条件：task_id、date、type、keyword 或 all'
      }

      if (args.task_id) {
        const error = validateTaskId(args.task_id)
        if (error) return error
      }

      if (args.type) {
        const error = validateTaskType(args.type)
        if (error) return error
      }

      if (args.date !== undefined) {
        const result = isValidDateParam(args.date)
        if (!result.valid) return result.error!
      }

      if (args.keyword !== undefined) {
        const error = validateKeyword(args.keyword)
        if (error) return error
      }

      return null
    },
  },

  task_update: {
    name: 'task_update',
    description: '更新任务信息。可修改时间、地点、状态等。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '要更新的任务ID' },
        keyword: { type: 'string', description: '按关键词匹配任务（不知道ID时使用）' },
        title: { type: 'string', description: '新标题' },
        scheduled_time: { type: 'string', description: '新时间' },
        location_name: { type: 'string', description: '新地点' },
        status: { 
          type: 'string', 
          enum: [...VALID_TASK_STATUSES], 
          description: '新状态（pending/confirmed/in_progress/completed/cancelled）' 
        },
      },
      required: [],
    },
    examples: [
      { task_id: '550e8400-e29b-41d4-a716-446655440000', status: 'completed' },
      { keyword: '晚餐', scheduled_time: '2025-01-15T19:00:00+08:00' },
      { keyword: '会议', location_name: '5号会议室' },
    ],
    customValidate: (args) => {
      // 必须提供定位条件
      if (!args.task_id && !args.keyword) {
        return '请提供 task_id 或 keyword 来定位要更新的任务'
      }
      
      // 必须提供至少一个更新字段
      const updateFields = ['title', 'scheduled_time', 'location_name', 'status']
      const hasUpdate = updateFields.some(f => args[f] !== undefined)
      if (!hasUpdate) {
        return '请提供要更新的字段：title、scheduled_time、location_name 或 status'
      }
      
      if (args.task_id) {
        const error = validateTaskId(args.task_id)
        if (error) return error
      }
      
      if (args.keyword !== undefined) {
        const error = validateKeyword(args.keyword)
        if (error) return error
      }
      
      if (args.title !== undefined) {
        const error = validateTitle(args.title)
        if (error) return error
      }
      
      if (args.scheduled_time !== undefined) {
        const error = validateScheduledTime(args.scheduled_time)
        if (error) return error
      }
      
      if (args.status !== undefined) {
        const error = validateTaskStatus(args.status, 'status')
        if (error) return error
      }
      
      return null
    },
  },

  task_query: {
    name: 'task_query',
    description: '查询任务。可按日期、类型、关键词等条件查询。',
    parameters: {
      type: 'object',
      properties: {
        date: { 
          type: 'string', 
          description: '日期筛选。单日如 "2025-01-15"；范围如 ["2025-01-15", "2025-01-16"]' 
        },
        type: { 
          type: 'string', 
          enum: [...VALID_TASK_TYPES],
          description: '按类型筛选（taxi/train/flight/meeting/dining/hotel/todo/other）' 
        },
        keyword: { type: 'string', description: '按关键词筛选任务标题' },
        status: { 
          type: 'string',
          enum: [...VALID_TASK_STATUSES],
          description: '按状态筛选' 
        },
        include_expired: { type: 'boolean', description: '是否包含过期任务' },
        limit: { type: 'number', description: '返回数量限制（默认20，最大100）' },
      },
      required: [],
    },
    examples: [
      { date: '2025-01-15' },
      { date: ['2025-01-15', '2025-01-16'] },
      { type: 'taxi' },
      { keyword: '会议' },
      { status: 'pending' },
    ],
    customValidate: (args) => {
      if (args.type) {
        const error = validateTaskType(args.type)
        if (error) return error
      }
      
      if (args.date !== undefined) {
        const result = isValidDateParam(args.date)
        if (!result.valid) return result.error!
      }
      
      if (args.status) {
        const error = validateTaskStatus(args.status, 'status')
        if (error) return error
      }
      
      if (args.keyword !== undefined) {
        const error = validateKeyword(args.keyword)
        if (error) return error
      }
      
      if (args.limit !== undefined) {
        const error = validateLimit(args.limit)
        if (error) return error
      }
      
      return null
    },
  },

  task_complete: {
    name: 'task_complete',
    description: '标记任务为完成。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务ID' },
        keyword: { type: 'string', description: '按关键词匹配任务' },
      },
      required: [],
    },
    examples: [
      { task_id: '550e8400-e29b-41d4-a716-446655440000' },
      { keyword: '晚餐' },
    ],
    customValidate: (args) => {
      if (!args.task_id && !args.keyword) {
        return '请提供 task_id 或 keyword'
      }
      
      if (args.task_id) {
        const error = validateTaskId(args.task_id)
        if (error) return error
      }
      
      if (args.keyword !== undefined) {
        const error = validateKeyword(args.keyword)
        if (error) return error
      }
      
      return null
    },
  },

  // =============================================
  // 打车工具
  // =============================================
  
  taxi_call: {
    name: 'taxi_call',
    description: '呼叫出租车/网约车。创建打车任务。',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: '出发地', required: true },
        destination: { type: 'string', description: '目的地', required: true },
        scheduled_time: { type: 'string', description: '用车时间' },
      },
      required: ['origin', 'destination'],
    },
    examples: [
      { origin: '杭州西溪', destination: '杭州东站' },
      { origin: '北京国贸', destination: '首都机场', scheduled_time: '2025-01-15T08:00:00+08:00' },
    ],
    customValidate: (args) => {
      if (!args.origin || args.origin.trim().length === 0) {
        return '出发地不能为空'
      }
      if (!args.destination || args.destination.trim().length === 0) {
        return '目的地不能为空'
      }
      if (args.scheduled_time !== undefined) {
        const error = validateScheduledTime(args.scheduled_time)
        if (error) return error
      }
      return null
    },
  },

  taxi_status: {
    name: 'taxi_status',
    description: '查询打车订单状态。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '打车任务ID', required: true },
      },
      required: ['task_id'],
    },
    examples: [
      { task_id: '550e8400-e29b-41d4-a716-446655440000' },
    ],
    customValidate: (args) => {
      if (!args.task_id) {
        return 'task_id 不能为空'
      }
      const error = validateTaskId(args.task_id)
      if (error) return error
      return null
    },
  },

  // =============================================
  // 时间和日历工具
  // =============================================
  
  time_check: {
    name: 'time_check',
    description: '检查时间冲突或任务是否过期。',
    parameters: {
      type: 'object',
      properties: {
        scheduled_time: { type: 'string', description: '要检查的时间', required: true },
        duration_minutes: { type: 'number', description: '持续时长（分钟）' },
      },
      required: ['scheduled_time'],
    },
    examples: [
      { scheduled_time: '2025-01-15T14:00:00+08:00' },
      { scheduled_time: '2025-01-15T14:00:00+08:00', duration_minutes: 60 },
    ],
    customValidate: (args) => {
      if (!args.scheduled_time) {
        return 'scheduled_time 不能为空'
      }
      const error = validateScheduledTime(args.scheduled_time)
      if (error) return error
      
      if (args.duration_minutes !== undefined) {
        if (!Number.isInteger(args.duration_minutes) || args.duration_minutes <= 0) {
          return `duration_minutes 必须是正整数，当前值: ${args.duration_minutes}`
        }
        if (args.duration_minutes > 1440) {
          return 'duration_minutes 不能超过 1440（24小时）'
        }
      }
      return null
    },
  },

  calendar_check: {
    name: 'calendar_check',
    description: '检查某天或某时间段的日程安排。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '日期（YYYY-MM-DD）' },
        start_time: { type: 'string', description: '开始时间' },
        end_time: { type: 'string', description: '结束时间' },
      },
      required: [],
    },
    examples: [
      { date: '2025-01-15' },
      { start_time: '2025-01-15T09:00:00+08:00', end_time: '2025-01-15T18:00:00+08:00' },
    ],
    customValidate: (args) => {
      if (!args.date && !args.start_time && !args.end_time) {
        return '请提供 date 或 start_time/end_time'
      }
      
      if (args.date !== undefined) {
        const result = isValidDateParam(args.date)
        if (!result.valid) return result.error!
      }
      
      if (args.start_time) {
        const error = validateScheduledTime(args.start_time, 'start_time')
        if (error) return error
      }
      
      if (args.end_time) {
        const error = validateScheduledTime(args.end_time, 'end_time')
        if (error) return error
      }
      
      if (args.start_time && args.end_time) {
        if (new Date(args.start_time) >= new Date(args.end_time)) {
          return 'start_time 必须早于 end_time'
        }
      }
      
      return null
    },
  },

  // =============================================
  // 行程规划工具
  // =============================================
  
  trip_plan: {
    name: 'trip_plan',
    description: '智能行程规划。自动规划最佳路线，拆分为多个任务。支持打车、高铁、飞机等交通方式。',
    parameters: {
      type: 'object',
      properties: {
        destination: { 
          type: 'string', 
          description: '目的地',
          required: true
        },
        origin: { type: 'string', description: '出发地（默认使用当前位置）' },
        departure_time: { type: 'string', description: '出发时间' },
        preferred_mode: { 
          type: 'string', 
          enum: [...VALID_TRANSPORT_MODES],
          description: '优先交通方式（taxi/train/flight）' 
        },
      },
      required: ['destination'],
    },
    examples: [
      { destination: '上海' },
      { destination: '北京', departure_time: '明天下午' },
      { origin: '杭州', destination: '上海', preferred_mode: 'train' },
    ],
    customValidate: (args) => {
      if (!args.destination || args.destination.trim().length === 0) {
        return '目的地不能为空'
      }
      
      if (args.origin !== undefined && args.origin.trim().length === 0) {
        return '出发地不能为空字符串'
      }
      
      if (args.preferred_mode !== undefined) {
        if (!isValidTransportMode(args.preferred_mode)) {
          return `preferred_mode 值错误。有效值: ${VALID_TRANSPORT_MODES.join(', ')}`
        }
      }
      
      return null
    },
  },
}

// =============================================
// 工具执行结果类型
// =============================================

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  message?: string
  reasoning?: string
  // 参数校验失败时的重试提示
  retryHint?: {
    toolName: string
    message: string
    requiredParams: string[]
    allParams: Record<string, { type: string; description: string; enum?: string[] }>
    examples?: Record<string, any>[]
  }
}

// =============================================
// 导出工具名称列表（供 LLM system prompt 使用）
// =============================================

export const TOOL_NAMES = Object.keys(TOOLS).map(name => ({
  name,
  description: TOOLS[name].description,
}))
