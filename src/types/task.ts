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
  // 位置信息（用于地图显示）
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
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

// 任务类型名称映射
const TASK_TYPE_NAMES: Record<TaskType, string> = {
  taxi: '打车',
  train: '火车',
  flight: '飞机',
  meeting: '会议',
  dining: '餐饮',
  hotel: '酒店',
  todo: '事务',
  other: '其他',
}

// 任务类型颜色映射
const TASK_TYPE_COLORS: Record<TaskType, string> = {
  taxi: '#faad14',
  train: '#1890ff',
  flight: '#722ed1',
  meeting: '#1890ff',
  dining: '#faad14',
  hotel: '#722ed1',
  todo: '#52c41a',
  other: '#8c8c8c',
}

/**
 * 获取任务类型名称
 */
export function getTaskTypeName(type: TaskType): string {
  return TASK_TYPE_NAMES[type] || '任务'
}

/**
 * 获取任务类型颜色
 */
export function getTaskTypeColor(type: TaskType): string {
  return TASK_TYPE_COLORS[type] || '#8c8c8c'
}

/**
 * 任务元数据类型
 */
export interface TaskMetadata {
  passengers?: number
  trainNumber?: string
  flightNumber?: string
  pnr?: string
  confirmationNumber?: string
  [key: string]: unknown
}
