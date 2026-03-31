/**
 * 用户上下文服务
 * 统一管理用户统计数据，提供两种输出格式：
 * 1. API 响应格式 - 给前端渲染
 * 2. 模型上下文格式 - 给 AI 提示词
 * 
 * 设计原则：
 * - 单一数据源：所有统计规则只在这里定义一次
 * - 双向输出：同一个数据可以输出给前端或模型
 * - 模型友好：输出给模型的文本简洁、占用 token 少
 */

import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

// =============================================
// 类型定义
// =============================================

/** 出行统计 */
export interface TravelStats {
  totalTrips: number
  byType: { taxi: number; train: number; flight: number }
  topLocations: { name: string; count: number }[]
  timeDistribution: { morning: number; afternoon: number; evening: number; night: number }
}

/** 日程统计 */
export interface ScheduleStats {
  totalTasks: number
  completed: number
  completionRate: number
  meetingsThisMonth: number
  byWeekday: { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number }
  byType: Record<string, number>
}

/** 趋势统计 */
export interface TrendStats {
  last7Days: { date: string; count: number }[]
}

/** 用户偏好 */
export interface UserPreferences {
  defaultTravelType: string
  reminderMinutes: number
  notificationEnabled: boolean
}

/** 完整用户上下文 */
export interface UserContext {
  travel: TravelStats | null
  schedule: ScheduleStats | null
  trend: TrendStats | null
  preferences: UserPreferences | null
}

// =============================================
// 配置：统计规则定义（只在这里修改）
// =============================================

/** 任务类型名称映射 */
const TYPE_NAMES: Record<string, string> = {
  taxi: '打车',
  train: '高铁',
  flight: '飞机',
  meeting: '会议',
  dining: '用餐',
  hotel: '酒店',
  todo: '事务',
  other: '其他',
}

/** 时段名称映射 */
const TIME_PERIOD_NAMES: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚间',
  night: '凌晨',
}

/** 星期名称映射 */
const WEEKDAY_NAMES: Record<string, string> = {
  mon: '周一',
  tue: '周二',
  wed: '周三',
  thu: '周四',
  fri: '周五',
  sat: '周六',
  sun: '周日',
}

/**
 * 统计项配置
 * enabled: 是否启用该统计项
 * includeInModel: 是否包含在模型上下文中
 * includeInApi: 是否包含在 API 响应中
 */
export const STATS_CONFIG = {
  travel: {
    enabled: true,
    includeInModel: true,
    includeInApi: true,
    fields: {
      totalTrips: { enabled: true, includeInModel: true, includeInApi: true },
      byType: { enabled: true, includeInModel: true, includeInApi: true },
      topLocations: { enabled: true, includeInModel: true, includeInApi: true, topN: 5 },
      timeDistribution: { enabled: true, includeInModel: true, includeInApi: true },
    },
  },
  schedule: {
    enabled: true,
    includeInModel: true,
    includeInApi: true,
    fields: {
      totalTasks: { enabled: true, includeInModel: true, includeInApi: true },
      completed: { enabled: true, includeInModel: false, includeInApi: true },
      completionRate: { enabled: true, includeInModel: true, includeInApi: true },
      meetingsThisMonth: { enabled: true, includeInModel: false, includeInApi: true },
      byWeekday: { enabled: true, includeInModel: false, includeInApi: true },
      byType: { enabled: true, includeInModel: true, includeInApi: true },
    },
  },
  trend: {
    enabled: true,
    includeInModel: false, // 趋势数据对模型用处不大，默认不包含
    includeInApi: true,
  },
  preferences: {
    enabled: true,
    includeInModel: true,
    includeInApi: true,
  },
}

// =============================================
// 服务实现
// =============================================

@Injectable()
export class UserContextService {
  private supabase = getSupabaseClient()
  private readonly logger = new Logger(UserContextService.name)

  /**
   * 获取用户完整上下文
   */
  async getUserContext(userId: string): Promise<UserContext> {
    try {
      // 并行获取所有数据
      const [tasks, preferences] = await Promise.all([
        this.supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        this.supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
      ])

      const allTasks = tasks.data || []

      return {
        travel: STATS_CONFIG.travel.enabled ? this.calculateTravelStats(allTasks) : null,
        schedule: STATS_CONFIG.schedule.enabled ? this.calculateScheduleStats(allTasks) : null,
        trend: STATS_CONFIG.trend.enabled ? this.calculateTrendStats(allTasks) : null,
        preferences: STATS_CONFIG.preferences.enabled ? this.parsePreferences(preferences.data) : null,
      }
    } catch (error) {
      this.logger.error('获取用户上下文失败:', error)
      return { travel: null, schedule: null, trend: null, preferences: null }
    }
  }

  // =============================================
  // 数据计算方法
  // =============================================

  private calculateTravelStats(tasks: any[]): TravelStats {
    const travelTasks = tasks.filter(t => ['taxi', 'train', 'flight'].includes(t.type))

    // 出行方式分布
    const byType = { taxi: 0, train: 0, flight: 0 }
    travelTasks.forEach(t => {
      if (t.type in byType) byType[t.type as keyof typeof byType]++
    })

    // 常去地点
    const locationCount: Record<string, number> = {}
    tasks.forEach(task => {
      if (task.destination_name) {
        locationCount[task.destination_name] = (locationCount[task.destination_name] || 0) + 1
      }
      if (task.location_name) {
        locationCount[task.location_name] = (locationCount[task.location_name] || 0) + 1
      }
    })
    const topN = STATS_CONFIG.travel.fields.topLocations.topN
    const topLocations = Object.entries(locationCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([name, count]) => ({ name, count }))

    // 时段分布
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 }
    tasks.forEach(task => {
      const date = new Date(task.scheduled_time)
      const hour = date.getHours()
      if (hour >= 6 && hour < 12) timeDistribution.morning++
      else if (hour >= 12 && hour < 18) timeDistribution.afternoon++
      else if (hour >= 18 && hour < 24) timeDistribution.evening++
      else timeDistribution.night++
    })

    return {
      totalTrips: travelTasks.length,
      byType,
      topLocations,
      timeDistribution,
    }
  }

  private calculateScheduleStats(tasks: any[]): ScheduleStats {
    const totalTasks = tasks.length
    const completed = tasks.filter(t => t.status === 'completed').length
    const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0

    // 本月会议
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthTasks = tasks.filter(t => new Date(t.scheduled_time) >= monthStart)
    const meetingsThisMonth = monthTasks.filter(t => t.type === 'meeting').length

    // 工作日分布
    const byWeekday = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
    const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    tasks.forEach(task => {
      const date = new Date(task.scheduled_time)
      const dayKey = weekdayKeys[date.getDay()]
      byWeekday[dayKey]++
    })

    // 类型分布
    const byType: Record<string, number> = {}
    tasks.forEach(task => {
      byType[task.type] = (byType[task.type] || 0) + 1
    })

    return {
      totalTasks,
      completed,
      completionRate,
      meetingsThisMonth,
      byWeekday,
      byType,
    }
  }

  private calculateTrendStats(tasks: any[]): TrendStats {
    const last7Days: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayTasks = tasks.filter(t => {
        const taskDate = new Date(t.scheduled_time)
        return taskDate >= date && taskDate < nextDate
      })

      last7Days.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        count: dayTasks.length,
      })
    }
    return { last7Days }
  }

  private parsePreferences(data: any): UserPreferences | null {
    if (!data) return null
    return {
      defaultTravelType: data.default_travel_type || 'taxi',
      reminderMinutes: data.reminder_minutes || 30,
      notificationEnabled: data.notification_enabled ?? true,
    }
  }

  // =============================================
  // 输出方法
  // =============================================

  /**
   * 输出给 API 响应
   * 格式化成前端需要的结构
   */
  toApiResponse(context: UserContext): Record<string, any> {
    const result: Record<string, any> = {}

    if (context.travel && STATS_CONFIG.travel.includeInApi) {
      result.travel = {
        total_trips: context.travel.totalTrips,
        by_type: context.travel.byType,
        top_locations: context.travel.topLocations,
        time_distribution: context.travel.timeDistribution,
      }
    }

    if (context.schedule && STATS_CONFIG.schedule.includeInApi) {
      result.schedule = {
        total_tasks: context.schedule.totalTasks,
        completed: context.schedule.completed,
        completion_rate: context.schedule.completionRate,
        meetings_this_month: context.schedule.meetingsThisMonth,
        by_weekday: context.schedule.byWeekday,
        by_type: context.schedule.byType,
      }
    }

    if (context.trend && STATS_CONFIG.trend.includeInApi) {
      result.trend = {
        last_7_days: context.trend.last7Days,
      }
    }

    if (context.preferences && STATS_CONFIG.preferences.includeInApi) {
      result.preferences = {
        default_travel_type: context.preferences.defaultTravelType,
        reminder_minutes: context.preferences.reminderMinutes,
        notification_enabled: context.preferences.notificationEnabled,
      }
    }

    return result
  }

  /**
   * 输出给模型上下文
   * 生成简洁的文本描述，占用 token 少
   */
  toModelContext(context: UserContext): string {
    const lines: string[] = []

    // 出行偏好
    if (context.travel && STATS_CONFIG.travel.includeInModel && context.travel.totalTrips > 0) {
      const { travel } = context

      if (STATS_CONFIG.travel.fields.totalTrips.includeInModel) {
        // 找最常用的出行方式
        const mostUsedType = Object.entries(travel.byType)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])[0]
        if (mostUsedType) {
          lines.push(`出行${travel.totalTrips}次，常坐${TYPE_NAMES[mostUsedType[0]]}`)
        }
      }

      if (STATS_CONFIG.travel.fields.topLocations.includeInModel && travel.topLocations.length > 0) {
        const locs = travel.topLocations.slice(0, 3).map(l => l.name).join('、')
        lines.push(`常去：${locs}`)
      }

      if (STATS_CONFIG.travel.fields.timeDistribution.includeInModel) {
        const mostUsedTime = Object.entries(travel.timeDistribution)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])[0]
        if (mostUsedTime) {
          lines.push(`偏好${TIME_PERIOD_NAMES[mostUsedTime[0]]}出行`)
        }
      }
    }

    // 日程习惯
    if (context.schedule && STATS_CONFIG.schedule.includeInModel && context.schedule.totalTasks > 0) {
      const { schedule } = context

      if (STATS_CONFIG.schedule.fields.totalTasks.includeInModel) {
        lines.push(`任务${schedule.totalTasks}个，完成${schedule.completionRate}%`)
      }

      if (STATS_CONFIG.schedule.fields.byType.includeInModel) {
        const mostType = Object.entries(schedule.byType)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])[0]
        if (mostType) {
          lines.push(`多为${TYPE_NAMES[mostType[0]] || mostType[0]}`)
        }
      }
    }

    // 用户偏好
    if (context.preferences && STATS_CONFIG.preferences.includeInModel) {
      lines.push(`默认${TYPE_NAMES[context.preferences.defaultTravelType] || context.preferences.defaultTravelType}出行`)
    }

    if (lines.length === 0) {
      return ''
    }

    return `## 用户画像
${lines.join('；')}。
参考以上偏好做推荐。`
  }

  // =============================================
  // 便捷方法：直接接收 userId
  // =============================================

  /**
   * 获取 API 响应格式的统计数据
   * @param userId 用户 ID
   * @returns 格式化后的统计数据
   */
  async getApiResponse(userId: string): Promise<Record<string, any>> {
    const context = await this.getUserContext(userId)
    return this.toApiResponse(context)
  }

  /**
   * 获取模型上下文格式的文本
   * @param userId 用户 ID
   * @returns 简洁的用户画像文本
   */
  async getModelContext(userId: string): Promise<string> {
    const context = await this.getUserContext(userId)
    return this.toModelContext(context)
  }
}
