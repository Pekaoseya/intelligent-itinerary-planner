/**
 * Agent 进度系统 - 类型定义
 * 
 * 提供统一的进度事件类型，便于扩展和维护
 */

// =============================================
// Agent 标识
// =============================================

/**
 * 已注册的 Agent 名称
 * 新增 Agent 时在此添加标识
 */
export type AgentName = 
  | 'trip_planner'      // 行程规划 Agent
  | 'weather'           // 天气查询 Agent（示例）
  | 'restaurant'        // 餐厅推荐 Agent（示例）
  // 后续新增 Agent 在此添加

/**
 * Agent 显示名称映射
 */
export const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  trip_planner: '行程规划',
  weather: '天气查询',
  restaurant: '餐厅推荐',
}

// =============================================
// 进度事件类型
// =============================================

/**
 * 进度阶段类型
 */
export type ProgressPhase = 
  | 'thinking'    // 思考/分析中
  | 'querying'    // 查询数据中
  | 'processing'  // 处理数据中
  | 'result'      // 返回结果
  | 'error'       // 错误

/**
 * 进度事件基础接口
 */
export interface AgentProgressEvent {
  /** Agent 标识 */
  agent: AgentName
  /** 进度阶段 */
  phase: ProgressPhase
  /** 进度消息（已格式化，可直接显示） */
  message: string
  /** 原始消息键（用于国际化等） */
  messageKey?: string
  /** 附加数据 */
  data?: Record<string, unknown>
  /** 时间戳 */
  timestamp: number
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (event: AgentProgressEvent) => void

// =============================================
// 进度消息模板
// =============================================

/**
 * 进度消息模板定义
 * message: 显示消息（支持模板变量 {var}）
 * emoji: 可选的表情符号前缀
 */
export interface ProgressMessageTemplate {
  message: string
  emoji?: string
}

/**
 * 消息变量映射（用于替换模板中的 {var}）
 */
export type MessageVariables = Record<string, string | number>
