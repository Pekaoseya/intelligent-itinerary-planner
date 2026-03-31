/**
 * 对话相关类型定义
 */
import type { Task } from './task'

export type MessageRole = 'user' | 'assistant'

export interface ToolResult {
  tool: string
  args: unknown
  result: {
    success: boolean
    data?: unknown
    message?: string
    error?: string
  }
}

export interface MessageData {
  // 任务相关
  task?: Task
  tasks?: Task[]
  deleted?: Task
  deletedCount?: number
  
  // 确认流程
  needConfirm?: boolean
  needConfirmation?: boolean
  confirmType?: 'batch_add' | 'batch_delete' | 'modify'
  
  // 批量创建
  pendingTasks?: import('@/components/confirmation').PendingTask[]
  pendingCount?: number
  
  // 批量删除
  pendingDeleteTasks?: Task[]
  pendingDeleteIds?: string[]
  pendingDeleteCount?: number
  
  // 单个任务更新
  originalTask?: import('@/components/confirmation').PendingTask
  updatedTask?: import('@/components/confirmation').PendingTask
  updates?: Record<string, unknown>
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  reasoning?: string[]
  tool_results?: ToolResult[]
  data?: MessageData
  timestamp: Date
}
