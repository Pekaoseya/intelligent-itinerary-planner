/**
 * 行程确认组件类型定义
 */

import type { TaskType, TaskMetadata } from '@/types'

// 待确认的任务（AI 生成，尚未持久化）
export interface PendingTask {
  id: string                    // 临时 ID
  title: string                 // 任务名称
  type: TaskType                // 任务类型
  scheduled_time: string        // 计划时间
  end_time?: string             // 结束时间
  location_name?: string        // 起点
  destination_name?: string     // 终点
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
  metadata?: TaskMetadata       // 元数据
}

// 确认类型
export type ConfirmType = 'add' | 'modify' | 'delete'

// 确认结果
export interface ConfirmResult {
  action: 'confirm' | 'cancel'
  task?: PendingTask            // 确认/修改后的任务
  originalTaskId?: string       // 原任务 ID（修改/删除时）
}

// 确认组件 Props 基础接口
export interface ConfirmProps {
  task: PendingTask
  originalTask?: PendingTask    // 原任务（修改时使用）
  onConfirm: (task: PendingTask) => void
  onCancel: () => void
}

// 行程编辑器 Props
export interface TaskEditorProps {
  task: PendingTask
  onChange: (task: PendingTask) => void
  editable?: boolean            // 是否可编辑（删除确认时为 false）
  showLocation?: boolean        // 是否显示地点信息
}

// 时间选择器 Props
export interface TimePickerProps {
  value: string                 // ISO 时间字符串
  onChange: (time: string) => void
  label?: string
}

// 出行方式选择器 Props
export interface TransportSelectorProps {
  value: TaskType
  onChange: (type: TaskType) => void
  options?: TaskType[]          // 可选的出行方式
}
