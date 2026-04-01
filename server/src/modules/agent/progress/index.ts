/**
 * Agent 进度系统 - 统一入口
 * 
 * 提供子 Agent 进度推送的完整解决方案：
 * 
 * 1. 类型定义：progress.types.ts
 *    - AgentName: Agent 标识类型
 *    - ProgressPhase: 进度阶段类型
 *    - AgentProgressEvent: 进度事件接口
 * 
 * 2. 消息模板：progress-messages.ts
 *    - 所有 Agent 的进度消息集中管理
 *    - 新增 Agent 时只需添加消息模板
 * 
 * 3. 进度发射器：progress-emitter.ts
 *    - 提供统一的进度推送 API
 *    - 支持模板消息和自定义消息
 * 
 * 使用示例：
 * ```typescript
 * import { createProgressEmitter } from './progress'
 * 
 * class MyAgent {
 *   private progress = createProgressEmitter('trip_planner', this.onProgress)
 *   
 *   async execute() {
 *     // 使用预定义模板
 *     this.progress.emit('analyzing_request')
 *     this.progress.emit('found_routes', { count: 3 })
 *     
 *     // 或使用便捷方法
 *     this.progress.thinking('正在分析...')
 *     this.progress.querying('查询数据中...')
 *     this.progress.result('处理完成')
 *   }
 * }
 * ```
 * 
 * 新增 Agent 步骤：
 * 1. 在 progress.types.ts 的 AgentName 中添加标识
 * 2. 在 progress-messages.ts 中添加消息模板
 * 3. 在子 Agent 中使用 ProgressEmitter 推送进度
 */

// 类型定义
export type {
  AgentName,
  ProgressPhase,
  AgentProgressEvent,
  ProgressCallback,
  ProgressMessageTemplate,
  MessageVariables,
} from './progress.types'

export { AGENT_DISPLAY_NAMES } from './progress.types'

// 消息模板
export {
  TRIP_PLANNER_MESSAGES,
  WEATHER_MESSAGES,
  AGENT_MESSAGES,
  formatMessage,
  getAgentMessages,
  getProgressMessage,
} from './progress-messages'

// 进度发射器
export {
  ProgressEmitter,
  createProgressEmitter,
  isProgressEvent,
} from './progress-emitter'
