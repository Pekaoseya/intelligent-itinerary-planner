/**
 * 工具模块统一入口
 * 
 * 职责：
 * - 导出所有工具相关的类型和定义
 * - 提供统一的工具执行入口
 * - 在执行前进行参数校验
 */

// 类型定义
export * from './types'

// 常量
export * from './constants'

// 工具定义
export * from './definitions'

// 参数校验
export * from './param-validator'

// 多段行程状态管理
export { resetMultiSegmentState } from './map-utils'

// 工具执行器（内部使用）
import { executeTaskCreate, executeTaskDelete, executeTaskUpdate, executeTaskQuery, executeTaskComplete } from './task.tool'
import { executeTaxiCall, executeTaxiStatus } from './taxi.tool'
import { executeTimeCheck, executeCalendarCheck } from './time.tool'
import { executeTripPlan } from './trip.tool'

// 类型
import type { UserLocation } from './types'
import type { ToolResult } from './definitions'
import { type ProgressCallback, type AgentProgressEvent } from '../progress'
import { validateToolParams } from './param-validator'

// 重新导出类型
export type { UserLocation, ToolResult }
export type { ProgressCallback, AgentProgressEvent } from '../progress'

/**
 * 统一工具执行入口
 * 
 * 执行流程：
 * 1. 参数校验（在执行前统一校验）
 * 2. 执行工具逻辑
 * 3. 返回结果
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string = 'default-user',
  userLocation?: UserLocation,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  console.log(`[ToolExecutor] 执行工具: ${toolName}`, JSON.stringify(args, null, 2))

  // =============================================
  // Step 1: 参数校验（统一处理）
  // =============================================
  const validation = validateToolParams(toolName, args)
  if (!validation.valid) {
    console.log(`[ToolExecutor] 参数校验失败: ${validation.error}`)
    return {
      success: false,
      error: validation.error,
      retryHint: validation.retryHint,
    }
  }

  // =============================================
  // Step 2: 执行工具
  // =============================================
  try {
    const result = await executeToolInternal(toolName, args, userId, userLocation, onProgress)
    return result
  } catch (error) {
    console.error(`[ToolExecutor] 工具执行异常:`, error)
    return {
      success: false,
      error: `工具执行失败: ${error.message || error}`,
    }
  }
}

/**
 * 内部工具执行（已通过参数校验）
 */
async function executeToolInternal(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  userLocation?: UserLocation,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  switch (toolName) {
    // 任务管理
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
    
    // 打车
    case 'taxi_call':
      return executeTaxiCall(args, userId, userLocation)
    case 'taxi_status':
      return executeTaxiStatus(args, userId)
    
    // 时间和日历
    case 'time_check':
      return executeTimeCheck(args, userId)
    case 'calendar_check':
      return executeCalendarCheck(args, userId)
    
    // 行程规划
    case 'trip_plan':
      return executeTripPlan(args, userId, userLocation, onProgress)
    
    default:
      return { success: false, error: `未知工具: ${toolName}` }
  }
}
