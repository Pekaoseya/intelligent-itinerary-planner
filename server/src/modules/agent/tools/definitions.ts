/**
 * AI Agent 工具定义
 * 这些工具可以被 LLM 调用来执行实际操作
 * 
 * 设计理念：
 * - 所有工具元数据集中定义（参数、示例、校验）
 * - 新增工具只需在此文件添加定义，无需修改其他代码
 */

// =============================================
// 辅助函数
// =============================================

/**
 * 检测字符串是否为有效的 UUID 格式
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

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
          enum: ['taxi', 'train', 'flight', 'meeting', 'dining', 'hotel', 'todo', 'other'],
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
              enum: ['taxi', 'train', 'flight', 'meeting', 'dining', 'hotel', 'todo', 'other'],
              description: '按类型筛选' 
            },
            date: { 
              type: 'string', 
              description: '日期筛选。单个日期如 "2025-01-15"；日期范围如 ["2025-01-15", "2025-01-16"]' 
            },
            status: { type: 'string', description: '按状态筛选' },
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
      // 检测 task_id 是否为有效的 UUID 格式
      if (args.task_id && !isValidUUID(args.task_id)) {
        return `task_id 格式错误：应该是一个有效的任务 ID（UUID 格式），而不是描述性文本。如果不知道任务 ID，请使用 filter 参数按条件查找任务。`
      }
      // 检测 filter.type 是否为有效的枚举值
      if (args.filter?.type) {
        const validTypes = ['taxi', 'train', 'flight', 'meeting', 'dining', 'hotel', 'todo', 'other']
        if (!validTypes.includes(args.filter.type)) {
          return `filter.type 值错误："${args.filter.type}" 不是有效的任务类型。有效值: ${validTypes.join(', ')}`
        }
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
            status: { type: 'string', enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'], description: '新状态' },
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
      // 检测 task_id 是否为有效的 UUID 格式
      if (args.task_id && !isValidUUID(args.task_id)) {
        return `task_id 格式错误：应该是一个有效的任务 ID（UUID 格式），而不是描述性文本。如果不知道任务 ID，请使用 filter.keyword 参数按关键词查找任务。`
      }
      // 检测 updates 中是否有错误的参数名
      if (args.updates) {
        const wrongParams = Object.keys(args.updates).filter(key => 
          !['title', 'scheduled_time', 'location_name', 'status', 'metadata', 'description', 'type', 'destination_name'].includes(key)
        )
        if (wrongParams.length > 0) {
          return `updates 中包含未知参数: ${wrongParams.join(', ')}。正确参数: title, scheduled_time, location_name, status, metadata, description, type, destination_name`
        }
        // 常见错误：使用 time 而非 scheduled_time
        if (args.updates.time) {
          return `参数错误: updates 中应使用 scheduled_time 而非 time。正确示例: { "scheduled_time": "2025-01-15T10:00:00+08:00" }`
        }
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
              enum: ['taxi', 'train', 'flight', 'meeting', 'dining', 'hotel', 'todo', 'other'],
              description: '按类型筛选' 
            },
            status: { type: 'string', description: '按状态筛选' },
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
          enum: ['taxi', 'train', 'flight'],
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
