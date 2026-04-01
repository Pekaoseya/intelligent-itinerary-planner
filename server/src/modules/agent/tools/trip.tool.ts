/**
 * 行程规划工具执行器
 * 
 * 功能：
 * - trip_plan: 规划出行路线，自动拆分成多个任务
 * - 使用 TripPlannerAgent（LLM 智能体）进行分析和决策
 * 
 * 注意：参数校验由 tools/index.ts 统一处理
 */

import { Injectable } from '@nestjs/common'
import { ToolResult } from './definitions'
import { planTripWithAgent } from './trip-planner.agent'
import { type ProgressCallback } from '../progress'
import type { UserLocation } from './types'

// =============================================
// 行程规划工具
// =============================================

@Injectable()
export class TripTool {
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
    // 参数已由 tools/index.ts 校验，直接执行
    return executeTripPlanInternal(args, userId, userLocation)
  }
}

// =============================================
// 独立执行函数
// =============================================

export async function executeTripPlan(
  args: Record<string, any>,
  userId: string,
  userLocation?: UserLocation,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  // 参数已由 tools/index.ts 校验，直接执行
  return executeTripPlanInternal(args, userId, userLocation, onProgress)
}

async function executeTripPlanInternal(
  args: Record<string, any>,
  userId: string,
  userLocation?: UserLocation,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  try {
    const destination = args.destination as string
    const origin = args.origin as string | undefined
    const departureTime = args.departure_time as string | undefined
    const arrivalTime = args.arrival_time as string | undefined
    const preferredMode = args.preferred_mode as 'taxi' | 'train' | 'flight' | undefined
    const notes = args.notes as string | undefined
    
    console.log('[executeTripPlan] 参数:', { origin, destination, departureTime, preferredMode })
    
    // 构建请求
    const request = {
      origin: {
        name: origin || userLocation?.name || '当前位置',
        coordinate: origin ? undefined : userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined,
      },
      destination: {
        name: destination,
      },
      departureTime: departureTime,
      arrivalTime: arrivalTime,
      preferredMode: preferredMode,
      notes: notes,
      userLocation: userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      } : undefined,
    }

    // 调用智能体规划行程
    const result = await planTripWithAgent(request, onProgress)

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
