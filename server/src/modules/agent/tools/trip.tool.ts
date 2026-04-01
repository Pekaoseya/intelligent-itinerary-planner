/**
 * 行程规划工具执行器
 * 
 * 功能：
 * - trip_plan: 规划出行路线，自动拆分成多个任务
 * - 支持打车、高铁、飞机等多种交通方式
 * - 参考高德路径规划的逻辑
 */

import { Injectable } from '@nestjs/common'
import { ToolResult } from './definitions'
import { TripPlannerService } from './trip-planner.service'
import type { UserLocation } from './types'

// =============================================
// 自然语言日期解析
// =============================================

/**
 * 解析自然语言日期为 Date 对象
 * 支持：今天、明天、后天、具体日期、相对时间等
 */
function parseNaturalDate(dateStr: string): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // 标准化输入（去除空格、转小写）
  const input = dateStr.trim().toLowerCase()
  
  // 今天
  if (input === '今天' || input === 'today') {
    return now
  }
  
  // 明天
  if (input === '明天' || input === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    // 默认下午出发
    tomorrow.setHours(14, 0, 0, 0)
    return tomorrow
  }
  
  // 后天
  if (input === '后天') {
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)
    dayAfter.setHours(14, 0, 0, 0)
    return dayAfter
  }
  
  // 大后天
  if (input === '大后天') {
    const date = new Date(today)
    date.setDate(date.getDate() + 3)
    date.setHours(14, 0, 0, 0)
    return date
  }
  
  // 下周X
  const weekMatch = input.match(/下周([一二三四五六日天])/)
  if (weekMatch) {
    const weekDays: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
    }
    const targetDay = weekDays[weekMatch[1]]
    const currentDay = today.getDay()
    let daysToAdd = targetDay - currentDay
    if (daysToAdd <= 0) daysToAdd += 7
    daysToAdd += 7 // 下周
    const result = new Date(today)
    result.setDate(result.getDate() + daysToAdd)
    result.setHours(14, 0, 0, 0)
    return result
  }
  
  // 周X / 星期X（本周）
  const thisWeekMatch = input.match(/[周星期]([一二三四五六日天])/)
  if (thisWeekMatch) {
    const weekDays: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
    }
    const targetDay = weekDays[thisWeekMatch[1]]
    const currentDay = today.getDay()
    let daysToAdd = targetDay - currentDay
    if (daysToAdd < 0) daysToAdd += 7
    const result = new Date(today)
    result.setDate(result.getDate() + daysToAdd)
    result.setHours(14, 0, 0, 0)
    return result
  }
  
  // 明天上午/下午/晚上
  const tomorrowTimeMatch = input.match(/明天(上午|下午|晚上|早上|傍晚)/)
  if (tomorrowTimeMatch) {
    const timeMap: Record<string, number> = {
      '早上': 8, '上午': 9, '中午': 12, '下午': 14, '傍晚': 17, '晚上': 19
    }
    const hour = timeMap[tomorrowTimeMatch[1]] || 14
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(hour, 0, 0, 0)
    return tomorrow
  }
  
  // 今天上午/下午/晚上
  const todayTimeMatch = input.match(/今天(上午|下午|晚上|早上|傍晚|中午)/)
  if (todayTimeMatch) {
    const timeMap: Record<string, number> = {
      '早上': 8, '上午': 9, '中午': 12, '下午': 14, '傍晚': 17, '晚上': 19
    }
    const hour = timeMap[todayTimeMatch[1]] || 14
    const result = new Date(today)
    result.setHours(hour, 0, 0, 0)
    return result
  }
  
  // ISO 日期格式：YYYY-MM-DD 或 YYYY-MM-DD HH:MM 或 YYYY-MM-DDTHH:MM
  const isoMatch = input.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[t\s](\d{1,2}):(\d{1,2}))?/i)
  if (isoMatch) {
    const [, year, month, day, hour, minute] = isoMatch
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour ? parseInt(hour) : 14,
      minute ? parseInt(minute) : 0,
      0
    )
  }
  
  // 简化日期：X月X日
  const mdMatch = input.match(/(\d{1,2})月(\d{1,2})[日号]?/)
  if (mdMatch) {
    const [, month, day] = mdMatch
    const result = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day), 14, 0, 0)
    // 如果日期已过，则认为是明年
    if (result < today) {
      result.setFullYear(result.getFullYear() + 1)
    }
    return result
  }
  
  // 尝试直接解析（支持 JS Date 能解析的格式）
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }
  
  // 无法解析，返回明天默认时间
  console.warn(`[parseNaturalDate] 无法解析日期: ${dateStr}，使用默认值（明天下午）`)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(14, 0, 0, 0)
  return tomorrow
}

// =============================================
// 行程规划工具
// =============================================

@Injectable()
export class TripTool {
  constructor(private readonly tripPlannerService: TripPlannerService) {}

  /**
   * 执行行程规划
   */
  async executeTripPlan(
    args: {
      origin?: string
      destination: string
      departure_time?: string
      arrival_time?: string
      preferred_mode?: 'taxi' | 'train' | 'flight'
      notes?: string
    },
    userId: string,
    userLocation?: UserLocation
  ): Promise<ToolResult> {
    try {
      // 构建请求
      const request = {
        origin: {
          name: args.origin || userLocation?.name || '当前位置',
          coordinate: args.origin ? undefined : userLocation ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          } : undefined,
        },
        destination: {
          name: args.destination,
        },
        departureTime: args.departure_time ? parseNaturalDate(args.departure_time) : new Date(),
        arrivalTime: args.arrival_time ? parseNaturalDate(args.arrival_time) : undefined,
        preferredMode: args.preferred_mode,
        notes: args.notes,
        userLocation: userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined,
      }

      // 调用行程规划服务
      const result = await this.tripPlannerService.planTrip(request)

      if (!result.success) {
        return {
          success: false,
          error: result.error || '行程规划失败',
        }
      }

      // 返回预览数据
      return {
        success: true,
        data: {
          preview: true,
          confirmType: 'trip_plan',
          routes: result.routes,
          recommendedIndex: result.recommendedIndex,
          splitTasks: result.splitTasks.map((task, index) => ({
            id: `preview_trip_${index}`,
            title: task.title,
            type: task.type,
            scheduled_time: task.scheduledTime.toISOString(),
            end_time: task.endTime?.toISOString(),
            location_name: task.origin?.name,
            destination_name: task.destination?.name,
            metadata: task.metadata,
            description: task.description,
          })),
          summary: result.summary,
          reasoning: result.reasoning,
        },
        message: result.summary,
      }
    } catch (error) {
      console.error('[executeTripPlan] 执行失败:', error)
      return {
        success: false,
        error: error.message || '行程规划失败',
      }
    }
  }
}

// =============================================
// 独立执行函数（不依赖注入）
// =============================================

let tripPlannerService: TripPlannerService | null = null

function getTripPlannerService(): TripPlannerService {
  if (!tripPlannerService) {
    tripPlannerService = new TripPlannerService()
  }
  return tripPlannerService
}

/**
 * 执行行程规划（独立函数版本）
 */
export async function executeTripPlan(
  args: Record<string, any>,
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  const service = getTripPlannerService()
  
  try {
    // 提取并验证参数
    const destination = args.destination as string
    if (!destination) {
      return {
        success: false,
        error: '请提供目的地',
      }
    }
    
    // 解析出发时间
    const departureTimeStr = args.departure_time as string | undefined
    let departureTime: Date
    if (departureTimeStr) {
      departureTime = parseNaturalDate(departureTimeStr)
      console.log(`[executeTripPlan] 解析出发时间: "${departureTimeStr}" -> ${departureTime.toISOString()} (valid: ${!isNaN(departureTime.getTime())})`)
    } else {
      departureTime = new Date()
    }
    
    // 验证日期有效性
    if (isNaN(departureTime.getTime())) {
      console.warn(`[executeTripPlan] 日期解析失败，使用默认值`)
      departureTime = new Date()
      departureTime.setDate(departureTime.getDate() + 1)
      departureTime.setHours(14, 0, 0, 0)
    }
    
    // 构建请求
    const request = {
      origin: {
        name: (args.origin as string) || userLocation?.name || '当前位置',
        coordinate: args.origin ? undefined : userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined,
      },
      destination: {
        name: destination,
      },
      departureTime,
      arrivalTime: args.arrival_time ? parseNaturalDate(args.arrival_time as string) : undefined,
      preferredMode: args.preferred_mode as 'taxi' | 'train' | 'flight' | undefined,
      notes: args.notes as string | undefined,
      userLocation: userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      } : undefined,
    }

    // 调用行程规划服务
    const result = await service.planTrip(request)

    if (!result.success) {
      return {
        success: false,
        error: result.error || '行程规划失败',
      }
    }

    // 安全地转换日期
    const safeFormatDate = (date: Date | undefined | null): string => {
      if (!date) return ''
      try {
        const time = date.getTime()
        if (isNaN(time)) {
          // 如果日期无效，返回一个默认的未来时间
          const defaultDate = new Date()
          defaultDate.setDate(defaultDate.getDate() + 1)
          defaultDate.setHours(14, 0, 0, 0)
          return defaultDate.toISOString()
        }
        return date.toISOString()
      } catch {
        return new Date().toISOString()
      }
    }

    // 返回预览数据
    return {
      success: true,
      data: {
        preview: true,
        confirmType: 'trip_plan',
        routes: result.routes,
        recommendedIndex: result.recommendedIndex,
        splitTasks: result.splitTasks.map((task, index) => ({
          id: `preview_trip_${index}`,
          title: task.title,
          type: task.type,
          scheduled_time: safeFormatDate(task.scheduledTime),
          end_time: safeFormatDate(task.endTime),
          location_name: task.origin?.name,
          destination_name: task.destination?.name,
          metadata: task.metadata,
          description: task.description,
        })),
        summary: result.summary,
        reasoning: result.reasoning,
      },
      message: result.summary,
    }
  } catch (error) {
    console.error('[executeTripPlan] 执行失败:', error)
    return {
      success: false,
      error: error.message || '行程规划失败',
    }
  }
}
