/**
 * Agent 进度系统 - 进度发射器
 * 
 * 提供统一的进度推送接口，子 Agent 只需调用简单的方法即可推送进度
 * 
 * 使用示例：
 * ```typescript
 * const emitter = new ProgressEmitter('trip_planner', onProgress)
 * 
 * // 方式1：使用预定义的消息模板（推荐）
 * emitter.emit('analyzing_request')
 * emitter.emit('found_routes', { count: 3 })
 * 
 * // 方式2：直接传递消息（不推荐，但支持）
 * emitter.emitCustom('thinking', '正在处理...')
 * ```
 */

import type { 
  AgentName, 
  ProgressPhase, 
  AgentProgressEvent, 
  ProgressCallback,
  MessageVariables 
} from './progress.types'
import { formatMessage, getProgressMessage } from './progress-messages'

/**
 * 消息键到阶段类型的默认映射
 */
const DEFAULT_PHASE_MAP: Record<string, ProgressPhase> = {
  analyzing: 'thinking',
  understanding: 'thinking',
  getting: 'querying',
  querying: 'querying',
  searching: 'querying',
  calculating: 'processing',
  splitting: 'processing',
  found: 'result',
  completed: 'result',
  tasks_created: 'result',
  no_routes: 'result',
  error: 'error',
}

/**
 * 进度发射器
 * 
 * 每个子 Agent 创建一个实例，用于推送进度事件
 */
export class ProgressEmitter {
  private agentName: AgentName
  private callback: ProgressCallback | undefined

  constructor(agentName: AgentName, callback?: ProgressCallback) {
    this.agentName = agentName
    this.callback = callback
  }

  /**
   * 更新回调函数（用于流式传输时动态更新回调）
   */
  setCallback(callback: ProgressCallback | undefined): void {
    this.callback = callback
  }

  /**
   * 发送进度事件（使用预定义的消息模板）
   * 
   * @param messageKey 消息模板键（定义在 progress-messages.ts 中）
   * @param variables 模板变量（用于替换 {var}）
   */
  emit(messageKey: string, variables?: MessageVariables): void {
    const template = getProgressMessage(this.agentName, messageKey)
    
    if (!template) {
      // 模板不存在，使用消息键作为消息
      this.emitCustom(this.detectPhase(messageKey), messageKey, variables)
      return
    }

    const message = formatMessage(template, variables)
    const phase = this.detectPhase(messageKey)

    this.sendEvent({
      agent: this.agentName,
      phase,
      message,
      messageKey,
      data: variables,
      timestamp: Date.now(),
    })
  }

  /**
   * 发送自定义进度事件（不使用预定义模板）
   * 
   * @param phase 进度阶段
   * @param message 消息内容
   * @param data 附加数据
   */
  emitCustom(
    phase: ProgressPhase,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.sendEvent({
      agent: this.agentName,
      phase,
      message,
      timestamp: Date.now(),
      data,
    })
  }

  /**
   * 发送思考阶段进度
   */
  thinking(message: string, data?: Record<string, unknown>): void {
    this.emitCustom('thinking', message, data)
  }

  /**
   * 发送查询阶段进度
   */
  querying(message: string, data?: Record<string, unknown>): void {
    this.emitCustom('querying', message, data)
  }

  /**
   * 发送处理阶段进度
   */
  processing(message: string, data?: Record<string, unknown>): void {
    this.emitCustom('processing', message, data)
  }

  /**
   * 发送结果阶段进度
   */
  result(message: string, data?: Record<string, unknown>): void {
    this.emitCustom('result', message, data)
  }

  /**
   * 发送错误进度
   */
  error(message: string, error?: Error): void {
    this.emitCustom('error', message, { 
      error: message,
      details: error?.message 
    })
  }

  /**
   * 检测消息键对应的阶段类型
   */
  private detectPhase(messageKey: string): ProgressPhase {
    const lowerKey = messageKey.toLowerCase()
    
    for (const [pattern, phase] of Object.entries(DEFAULT_PHASE_MAP)) {
      if (lowerKey.includes(pattern)) {
        return phase
      }
    }
    
    return 'thinking'
  }

  /**
   * 发送事件到回调
   */
  private sendEvent(event: AgentProgressEvent): void {
    if (this.callback) {
      this.callback(event)
    }
  }
}

// =============================================
// 便捷工厂函数
// =============================================

/**
 * 创建进度发射器
 */
export function createProgressEmitter(
  agentName: AgentName,
  callback?: ProgressCallback
): ProgressEmitter {
  return new ProgressEmitter(agentName, callback)
}

/**
 * 类型守卫：检查是否为进度事件
 */
export function isProgressEvent(event: unknown): event is AgentProgressEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'agent' in event &&
    'phase' in event &&
    'message' in event &&
    'timestamp' in event
  )
}
