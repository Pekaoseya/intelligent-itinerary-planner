/**
 * 个人中心相关类型定义
 */

// 出行统计
export interface TravelStats {
  total_trips: number
  by_type: { taxi: number; train: number; flight: number }
  top_locations: { name: string; count: number }[]
  time_distribution: { morning: number; afternoon: number; evening: number; night: number }
}

// 日程统计
export interface ScheduleStats {
  total_tasks: number
  completed: number
  completion_rate: number
  meetings_this_month: number
  by_weekday: { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number }
  by_type: Record<string, number>
}

// 趋势统计
export interface TrendStats {
  last_7_days: { date: string; count: number }[]
}

// 用户偏好设置
export interface UserPreferences {
  default_travel_type: string
  reminder_minutes: number
  notification_enabled: boolean
}

// 出行类型配置
export const TRAVEL_TYPE_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  taxi: { name: '打车', color: '#faad14', bgColor: '#fff7e6' },
  train: { name: '高铁', color: '#1890ff', bgColor: '#e6f7ff' },
  flight: { name: '飞机', color: '#722ed1', bgColor: '#f9f0ff' },
}

// 时段配置
export const TIME_PERIOD_CONFIG: Record<string, { name: string; color: string }> = {
  morning: { name: '上午', color: '#faad14' },
  afternoon: { name: '下午', color: '#1890ff' },
  evening: { name: '晚间', color: '#722ed1' },
  night: { name: '凌晨', color: '#52c41a' },
}

// 星期配置
export const WEEKDAY_CONFIG: Record<string, { name: string; isWeekend: boolean }> = {
  mon: { name: '一', isWeekend: false },
  tue: { name: '二', isWeekend: false },
  wed: { name: '三', isWeekend: false },
  thu: { name: '四', isWeekend: false },
  fri: { name: '五', isWeekend: false },
  sat: { name: '六', isWeekend: true },
  sun: { name: '日', isWeekend: true },
}
