/**
 * AI Agent 工具定义
 * 这些工具可以被 LLM 调用来执行实际操作
 * 
 * 设计理念：
 * - 所有工具元数据集中定义（参数、示例、校验）
 * - 新增工具只需在此文件添加定义，无需修改其他代码
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
        location_address: { type: 'string', description: '地点地址' },
        destination_name: { type: 'string', description: '目的地名称（出行类）' },
        destination_address: { type: 'string', description: '目的地地址' },
        metadata: { type: 'object', description: '类型特定数据' },
      },
      required: ['title', 'type', 'scheduled_time'],
    },
    examples: [
      { title: '打车去机场', type: 'taxi', scheduled_time: '2025-01-15T14:00:00+08:00' },
      { title: '团队周会', type: 'meeting', scheduled_time: '2025-01-15T10:00:00+08:00', location_name: '3号会议室' },
    ],
    customValidate: (args) => {
      // 校验 title
      if (args.title !== undefined) {
        const error = validateTitle(args.title)
        if (error) return error
      }
      
      // 校验 type
      if (args.type !== undefined) {
        const error = validateTaskType(args.type)
        if (error) return error
      }
      
      // 校验 scheduled_time
      if (args.scheduled_time !== undefined) {
        const error = validateScheduledTime(args.scheduled_time)
        if (error) return error
      }
      
      // 校验 end_time（如果提供）
      if (args.end_time !== undefined && args.end_time !== null) {
        const error = validateScheduledTime(args.end_time, 'end_time')
        if (error) return error
      }
      
      return null
    },
  },

  task_delete: {
    name: 'task_delete',
    description: '删除任务。可以按ID删除、按条件批量删除（如删除所有、删除今天的、删除某类型的）。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '要删除的任务ID（单个任务）' },
        filter: { 
          type: 'object',
          properties: {
            type: { 
              type: 'string', 
              enum: [...VALID_TASK_TYPES],
              description: '按类型筛选' 
            },
            date: { 
              type: 'string', 
              description: '日期筛选。单个日期如 "2025-01-15"；日期范围如 ["2025-01-15", "2025-01-16"]' 
            },
            status: { 
              type: 'string',
              enum: [...VALID_TASK_STATUSES],
              description: '按状态筛选' 
            },
            keyword: { type: 'string', description: '按关键词筛选' },
            expired: { type: 'boolean', description: '只删除过期的' },
            all: { type: 'boolean', description: '删除所有任务（用户说"删除所有"时设为 true）' },
          },
          description: '筛选条件（不传task_id时使用）'
        },
        confirm: { type: 'boolean', description: '是否已确认删除' },
      },
      required: [],
    },
    examples: [
      { task_id: 'abc123' },
      { filter: { all: true } },
      { filter: { date: '2025-01-15' } },
      { filter: { date: ['2025-01-15', '2025-01-16'] } },
      { filter: { type: 'taxi' } },
    ],
    customValidate: (args) => {
      if (!args.task_id && !args.filter) {
        return '必须提供 task_id 或 filter 参数'
      }
      
      // 校验 task_id
      if (args.task_id) {
        const error = validateTaskId(args.task_id)
        if (error) return error
      }
      
      // 校验 filter.type
      if (args.filter?.type) {
        const error = validateTaskType(args.filter.type, 'filter.type')
        if (error) return error
      }
      
      // 校验 filter.date
      if (args.filter?.date !== undefined) {
        const result = isValidDateParam(args.filter.date)
        if (!result.valid) return result.error!
      }
      
      // 校验 filter.status
      if (args.filter?.status) {
        const error = validateTaskStatus(args.filter.status, 'filter.status')
        if (error) return error
      }
      
      // 校验 filter.keyword
      if (args.filter?.keyword !== undefined) {
        const error = validateKeyword(args.filter.keyword)
        if (error) return error
      }
      
      return null
    },
  },

  task_update: {
    name: 'task_update',
    description: '更新任务信息。可以修改时间、地点、状态等。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '要更新的任务ID' },
        filter: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '按关键词匹配任务' },
          },
          description: '用于匹配任务的筛选条件'
        },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '新标题' },
            scheduled_time: { type: 'string', description: '新时间' },
            location_name: { type: 'string', description: '新地点' },
            status: { 
              type: 'string', 
              enum: [...VALID_TASK_STATUSES], 
              description: '新状态' 
            },
            metadata: { type: 'object', description: '新元数据' },
          },
          description: '要更新的字段',
          required: true
        },
      },
      required: ['updates'],
    },
    examples: [
      { task_id: 'abc123', updates: { status: 'completed' } },
      { filter: { keyword: '晚餐' }, updates: { scheduled_time: '2025-01-15T19:00:00+08:00' } },
    ],
    customValidate: (args) => {
      if (!args.task_id && !args.filter?.keyword) {
        return '必须提供 task_id 或 filter.keyword'
      }
      
      // 校验 task_id
      if (args.task_id) {
        const error = validateTaskId(args.task_id)
        if (error) return error
      }
      
      // 校验 filter.keyword
      if (args.filter?.keyword !== undefined) {
        const error = validateKeyword(args.filter.keyword)
        if (error) return error
      }
      
      // 校验 updates
      if (!args.updates || Object.keys(args.updates).length === 0) {
        return 'updates 不能为空'
      }
      
      // 检测 updates 中是否有错误的参数名
      const validUpdateFields = ['title', 'scheduled_time', 'location_name', 'status', 'metadata', 'description', 'type', 'destination_name']
      const wrongParams = Object.keys(args.updates).filter(key => !validUpdateFields.includes(key))
      if (wrongParams.length > 0) {
        return `updates 中包含未知参数: ${wrongParams.join(', ')}。正确参数: ${validUpdateFields.join(', ')}`
      }
      
      // 校验 updates.title
      if (args.updates.title !== undefined) {
        const error = validateTitle(args.updates.title)
        if (error) return error
      }
      
      // 校验 updates.scheduled_time
      if (args.updates.scheduled_time !== undefined) {
        const error = validateScheduledTime(args.updates.scheduled_time)
        if (error) return error
      }
      
      // 校验 updates.status
      if (args.updates.status !== undefined) {
        const error = validateTaskStatus(args.updates.status, 'updates.status')
        if (error) return error
      }
      
      // 校验 updates.type
      if (args.updates.type !== undefined) {
        const error = validateTaskType(args.updates.type, 'updates.type')
        if (error) return error
      }
      
      return null
    },
  },

  task_query: {
    name: 'task_query',
    description: '查询任务。可以按日期、类型、状态等条件查询。',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            date: { 
              type: 'string', 
              description: '日期筛选。单个日期如 "2025-01-15"；日期范围如 ["2025-01-15", "2025-01-16"]' 
            },
            type: { 
              type: 'string', 
              enum: [...VALID_TASK_TYPES],
              description: '按类型筛选' 
            },
            status: { 
              type: 'string',
              enum: [...VALID_TASK_STATUSES],
              description: '按状态筛选' 
            },
            keyword: { type: 'string', description: '按关键词筛选' },
            include_expired: { type: 'boolean', description: '是否包含过期任务' },
          },
          description: '筛选条件'
        },
        limit: { type: 'number', description: '返回数量限制' },
      },
      required: [],
    },
    examples: [
      { filter: { date: '2025-01-15' } },
      { filter: { date: ['2025-01-15', '2025-01-16'] } },
      { filter: { type: 'taxi', include_expired: true } },
    ],
    customValidate: (args) => {
      // 校验 filter.type
      if (args.filter?.type) {
        const error = validateTaskType(args.filter.type, 'filter.type')
        if (error) return error
      }
      
      // 校验 filter.date
      if (args.filter?.date !== undefined) {
        const result = isValidDateParam(args.filter.date)
        if (!result.valid) return result.error!
      }
      
      // 校验 filter.status
      if (args.filter?.status) {
        const error = validateTaskStatus(args.filter.status, 'filter.status')
        if (error) return error
      }
      
      // 校验 filter.keyword
      if (args.filter?.keyword !== undefined) {
        const error = validateKeyword(args.filter.keyword)
        if (error) return error
      }
      
      // 校验 limit
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
        filter: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '按关键词匹配' },
          },
          description: '筛选条件'
        },
      },
      required: [],
    },
    examples: [
      { task_id: 'abc123' },
      { filter: { keyword: '晚餐' } },
    ],
    customValidate: (args) => {
      if (!args.task_id && !args.filter?.keyword) {
        return '必须提供 task_id 或 filter.keyword'
      }
      
      // 校验 task_id
      if (args.task_id) {
        const error = validateTaskId(args.task_id)
        if (error) return error
      }
      
      // 校验 filter.keyword
      if (args.filter?.keyword !== undefined) {
        const error = validateKeyword(args.filter.keyword)
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
    description: '呼叫出租车/网约车。创建打车任务并模拟叫车过程。',
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
      // 校验 origin
      if (!args.origin || args.origin.trim().length === 0) {
        return 'origin（出发地）不能为空'
      }
      
      // 校验 destination
      if (!args.destination || args.destination.trim().length === 0) {
        return 'destination（目的地）不能为空'
      }
      
      // 校验 scheduled_time（如果提供）
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
      { task_id: 'taxi_123' },
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
      // 校验 scheduled_time
      if (!args.scheduled_time) {
        return 'scheduled_time 不能为空'
      }
      const error = validateScheduledTime(args.scheduled_time)
      if (error) return error
      
      // 校验 duration_minutes（如果提供）
      if (args.duration_minutes !== undefined) {
        if (!Number.isInteger(args.duration_minutes) || args.duration_minutes <= 0) {
          return `duration_minutes 必须是正整数，当前值: ${args.duration_minutes}`
        }
        if (args.duration_minutes > 1440) { // 24小时
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
        time_range: { 
          type: 'object', 
          properties: { 
            start: { type: 'string', description: '开始时间' }, 
            end: { type: 'string', description: '结束时间' } 
          },
          description: '时间范围'
        },
      },
      required: [],
    },
    examples: [
      { date: '2025-01-15' },
      { time_range: { start: '2025-01-15T09:00:00+08:00', end: '2025-01-15T18:00:00+08:00' } },
    ],
    customValidate: (args) => {
      // 至少需要一个参数
      if (!args.date && !args.time_range) {
        return '必须提供 date 或 time_range 参数'
      }
      
      // 校验 date
      if (args.date !== undefined) {
        const result = isValidDateParam(args.date)
        if (!result.valid) return result.error!
      }
      
      // 校验 time_range
      if (args.time_range) {
        if (!args.time_range.start || !args.time_range.end) {
          return 'time_range 必须同时包含 start 和 end'
        }
        const startError = validateScheduledTime(args.time_range.start, 'time_range.start')
        if (startError) return startError
        const endError = validateScheduledTime(args.time_range.end, 'time_range.end')
        if (endError) return endError
        
        // 检查开始时间是否小于结束时间
        if (new Date(args.time_range.start) >= new Date(args.time_range.end)) {
          return 'time_range.start 必须早于 time_range.end'
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
    description: '智能行程规划。根据起点和终点自动规划最佳路线，拆分为多个任务（如：打车去机场 → 飞往目的地 → 打车到酒店）。支持打车、高铁、飞机等多种交通方式。',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: '出发地（可选，默认使用当前位置）' },
        destination: { 
          type: 'string', 
          description: '目的地（必填！用户说的"去某地"、"到某地"、"某地行程"中的"某地"就是目的地）',
          required: true
        },
        departure_time: { type: 'string', description: '出发时间（用户说的"明天"、"下周"等时间）' },
        arrival_time: { type: 'string', description: '期望到达时间（可选）' },
        preferred_mode: { 
          type: 'string', 
          enum: [...VALID_TRANSPORT_MODES],
          description: '优先交通方式（可选）' 
        },
        notes: { type: 'string', description: '备注信息（可选）' },
      },
      required: ['destination'],
    },
    examples: [
      { destination: '上海' },
      { destination: '北京', departure_time: '明天下午' },
      { origin: '杭州', destination: '上海', preferred_mode: 'train' },
    ],
    customValidate: (args) => {
      // 校验 destination
      if (!args.destination || args.destination.trim().length === 0) {
        return 'destination（目的地）不能为空'
      }
      
      // 校验 origin（如果提供）
      if (args.origin !== undefined && args.origin.trim().length === 0) {
        return 'origin（出发地）不能为空字符串'
      }
      
      // 校验 preferred_mode
      if (args.preferred_mode !== undefined) {
        if (!isValidTransportMode(args.preferred_mode)) {
          return `preferred_mode 值错误："${args.preferred_mode}" 不是有效的交通方式。有效值: ${VALID_TRANSPORT_MODES.join(', ')}`
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
