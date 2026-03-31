/**
 * 行程确认组件类型定义
 */

import type { TaskType, TaskMetadata } from '@/types'

// 待确认的任务（AI 生成的参数）
export interface PendingTask {
  title: string                 // 任务名称
  type: TaskType                // 任务类型
  scheduled_time: string        // 计划时间
  end_time?: string             // 结束时间
  location_name?: string        // 起点
  location_address?: string
  destination_name?: string     // 终点
  destination_address?: string
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
  metadata?: TaskMetadata       // 元数据
  status?: string
  is_expired?: boolean
  conflictWarning?: string      // 冲突警告
}

// 确认类型
export type ConfirmType = 'batch_add' | 'batch_delete' | 'modify'

// 确认组件 Props
export interface ConfirmModalProps {
  type: ConfirmType
  visible: boolean
  // 批量创建
  pendingTasks?: PendingTask[]
  // 批量删除
  pendingDeleteTasks?: any[]
  // 单个任务更新
  originalTask?: PendingTask
  updatedTask?: PendingTask
  // 回调
  onConfirmBatchAdd: () => void
  onConfirmBatchDelete: () => void
  onConfirmModify: () => void
  onCancel: () => void
}

// 行程编辑器 Props
export interface TaskEditorProps {
  task: PendingTask
  onChange: (task: PendingTask) => void
  editable?: boolean
  showLocation?: boolean
}

// 任务卡片 Props
export interface TaskCardProps {
  task: PendingTask | any
  index?: number
  showType?: boolean
}
