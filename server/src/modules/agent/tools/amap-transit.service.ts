/**
 * 高德地图长途交通规划服务
 * 直接调用高德API获取真实的交通推荐，避免硬编码
 * 
 * 核心API：/v3/direction/transit/integrated
 * 返回：高铁车次、飞机航班、地铁换乘等完整行程
 */

import { Injectable, Logger } from '@nestjs/common'
import { getAmapKey } from './map-utils'

// =============================================
// 类型定义
// =============================================

/** 高德地铁/公交段 */
export interface AmapBusSegment {
  buslines: Array<{
    departure_stop: { name: string; location: string }
    arrival_stop: { name: string; location: string }
    name: string // 如 "地铁3号线(星桥--石马)"
    id: string
    type: string // "地铁线路"
    distance: string
    duration: string
    polyline: string
    start_time: string
    end_time: string
  }>
}

/** 高德高铁/火车段 */
export interface AmapRailwaySegment {
  id: string
  name: string // 如 "G1640(厦门北-上海南)"
  trip: string // 车次号，如 "G1640"
  type: string // 如 "G字头的高铁火车"
  distance: string
  time: string // 时长（秒）
  departure_stop: {
    id: string
    name: string // 出发站名
    location: string
    time: string // 出发时间，如 "2245" 表示 22:45
  }
  arrival_stop: {
    id: string
    name: string // 到达站名
    location: string
    time: string // 到达时间
  }
  via_stops: Array<{ name: string }>
  alters: Array<{ id: string; name: string }> // 替代班次
}

/** 高德步行段 */
export interface AmapWalkingSegment {
  origin: string
  destination: string
  distance: string
  duration: string
  steps: Array<{
    instruction: string
    distance: string
    polyline: string
  }>
}

/** 高德出租车段 */
export interface AmapTaxiSegment {
  // 出租车信息
}

/** 高德行程段 */
export interface AmapSegment {
  walking?: AmapWalkingSegment
  bus?: AmapBusSegment
  railway?: AmapRailwaySegment
  taxi?: AmapTaxiSegment
}

/** 高德完整行程方案 */
export interface AmapTransit {
  cost: string // 票价
  duration: string // 总时长（秒）
  distance: string // 总距离（米）
  missed: string // 是否有错过末班车
  segments: AmapSegment[]
}

/** 高德API响应 */
export interface AmapTransitResponse {
  status: string
  info: string
  count: string
  route: {
    origin: string
    destination: string
    distance: string
    transits: AmapTransit[]
  }
}

/** 解析后的行程方案 */
export interface ParsedTransitPlan {
  id: string
  name: string
  totalDistance: number
  totalDuration: number
  totalCost: number
  segments: Array<{
    type: 'walking' | 'subway' | 'railway' | 'flight' | 'taxi'
    name: string
    origin: { name: string; location?: { lat: number; lng: number } }
    destination: { name: string; location?: { lat: number; lng: number } }
    distance: number
    duration: number
    cost?: number
    details?: {
      // 高铁详情
      trainNo?: string
      trainType?: string
      departureTime?: string
      arrivalTime?: string
      viaStops?: string[]
      alternatives?: Array<{ id: string; name: string }>
      // 地铁详情
      lineName?: string
      start_time?: string
      end_time?: string
    }
  }>
  highlights: string[]
}

// =============================================
// 服务实现
// =============================================

@Injectable()
export class AmapTransitService {
  private readonly logger = new Logger(AmapTransitService.name)
  private readonly baseUrl = 'https://restapi.amap.com'

  /**
   * 查询长途交通规划（跨城市）
   * @param origin 起点坐标 "lng,lat"
   * @param destination 终点坐标 "lng,lat"
   * @param originCity 起点城市
   * @param destCity 终点城市
   * @returns 行程方案列表
   */
  async queryLongDistanceTransit(
    origin: string,
    destination: string,
    originCity: string,
    destCity: string
  ): Promise<ParsedTransitPlan[]> {
    const key = getAmapKey()
    if (!key) {
      this.logger.warn('高德地图 Key 未配置')
      return []
    }

    try {
      const params = new URLSearchParams({
        key,
        origin,
        destination,
        city: originCity,
        cityd: destCity,
        extensions: 'all',
        output: 'json',
      })

      const url = `${this.baseUrl}/v3/direction/transit/integrated?${params}`
      this.logger.log(`[高德API] 查询长途交通: ${originCity} → ${destCity}`)

      const response = await fetch(url)
      const data: AmapTransitResponse = await response.json()

      if (data.status !== '1') {
        this.logger.error(`[高德API] 查询失败: ${data.info}`)
        return []
      }

      this.logger.log(`[高德API] 返回 ${data.route.transits.length} 个方案`)

      // 解析高德返回的方案
      return this.parseTransitPlans(data.route.transits, data.route.distance)
    } catch (error) {
      this.logger.error('[高德API] 查询异常:', error)
      return []
    }
  }

  /**
   * 解析高德返回的行程方案
   */
  private parseTransitPlans(transits: AmapTransit[], totalDistance: string): ParsedTransitPlan[] {
    return transits.slice(0, 3).map((transit, index) => {
      const segments = this.parseSegments(transit.segments)
      const planId = `plan_${index + 1}`
      
      // 生成方案名称
      const railwaySegment = segments.find(s => s.type === 'railway')
      const subwayCount = segments.filter(s => s.type === 'subway').length
      const walkingCount = segments.filter(s => s.type === 'walking').length
      
      let planName = '综合出行方案'
      if (railwaySegment) {
        planName = `${railwaySegment.details?.trainType || '高铁'}出行`
      } else if (subwayCount > 0) {
        planName = '地铁出行'
      }

      // 计算亮点
      const highlights: string[] = []
      if (railwaySegment) {
        highlights.push(`${railwaySegment.details?.trainNo || '高铁'}直达`)
        if (railwaySegment.details?.alternatives && railwaySegment.details.alternatives.length > 0) {
          highlights.push(`${railwaySegment.details.alternatives.length + 1}个班次可选`)
        }
      }
      if (subwayCount > 0 && walkingCount <= 2) {
        highlights.push('换乘少')
      }
      const totalMin = Math.round(parseInt(transit.duration) / 60)
      if (totalMin < 60) {
        highlights.push(`${totalMin}分钟到达`)
      }

      return {
        id: planId,
        name: planName,
        totalDistance: parseInt(totalDistance) || parseInt(transit.distance),
        totalDuration: parseInt(transit.duration),
        totalCost: parseFloat(transit.cost) || 0,
        segments,
        highlights,
      }
    })
  }

  /**
   * 解析行程段
   */
  private parseSegments(amapSegments: AmapSegment[]): ParsedTransitPlan['segments'] {
    const segments: ParsedTransitPlan['segments'] = []

    for (const seg of amapSegments) {
      // 步行段
      if (seg.walking && parseInt(seg.walking.distance) > 50) {
        const distance = parseInt(seg.walking.distance)
        const duration = parseInt(seg.walking.duration)
        const [orgLng, orgLat] = seg.walking.origin.split(',').map(Number)
        const [destLng, destLat] = seg.walking.destination.split(',').map(Number)

        segments.push({
          type: 'walking',
          name: `步行${Math.round(distance)}米`,
          origin: { name: '当前位置', location: { lat: orgLat, lng: orgLng } },
          destination: { name: '目的地', location: { lat: destLat, lng: destLng } },
          distance,
          duration,
        })
      }

      // 地铁/公交段
      if (seg.bus?.buslines && seg.bus.buslines.length > 0) {
        const busline = seg.bus.buslines[0]
        const distance = parseInt(busline.distance)
        const duration = parseInt(busline.duration)
        const [orgLng, orgLat] = busline.departure_stop.location.split(',').map(Number)
        const [destLng, destLat] = busline.arrival_stop.location.split(',').map(Number)

        segments.push({
          type: 'subway',
          name: busline.name,
          origin: { name: busline.departure_stop.name, location: { lat: orgLat, lng: orgLng } },
          destination: { name: busline.arrival_stop.name, location: { lat: destLat, lng: destLng } },
          distance,
          duration,
          details: {
            lineName: busline.name,
            start_time: busline.start_time,
            end_time: busline.end_time,
          },
        })
      }

      // 高铁/火车段
      if (seg.railway) {
        const railway = seg.railway
        const distance = parseInt(railway.distance)
        const duration = parseInt(railway.time)
        const [orgLng, orgLat] = railway.departure_stop.location.split(' ').map(Number)
        const [destLng, destLat] = railway.arrival_stop.location.split(' ').map(Number)

        // 解析出发/到达时间
        const departTime = this.formatRailwayTime(railway.departure_stop.time)
        const arriveTime = this.formatRailwayTime(railway.arrival_stop.time)

        segments.push({
          type: 'railway',
          name: `${railway.trip} ${railway.departure_stop.name}→${railway.arrival_stop.name}`,
          origin: { name: railway.departure_stop.name, location: { lat: orgLat, lng: orgLng } },
          destination: { name: railway.arrival_stop.name, location: { lat: destLat, lng: destLng } },
          distance,
          duration,
          cost: this.estimateRailwayCost(distance),
          details: {
            trainNo: railway.trip,
            trainType: railway.type,
            departureTime: departTime,
            arrivalTime: arriveTime,
            viaStops: railway.via_stops?.map(s => s.name),
            alternatives: railway.alters?.slice(0, 5),
          },
        })
      }
    }

    return segments
  }

  /**
   * 格式化高铁时间
   * "2245" -> "22:45"
   */
  private formatRailwayTime(timeStr: string): string {
    if (!timeStr || timeStr.length < 3) return ''
    const hours = timeStr.slice(0, -2).padStart(2, '0')
    const minutes = timeStr.slice(-2)
    return `${hours}:${minutes}`
  }

  /**
   * 估算高铁票价
   * 根据距离估算，约 0.45 元/公里（二等座）
   */
  private estimateRailwayCost(distance: number): number {
    return Math.round(distance * 0.00045)
  }
}

// =============================================
// 独立函数版本（不依赖注入）
// =============================================

let amapTransitService: AmapTransitService | null = null

export function getAmapTransitService(): AmapTransitService {
  if (!amapTransitService) {
    amapTransitService = new AmapTransitService()
  }
  return amapTransitService
}

/**
 * 查询长途交通规划
 */
export async function queryLongDistanceTransit(
  origin: string,
  destination: string,
  originCity: string,
  destCity: string
): Promise<ParsedTransitPlan[]> {
  return getAmapTransitService().queryLongDistanceTransit(origin, destination, originCity, destCity)
}
