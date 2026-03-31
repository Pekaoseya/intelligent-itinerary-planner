/**
 * 任务工具执行器
 * 
 * 设计原则：
 * - task_create: 只生成任务参数预览，不写入数据库
 * - task_delete: 只返回待删除任务列表，不真正删除
 * - 用户确认后，通过批量API真正执行操作
 */

import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { ToolResult } from './definitions'
import { DEFAULT_LOCATION } from './constants'
import {
  getCoordinates,
  getLastDestination,
  setLastDestination,
  getDrivingRoute,
  getAmapTransitRoute,
  calculateStraightDistance,
  generateStraightPolyline,
  extractCityName,
  formatTime,
} from './map-utils'
import { validateTransport } from './transport-validator'
import { estimateTaskDuration, checkTimeConflict } from './time-conflict'
import type { UserLocation, TaskType, RouteInfo, Coordinate } from './types'

const supabase = getSupabaseClient()

// =============================================
// 任务创建预览（不写入数据库）
// =============================================

export async function executeTaskCreate(
  args: any,
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  const { title, type, scheduled_time, end_time, location_name, location_address, destination_name, destination_address, metadata } = args

  // 参数校验
  if (!title || !type || !scheduled_time) {
    return {
      success: false,
      error: '缺少必要参数：title, type, scheduled_time',
    }
  }

  const scheduledDate = new Date(scheduled_time)
  const now = new Date()
  const isExpired = scheduledDate < now

  // 时间冲突检测
  const estimatedDuration = estimateTaskDuration(type as TaskType, undefined, metadata)
  const conflictCheck = await checkTimeConflict(userId, scheduledDate, estimatedDuration)

  if (conflictCheck.hasConflict && conflictCheck.severity === 'error') {
    const conflictDetails = conflictCheck.conflicts.map(c => {
      const timeStr = formatTime(c.scheduled_time)
      return `"${c.title}"（${timeStr}，重叠${c.overlap_minutes}分钟）`
    }).join('、')

    return {
      success: false,
      error: `时间冲突：该时间段与以下任务重叠：${conflictDetails}`,
      data: {
        conflicts: conflictCheck.conflicts,
        suggestion: '请选择其他时间，或先取消/调整冲突的任务',
      },
    }
  }

  // 智能起点选择
  let actualLocationName = location_name
  let originCoords: Coordinate | null = null

  if (location_name) {
    originCoords = await getCoordinates(location_name)
  } else if (getLastDestination()) {
    actualLocationName = getLastDestination()!.name
    originCoords = { latitude: getLastDestination()!.latitude, longitude: getLastDestination()!.longitude }
  } else if (userLocation) {
    actualLocationName = userLocation.name || '当前位置'
    originCoords = { latitude: userLocation.latitude, longitude: userLocation.longitude }
  } else {
    actualLocationName = DEFAULT_LOCATION.name
    originCoords = { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude }
  }

  const latitude = originCoords?.latitude ?? null
  const longitude = originCoords?.longitude ?? null

  // 获取终点坐标
  let destCoords: Coordinate | null = destination_name ? await getCoordinates(destination_name) : null
  let destLatitude = destCoords?.latitude ?? null
  let destLongitude = destCoords?.longitude ?? null

  // 获取路线信息
  let routeInfo: RouteInfo | null = null
  if (['taxi', 'train', 'flight'].includes(type) && actualLocationName && destination_name) {
    routeInfo = await getRouteByType(actualLocationName, destination_name, type as 'taxi' | 'train' | 'flight')
  }

  // 交通方式校验
  let validationWarnings: string[] = []
  let actualOriginName = actualLocationName
  let actualDestName = destination_name
  let finalOriginCoords: Coordinate | null = originCoords
  let finalDestCoords: Coordinate | null = destCoords

  if (['taxi', 'train', 'flight'].includes(type) && routeInfo) {
    const validation = await validateTransport(type as TaskType, actualLocationName, destination_name, routeInfo.distance)
    validationWarnings = validation.warnings

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
        data: {
          suggestions: validation.suggestions,
          autoFix: validation.autoFix,
          distance: Math.round(routeInfo.distance / 1000),
        },
      }
    }

    if (validation.autoFix) {
      if (validation.autoFix.origin) {
        actualOriginName = validation.autoFix.origin.name
        finalOriginCoords = {
          latitude: validation.autoFix.origin.latitude,
          longitude: validation.autoFix.origin.longitude,
        }
      }
      if (validation.autoFix.destination) {
        actualDestName = validation.autoFix.destination.name
        finalDestCoords = {
          latitude: validation.autoFix.destination.latitude,
          longitude: validation.autoFix.destination.longitude,
        }
        if (actualOriginName && actualDestName) {
          routeInfo = await getRouteByType(actualOriginName, actualDestName, type as 'taxi' | 'train' | 'flight')
        }
      }
    }
  }

  const finalMetadata = {
    ...metadata,
    distance: routeInfo?.distance,
    duration: routeInfo?.duration,
    polyline: routeInfo?.polyline,
    validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined,
  }

  // 生成预览数据（不写入数据库）
  const previewTask = {
    title,
    type,
    scheduled_time,
    end_time: end_time || null,
    location_name: actualOriginName || null,
    location_address: location_address || null,
    latitude: finalOriginCoords?.latitude ?? latitude,
    longitude: finalOriginCoords?.longitude ?? longitude,
    destination_name: actualDestName || null,
    destination_address: destination_address || null,
    dest_latitude: finalDestCoords?.latitude ?? destLatitude,
    dest_longitude: finalDestCoords?.longitude ?? destLongitude,
    metadata: finalMetadata,
    status: isExpired ? 'expired' : 'pending',
    is_expired: isExpired,
    // 冲突警告（如果有）
    conflictWarning: conflictCheck.hasConflict && conflictCheck.severity === 'warning' 
      ? `注意：该时间段与现有任务有轻微重叠` 
      : undefined,
  }

  // 更新多段行程状态（用于后续任务的起点）
  if (actualDestName && finalDestCoords?.latitude && finalDestCoords?.longitude) {
    setLastDestination({
      name: actualDestName,
      latitude: finalDestCoords.latitude,
      longitude: finalDestCoords.longitude,
    })
  }

  let message = `准备创建任务「${title}」`
  if (isExpired) {
    message += '（该时间已过期）'
  }
  if (validationWarnings.length > 0) {
    message += `。提示：${validationWarnings.join('；')}`
  }

  // 返回预览数据，标记为待确认
  return { 
    success: true, 
    data: { 
      preview: true,  // 标记为预览模式
      task: previewTask,
    }, 
    message 
  }
}

// =============================================
// 路线规划辅助函数
// =============================================

async function getRouteByType(
  originName: string,
  destName: string,
  transportType: 'taxi' | 'train' | 'flight'
): Promise<RouteInfo> {
  const origin = await getCoordinates(originName)
  const dest = await getCoordinates(destName)

  if (transportType === 'taxi') {
    const route = await getDrivingRoute(origin, dest)
    if (route) return route
  }

  if (transportType === 'train') {
    const originCity = extractCityName(originName)
    const destCity = extractCityName(destName)
    const route = await getAmapTransitRoute(origin, dest, originCity, destCity)
    if (route && route.distance > 0) return route
  }

  // 飞机或降级：计算直线距离
  const distance = calculateStraightDistance(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
  const polyline = generateStraightPolyline(origin, dest)

  let duration: number
  if (transportType === 'flight') {
    duration = Math.round(distance / 250)
  } else if (transportType === 'train') {
    duration = Math.round(distance / 80)
  } else {
    duration = Math.round(distance / 30)
  }

  return { distance, duration, polyline }
}

// =============================================
// 任务删除预览（不真正删除）
// =============================================

export async function executeTaskDelete(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter } = args

  // 按ID删除单个任务
  if (task_id) {
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .eq('user_id', userId)
      .single()

    if (findError || !task) {
      return { success: false, error: '未找到该任务' }
    }

    // 返回预览，不真正删除
    return { 
      success: true, 
      data: { 
        preview: true,
        deleteType: 'single',
        tasks: [task],
        count: 1,
      }, 
      message: `准备删除任务「${task.title}」` 
    }
  }

  // 按条件批量删除
  if (filter) {
    let query = supabase.from('tasks').select('*').eq('user_id', userId)

    if (filter.all) {
      // 删除所有
    } else {
      if (filter.type) query = query.eq('type', filter.type)
      if (filter.date_range?.start && filter.date_range?.end) {
        // 使用本地时区（+08:00）进行日期范围查询
        query = query.gte('scheduled_time', `${filter.date_range.start}T00:00:00+08:00`).lte('scheduled_time', `${filter.date_range.end}T23:59:59+08:00`)
      } else if (filter.date) {
        // 使用本地时区（+08:00）进行日期查询
        query = query.gte('scheduled_time', `${filter.date}T00:00:00+08:00`).lte('scheduled_time', `${filter.date}T23:59:59+08:00`)
      }
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.keyword) query = query.or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`)
      if (filter.expired === true) query = query.eq('is_expired', true)
    }

    const { data: tasks, error: findError } = await query
    if (findError) return { success: false, error: findError.message }
    if (!tasks?.length) return { success: true, data: { preview: true, tasks: [], count: 0 }, message: '没有找到符合条件的任务' }

    // 返回预览，不真正删除
    return { 
      success: true, 
      data: { 
        preview: true,
        deleteType: 'batch',
        tasks: tasks,
        count: tasks.length,
        taskIds: tasks.map(t => t.id),
      }, 
      message: `找到 ${tasks.length} 个任务待删除` 
    }
  }

  return { success: false, error: '请提供 task_id 或 filter 参数' }
}

// =============================================
// 任务更新（暂时保留原有逻辑，后续可改为预览模式）
// =============================================

export async function executeTaskUpdate(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter, updates } = args

  let targetTask: any = null

  if (task_id) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', task_id).eq('user_id', userId).single()
    if (error || !data) return { success: false, error: '未找到该任务' }
    targetTask = data
  } else if (filter?.keyword) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`).limit(1).single()
    if (error || !data) return { success: false, error: '未找到匹配的任务' }
    targetTask = data
  } else {
    return { success: false, error: '请提供 task_id 或 filter.keyword' }
  }

  if (targetTask.is_expired) {
    return { success: false, error: '该任务已过期，无法修改' }
  }

  // 返回预览数据
  const updatedTask = {
    ...targetTask,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  return { 
    success: true, 
    data: { 
      preview: true,
      originalTask: targetTask,
      updatedTask: updatedTask,
      updates: updates,
    }, 
    message: `准备更新任务「${targetTask.title}」` 
  }
}

// =============================================
// 任务查询（保留原有逻辑）
// =============================================

export async function executeTaskQuery(args: any, userId: string): Promise<ToolResult> {
  const { filter, limit = 20 } = args

  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (filter) {
    if (filter.date) {
      // 使用本地时区（+08:00）进行日期查询
      query = query.gte('scheduled_time', `${filter.date}T00:00:00+08:00`).lte('scheduled_time', `${filter.date}T23:59:59+08:00`)
    }
    if (filter.date_range) {
      // 使用本地时区（+08:00）进行日期范围查询
      if (filter.date_range.start) query = query.gte('scheduled_time', `${filter.date_range.start}T00:00:00+08:00`)
      if (filter.date_range.end) query = query.lte('scheduled_time', `${filter.date_range.end}T23:59:59+08:00`)
    }
    if (filter.type) query = query.eq('type', filter.type)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.keyword) query = query.or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`)
    if (!filter.include_expired) query = query.eq('is_expired', false)
  }

  query = query.order('scheduled_time', { ascending: true }).limit(limit)

  const { data: tasks, error } = await query
  if (error) return { success: false, error: error.message }

  return { success: true, data: { tasks: tasks || [], count: tasks?.length || 0 }, message: `找到 ${tasks?.length || 0} 个任务` }
}

// =============================================
// 任务完成（保留原有逻辑）
// =============================================

export async function executeTaskComplete(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter } = args

  let targetTask: any = null

  if (task_id) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', task_id).eq('user_id', userId).single()
    if (error || !data) return { success: false, error: '未找到该任务' }
    targetTask = data
  } else if (filter?.keyword) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).or(`title.ilike.%${filter.keyword}%`).limit(1).single()
    if (error || !data) return { success: false, error: '未找到匹配的任务' }
    targetTask = data
  } else {
    return { success: false, error: '请提供 task_id 或 filter' }
  }

  const { data: updatedTask, error } = await supabase.from('tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', targetTask.id).select().single()

  if (error) return { success: false, error: error.message }

  await supabase.from('task_events').insert({
    task_id: targetTask.id,
    user_id: userId,
    event_type: 'completed',
    reasoning: `标记完成: ${targetTask.title}`,
  })

  return { success: true, data: updatedTask, message: `已完成任务「${targetTask.title}」` }
}

// =============================================
// 批量创建任务（供确认后调用）
// =============================================

export async function executeBatchCreateTasks(
  userId: string,
  tasks: any[]
): Promise<ToolResult> {
  const results: any[] = []
  const errors: string[] = []

  for (const taskData of tasks) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        ...taskData,
      })
      .select()
      .single()

    if (error) {
      errors.push(`创建「${taskData.title}」失败: ${error.message}`)
    } else {
      results.push(data)
      
      // 记录事件
      await supabase.from('task_events').insert({
        task_id: data.id,
        user_id: userId,
        event_type: 'created',
        reasoning: `创建${taskData.type}类型任务: ${taskData.title}`,
      })
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return { success: false, error: errors.join('; ') }
  }

  return {
    success: true,
    data: {
      created: results,
      createdCount: results.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    message: errors.length > 0 
      ? `成功创建 ${results.length} 个任务，${errors.length} 个失败`
      : `成功创建 ${results.length} 个任务`,
  }
}

// =============================================
// 批量删除任务（供确认后调用）
// =============================================

export async function executeBatchDeleteTasks(
  userId: string,
  taskIds: string[]
): Promise<ToolResult> {
  if (!taskIds || taskIds.length === 0) {
    return { success: false, error: '请提供要删除的任务ID' }
  }

  // 查询任务
  const { data: tasks, error: findError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('id', taskIds)

  if (findError) return { success: false, error: findError.message }
  if (!tasks?.length) return { success: false, error: '未找到任务' }

  // 记录删除事件
  for (const task of tasks) {
    await supabase.from('task_events').insert({
      task_id: task.id,
      user_id: userId,
      event_type: 'cancelled',
      reasoning: `用户删除任务: ${task.title}`,
    })
  }

  // 执行删除
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .in('id', taskIds)

  if (deleteError) return { success: false, error: deleteError.message }

  return {
    success: true,
    data: {
      deletedCount: tasks.length,
      deletedTasks: tasks,
    },
    message: `已删除 ${tasks.length} 个任务`,
  }
}
