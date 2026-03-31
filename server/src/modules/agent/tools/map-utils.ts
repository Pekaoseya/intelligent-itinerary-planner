/**
 * 地图服务工具函数
 * 包含腾讯地图、高德地图 API 调用封装
 */

import { createHash } from 'crypto'
import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { TENCENT_MAP_BASE_URL, AMAP_BASE_URL, DEFAULT_LOCATION } from './constants'
import type { UserLocation, POIResult, RouteInfo, Coordinate } from './types'

const supabase = getSupabaseClient()

// =============================================
// 多段行程状态管理
// =============================================

let lastDestination: { name: string; latitude: number; longitude: number } | null = null

export function resetMultiSegmentState(): void {
  lastDestination = null
  console.log('[MultiSegment] 状态已重置')
}

export function getLastDestination() {
  return lastDestination
}

export function setLastDestination(dest: { name: string; latitude: number; longitude: number } | null) {
  lastDestination = dest
  if (dest) {
    console.log(`[MultiSegment] 更新上段终点: ${dest.name}`)
  }
}

// =============================================
// API Key 获取
// =============================================

export function getAmapKey(): string {
  return process.env.AMAP_KEY || ''
}

export function getTencentMapKey(): string {
  return process.env.TENCENT_MAP_KEY || ''
}

export function getTencentMapSecret(): string {
  return process.env.TENCENT_MAP_SECRET || ''
}

// =============================================
// 腾讯地图签名生成
// =============================================

function generateTencentMapSignature(path: string, params: Record<string, string>): string {
  const secret = getTencentMapSecret()
  const sortedKeys = Object.keys(params).sort()
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&')
  const requestPath = path + '?' + queryString
  const stringToSign = requestPath + '&sk=' + secret
  return createHash('md5').update(stringToSign).digest('hex')
}

export function buildTencentMapUrl(path: string, params: Record<string, string>): string {
  const key = getTencentMapKey()
  const allParams = { ...params, key }
  const sigPath = '/ws' + path
  const sig = generateTencentMapSignature(sigPath, allParams)
  const queryString = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return `${TENCENT_MAP_BASE_URL}${path}?${queryString}&sig=${sig}`
}

// =============================================
// 高德地图驾车路线规划
// =============================================

export async function getAmapDrivingRoute(
  origin: Coordinate,
  dest: Coordinate
): Promise<RouteInfo | null> {
  const key = getAmapKey()
  if (!key) {
    console.log('[getAmapDrivingRoute] 高德地图 Key 未配置')
    return null
  }

  try {
    const params = new URLSearchParams({
      key,
      origin: `${origin.longitude},${origin.latitude}`,
      destination: `${dest.longitude},${dest.latitude}`,
      extensions: 'all',
      output: 'json',
    })

    const url = `${AMAP_BASE_URL}/v3/direction/driving?${params}`
    console.log(`[getAmapDrivingRoute] 请求 URL: ${url}`)

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.route?.paths?.length > 0) {
      const path = data.route.paths[0]
      const polyline: Array<{ latitude: number; longitude: number }> = []

      for (const step of path.steps || []) {
        if (step.polyline) {
          const points = step.polyline.split(';')
          for (const point of points) {
            const [lng, lat] = point.split(',').map(Number)
            polyline.push({ latitude: lat, longitude: lng })
          }
        }
      }

      return {
        distance: parseInt(path.distance) || 0,
        duration: parseInt(path.duration) || 0,
        polyline,
        toll: parseFloat(path.tolls) || 0,
      }
    }
    console.warn(`[getAmapDrivingRoute] API 返回失败: status=${data.status}, info=${data.info}`)
    return null
  } catch (error) {
    console.error('[getAmapDrivingRoute] API 调用失败:', error)
    return null
  }
}

// =============================================
// 高德地图公交/地铁路线规划
// =============================================

export async function getAmapTransitRoute(
  origin: Coordinate,
  dest: Coordinate,
  originCity: string,
  destCity: string
): Promise<RouteInfo | null> {
  const key = getAmapKey()
  if (!key) return null

  try {
    const params = new URLSearchParams({
      key,
      origin: `${origin.longitude},${origin.latitude}`,
      destination: `${dest.longitude},${dest.latitude}`,
      city: originCity,
      cityd: destCity,
      extensions: 'all',
      output: 'json',
    })

    const url = `${AMAP_BASE_URL}/v3/direction/transit/integrated?${params}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.route?.transits?.length > 0) {
      const transit = data.route.transits[0]
      const polyline: Array<{ latitude: number; longitude: number }> = []
      let totalDistance = 0
      let totalDuration = 0

      for (const seg of transit.segments || []) {
        totalDistance += parseInt(seg.distance) || 0
        totalDuration += parseInt(seg.time) || 0

        if (seg.walking?.polyline) {
          const points = seg.walking.polyline.split(';')
          for (const point of points) {
            const [lng, lat] = point.split(',').map(Number)
            polyline.push({ latitude: lat, longitude: lng })
          }
        }
        if (seg.bus?.buslines?.[0]?.polyline) {
          const points = seg.bus.buslines[0].polyline.split(';')
          for (const point of points) {
            const [lng, lat] = point.split(',').map(Number)
            polyline.push({ latitude: lat, longitude: lng })
          }
        }
      }

      return { distance: totalDistance, duration: totalDuration, polyline }
    }
    return null
  } catch (error) {
    console.error('[getAmapTransitRoute] API 调用失败:', error)
    return null
  }
}

// =============================================
// 高德地图 POI 搜索
// =============================================

export async function searchTransportPOI(
  keyword: string,
  city: string,
  type: 'airport' | 'train_station'
): Promise<POIResult[]> {
  const key = getAmapKey()
  if (!key) return []

  try {
    const types = type === 'airport' ? '150200' : '150700'
    const params = new URLSearchParams({
      key,
      keywords: keyword,
      types,
      city,
      citylimit: 'true',
      extensions: 'all',
      output: 'json',
    })

    const url = `${AMAP_BASE_URL}/v3/place/text?${params}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.pois?.length > 0) {
      return data.pois.slice(0, 5).map((poi: any) => {
        const [lng, lat] = poi.location.split(',').map(Number)
        return {
          name: poi.name,
          address: poi.address,
          latitude: lat,
          longitude: lng,
          type: poi.type,
          distance: poi.distance ? parseInt(poi.distance) : undefined,
        }
      })
    }
    return []
  } catch (error) {
    console.error('[searchTransportPOI] API 调用失败:', error)
    return []
  }
}

export async function findAirportByCityViaAPI(cityName: string): Promise<POIResult | null> {
  const results = await searchTransportPOI('机场', cityName, 'airport')
  if (results.length > 0) {
    const match = results.find(r => r.name.includes(cityName))
    return match || results[0]
  }
  return null
}

export async function findStationByCityViaAPI(cityName: string): Promise<POIResult | null> {
  const results = await searchTransportPOI('火车站', cityName, 'train_station')
  if (results.length > 0) {
    const mainStation = results.find(r =>
      r.name === `${cityName}站` ||
      r.name === `${cityName}东站` ||
      r.name === `${cityName}南站` ||
      r.name === `${cityName}西站` ||
      r.name === `${cityName}北站`
    )
    return mainStation || results[0]
  }
  return null
}

// =============================================
// 地理编码
// =============================================

export async function geocodeAddress(address: string): Promise<Coordinate | null> {
  const amapKey = getAmapKey()
  if (!amapKey) return null

  try {
    const url = `${AMAP_BASE_URL}/v3/geocode/geo?key=${amapKey}&address=${encodeURIComponent(address)}&output=json`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.geocodes?.length > 0) {
      const location = data.geocodes[0].location.split(',')
      return {
        latitude: parseFloat(location[1]),
        longitude: parseFloat(location[0]),
      }
    }
    return null
  } catch (error) {
    console.error(`[geocodeAddress] 调用失败: ${address}`, error)
    return null
  }
}

// =============================================
// 坐标缓存
// =============================================

async function saveToCache(name: string, latitude: number, longitude: number): Promise<void> {
  try {
    await supabase
      .from('location_cache')
      .upsert({
        name,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        source: 'amap',
      }, { onConflict: 'name' })
  } catch (error) {
    console.warn(`[saveToCache] 缓存保存失败: ${name}`, error)
  }
}

export async function getCoordinates(
  locationName: string,
  fallbackLocation?: Coordinate
): Promise<Coordinate> {
  // 1. 查询缓存
  try {
    const { data, error } = await supabase
      .from('location_cache')
      .select('latitude, longitude')
      .ilike('name', `%${locationName}%`)
      .limit(1)
      .single()

    if (!error && data) {
      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      }
    }
  } catch (error) {
    console.warn(`[getCoordinates] 缓存查询失败: ${locationName}`, error)
  }

  // 2. 调用地图 API
  const coords = await geocodeAddress(locationName)
  if (coords) {
    await saveToCache(locationName, coords.latitude, coords.longitude)
    return coords
  }

  // 3. 使用备用位置或默认值
  if (fallbackLocation) {
    return fallbackLocation
  }
  return { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude }
}

// =============================================
// 路线规划
// =============================================

export async function getDrivingRoute(
  origin: Coordinate,
  dest: Coordinate
): Promise<RouteInfo | null> {
  // 优先使用高德地图
  const route = await getAmapDrivingRoute(origin, dest)
  if (route) return route

  // 备用：腾讯地图
  const tencentKey = getTencentMapKey()
  if (tencentKey) {
    try {
      const params: Record<string, string> = {
        from: `${origin.latitude},${origin.longitude}`,
        to: `${dest.latitude},${dest.longitude}`,
        output: 'json',
      }
      const url = buildTencentMapUrl('/direction/v1/driving/', params)
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 0 && data.result?.routes?.[0]) {
        const routeData = data.result.routes[0]
        const polyline: Array<{ latitude: number; longitude: number }> = []

        if (routeData.polyline) {
          for (const point of routeData.polyline) {
            polyline.push({ latitude: point[0], longitude: point[1] })
          }
        }

        return {
          distance: routeData.distance,
          duration: routeData.duration,
          polyline,
        }
      }
    } catch (error) {
      console.error('[getDrivingRoute] 腾讯地图调用失败:', error)
    }
  }

  return null
}

// =============================================
// 距离计算
// =============================================

export function calculateStraightDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function generateStraightPolyline(
  origin: Coordinate,
  dest: Coordinate,
  steps: number = 10
): Array<{ latitude: number; longitude: number }> {
  const polyline: Array<{ latitude: number; longitude: number }> = []
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    polyline.push({
      latitude: origin.latitude + (dest.latitude - origin.latitude) * ratio,
      longitude: origin.longitude + (dest.longitude - origin.longitude) * ratio,
    })
  }
  return polyline
}

// =============================================
// 工具函数
// =============================================

export function extractCityName(locationName: string, cities?: string[]): string {
  const cityList = cities || [
    '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都',
    '武汉', '西安', '重庆', '天津', '长沙', '郑州', '青岛', '厦门',
  ]

  for (const city of cityList) {
    if (locationName.includes(city)) {
      return city
    }
  }

  return locationName.replace(/站|机场|东|南|西|北/g, '').trim()
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// =============================================
// 按交通类型获取路线
// =============================================

export async function getRouteByType(
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
