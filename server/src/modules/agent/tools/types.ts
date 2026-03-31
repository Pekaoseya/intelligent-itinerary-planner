/**
 * 工具模块共享类型定义
 */

// 用户位置信息
export interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

// 任务类型
export type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'

// 任务状态
export type TaskStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

// POI 搜索结果
export interface POIResult {
  name: string
  address: string
  latitude: number
  longitude: number
  type: string
  distance?: number
}

// 校验结果
export interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  suggestions: string[]
  autoFix?: {
    origin?: { name: string; latitude: number; longitude: number }
    destination?: { name: string; latitude: number; longitude: number }
    suggestedType?: TaskType
  }
}

// 路线信息
export interface RouteInfo {
  distance: number // 米
  duration: number // 秒
  polyline: Array<{ latitude: number; longitude: number }>
  toll?: number // 过路费
}

// 坐标点
export interface Coordinate {
  latitude: number
  longitude: number
}
