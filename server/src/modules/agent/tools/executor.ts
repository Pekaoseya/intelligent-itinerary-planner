/**
 * 工具执行器
 * 实际执行 AI 调用的工具
 */

import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { ToolResult } from './definitions'
import {
  findAirportByCity,
  findStationByCity,
  isAirport,
  isTrainStation,
  TRANSPORT_RULES,
  AIRPORTS,
  TRAIN_STATIONS,
} from '../../map/transport-nodes'

const supabase = getSupabaseClient()

// =============================================
// 类型定义
// =============================================

interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'

// =============================================
// 默认坐标（杭州西湖）- 用于测试和极端情况
// 后期可通过删除此常量来移除默认值逻辑
// =============================================
const DEFAULT_LOCATION = {
  latitude: 30.242489,
  longitude: 120.148532,
  name: '杭州西湖',
}

// =============================================
// 多段行程状态管理
// 在同一次对话中创建多个任务时，记录上一个任务的终点
// =============================================
let lastDestination: { name: string; latitude: number; longitude: number } | null = null

/**
 * 重置多段行程状态（每次新对话开始时调用）
 */
export function resetMultiSegmentState(): void {
  lastDestination = null
  console.log('[MultiSegment] 状态已重置')
}

// 腾讯地图 API 配置（动态读取环境变量）- 仅用于前端地图显示
const TENCENT_MAP_BASE_URL = 'https://apis.map.qq.com/ws'

// 高德地图 API 配置 - 用于路线规划
const AMAP_BASE_URL = 'https://restapi.amap.com'

// =============================================
// 高德地图 API 配置
// =============================================

/**
 * 获取高德地图 Key（动态读取）
 */
function getAmapKey(): string {
  return process.env.AMAP_KEY || ''
}

/**
 * 腾讯地图签名生成（保留用于前端逆地理编码等辅助功能）
 */
import { createHash } from 'crypto'

/**
 * 获取腾讯地图 Key（动态读取）
 */
function getTencentMapKey(): string {
  return process.env.TENCENT_MAP_KEY || ''
}

/**
 * 获取腾讯地图 Secret（动态读取）
 */
function getTencentMapSecret(): string {
  return process.env.TENCENT_MAP_SECRET || ''
}

/**
 * 生成腾讯地图 API 签名
 * 签名规则：MD5(请求路径 + ? + 参数排序后拼接 + &sk=xxx)
 */
function generateTencentMapSignature(path: string, params: Record<string, string>): string {
  const secret = getTencentMapSecret()
  
  // 1. 将参数按 key 升序排列
  const sortedKeys = Object.keys(params).sort()
  
  // 2. 拼接参数（参数值保持原始值，不编码）
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&')
  
  // 3. 拼接路径和参数
  const requestPath = path + '?' + queryString
  
  // 4. 追加 sk
  const stringToSign = requestPath + '&sk=' + secret
  
  // 调试输出
  console.log(`[签名] 路径: ${path}`)
  console.log(`[签名] 参数: ${queryString}`)
  console.log(`[签名] 待签名字符串: ${stringToSign}`)
  
  // 5. MD5 加密
  const signature = createHash('md5').update(stringToSign).digest('hex')
  
  console.log(`[签名] 结果: ${signature}`)
  
  return signature
}

/**
 * 构建带签名的腾讯地图 API URL
 */
function buildTencentMapUrl(path: string, params: Record<string, string>): string {
  const key = getTencentMapKey()
  
  // 添加 key 到参数
  const allParams = { ...params, key }
  
  // 生成签名（路径需要包含 /ws 前缀）
  const sigPath = '/ws' + path
  const sig = generateTencentMapSignature(sigPath, allParams)
  
  // 构建完整 URL
  const queryString = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return `${TENCENT_MAP_BASE_URL}${path}?${queryString}&sig=${sig}`
}

// =============================================
// 高德地图驾车路线规划
// =============================================

/**
 * 调用高德地图驾车路线 API
 * 返回真实道路距离、时长和路线坐标点
 */
async function getAmapDrivingRoute(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number }
): Promise<{ distance: number; duration: number; polyline: Array<{ latitude: number; longitude: number }>; toll?: number } | null> {
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

      // 解析 polyline（从 steps 中提取）
      for (const step of path.steps || []) {
        if (step.polyline) {
          const points = step.polyline.split(';')
          for (const point of points) {
            const [lng, lat] = point.split(',').map(Number)
            polyline.push({ latitude: lat, longitude: lng })
          }
        }
      }

      const distance = parseInt(path.distance) || 0
      const duration = parseInt(path.duration) || 0
      const toll = parseFloat(path.tolls) || 0

      console.log(`[getAmapDrivingRoute] API 返回: 距离 ${distance}m, 时长 ${duration}s, 过路费 ${toll}元`)
      return { distance, duration, polyline, toll }
    } else {
      console.warn(`[getAmapDrivingRoute] API 返回失败: status=${data.status}, info=${data.info}`)
      return null
    }
  } catch (error) {
    console.error('[getAmapDrivingRoute] API 调用失败:', error)
    return null
  }
}

// =============================================
// 高德地图公交/地铁路线规划
// =============================================

/**
 * 调用高德地图公交路线 API
 * 用于高铁/城际交通规划
 */
async function getAmapTransitRoute(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
  originCity: string,
  destCity: string
): Promise<{ distance: number; duration: number; polyline: Array<{ latitude: number; longitude: number }> } | null> {
  const key = getAmapKey()
  if (!key) {
    console.log('[getAmapTransitRoute] 高德地图 Key 未配置')
    return null
  }

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
    console.log(`[getAmapTransitRoute] 请求 URL: ${url}`)

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.route?.transits?.length > 0) {
      const transit = data.route.transits[0]
      const polyline: Array<{ latitude: number; longitude: number }> = []
      let totalDistance = 0
      let totalDuration = 0

      // 解析路线段
      for (const seg of transit.segments || []) {
        totalDistance += parseInt(seg.distance) || 0
        totalDuration += parseInt(seg.time) || 0

        // 解析步行段 polyline
        if (seg.walking?.polyline) {
          const points = seg.walking.polyline.split(';')
          for (const point of points) {
            const [lng, lat] = point.split(',').map(Number)
            polyline.push({ latitude: lat, longitude: lng })
          }
        }
        // 解析公交/地铁段 polyline
        if (seg.bus?.buslines?.[0]?.polyline) {
          const points = seg.bus.buslines[0].polyline.split(';')
          for (const point of points) {
            const [lng, lat] = point.split(',').map(Number)
            polyline.push({ latitude: lat, longitude: lng })
          }
        }
      }

      console.log(`[getAmapTransitRoute] API 返回: 距离 ${totalDistance}m, 时长 ${totalDuration}s`)
      return { distance: totalDistance, duration: totalDuration, polyline }
    } else {
      console.warn(`[getAmapTransitRoute] API 返回失败: status=${data.status}, info=${data.info}`)
      return null
    }
  } catch (error) {
    console.error('[getAmapTransitRoute] API 调用失败:', error)
    return null
  }
}

// =============================================
// 高德地图 POI 搜索
// =============================================

interface POIResult {
  name: string
  address: string
  latitude: number
  longitude: number
  type: string
  distance?: number
}

/**
 * 搜索附近的交通节点（机场/火车站）
 * 用于智能识别和自动修正起终点
 */
async function searchTransportPOI(
  keyword: string,
  city: string,
  type: 'airport' | 'train_station'
): Promise<POIResult[]> {
  const key = getAmapKey()
  if (!key) {
    console.log('[searchTransportPOI] 高德地图 Key 未配置')
    return []
  }

  try {
    // POI 类型编码：150200=飞机场，150700=火车站
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
    console.log(`[searchTransportPOI] 请求 URL: ${url}`)

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.pois?.length > 0) {
      const results: POIResult[] = data.pois.slice(0, 5).map((poi: any) => {
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

      console.log(`[searchTransportPOI] 找到 ${results.length} 个结果: ${results.map(r => r.name).join(', ')}`)
      return results
    } else {
      console.warn(`[searchTransportPOI] API 返回失败: status=${data.status}, info=${data.info}`)
      return []
    }
  } catch (error) {
    console.error('[searchTransportPOI] API 调用失败:', error)
    return []
  }
}

/**
 * 根据城市名搜索机场
 */
async function findAirportByCityViaAPI(cityName: string): Promise<POIResult | null> {
  const results = await searchTransportPOI('机场', cityName, 'airport')
  if (results.length > 0) {
    // 优先选择名称包含城市名的机场
    const match = results.find(r => r.name.includes(cityName))
    return match || results[0]
  }
  return null
}

/**
 * 根据城市名搜索火车站
 */
async function findStationByCityViaAPI(cityName: string): Promise<POIResult | null> {
  const results = await searchTransportPOI('火车站', cityName, 'train_station')
  if (results.length > 0) {
    // 优先选择"XX站"或"XX东站"等主要车站
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
// 交通方式校验逻辑
// =============================================

interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  suggestions: string[]
  autoFix?: {
    origin?: { name: string; latitude: number; longitude: number }
    destination?: { name: string; latitude: number; longitude: number }
    suggestedType?: TaskType
  }
}

/**
 * 校验交通方式合理性
 */
async function validateTransport(
  type: TaskType,
  originName: string | undefined,
  destName: string | undefined,
  distance: number
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    suggestions: [],
  }

  if (type === 'taxi') {
    validateTaxi(originName, destName, distance, result)
  } else if (type === 'train') {
    await validateTrain(originName, destName, distance, result)
  } else if (type === 'flight') {
    await validateFlight(originName, destName, distance, result)
  }

  return result
}

/**
 * 打车校验
 */
function validateTaxi(
  originName: string | undefined,
  destName: string | undefined,
  distance: number,
  result: ValidationResult
): void {
  const rules = TRANSPORT_RULES.taxi
  const distanceKm = Math.round(distance / 1000)

  if (distance > rules.maxDistance) {
    result.valid = false
    result.errors.push(`打车距离 ${distanceKm}km，超过合理范围`)
    result.suggestions.push(rules.message)
    
    if (distance > TRANSPORT_RULES.flight.minDistance) {
      result.suggestions.push('建议选择飞机出行')
      result.autoFix = { suggestedType: 'flight' }
    } else if (distance > TRANSPORT_RULES.train.minDistance) {
      result.suggestions.push('建议选择高铁出行')
      result.autoFix = { suggestedType: 'train' }
    }
  } else if (distance > rules.warningDistance) {
    result.warnings.push(`打车距离 ${distanceKm}km，费用可能较高`)
  }
}

/**
 * 高铁校验（异步：优先使用 API 查询火车站）
 */
async function validateTrain(
  originName: string | undefined,
  destName: string | undefined,
  distance: number,
  result: ValidationResult
): Promise<void> {
  const distanceKm = Math.round(distance / 1000)

  // 检查起点是否是火车站
  if (originName) {
    // 1. 优先使用 API 查询
    const originCity = extractCityName(originName)
    const apiStation = await findStationByCityViaAPI(originCity)
    
    if (apiStation) {
      const isStation = originName.includes('站')
      if (!isStation) {
        result.warnings.push(`起点"${originName}"将自动修正为"${apiStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: apiStation.name,
            latitude: apiStation.latitude,
            longitude: apiStation.longitude,
          },
        }
      }
      console.log(`[validateTrain] API 查询起点: ${originCity} -> ${apiStation.name}`)
    } else {
      // 2. API 失败，回退到本地数据库
      const localStation = findStationByCity(originName)
      const isStation = isTrainStation(originName)
      
      if (!isStation && localStation) {
        result.warnings.push(`起点"${originName}"将自动修正为"${localStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: localStation.name,
            latitude: localStation.latitude,
            longitude: localStation.longitude,
          },
        }
      } else if (!isStation && !localStation) {
        result.warnings.push(`起点"${originName}"未找到对应火车站`)
      }
      console.log(`[validateTrain] 本地查询起点: ${originName} -> ${localStation?.name || '未找到'}`)
    }
  }

  // 检查终点是否是火车站
  if (destName) {
    // 1. 优先使用 API 查询
    const destCity = extractCityName(destName)
    const apiStation = await findStationByCityViaAPI(destCity)
    
    if (apiStation) {
      const isStation = destName.includes('站')
      if (!isStation) {
        result.warnings.push(`终点"${destName}"将自动修正为"${apiStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: apiStation.name,
            latitude: apiStation.latitude,
            longitude: apiStation.longitude,
          },
        }
      }
      console.log(`[validateTrain] API 查询终点: ${destCity} -> ${apiStation.name}`)
    } else {
      // 2. API 失败，回退到本地数据库
      const localStation = findStationByCity(destName)
      const isStation = isTrainStation(destName)
      
      if (!isStation && localStation) {
        result.warnings.push(`终点"${destName}"将自动修正为"${localStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: localStation.name,
            latitude: localStation.latitude,
            longitude: localStation.longitude,
          },
        }
      }
      console.log(`[validateTrain] 本地查询终点: ${destName} -> ${localStation?.name || '未找到'}`)
    }
  }

  // 距离过短
  if (distance < TRANSPORT_RULES.train.minDistance) {
    result.warnings.push(`距离仅 ${distanceKm}km，高铁可能不是最佳选择`)
  }
}

/**
 * 飞机校验（异步：优先使用 API 查询机场）
 */
async function validateFlight(
  originName: string | undefined,
  destName: string | undefined,
  distance: number,
  result: ValidationResult
): Promise<void> {
  const distanceKm = Math.round(distance / 1000)

  // 检查起点是否是机场
  if (originName) {
    // 1. 优先使用 API 查询
    const originCity = extractCityName(originName)
    const apiAirport = await findAirportByCityViaAPI(originCity)
    
    if (apiAirport) {
      const isAir = originName.includes('机场')
      if (!isAir) {
        result.warnings.push(`起点"${originName}"将自动修正为"${apiAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: apiAirport.name,
            latitude: apiAirport.latitude,
            longitude: apiAirport.longitude,
          },
        }
      }
      console.log(`[validateFlight] API 查询起点: ${originCity} -> ${apiAirport.name}`)
    } else {
      // 2. API 失败，回退到本地数据库
      const localAirport = findAirportByCity(originName)
      const isAir = isAirport(originName)
      
      if (!isAir && localAirport) {
        result.warnings.push(`起点"${originName}"将自动修正为"${localAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: localAirport.name,
            latitude: localAirport.latitude,
            longitude: localAirport.longitude,
          },
        }
      } else if (!isAir && !localAirport) {
        result.warnings.push(`起点"${originName}"未找到对应机场`)
      }
      console.log(`[validateFlight] 本地查询起点: ${originName} -> ${localAirport?.name || '未找到'}`)
    }
  }

  // 检查终点是否是机场
  if (destName) {
    // 1. 优先使用 API 查询
    const destCity = extractCityName(destName)
    const apiAirport = await findAirportByCityViaAPI(destCity)
    
    if (apiAirport) {
      const isAir = destName.includes('机场')
      if (!isAir) {
        result.warnings.push(`终点"${destName}"将自动修正为"${apiAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: apiAirport.name,
            latitude: apiAirport.latitude,
            longitude: apiAirport.longitude,
          },
        }
      }
      console.log(`[validateFlight] API 查询终点: ${destCity} -> ${apiAirport.name}`)
    } else {
      // 2. API 失败，回退到本地数据库
      const localAirport = findAirportByCity(destName)
      const isAir = isAirport(destName)
      
      if (!isAir && localAirport) {
        result.warnings.push(`终点"${destName}"将自动修正为"${localAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: localAirport.name,
            latitude: localAirport.latitude,
            longitude: localAirport.longitude,
          },
        }
      }
      console.log(`[validateFlight] 本地查询终点: ${destName} -> ${localAirport?.name || '未找到'}`)
    }
  }

  // 距离过短（高铁更合适）
  if (distance < TRANSPORT_RULES.flight.minDistance && distance > TRANSPORT_RULES.train.minDistance) {
    result.warnings.push(`距离 ${distanceKm}km，高铁可能更便捷`)
    result.suggestions.push('建议考虑高铁出行')
    result.autoFix = { ...result.autoFix, suggestedType: 'train' }
  }
}

/**
 * 获取正确的交通节点坐标
 */
function getCorrectNode(
  type: TaskType,
  cityName: string
): { name: string; latitude: number; longitude: number } | null {
  const city = cityName.replace(/[市站场机场]/g, '').trim()

  if (type === 'flight') {
    const airport = findAirportByCity(city)
    if (airport) {
      return {
        name: airport.name,
        latitude: airport.latitude,
        longitude: airport.longitude,
      }
    }
  }

  if (type === 'train') {
    const station = findStationByCity(city)
    if (station) {
      return {
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
      }
    }
  }

  return null
}

// =============================================
// 坐标获取（优先用户位置/上段终点，其次缓存，再次 API，最后默认值）
// =============================================

/**
 * 调用腾讯地图地理编码 API 获取坐标
 */
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const amapKey = process.env.AMAP_KEY
  if (!amapKey) {
    console.log('[geocodeAddress] 高德地图 API Key 未配置')
    return null
  }

  try {
    // 使用高德地图地理编码 API
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${amapKey}&address=${encodeURIComponent(address)}&output=json`
    console.log(`[geocodeAddress] 请求高德地图 URL: ${url}`)
    
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const location = data.geocodes[0].location.split(',')
      const lng = parseFloat(location[0])
      const lat = parseFloat(location[1])
      console.log(`[geocodeAddress] 高德地图返回: ${address} -> (${lat}, ${lng})`)
      return { latitude: lat, longitude: lng }
    } else {
      console.warn(`[geocodeAddress] 高德地图返回失败: ${address}, status=${data.status}, info=${data.info}`)
      return null
    }
  } catch (error) {
    console.error(`[geocodeAddress] 高德地图调用失败: ${address}`, error)
    return null
  }
}

/**
 * 保存坐标到缓存
 */
async function saveToCache(name: string, latitude: number, longitude: number): Promise<void> {
  try {
    await supabase
      .from('location_cache')
      .upsert({
        name,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        source: 'tencent_map',
      }, { onConflict: 'name' })
    console.log(`[saveToCache] 已缓存: ${name} -> (${latitude}, ${longitude})`)
  } catch (error) {
    console.warn(`[saveToCache] 缓存保存失败: ${name}`, error)
  }
}

/**
 * 获取坐标
 * 1. 优先从 location_cache 查询
 * 2. 查不到时调用地图 API 获取
 * 3. API 成功时存入缓存
 * 4. API 失败时使用 fallbackLocation 或默认值
 * 
 * @param locationName 地点名称
 * @param fallbackLocation 备用位置（API失败时使用）
 */
async function getCoordinates(
  locationName: string,
  fallbackLocation?: { latitude: number; longitude: number }
): Promise<{ latitude: number; longitude: number }> {
  // 1. 查询缓存
  try {
    const { data, error } = await supabase
      .from('location_cache')
      .select('latitude, longitude')
      .ilike('name', `%${locationName}%`)
      .limit(1)
      .single()

    if (!error && data) {
      console.log(`[getCoordinates] 缓存命中: ${locationName} -> (${data.latitude}, ${data.longitude})`)
      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      }
    }
  } catch (error) {
    console.warn(`[getCoordinates] 缓存查询失败: ${locationName}`, error)
  }

  // 2. 调用地图 API 获取坐标
  console.log(`[getCoordinates] 缓存未命中，尝试 API: ${locationName}`)
  const coords = await geocodeAddress(locationName)

  if (coords) {
    // 3. 存入缓存
    await saveToCache(locationName, coords.latitude, coords.longitude)
    return coords
  }

  // 4. 使用备用位置或默认值
  if (fallbackLocation) {
    console.log(`[getCoordinates] API 失败，使用备用位置: ${locationName} -> (${fallbackLocation.latitude}, ${fallbackLocation.longitude})`)
    return fallbackLocation
  }

  console.log(`[getCoordinates] API 失败，使用默认值: ${locationName} -> (${DEFAULT_LOCATION.latitude}, ${DEFAULT_LOCATION.longitude})`)
  return {
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
  }
}

// =============================================
// 路线规划（区分交通类型）
// =============================================

/**
 * 获取打车路线（调用高德地图 API 获取真实道路距离）
 */
async function getDrivingRoute(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number }
): Promise<{ distance: number; duration: number; polyline: Array<{ latitude: number; longitude: number }> } | null> {
  // 优先使用高德地图驾车路线 API
  const route = await getAmapDrivingRoute(origin, dest)
  if (route) {
    return {
      distance: route.distance,
      duration: route.duration,
      polyline: route.polyline,
    }
  }

  // 高德 API 失败，尝试腾讯地图作为备用
  const tencentKey = getTencentMapKey()
  if (tencentKey) {
    try {
      const params: Record<string, string> = {
        from: `${origin.latitude},${origin.longitude}`,
        to: `${dest.latitude},${dest.longitude}`,
        output: 'json',
      }

      const url = buildTencentMapUrl('/direction/v1/driving/', params)
      console.log(`[getDrivingRoute] 腾讯地图备用 URL: ${url}`)

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

        console.log(`[getDrivingRoute] 腾讯地图返回: 距离 ${routeData.distance}m, 时长 ${routeData.duration}s`)
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

  // 所有 API 都不可用，返回 null
  console.log('[getDrivingRoute] 所有地图 API 不可用，返回 null')
  return null
}

/**
 * 计算直线距离（用于飞机、高铁等）
 */
function calculateStraightDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 生成模拟 polyline（直线插值）
 */
function generateStraightPolyline(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
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

/**
 * 获取路线规划（根据交通类型选择不同策略）
 * - taxi: 调用高德地图驾车路线 API
 * - train: 调用高德地图公交路线 API（跨城）
 * - flight: 计算直线距离
 */
async function getRouteByType(
  originName: string,
  destName: string,
  transportType: 'taxi' | 'train' | 'flight'
): Promise<{ distance: number; duration: number; polyline: Array<{ latitude: number; longitude: number }> }> {
  // 获取坐标
  const origin = await getCoordinates(originName)
  const dest = await getCoordinates(destName)

  // 打车：调用高德地图驾车 API
  if (transportType === 'taxi') {
    const route = await getDrivingRoute(origin, dest)
    if (route) {
      return route
    }
    console.log(`[getRouteByType] 打车 API 失败，降级到直线距离`)
  }

  // 高铁：调用高德地图公交 API（跨城路线）
  if (transportType === 'train') {
    // 提取城市名（用于跨城公交查询）
    const originCity = extractCityName(originName)
    const destCity = extractCityName(destName)
    
    console.log(`[getRouteByType] 高铁路线: ${originCity} -> ${destCity}`)
    
    const route = await getAmapTransitRoute(origin, dest, originCity, destCity)
    
    // 只有当 API 返回有效距离时才使用（跨城公交 API 可能返回 0）
    if (route && route.distance > 0) {
      return route
    }
    
    console.log(`[getRouteByType] 高铁公交 API 未返回有效数据，降级到直线距离`)
  }

  // 飞机/降级：计算直线距离
  const distance = calculateStraightDistance(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
  const polyline = generateStraightPolyline(origin, dest)

  // 根据类型估算时间
  let duration: number
  if (transportType === 'flight') {
    duration = Math.round(distance / 250) // 飞机约 250m/s = 900km/h
  } else if (transportType === 'train') {
    duration = Math.round(distance / 80) // 高铁约 80m/s = 288km/h
  } else {
    duration = Math.round(distance / 30) // 打车降级：约 30m/s = 108km/h
  }

  console.log(`[getRouteByType] ${transportType}: 直线距离 ${Math.round(distance)}m, 预估时长 ${duration}s`)
  return { distance, duration, polyline }
}

/**
 * 从地点名称中提取城市名
 * 例如："杭州东站" -> "杭州"，"上海虹桥站" -> "上海"
 */
function extractCityName(locationName: string): string {
  // 常见城市名列表
  const cities = [
    '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', 
    '武汉', '西安', '重庆', '天津', '长沙', '郑州', '青岛', '厦门',
    '福州', '济南', '合肥', '南昌', '昆明', '贵阳', '南宁', '海口',
    '三亚', '大连', '沈阳', '哈尔滨', '长春', '石家庄', '太原', '呼和浩特',
    '兰州', '银川', '西宁', '乌鲁木齐', '拉萨', '宁波', '温州', '无锡',
  ]
  
  for (const city of cities) {
    if (locationName.includes(city)) {
      return city
    }
  }
  
  // 如果没有匹配到，返回原始名称
  return locationName.replace(/站|机场|东|南|西|北/g, '').trim()
}

// 保留旧函数名兼容
const getCachedCoordinates = getCoordinates
const getRouteWithPolyline = getRouteByType

// =============================================
// 工具执行函数
// =============================================

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string = 'default-user',
  userLocation?: UserLocation
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
    default:
      return { success: false, error: `未知工具: ${toolName}` }
  }
}

// =============================================
// 时间冲突检测
// =============================================

/**
 * 根据任务类型和距离估算时长（分钟）
 */
function estimateTaskDuration(type: TaskType, distance?: number, metadata?: any): number {
  // 如果已有时长信息，直接使用
  if (metadata?.duration) {
    return Math.ceil(metadata.duration / 60) // 秒转分钟
  }

  switch (type) {
    case 'taxi':
      // 打车：根据距离估算，市区平均30km/h
      if (distance) {
        const hours = distance / 1000 / 30
        return Math.max(15, Math.ceil(hours * 60)) // 至少15分钟
      }
      return 30 // 默认30分钟

    case 'train':
      // 高铁：根据距离估算，平均200km/h + 提前30分钟候车
      if (distance) {
        const hours = distance / 1000 / 200
        return Math.ceil(hours * 60) + 30
      }
      return 120 // 默认2小时

    case 'flight':
      // 飞机：根据距离估算，平均600km/h + 提前2小时到机场 + 落地后30分钟
      if (distance) {
        const hours = distance / 1000 / 600
        return Math.ceil(hours * 60) + 150
      }
      return 180 // 默认3小时

    case 'meeting':
      return 60 // 会议默认1小时

    case 'dining':
      return 90 // 用餐默认1.5小时

    case 'hotel':
      return 480 // 酒店默认8小时（过夜）

    default:
      return 60 // 其他默认1小时
  }
}

/**
 * 检测时间冲突
 * @param userId 用户ID
 * @param scheduledTime 新任务的开始时间
 * @param duration 新任务的预估时长（分钟）
 * @param excludeTaskId 排除的任务ID（用于更新场景）
 * @returns 冲突检测结果
 */
async function checkTimeConflict(
  userId: string,
  scheduledTime: Date,
  duration: number,
  excludeTaskId?: string
): Promise<{
  hasConflict: boolean
  conflicts: Array<{
    id: string
    title: string
    type: string
    scheduled_time: string
    duration_minutes: number | null
    overlap_minutes: number
  }>
  severity: 'none' | 'warning' | 'error'
}> {
  // 计算新任务的时间区间
  const newStart = scheduledTime.getTime()
  const newEnd = newStart + duration * 60 * 1000

  // 获取当天日期范围
  const dateStr = scheduledTime.toISOString().split('T')[0]
  const startOfDay = new Date(`${dateStr}T00:00:00`).toISOString()
  const endOfDay = new Date(`${dateStr}T23:59:59`).toISOString()

  // 查询当天所有待处理的任务
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('scheduled_time', startOfDay)
    .lte('scheduled_time', endOfDay)

  if (error || !tasks) {
    console.warn('[checkTimeConflict] 查询失败:', error)
    return { hasConflict: false, conflicts: [], severity: 'none' }
  }

  console.log(`[checkTimeConflict] 查询返回 ${tasks.length} 个任务`)

  const conflicts: Array<{
    id: string
    title: string
    type: string
    scheduled_time: string
    duration_minutes: number | null
    overlap_minutes: number
  }> = []

  // 检查每个任务是否与新任务时间重叠
  for (const task of tasks) {
    // 排除当前任务（更新场景）
    if (excludeTaskId && task.id === excludeTaskId) continue

    const taskStart = new Date(task.scheduled_time).getTime()
    const taskDuration = task.duration_minutes || estimateTaskDuration(task.type as TaskType, task.metadata?.distance, task.metadata)
    const taskEnd = taskStart + taskDuration * 60 * 1000

    // 时间区间重叠判断：newStart < taskEnd && newEnd > taskStart
    if (newStart < taskEnd && newEnd > taskStart) {
      // 计算重叠时长（分钟）
      const overlapStart = Math.max(newStart, taskStart)
      const overlapEnd = Math.min(newEnd, taskEnd)
      const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000)

      conflicts.push({
        id: task.id,
        title: task.title,
        type: task.type,
        scheduled_time: task.scheduled_time,
        duration_minutes: task.duration_minutes,
        overlap_minutes: overlapMinutes,
      })
    }
  }

  // 判断冲突严重程度
  let severity: 'none' | 'warning' | 'error' = 'none'
  if (conflicts.length > 0) {
    // 如果重叠时间超过15分钟，视为严重冲突
    const hasSeriousConflict = conflicts.some(c => c.overlap_minutes > 15)
    severity = hasSeriousConflict ? 'error' : 'warning'
  }

  console.log(`[checkTimeConflict] 检测到 ${conflicts.length} 个冲突，严重程度: ${severity}`)

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    severity,
  }
}

/**
 * 格式化时间显示
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// =============================================
// 任务创建
// =============================================

async function executeTaskCreate(
  args: any, 
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  const { title, type, scheduled_time, end_time, location_name, location_address, destination_name, destination_address, metadata } = args

  // 检查时间是否过期
  const scheduledDate = new Date(scheduled_time)
  const now = new Date()
  const isExpired = scheduledDate < now

  // =============================================
  // 时间冲突检测
  // =============================================
  // 先估算任务时长（用于冲突检测）
  const estimatedDuration = estimateTaskDuration(type as TaskType, undefined, metadata)
  
  // 检测时间冲突
  const conflictCheck = await checkTimeConflict(userId, scheduledDate, estimatedDuration)
  
  if (conflictCheck.hasConflict) {
    // 构建冲突信息
    const conflictDetails = conflictCheck.conflicts.map(c => {
      const timeStr = formatTime(c.scheduled_time)
      return `"${c.title}"（${timeStr}，重叠${c.overlap_minutes}分钟）`
    }).join('、')

    if (conflictCheck.severity === 'error') {
      // 严重冲突，拒绝创建
      return {
        success: false,
        error: `时间冲突：该时间段与以下任务重叠：${conflictDetails}`,
        data: {
          conflicts: conflictCheck.conflicts,
          suggestion: '请选择其他时间，或先取消/调整冲突的任务',
        },
      }
    } else {
      // 轻微冲突，记录警告但允许创建
      console.log(`[TaskCreate] 时间冲突警告：${conflictDetails}`)
    }
  }

  // =============================================
  // 智能起点选择逻辑（多段行程联动）
  // =============================================
  let actualLocationName = location_name
  let originCoords: { latitude: number; longitude: number } | null = null

  // 获取起点坐标的辅助函数
  const getOriginCoords = async (name: string, fallback?: { latitude: number; longitude: number }) => {
    const coords = await getCoordinates(name, fallback)
    // 检查是否返回了默认值（与默认位置相同但名称不同）
    if (coords.latitude === DEFAULT_LOCATION.latitude && 
        coords.longitude === DEFAULT_LOCATION.longitude &&
        name !== DEFAULT_LOCATION.name) {
      console.log(`[TaskCreate] 起点"${name}"解析失败，返回了默认值`)
      return { coords, isDefault: true }
    }
    return { coords, isDefault: false }
  }

  // 1. 如果指定了起点，先尝试获取坐标
  if (location_name) {
    const result = await getOriginCoords(location_name)
    originCoords = result.coords
    
    // 如果获取失败（返回了默认值），尝试回退到上段终点或用户位置
    if (result.isDefault) {
      if (lastDestination) {
        console.log(`[TaskCreate] 起点解析失败，回退到上段终点: ${lastDestination.name}`)
        actualLocationName = lastDestination.name
        originCoords = { latitude: lastDestination.latitude, longitude: lastDestination.longitude }
      } else if (userLocation) {
        console.log(`[TaskCreate] 起点解析失败，回退到用户位置: ${userLocation.name || '当前位置'}`)
        actualLocationName = userLocation.name || '当前位置'
        originCoords = { latitude: userLocation.latitude, longitude: userLocation.longitude }
      }
    }
  }
  // 2. 如果没有指定起点，但有上一段任务的终点，使用上一段终点
  else if (lastDestination) {
    actualLocationName = lastDestination.name
    originCoords = { latitude: lastDestination.latitude, longitude: lastDestination.longitude }
    console.log(`[TaskCreate] 未指定起点，使用上段终点: ${lastDestination.name}`)
  }
  // 3. 如果没有上段终点，使用用户当前位置
  else if (userLocation) {
    actualLocationName = userLocation.name || '当前位置'
    originCoords = { latitude: userLocation.latitude, longitude: userLocation.longitude }
    console.log(`[TaskCreate] 未指定起点，使用用户位置: ${actualLocationName}`)
  }
  // 4. 否则使用默认位置
  else {
    actualLocationName = DEFAULT_LOCATION.name
    originCoords = { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude }
    console.log(`[TaskCreate] 使用默认位置: ${DEFAULT_LOCATION.name}`)
  }

  // 获取起点坐标（如果还没有坐标，则查询缓存/API）
  if (!originCoords) {
    originCoords = await getCoordinates(actualLocationName)
  }
  const latitude = originCoords?.latitude ?? null
  const longitude = originCoords?.longitude ?? null

  // 获取终点坐标
  let destCoords = destination_name ? await getCoordinates(destination_name) : null
  let destLatitude = destCoords?.latitude ?? null
  let destLongitude = destCoords?.longitude ?? null

  // 获取路线信息（打车/高铁/飞机等出行任务）
  let routeInfo: { distance: number; duration: number; polyline: Array<{ latitude: number; longitude: number }> } | null = null
  if (['taxi', 'train', 'flight'].includes(type) && actualLocationName && destination_name) {
    routeInfo = await getRouteByType(actualLocationName, destination_name, type as 'taxi' | 'train' | 'flight')
    console.log(`[TaskCreate] ${type} 路线: 距离 ${Math.round(routeInfo.distance)}m, 时长 ${routeInfo.duration}s, polyline ${routeInfo.polyline.length} 点`)
  }

  // =============================================
  // 交通方式校验与自动修正
  // =============================================
  let validationWarnings: string[] = []
  let actualOriginName = actualLocationName
  let actualDestName = destination_name
  let finalOriginCoords = originCoords
  let finalDestCoords = destCoords

  if (['taxi', 'train', 'flight'].includes(type) && routeInfo) {
    console.log(`[TaskCreate] 开始校验: type=${type}, distance=${routeInfo.distance}m`)
    const validation = await validateTransport(type as TaskType, actualLocationName, destination_name, routeInfo.distance)
    console.log(`[TaskCreate] 校验结果: valid=${validation.valid}, errors=${JSON.stringify(validation.errors)}, warnings=${JSON.stringify(validation.warnings)}`)
    
    // 收集警告信息
    validationWarnings = validation.warnings
    
    // 如果校验失败，返回错误和建议
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

    // 自动修正起终点
    if (validation.autoFix) {
      // 修正起点
      if (validation.autoFix.origin) {
        actualOriginName = validation.autoFix.origin.name
        finalOriginCoords = {
          latitude: validation.autoFix.origin.latitude,
          longitude: validation.autoFix.origin.longitude,
        }
        console.log(`[TaskCreate] 自动修正起点: ${actualLocationName} -> ${actualOriginName}`)
      }
      
      // 修正终点
      if (validation.autoFix.destination) {
        actualDestName = validation.autoFix.destination.name
        finalDestCoords = {
          latitude: validation.autoFix.destination.latitude,
          longitude: validation.autoFix.destination.longitude,
        }
        console.log(`[TaskCreate] 自动修正终点: ${destination_name} -> ${actualDestName}`)
        
        // 重新计算路线
        if (actualOriginName && actualDestName) {
          routeInfo = await getRouteByType(actualOriginName, actualDestName, type as 'taxi' | 'train' | 'flight')
        }
      }
    }
  }

  // 更新最终坐标
  const finalLatitude = finalOriginCoords?.latitude ?? latitude
  const finalLongitude = finalOriginCoords?.longitude ?? longitude
  const finalDestLatitude = finalDestCoords?.latitude ?? destLatitude
  const finalDestLongitude = finalDestCoords?.longitude ?? destLongitude

  // 合并 metadata
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
    latitude: finalLatitude,
    longitude: finalLongitude,
    destination_name: actualDestName || null,
    destination_address: destination_address || null,
    dest_latitude: finalDestLatitude,
    dest_longitude: finalDestLongitude,
    metadata: finalMetadata,
    status: isExpired ? 'expired' : 'pending',
    is_expired: isExpired,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // =============================================
  // 更新多段行程状态：记录当前任务的终点
  // =============================================
  if (actualDestName && finalDestLatitude && finalDestLongitude) {
    lastDestination = {
      name: actualDestName,
      latitude: finalDestLatitude,
      longitude: finalDestLongitude,
    }
    console.log(`[TaskCreate] 更新上段终点: ${actualDestName} (${finalDestLatitude}, ${finalDestLongitude})`)
  }

  // 记录事件
  await supabase.from('task_events').insert({
    task_id: data.id,
    user_id: userId,
    event_type: 'created',
    reasoning: `创建${type}类型任务: ${title}`,
  })

  // 构建返回消息
  let message = isExpired 
    ? `已创建任务「${title}」，但该时间已过期，状态标记为过期`
    : `已创建任务「${title}」`
  
  // 添加校验警告
  if (validationWarnings.length > 0) {
    message += `。提示：${validationWarnings.join('；')}`
  }

  return {
    success: true,
    data,
    message,
  }
}

// =============================================
// 任务删除
// =============================================

async function executeTaskDelete(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter, confirm } = args

  // 如果提供了 task_id，直接删除
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

    // 记录事件
    await supabase.from('task_events').insert({
      task_id: task.id,
      user_id: userId,
      event_type: 'cancelled',
      reasoning: `用户删除任务: ${task.title}`,
    })

    const { error } = await supabase.from('tasks').delete().eq('id', task_id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: { deleted: task }, message: `已删除任务「${task.title}」` }
  }

  // 按条件筛选删除
  if (filter) {
    let query = supabase.from('tasks').select('*').eq('user_id', userId)

    if (filter.all) {
      // 删除所有
    } else {
      if (filter.type) query = query.eq('type', filter.type)
      if (filter.date) {
        const startOfDay = `${filter.date}T00:00:00Z`
        const endOfDay = `${filter.date}T23:59:59Z`
        query = query.gte('scheduled_time', startOfDay).lte('scheduled_time', endOfDay)
      }
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.keyword) {
        query = query.or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`)
      }
      if (filter.expired === true) {
        query = query.eq('is_expired', true)
      }
    }

    const { data: tasks, error: findError } = await query

    if (findError) {
      return { success: false, error: findError.message }
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, data: { count: 0 }, message: '没有找到符合条件的任务' }
    }

    // 单个任务直接删除，不需要确认
    if (tasks.length === 1) {
      const task = tasks[0]
      
      // 记录删除事件
      await supabase.from('task_events').insert({
        task_id: task.id,
        user_id: userId,
        event_type: 'cancelled',
        reasoning: `用户删除任务: ${task.title}`,
      })

      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', task.id)

      if (deleteError) {
        return { success: false, error: deleteError.message }
      }

      return { success: true, data: { deleted: task }, message: `已删除任务「${task.title}」` }
    }

    // 多个任务时需要确认
    if (!confirm) {
      return {
        success: true,
        data: { 
          needConfirm: true, 
          tasks: tasks,
          count: tasks.length 
        },
        message: `找到 ${tasks.length} 个任务，请确认是否全部删除`,
      }
    }

    // 确认后执行删除
    const taskIds = tasks.map(t => t.id)
    
    // 记录删除事件
    for (const task of tasks) {
      await supabase.from('task_events').insert({
        task_id: task.id,
        user_id: userId,
        event_type: 'cancelled',
        reasoning: `批量删除: ${task.title}`,
      })
    }

    const { error: deleteError } = await supabase.from('tasks').delete().in('id', taskIds)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    return {
      success: true,
      data: { count: tasks.length },
      message: `已删除 ${tasks.length} 个任务`,
    }
  }

  return { success: false, error: '请提供 task_id 或 filter 参数' }
}

// =============================================
// 任务更新
// =============================================

async function executeTaskUpdate(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter, updates } = args

  let targetTask: any = null

  // 通过 ID 或筛选找到任务
  if (task_id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .eq('user_id', userId)
      .single()
    if (error || !data) {
      return { success: false, error: '未找到该任务' }
    }
    targetTask = data
  } else if (filter?.keyword) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`)
      .limit(1)
      .single()
    if (error || !data) {
      return { success: false, error: '未找到匹配的任务' }
    }
    targetTask = data
  } else {
    return { success: false, error: '请提供 task_id 或 filter.keyword' }
  }

  // 检查任务是否过期
  if (targetTask.is_expired) {
    return { success: false, error: '该任务已过期，无法修改' }
  }

  // 准备更新数据
  const updateData: any = { updated_at: new Date().toISOString() }
  if (updates.title) updateData.title = updates.title
  if (updates.scheduled_time) {
    updateData.scheduled_time = updates.scheduled_time
    // 重新检查是否过期
    const newScheduledDate = new Date(updates.scheduled_time)
    updateData.is_expired = newScheduledDate < new Date()
    if (updateData.is_expired) {
      updateData.status = 'expired'
    }
  }
  if (updates.location_name) updateData.location_name = updates.location_name
  if (updates.status) updateData.status = updates.status
  if (updates.metadata) {
    updateData.metadata = { ...targetTask.metadata, ...updates.metadata }
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', targetTask.id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // 记录事件
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

async function executeTaskQuery(args: any, userId: string): Promise<ToolResult> {
  const { filter, limit = 20 } = args

  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (filter) {
    if (filter.date) {
      const startOfDay = `${filter.date}T00:00:00Z`
      const endOfDay = `${filter.date}T23:59:59Z`
      query = query.gte('scheduled_time', startOfDay).lte('scheduled_time', endOfDay)
    }
    if (filter.date_range) {
      if (filter.date_range.start) query = query.gte('scheduled_time', filter.date_range.start)
      if (filter.date_range.end) query = query.lte('scheduled_time', filter.date_range.end)
    }
    if (filter.type) query = query.eq('type', filter.type)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.keyword) {
      query = query.or(`title.ilike.%${filter.keyword}%,location_name.ilike.%${filter.keyword}%`)
    }
    if (!filter.include_expired) {
      query = query.eq('is_expired', false)
    }
  }

  query = query.order('scheduled_time', { ascending: true }).limit(limit)

  const { data: tasks, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: { tasks: tasks || [], count: tasks?.length || 0 },
    message: `找到 ${tasks?.length || 0} 个任务`,
  }
}

// =============================================
// 任务完成
// =============================================

async function executeTaskComplete(args: any, userId: string): Promise<ToolResult> {
  const { task_id, filter } = args

  let targetTask: any = null

  if (task_id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .eq('user_id', userId)
      .single()
    if (error || !data) return { success: false, error: '未找到该任务' }
    targetTask = data
  } else if (filter?.keyword) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${filter.keyword}%`)
      .limit(1)
      .single()
    if (error || !data) return { success: false, error: '未找到匹配的任务' }
    targetTask = data
  } else {
    return { success: false, error: '请提供 task_id 或 filter' }
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetTask.id)
    .select()
    .single()

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
// 打车
// =============================================

async function executeTaxiCall(
  args: any, 
  userId: string,
  userLocation?: UserLocation
): Promise<ToolResult> {
  const { origin, destination, scheduled_time } = args

  // 确定起点名称
  let originName = origin
  let originCoords: { latitude: number; longitude: number } | null = null

  // 1. 如果指定了起点，使用指定起点
  if (originName) {
    // 已有起点名称
  }
  // 2. 如果没有指定起点，但有上一段任务的终点，使用上一段终点
  else if (lastDestination) {
    originName = lastDestination.name
    originCoords = { latitude: lastDestination.latitude, longitude: lastDestination.longitude }
    console.log(`[TaxiCall] 使用上段终点作为起点: ${lastDestination.name}`)
  }
  // 3. 如果没有上段终点，使用用户当前位置
  else if (userLocation) {
    originName = userLocation.name || '当前位置'
    originCoords = { latitude: userLocation.latitude, longitude: userLocation.longitude }
    console.log(`[TaxiCall] 使用用户位置作为起点: ${originName}`)
  }
  // 4. 否则使用默认位置
  else {
    originName = DEFAULT_LOCATION.name
    originCoords = { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude }
    console.log(`[TaxiCall] 使用默认位置作为起点: ${DEFAULT_LOCATION.name}`)
  }

  // 提供默认值，避免 undefined
  const destinationName = destination || '目的地'

  const scheduledTime = scheduled_time ? new Date(scheduled_time) : new Date()
  const now = new Date()
  const isExpired = scheduledTime < now

  // 获取起点坐标（如果还没有坐标）
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
  let routeInfo: { distance: number; duration: number; polyline: Array<{ latitude: number; longitude: number }> } | null = null
  if (originName && destinationName) {
    routeInfo = await getRouteByType(originName, destinationName, 'taxi')
    console.log(`[TaxiCall] taxi 路线: 距离 ${Math.round(routeInfo.distance)}m, 时长 ${routeInfo.duration}s`)
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

  const { data: task, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  if (isExpired) {
    return {
      success: true,
      data: task,
      message: `已创建打车任务，但时间已过期，无法叫车`,
    }
  }

  // 模拟叫车（实际应该调用真实 API）
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
    .update({
      status: 'in_progress',
      metadata: mockDriver,
    })
    .eq('id', task.id)
    .select()
    .single()

  if (updateError) return { success: false, error: updateError.message }

  // 更新多段行程状态
  if (destinationName && destLatitude && destLongitude) {
    lastDestination = {
      name: destinationName,
      latitude: destLatitude,
      longitude: destLongitude,
    }
    console.log(`[TaxiCall] 更新上段终点: ${destinationName}`)
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

async function executeTaxiStatus(args: any, userId: string): Promise<ToolResult> {
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

// =============================================
// 时间检查
// =============================================

async function executeTimeCheck(args: any, userId: string): Promise<ToolResult> {
  const { scheduled_time, duration_minutes } = args

  const scheduledDate = new Date(scheduled_time)
  const now = new Date()
  const isExpired = scheduledDate < now

  if (isExpired) {
    return {
      success: true,
      data: { is_expired: true },
      message: `该时间（${scheduled_time}）已经过去，无法安排`,
    }
  }

  // 检查是否有冲突
  const endTime = duration_minutes
    ? new Date(scheduledDate.getTime() + duration_minutes * 60000)
    : new Date(scheduledDate.getTime() + 60 * 60000)

  const { data: conflicts } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_expired', false)
    .gte('scheduled_time', scheduledDate.toISOString())
    .lte('scheduled_time', endTime.toISOString())

  return {
    success: true,
    data: {
      is_expired: false,
      has_conflict: conflicts && conflicts.length > 0,
      conflicts: conflicts || [],
    },
    message: conflicts && conflicts.length > 0
      ? `该时间段有 ${conflicts.length} 个任务冲突`
      : '该时间段可用',
  }
}

// =============================================
// 日历检查
// =============================================

async function executeCalendarCheck(args: any, userId: string): Promise<ToolResult> {
  const { date, time_range } = args

  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (date) {
    const startOfDay = `${date}T00:00:00Z`
    const endOfDay = `${date}T23:59:59Z`
    query = query.gte('scheduled_time', startOfDay).lte('scheduled_time', endOfDay)
  } else if (time_range) {
    if (time_range.start) query = query.gte('scheduled_time', time_range.start)
    if (time_range.end) query = query.lte('scheduled_time', time_range.end)
  }

  const { data: tasks, error } = await query.order('scheduled_time', { ascending: true })

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: { tasks: tasks || [] },
    message: date
      ? `${date} 有 ${tasks?.length || 0} 个任务`
      : `找到 ${tasks?.length || 0} 个任务`,
  }
}
