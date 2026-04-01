/**
 * AI Agent 工具定义
 * 这些工具可以被 LLM 调用来执行实际操作
 */

// =============================================
// 工具定义（供 LLM 使用）
// =============================================

export const TOOLS = {
  // 任务管理工具
  task_create: {
    name: 'task_create',
    description: '创建一个新任务。支持打车、火车、飞机、会议、餐饮、酒店、事务等类型。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题' },
        type: { 
          type: 'string', 
          enum: ['taxi', 'train', 'flight', 'meeting', 'dining', 'hotel', 'todo', 'other'],
          description: '任务类型' 
        },
        scheduled_time: { type: 'string', description: '计划时间（ISO格式）' },
        end_time: { type: 'string', description: '结束时间（可选）' },
        location_name: { type: 'string', description: '地点名称' },
        location_address: { type: 'string', description: '地点地址' },
        destination_name: { type: 'string', description: '目的地名称（出行类）' },
        destination_address: { type: 'string', description: '目的地地址' },
        metadata: { type: 'object', description: '类型特定数据' },
      },
      required: ['title', 'type', 'scheduled_time'],
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
            type: { type: 'string', description: '按类型筛选' },
            date: { type: 'string', description: '按日期筛选（YYYY-MM-DD）' },
            date_range: { 
              type: 'object', 
              properties: { 
                start: { type: 'string', description: '开始日期' }, 
                end: { type: 'string', description: '结束日期' } 
              },
              description: '按日期范围筛选' 
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
            title: { type: 'string' },
            scheduled_time: { type: 'string' },
            location_name: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
            metadata: { type: 'object' },
          },
          description: '要更新的字段'
        },
      },
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
            date: { type: 'string', description: '查询某天的任务（YYYY-MM-DD）' },
            date_range: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } }, description: '日期范围' },
            type: { type: 'string', description: '按类型筛选' },
            status: { type: 'string', description: '按状态筛选' },
            keyword: { type: 'string', description: '按关键词筛选' },
            include_expired: { type: 'boolean', description: '是否包含过期任务' },
          },
        },
        limit: { type: 'number', description: '返回数量限制' },
      },
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
        },
      },
    },
  },

  // 打车专用工具
  taxi_call: {
    name: 'taxi_call',
    description: '呼叫出租车/网约车。创建打车任务并模拟叫车过程。',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: '出发地（也叫 start、from、pickup）' },
        destination: { type: 'string', description: '目的地（也叫 end、to、dropoff）' },
        scheduled_time: { type: 'string', description: '用车时间（也叫 time、datetime、pickup_time）' },
      },
      required: ['origin', 'destination'],
    },
  },

  taxi_status: {
    name: 'taxi_status',
    description: '查询打车订单状态。',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '打车任务ID' },
      },
    },
  },

  // 地图工具
  map_search: {
    name: 'map_search',
    description: '搜索地点。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' },
        city: { type: 'string', description: '城市' },
      },
      required: ['keyword'],
    },
  },

  // 时间工具
  time_check: {
    name: 'time_check',
    description: '检查时间冲突或任务是否过期。',
    parameters: {
      type: 'object',
      properties: {
        scheduled_time: { type: 'string', description: '要检查的时间（也叫 time、datetime、check_time）' },
        duration_minutes: { type: 'number', description: '持续时长（分钟，也叫 duration、length）' },
      },
    },
  },

  // 日历工具
  calendar_check: {
    name: 'calendar_check',
    description: '检查某天或某时间段的日程安排。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '日期（YYYY-MM-DD，也叫 day、check_date）' },
        time_range: { 
          type: 'object', 
          properties: { 
            start: { type: 'string' }, 
            end: { type: 'string' } 
          },
          description: '时间范围（也叫 range、period）'
        },
      },
    },
  },

  // 行程规划工具
  trip_plan: {
    name: 'trip_plan',
    description: '智能行程规划。根据起点和终点自动规划最佳路线，拆分为多个任务（如：打车去机场 → 飞往目的地 → 打车到酒店）。支持打车、高铁、飞机等多种交通方式。',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: '出发地（可选，默认使用当前位置）' },
        destination: { 
          type: 'string', 
          description: '目的地（必填！用户说的"去某地"、"到某地"、"某地行程"中的"某地"就是目的地）' 
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
  reasoning?: string // AI 可以解释为什么这样执行
}

// =============================================
// 导出工具名称列表（供 LLM system prompt 使用）
// =============================================

export const TOOL_NAMES = Object.keys(TOOLS).map(name => ({
  name,
  description: TOOLS[name].description,
}))
