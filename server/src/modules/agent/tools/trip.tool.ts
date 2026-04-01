/**
 * 行程规划工具执行器
 * 
 * 功能：
 * - trip_plan: 规划出行路线，自动拆分成多个任务
 * - 使用 TripPlannerAgent（LLM 智能体）进行分析和决策
 * - 不硬编码任何规则，全部由 AI 处理
 */

import { Injectable } from '@nestjs/common'
import { ToolResult } from './definitions'
import { planTripWithAgent } from './trip-planner.agent'
import type { UserLocation } from './types'

// =============================================
// 行程规划工具
// =============================================

@Injectable()
export class TripTool {
  /**
   * 执行行程规划
   * 使用 LLM 智能体分析需求、调用 API、拆分任务
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
      // 构建请求 - 直接传递原始参数，由 LLM 解析
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
        // 直接传递原始字符串，让 LLM 理解
        departureTime: args.departure_time,
        arrivalTime: args.arrival_time,
        preferredMode: args.preferred_mode,
        notes: args.notes,
        userLocation: userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined,
      }

      // 调用智能体规划行程
      const result = await planTripWithAgent(request)

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
}

// =============================================
// 独立执行函数（不依赖注入）
// =============================================

/**
 * 执行行程规划（独立函数版本）
 * 直接调用 TripPlannerAgent，让 LLM 处理所有分析
 */
export async function executeTripPlan(
  args: Record<string, any>,
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  try {
    // 提取参数
    const destination = args.destination as string
    if (!destination) {
      return {
        success: false,
        error: '请提供目的地',
      }
    }

    // 构建请求 - 直接传递原始参数，让 LLM 理解和解析
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
      // 直接传递原始字符串，如 "明天下午"，由 LLM 理解
      departureTime: args.departure_time as string | undefined,
      arrivalTime: args.arrival_time as string | undefined,
      preferredMode: args.preferred_mode as 'taxi' | 'train' | 'flight' | undefined,
      notes: args.notes as string | undefined,
      userLocation: userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      } : undefined,
    }

    console.log('[executeTripPlan] 调用智能体规划行程，参数:', {
      origin: request.origin.name,
      destination: request.destination.name,
      departureTime: request.departureTime,
      preferredMode: request.preferredMode,
    })

    // 调用智能体
    const result = await planTripWithAgent(request)

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
