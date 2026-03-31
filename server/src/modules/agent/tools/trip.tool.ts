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
        departureTime: args.departure_time ? new Date(args.departure_time) : new Date(),
        arrivalTime: args.arrival_time ? new Date(args.arrival_time) : undefined,
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
      departureTime: args.departure_time ? new Date(args.departure_time as string) : new Date(),
      arrivalTime: args.arrival_time ? new Date(args.arrival_time as string) : undefined,
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
