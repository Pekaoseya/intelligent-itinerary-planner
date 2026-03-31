/**
 * 任务工具执行器
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
// 任务创建
// =============================================

export async function executeTaskCreate(
  args: any,
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  const { title, type, scheduled_time, end_time, location_name, location_address, destination_name, destination_address, metadata } = args

  const scheduledDate = new Date(scheduled_time)
  const now = new Date()
  const isExpired = scheduledDate < now

  // 时间冲突检测
  const estimatedDuration = estimateTaskDuration(type as TaskType, undefined, metadata)
  const conflictCheck = await checkTimeConflict(userId, scheduledDate, estimatedDuration)

  if (conflictCheck.hasConflict) {
    const conflictDetails = conflictCheck.conflicts.map(c => {
      const timeStr = formatTime(c.scheduled_time)
      return `"${c.title}"（${timeStr}，重叠${c.overlap_minutes}分钟）`
    }).join('、')

    if (conflictCheck.severity === 'error') {
      return {
        success: false,
        error: `时间冲突：该时间段与以下任务重叠：${conflictDetails}`,
        data: {
          conflicts: conflictCheck.conflicts,
          suggestion: '请选择其他时间，或先取消/调整冲突的任务',
        },
      }
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

  const taskData = {
    user_id: userId,
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
  }

  const { data, error } = await supabase.from('tasks').insert(taskData).select().single()

  if (error) {
    return { success: false, error: error.message }
  }

  // 更新多段行程状态
  if (actualDestName && finalDestCoords?.latitude && finalDestCoords?.longitude) {
    setLastDestination({
      name: actualDestName,
      latitude: finalDestCoords.latitude,
      longitude: finalDestCoords.longitude,
    })
  }

  // 记录事件
  await supabase.from('task_events').insert({
    task_id: data.id,
    user_id: userId,
    event_type: 'created',
    reasoning: `创建${type}类型任务: ${title}`,
  })

  let message = isExpired
    ? `已创建任务「${title}」，但该时间已过期，状态标记为过期`
    : `已创建任务「${title}」`

  if (validationWarnings.length > 0) {
    message += `。提示：${validationWarnings.join('；')}`
  }

  return { success: true, data, message }
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
// 任务删除
// =============================================

export async function executeTaskDelete(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter, confirm } = args

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

    await supabase.from('task_events').insert({
      task_id: task.id,
      user_id: userId,
      event_type: 'cancelled',
      reasoning: `用户删除任务: ${task.title}`,
    })

    const { error } = await supabase.from('tasks').delete().eq('id', task_id)
    if (error) return { success: false, error: error.message }

    return { success: true, data: { deleted: task }, message: `已删除任务「${task.title}」` }
  }

  if (filter) {
    let query = supabase.from('tasks').select('*').eq('user_id', userId)

    if (filter.all) {
      // 删除所有
    } else {
      if (filter.type) query = query.eq('type', filter.type)
      if (filter.date_range?.start && filter.date_range?.end) {
        query = query.gte('scheduled_time', `${filter.date_range.start}T00:00:00Z`).lte('scheduled_time', `${filter.date_range.end}T23:59:59Z`)
      } else if (filter.date) {
        query = query.gte('scheduled_time', `${filter.date}T00:00:00Z`).lte('scheduled_time', `${filter.date}T23:59:59Z`)
      }
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.keyword) query = query.or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`)
      if (filter.expired === true) query = query.eq('is_expired', true)
    }

    const { data: tasks, error: findError } = await query
    if (findError) return { success: false, error: findError.message }
    if (!tasks?.length) return { success: true, data: { count: 0 }, message: '没有找到符合条件的任务' }

    if (tasks.length === 1) {
      const task = tasks[0]
      await supabase.from('task_events').insert({
        task_id: task.id,
        user_id: userId,
        event_type: 'cancelled',
        reasoning: `用户删除任务: ${task.title}`,
      })
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', task.id)
      if (deleteError) return { success: false, error: deleteError.message }
      return { success: true, data: { deleted: task }, message: `已删除任务「${task.title}」` }
    }

    if (!confirm) {
      return { success: true, data: { needConfirm: true, tasks, count: tasks.length }, message: `找到 ${tasks.length} 个任务，请确认是否全部删除` }
    }

    for (const task of tasks) {
      await supabase.from('task_events').insert({
        task_id: task.id,
        user_id: userId,
        event_type: 'cancelled',
        reasoning: `批量删除: ${task.title}`,
      })
    }

    const { error: deleteError } = await supabase.from('tasks').delete().in('id', tasks.map(t => t.id))
    if (deleteError) return { success: false, error: deleteError.message }

    return { success: true, data: { count: tasks.length }, message: `已删除 ${tasks.length} 个任务` }
  }

  return { success: false, error: '请提供 task_id 或 filter 参数' }
}

// =============================================
// 任务更新
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

  const updateData: any = { updated_at: new Date().toISOString() }
  if (updates.title) updateData.title = updates.title
  if (updates.scheduled_time) {
    updateData.scheduled_time = updates.scheduled_time
    updateData.is_expired = new Date(updates.scheduled_time) < new Date()
    if (updateData.is_expired) updateData.status = 'expired'
  }
  if (updates.location_name) updateData.location_name = updates.location_name
  if (updates.status) updateData.status = updates.status
  if (updates.metadata) updateData.metadata = { ...targetTask.metadata, ...updates.metadata }

  const { data: updatedTask, error } = await supabase.from('tasks').update(updateData).eq('id', targetTask.id).select().single()
  if (error) return { success: false, error: error.message }

  await supabase.from('task_events').insert({
    task_id: targetTask.id,
    user_id: userId,
    event_type: 'updated',
    changes: updates,
    reasoning: `更新任务: ${JSON.stringify(updates)}`,
  })

  return { success: true, data: updatedTask, message: `已更新任务「${updatedTask.title}」` }
}

// =============================================
// 任务查询
// =============================================

export async function executeTaskQuery(args: any, userId: string): Promise<ToolResult> {
  const { filter, limit = 20 } = args

  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (filter) {
    if (filter.date) {
      query = query.gte('scheduled_time', `${filter.date}T00:00:00Z`).lte('scheduled_time', `${filter.date}T23:59:59Z`)
    }
    if (filter.date_range) {
      if (filter.date_range.start) query = query.gte('scheduled_time', filter.date_range.start)
      if (filter.date_range.end) query = query.lte('scheduled_time', filter.date_range.end)
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
// 任务完成
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
