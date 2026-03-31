/**
 * 任务相关类型定义
 */

export type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'
export type TaskStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

export interface Task {
  id: string
  title: string
  type: TaskType
  status: TaskStatus
  scheduled_time: string
  end_time?: string
  location_name?: string
  destination_name?: string
  is_expired: boolean
  metadata?: Record<string, unknown>
}

export interface CreateTaskDTO {
  title: string
  type: TaskType
  scheduled_time: string
  end_time?: string
  location_name?: string
  destination_name?: string
  metadata?: Record<string, unknown>
}
