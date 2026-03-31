/**
 * 任务相关类型定义
 */

// 任务类型
export type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'

// 任务状态
export type TaskStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

// 任务元数据
export interface TaskMetadata {
  train_number?: string
  flight_number?: string
  seat_type?: string
  cost?: number
  duration?: number
  attendees?: string[]
  meeting_room?: string
  tip?: string
  driver_name?: string
  driver_phone?: string
  car_number?: string
  car_model?: string
  arrive_minutes?: number
  distance?: number
  polyline?: Array<{ latitude: number; longitude: number }>
  [key: string]: any
}

// 任务实体
export interface Task {
  id: string
  title: string
  type: TaskType
  status: TaskStatus
  scheduled_time: string
  end_time?: string
  location_name?: string
  destination_name?: string
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
  is_expired: boolean
  metadata?: TaskMetadata
}

// 任务类型配置
export const TASK_TYPE_CONFIG: Record<TaskType, { name: string; color: string }> = {
  taxi: { name: '打车', color: '#faad14' },
  train: { name: '高铁', color: '#1890ff' },
  flight: { name: '飞机', color: '#722ed1' },
  hotel: { name: '酒店', color: '#722ed1' },
  dining: { name: '用餐', color: '#faad14' },
  meeting: { name: '会议', color: '#1890ff' },
  todo: { name: '事务', color: '#52c41a' },
  other: { name: '其他', color: '#999' },
}

// 获取任务类型名称
export function getTaskTypeName(type: TaskType): string {
  return TASK_TYPE_CONFIG[type]?.name || '任务'
}

// 获取任务类型颜色
export function getTaskTypeColor(type: TaskType): string {
  return TASK_TYPE_CONFIG[type]?.color || '#999'
}
