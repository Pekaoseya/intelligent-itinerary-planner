/**
 * 任务工具执行器
 * 
 * 职责：
 * - 执行具体的任务操作逻辑
 * - 参数校验由 tools/index.ts 统一处理
 * 
 * 设计原则：
 * - task_create: 只生成任务参数预览，不写入数据库
 * - task_delete: 只返回待删除任务列表，不真正删除
 * - 用户确认后，通过批量API真正执行操作
 */

import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { ToolResult } from './definitions'
import { DEFAULT_LOCATION } from './constants'
import { getDayRange, getDateRangeQuery, parseDateParam } from './date-utils'
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
// 任务创建预览
// =============================================

export async function executeTaskCreate(
  args: any,
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  // 参数已由 tools/index.ts 校验
  const { title, type, scheduled_time, end_time, location_name, location_address, destination_name, destination_address, metadata } = args

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

  // 生成预览数据
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
    dest_latitude: finalDestCoords?.latitude,
    dest_longitude: finalDestCoords?.longitude,
    metadata: finalMetadata,
    status: isExpired ? 'expired' : 'pending',
    is_expired: isExpired,
    conflictWarning: conflictCheck.hasConflict && conflictCheck.severity === 'warning' 
      ? `注意：该时间段与现有任务有轻微重叠` 
      : undefined,
  }

  // 更新多段行程状态
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

  return { 
    success: true, 
    data: { 
      preview: true,
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
// 任务删除预览
// =============================================

export async function executeTaskDelete(args: any, userId: string): Promise<ToolResult> {
  // 扁平化参数：task_id, date, type, keyword, all, confirm
  const { task_id, date, type, keyword, all, confirm } = args

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
  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (all) {
    // 删除所有
  } else {
    if (type) query = query.eq('type', type)
    if (date) {
      const range = parseDateParam(date)
      query = query.gte('scheduled_time', range.start).lte('scheduled_time', range.end)
    }
    if (keyword) query = query.or(`title.ilike.%${keyword}%,location_name.ilike.%${keyword}%`)
  }

  const { data: tasks, error: findError } = await query
  if (findError) return { success: false, error: findError.message }
  if (!tasks?.length) {
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('id, title, type, scheduled_time, status')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true })
      .limit(10)
    
    return { 
      success: true, 
      data: { 
        preview: true, 
        tasks: [], 
        count: 0,
        suggestion: '没有找到符合条件的任务',
        availableTasks: allTasks || [],
        hint: allTasks && allTasks.length > 0 
          ? `您当前有 ${allTasks.length} 个任务可以删除` 
          : '您目前没有任何任务'
      }, 
      message: '没有找到符合条件的任务' 
    }
  }

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

// =============================================
// 任务更新
// =============================================

export async function executeTaskUpdate(args: any, userId: string): Promise<ToolResult> {
  // 扁平化参数：task_id, keyword, title, scheduled_time, location_name, status
  const { task_id, keyword, title, scheduled_time, location_name, status } = args

  // 构建更新对象
  const updates: any = {}
  if (title !== undefined) updates.title = title
  if (scheduled_time !== undefined) updates.scheduled_time = scheduled_time
  if (location_name !== undefined) updates.location_name = location_name
  if (status !== undefined) updates.status = status

  if (Object.keys(updates).length === 0) {
    return { success: false, error: '没有提供要更新的字段' }
  }

  let targetTask: any = null

  if (task_id) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', task_id).eq('user_id', userId).single()
    if (error || !data) return { success: false, error: '未找到该任务' }
    targetTask = data
  } else if (keyword) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).or(`title.ilike.%${keyword}%,location_name.ilike.%${keyword}%`).limit(1).single()
    if (error || !data) {
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('id, title, type, scheduled_time, status')
        .eq('user_id', userId)
        .eq('is_expired', false)
        .order('scheduled_time', { ascending: true })
        .limit(10)
      
      return { 
        success: false, 
        error: `未找到包含「${keyword}」的任务`,
        data: {
          suggestion: '您可以先查看当前的任务列表',
          availableTasks: allTasks || [],
        }
      }
    }
    targetTask = data
  }

  if (targetTask.is_expired) {
    return { success: false, error: '该任务已过期，无法修改' }
  }

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
// 任务查询
// =============================================

export async function executeTaskQuery(args: any, userId: string): Promise<ToolResult> {
  // 扁平化参数：date, type, keyword, status, include_expired, limit
  const { date, type, keyword, status, include_expired, limit = 20 } = args

  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (date) {
    const range = parseDateParam(date)
    query = query.gte('scheduled_time', range.start).lte('scheduled_time', range.end)
  }
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)
  if (keyword) query = query.or(`title.ilike.%${keyword}%,location_name.ilike.%${keyword}%`)
  if (!include_expired) query = query.eq('is_expired', false)

  query = query.order('scheduled_time', { ascending: true }).limit(limit)

  const { data: tasks, error } = await query
  if (error) return { success: false, error: error.message }

  return { success: true, data: { tasks: tasks || [], count: tasks?.length || 0 }, message: `找到 ${tasks?.length || 0} 个任务` }
}

// =============================================
// 任务完成
// =============================================

export async function executeTaskComplete(args: any, userId: string): Promise<ToolResult> {
  // 扁平化参数：task_id, keyword
  const { task_id, keyword } = args

  let targetTask: any = null

  if (task_id) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', task_id).eq('user_id', userId).single()
    if (error || !data) return { success: false, error: '未找到该任务' }
    targetTask = data
  } else if (keyword) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).or(`title.ilike.%${keyword}%`).limit(1).single()
    if (error || !data) return { success: false, error: '未找到匹配的任务' }
    targetTask = data
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
// 批量操作（供确认后调用）
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

export async function executeBatchDeleteTasks(
  userId: string,
  taskIds: string[]
): Promise<ToolResult> {
  if (!taskIds || taskIds.length === 0) {
    return { success: false, error: '请提供要删除的任务ID' }
  }

  const { data: tasks, error: findError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('id', taskIds)

  if (findError) return { success: false, error: findError.message }
  if (!tasks?.length) return { success: false, error: '未找到任务' }

  for (const task of tasks) {
    await supabase.from('task_events').insert({
      task_id: task.id,
      user_id: userId,
      event_type: 'cancelled',
      reasoning: `用户删除任务: ${task.title}`,
    })
  }

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
