/**
 * 工具模块统一入口
 */

// 类型定义
export * from './types'

// 常量
export * from './constants'

// 工具定义
export * from './definitions'

// 多段行程状态管理
export { resetMultiSegmentState } from './map-utils'

// 工具执行器
import { executeTaskCreate, executeTaskDelete, executeTaskUpdate, executeTaskQuery, executeTaskComplete } from './task.tool'
import { executeTaxiCall, executeTaxiStatus } from './taxi.tool'
import { executeTimeCheck, executeCalendarCheck } from './time.tool'
import { executeTripPlan } from './trip.tool'
import type { UserLocation } from './types'
import type { ToolResult } from './definitions'
import { type ProgressCallback, type AgentProgressEvent } from '../progress'

// 重新导出类型
export type { UserLocation, ToolResult }
export type { ProgressCallback, AgentProgressEvent } from '../progress'

/**
 * 统一工具执行入口
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string = 'default-user',
  userLocation?: UserLocation,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  console.log(`[ToolExecutor] 执行工具: ${toolName}`, args)

  switch (toolName) {
    case 'task_create':
      return executeTaskCreate(args, userId, userLocation)
    case 'task_delete':
      return executeTaskDelete(args, userId)
    case 'task_update':
      return executeTaskUpdate(args, userId)
    case 'task_query':
      return executeTaskQuery(args, userId)
    case 'task_complete':
      return executeTaskComplete(args, userId)
    case 'taxi_call':
      return executeTaxiCall(args, userId, userLocation)
    case 'taxi_status':
      return executeTaxiStatus(args, userId)
    case 'time_check':
      return executeTimeCheck(args, userId)
    case 'calendar_check':
      return executeCalendarCheck(args, userId)
    case 'trip_plan':
      return executeTripPlan(args, userId, userLocation, onProgress)
    default:
      return { success: false, error: `未知工具: ${toolName}` }
  }
}
