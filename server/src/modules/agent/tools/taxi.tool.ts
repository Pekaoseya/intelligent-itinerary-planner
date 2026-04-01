/**
 * 打车工具执行器
 */

import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { ToolResult } from './definitions'
import { DEFAULT_LOCATION } from './constants'
import { getCoordinates, getLastDestination, setLastDestination, getRouteByType } from './map-utils'
import type { UserLocation, Coordinate, RouteInfo } from './types'

const supabase = getSupabaseClient()

// =============================================
// 打车
// =============================================

export async function executeTaxiCall(
  args: any,
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  // 参数别名映射（兼容 AI 返回的不同参数名）
  const normalizedArgs = {
    ...args,
    origin: args.origin || args.start || args.from || args.start_location || args.pickup,
    destination: args.destination || args.end || args.to || args.end_location || args.dropoff,
    scheduled_time: args.scheduled_time || args.time || args.datetime || args.pickup_time,
  }

  const { origin, destination, scheduled_time } = normalizedArgs

  // 确定起点名称
  let originName = origin
  let originCoords: Coordinate | null = null

  if (originName) {
    // 已有起点名称
  } else if (getLastDestination()) {
    originName = getLastDestination()!.name
    originCoords = { latitude: getLastDestination()!.latitude, longitude: getLastDestination()!.longitude }
  } else if (userLocation) {
    originName = userLocation.name || '当前位置'
    originCoords = { latitude: userLocation.latitude, longitude: userLocation.longitude }
  } else {
    originName = DEFAULT_LOCATION.name
    originCoords = { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude }
  }

  const destinationName = destination || '目的地'
  const scheduledTime = scheduled_time ? new Date(scheduled_time) : new Date()
  const now = new Date()
  const isExpired = scheduledTime < now

  // 获取起点坐标
  if (!originCoords) {
    originCoords = await getCoordinates(originName)
  }
  const latitude = originCoords?.latitude ?? null
  const longitude = originCoords?.longitude ?? null

  // 获取终点坐标
  const destCoords = destinationName ? await getCoordinates(destinationName) : null
  const destLatitude = destCoords?.latitude ?? null
  const destLongitude = destCoords?.longitude ?? null

  // 获取路线信息
  let routeInfo: RouteInfo | null = null
  if (originName && destinationName) {
    routeInfo = await getRouteByType(originName, destinationName, 'taxi')
  }

  // 创建打车任务
  const taskData = {
    user_id: userId,
    title: `打车：${originName} → ${destinationName}`,
    type: 'taxi',
    scheduled_time: scheduledTime.toISOString(),
    location_name: originName,
    destination_name: destinationName,
    latitude,
    longitude,
    dest_latitude: destLatitude,
    dest_longitude: destLongitude,
    metadata: {
      distance: routeInfo?.distance,
      duration: routeInfo?.duration,
      polyline: routeInfo?.polyline,
    },
    status: isExpired ? 'expired' : 'pending',
    is_expired: isExpired,
  }

  const { data: task, error } = await supabase.from('tasks').insert(taskData).select().single()
  if (error) return { success: false, error: error.message }

  if (isExpired) {
    return { success: true, data: task, message: `已创建打车任务，但时间已过期，无法叫车` }
  }

  // 模拟叫车
  const mockDriver = {
    driver_name: '张师傅',
    driver_phone: '138****8888',
    car_number: '京A·' + Math.random().toString(36).substr(2, 4).toUpperCase(),
    car_model: '大众帕萨特 黑色',
    arrive_minutes: Math.floor(Math.random() * 5) + 2,
    order_id: 'taxi_' + Date.now(),
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({ status: 'in_progress', metadata: mockDriver })
    .eq('id', task.id)
    .select()
    .single()

  if (updateError) return { success: false, error: updateError.message }

  // 更新多段行程状态
  if (destinationName && destLatitude && destLongitude) {
    setLastDestination({ name: destinationName, latitude: destLatitude, longitude: destLongitude })
  }

  return {
    success: true,
    data: updatedTask,
    message: `已为您叫车，${mockDriver.arrive_minutes}分钟后到达。司机：${mockDriver.driver_name}，车牌：${mockDriver.car_number}`,
  }
}

// =============================================
// 打车状态
// =============================================

export async function executeTaxiStatus(args: any, userId: string): Promise<ToolResult> {
  const { task_id } = args

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', task_id)
    .eq('user_id', userId)
    .eq('type', 'taxi')
    .single()

  if (error || !task) {
    return { success: false, error: '未找到该打车订单' }
  }

  return {
    success: true,
    data: task,
    message: task.status === 'in_progress'
      ? `司机正在赶来，预计${task.metadata?.arrive_minutes || 3}分钟到达`
      : `订单状态：${task.status}`,
  }
}
