/**
 * 高德地图服务
 * 提供专业的路线规划能力
 */

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// 高德驾车路线响应
interface AMapDrivingRoute {
  distance: number      // 距离（米）
  duration: number      // 时间（秒）
  strategy: string      // 策略
  toll: number          // 过路费（元）
  toll_distance: number // 收费路段距离
  steps: Array<{
    instruction: string
    road: string
    distance: number
    duration: number
    polyline: string    // 经纬度串
  }>
}

// 高德公交路线响应
interface AMapTransitRoute {
  distance: number
  duration: number
  walking_distance: number
  cost: number          // 票价
  lines: Array<{
    type: string        // 地铁/公交
    name: string
    via_stops: string[]
  }>
}

// 高德路线规划结果
export interface AMapRoutePlan {
  distance: number
  duration: number
  cost?: number         // 费用（打车费或票价）
  toll?: number         // 过路费
  polyline: Array<{ latitude: number; longitude: number }>
  steps?: Array<{
    instruction: string
    distance: number
    duration: number
  }>
  strategy?: string     // 路线策略描述
}

// 多路线方案
export interface AMapRouteOptions {
  routes: AMapRoutePlan[]
  recommended: number   // 推荐路线索引
}

@Injectable()
export class AMapService {
  private readonly logger = new Logger(AMapService.name)
  private readonly amapKey: string
  private readonly baseUrl = 'https://restapi.amap.com'

  constructor(private configService: ConfigService) {
    this.amapKey = this.configService.get<string>('AMAP_KEY') || ''
    if (!this.amapKey) {
      this.logger.warn('AMAP_KEY 未配置，高德地图服务将不可用')
    } else {
      this.logger.log('高德地图服务已初始化')
    }
  }

  /**
   * 驾车路线规划（支持多路线）
   * 高德返回多条备选路线，包含费用估算
   */
  async planDrivingRoute(
    origin: { longitude: number; latitude: number },
    destination: { longitude: number; latitude: number }
  ): Promise<AMapRouteOptions | null> {
    if (!this.amapKey) {
      this.logger.warn('高德地图 Key 未配置')
      return null
    }

    try {
      const params = new URLSearchParams({
        key: this.amapKey,
        origin: `${origin.longitude},${origin.latitude}`,
        destination: `${destination.longitude},${destination.latitude}`,
        extensions: 'all',     // 返回详细信息
        strategy: '10',        // 返回多条路线策略
        output: 'json',
      })

      const url = `${this.baseUrl}/v3/direction/driving?${params}`
      this.logger.log(`[高德驾车路线] 请求: ${url}`)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && data.route?.paths?.length > 0) {
        const routes: AMapRoutePlan[] = data.route.paths.map((path: any) => {
          // 解析 polyline
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
            cost: path.taxis?.[0]?.cost ? parseFloat(path.taxis[0].cost) : undefined,
            toll: parseFloat(path.tolls) || 0,
            polyline,
            steps: (path.steps || []).map((step: any) => ({
              instruction: step.instruction,
              distance: parseInt(step.distance) || 0,
              duration: parseInt(step.duration) || 0,
            })),
            strategy: path.strategy,
          }
        })

        // 按距离和时间综合排序，推荐最优路线
        const recommended = this.findBestRoute(routes)

        this.logger.log(`[高德驾车路线] 返回 ${routes.length} 条路线，推荐第 ${recommended + 1} 条`)
        return { routes, recommended }
      }

      this.logger.warn(`[高德驾车路线] 失败: ${data.info}`)
      return null
    } catch (error) {
      this.logger.error('[高德驾车路线] 请求失败:', error)
      return null
    }
  }

  /**
   * 公交/地铁路线规划
   * 支持跨城公交规划
   */
  async planTransitRoute(
    origin: { longitude: number; latitude: number },
    destination: { longitude: number; latitude: number },
    city: string,
    cityd: string // 目的城市
  ): Promise<AMapRoutePlan | null> {
    if (!this.amapKey) {
      return null
    }

    try {
      const params = new URLSearchParams({
        key: this.amapKey,
        origin: `${origin.longitude},${origin.latitude}`,
        destination: `${destination.longitude},${destination.latitude}`,
        city,
        cityd: cityd || city,   // 目的城市
        extensions: 'all',
        output: 'json',
      })

      const url = `${this.baseUrl}/v3/direction/transit/integrated?${params}`
      this.logger.log(`[高德公交路线] 请求: ${url}`)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && data.route?.transits?.length > 0) {
        // 取第一个方案
        const transit = data.route.transits[0]
        
        const polyline: Array<{ latitude: number; longitude: number }> = []
        let totalDistance = 0
        let totalDuration = 0

        for (const seg of transit.segments || []) {
          totalDistance += parseInt(seg.distance) || 0
          totalDuration += parseInt(seg.time) || 0

          // 解析步行和公交段
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

        return {
          distance: totalDistance,
          duration: totalDuration,
          cost: parseFloat(transit.cost) || undefined,
          polyline,
        }
      }

      return null
    } catch (error) {
      this.logger.error('[高德公交路线] 请求失败:', error)
      return null
    }
  }

  /**
   * 地理编码（地址转坐标）
   */
  async geocode(address: string, city?: string): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.amapKey) {
      return null
    }

    try {
      const params = new URLSearchParams({
        key: this.amapKey,
        address,
        output: 'json',
      })
      if (city) params.append('city', city)

      const url = `${this.baseUrl}/v3/geocode/geo?${params}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && data.geocodes?.length > 0) {
        const location = data.geocodes[0].location.split(',')
        return {
          longitude: parseFloat(location[0]),
          latitude: parseFloat(location[1]),
        }
      }

      return null
    } catch (error) {
      this.logger.error('[高德地理编码] 请求失败:', error)
      return null
    }
  }

  /**
   * 逆地理编码（坐标转地址）
   */
  async reverseGeocode(longitude: number, latitude: number): Promise<string | null> {
    if (!this.amapKey) {
      return null
    }

    try {
      const params = new URLSearchParams({
        key: this.amapKey,
        location: `${longitude},${latitude}`,
        output: 'json',
      })

      const url = `${this.baseUrl}/v3/geocode/regeo?${params}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && data.regeocode) {
        return data.regeocode.formatted_address
      }

      return null
    } catch (error) {
      this.logger.error('[高德逆地理编码] 请求失败:', error)
      return null
    }
  }

  /**
   * 行政区域查询（用于判断城市）
   */
  async getAdministrative(longitude: number, latitude: number): Promise<{ province: string; city: string; district: string } | null> {
    if (!this.amapKey) {
      return null
    }

    try {
      const params = new URLSearchParams({
        key: this.amapKey,
        location: `${longitude},${latitude}`,
        extensions: 'base',
        output: 'json',
      })

      const url = `${this.baseUrl}/v3/geocode/regeo?${params}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && data.regeocode?.addressComponent) {
        const comp = data.regeocode.addressComponent
        return {
          province: comp.province,
          city: comp.city || comp.province,  // 直辖市 city 为空
          district: comp.district,
        }
      }

      return null
    } catch (error) {
      this.logger.error('[高德行政区划] 请求失败:', error)
      return null
    }
  }

  /**
   * 找出最优路线（综合考虑时间和距离）
   */
  private findBestRoute(routes: AMapRoutePlan[]): number {
    if (routes.length === 1) return 0

    // 综合评分 = 时间权重 * 时间分 + 距离权重 * 距离分
    const timeWeight = 0.6
    const distanceWeight = 0.4

    let bestIndex = 0
    let bestScore = Infinity

    for (let i = 0; i < routes.length; i++) {
      // 归一化时间（分钟）
      const timeScore = routes[i].duration / 60
      // 归一化距离（公里）
      const distanceScore = routes[i].distance / 1000

      const score = timeWeight * timeScore + distanceWeight * distanceScore

      if (score < bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    return bestIndex
  }

  /**
   * 估算打车费用
   * 根据距离和城市规则估算
   */
  estimateTaxiCost(distance: number, city: string = '杭州'): number {
    // 简单估算规则（实际应该按城市规则计算）
    const baseRules: Record<string, { start: number; price: number; distance: number }> = {
      '北京': { start: 13, price: 2.3, distance: 3 },
      '上海': { start: 14, price: 2.4, distance: 3 },
      '广州': { start: 12, price: 2.6, distance: 2.5 },
      '深圳': { start: 11, price: 2.4, distance: 2 },
      '杭州': { start: 11, price: 2.5, distance: 3 },
      'default': { start: 10, price: 2.0, distance: 3 },
    }

    const rule = baseRules[city] || baseRules['default']
    const extraDistance = Math.max(0, distance / 1000 - rule.distance)
    
    return Math.round((rule.start + extraDistance * rule.price) * 100) / 100
  }
}
