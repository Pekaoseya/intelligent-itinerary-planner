/**
 * 后端共享类型定义 - 任务
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
  user_id: string
  title: string
  type: TaskType
  status: TaskStatus
  scheduled_time: string
  end_time?: string
  location_name?: string
  location_address?: string
  destination_name?: string
  destination_address?: string
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
  duration_minutes?: number
  metadata?: TaskMetadata
  is_expired: boolean
  created_at: string
  updated_at: string
}
