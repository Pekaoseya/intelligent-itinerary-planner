/**
 * Agent 进度系统 - 消息模板
 * 
 * 所有 Agent 的进度消息在此集中管理，便于：
 * 1. 统一维护消息格式和表情符号
 * 2. 快速定位和修改文案
 * 3. 支持国际化扩展
 * 
 * 新增 Agent 时，只需在此添加对应的消息模板
 */

import type { AgentName, ProgressMessageTemplate } from './progress.types'

// =============================================
// 行程规划 Agent 消息模板
// =============================================

export const TRIP_PLANNER_MESSAGES: Record<string, ProgressMessageTemplate> = {
  // 思考阶段
  analyzing_request: {
    message: 'AI 正在分析您的出行需求...',
    emoji: '🧠',
  },
  understanding_time: {
    message: '理解时间：{time}',
    emoji: '🕐',
  },
  
  // 查询阶段
  getting_location: {
    message: '正在获取地理信息...',
    emoji: '📍',
  },
  calculating_distance: {
    message: '直线距离约 {distance} 公里',
    emoji: '📏',
  },
  querying_transit: {
    message: '查询跨城交通：{from} → {to}',
    emoji: '🚄',
  },
  querying_flight: {
    message: '查询航班：{from} → {to}',
    emoji: '✈️',
  },
  querying_driving: {
    message: '查询驾车路线...',
    emoji: '🚗',
  },
  
  // 结果阶段
  found_routes: {
    message: '找到 {count} 个出行方案',
    emoji: '✅',
  },
  no_routes: {
    message: '未找到合适的出行方案',
    emoji: '⚠️',
  },
  
  // 处理阶段
  splitting_tasks: {
    message: 'AI 正在拆分行程任务...',
    emoji: '📋',
  },
  tasks_created: {
    message: '已拆分为 {count} 个任务',
    emoji: '✅',
  },
  
  // 完成
  completed: {
    message: '{summary}',
    emoji: '🎉',
  },
  
  // 错误
  error: {
    message: '行程规划失败：{error}',
    emoji: '❌',
  },
}

// =============================================
// 天气查询 Agent 消息模板（示例）
// =============================================

export const WEATHER_MESSAGES: Record<string, ProgressMessageTemplate> = {
  querying: {
    message: '正在查询 {city} 的天气...',
    emoji: '🌤️',
  },
  found: {
    message: '获取到 {city} 未来 {days} 天的天气信息',
    emoji: '✅',
  },
}

// =============================================
// 消息模板映射（按 Agent 名称）
// =============================================

/**
 * Agent 消息模板映射
 * 新增 Agent 时在此注册
 */
export const AGENT_MESSAGES: Record<AgentName, Record<string, ProgressMessageTemplate>> = {
  trip_planner: TRIP_PLANNER_MESSAGES,
  weather: WEATHER_MESSAGES,
  restaurant: {
    // 示例：餐厅推荐 Agent 的消息模板
    searching: {
      message: '正在搜索 {location} 附近的餐厅...',
      emoji: '🔍',
    },
    found: {
      message: '找到 {count} 家符合条件的餐厅',
      emoji: '✅',
    },
  },
}

// =============================================
// 辅助函数
// =============================================

/**
 * 格式化消息（替换模板变量）
 */
export function formatMessage(
  template: ProgressMessageTemplate,
  variables?: Record<string, string | number>
): string {
  let message = template.message
  
  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, String(value))
    })
  }
  
  // 添加表情符号前缀
  if (template.emoji) {
    message = `${template.emoji} ${message}`
  }
  
  return message
}

/**
 * 获取 Agent 的消息模板
 */
export function getAgentMessages(agentName: AgentName): Record<string, ProgressMessageTemplate> {
  return AGENT_MESSAGES[agentName] || {}
}

/**
 * 获取特定消息模板
 */
export function getProgressMessage(
  agentName: AgentName,
  messageKey: string
): ProgressMessageTemplate | undefined {
  return AGENT_MESSAGES[agentName]?.[messageKey]
}
