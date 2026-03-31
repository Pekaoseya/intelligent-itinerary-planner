/**
 * 行程规划服务
 * 参考高德路径规划，智能拆分多段行程
 * 
 * 核心功能：
 * 1. 调用高德地图 API 获取路线规划
 * 2. 根据距离智能选择交通方式
 * 3. 拆分成多个任务（打车去机场 → 飞行 → 打车到目的地）
 * 4. 展示 AI 思考过程
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  TripPlanRequest,
  TripPlanResult,
  RoutePlan,
  RouteSegment,
  SplitTask,
  ReasoningStep,
  Coordinate,
  Location,
  TransportMode,
} from './trip-planner.types'
import {
  getAmapKey,
  getCoordinates,
  getDrivingRoute,
  searchTransportPOI,
  calculateStraightDistance,
  generateStraightPolyline,
} from './map-utils'

// =============================================
// 常量定义
// =============================================

/** 距离阈值（米） */
const DISTANCE_THRESHOLD = {
  /** 短途：建议打车/步行 */
  SHORT: 5000, // 5km
  /** 中途：建议打车/地铁 */
  MEDIUM: 50000, // 50km
  /** 长途：建议高铁 */
  LONG: 300000, // 300km
  /** 超长途：建议飞机 */
  VERY_LONG: 800000, // 800km
}

/** 交通方式预估速度（米/秒） */
const SPEED = {
  walking: 1.4, // 5km/h
  taxi: 8.3, // 30km/h（城市道路）
  subway: 11.1, // 40km/h
  train: 83.3, // 300km/h（高铁）
  flight: 250, // 900km/h
}

/** 出行方式名称映射 */
const MODE_NAMES: Record<TransportMode, string> = {
  taxi: '打车',
  train: '高铁',
  flight: '飞机',
  walking: '步行',
  subway: '地铁',
  bus: '公交',
}

// =============================================
// 服务实现
// =============================================

@Injectable()
export class TripPlannerService {
  private readonly logger = new Logger(TripPlannerService.name)

  /**
   * 规划行程
   * 主入口：分析需求 → 查询路线 → 拆分任务
   */
  async planTrip(request: TripPlanRequest): Promise<TripPlanResult> {
    const reasoning: ReasoningStep[] = []
    const routes: RoutePlan[] = []
    let splitTasks: SplitTask[] = []

    try {
      // =============================================
      // Step 1: 分析出行需求
      // =============================================
      reasoning.push({
        type: 'analyze',
        content: `分析出行需求：从「${request.origin.name}」到「${request.destination.name}」`,
      })

      // 获取起点和终点坐标
      const originCoord = request.origin.coordinate || await getCoordinates(request.origin.name)
      const destCoord = request.destination.coordinate || await getCoordinates(request.destination.name)

      // 计算直线距离
      const straightDistance = calculateStraightDistance(
        originCoord.latitude, originCoord.longitude,
        destCoord.latitude, destCoord.longitude
      )

      reasoning.push({
        type: 'analyze',
        content: `直线距离约 ${Math.round(straightDistance / 1000)} 公里`,
        data: { distance: straightDistance },
      })

      // =============================================
      // Step 2: 切换 Agent 查询高德地图
      // =============================================
      reasoning.push({
        type: 'query',
        content: '正在调用高德地图 API 查询路线规划...',
      })

      // 根据距离选择交通方式
      const suggestedModes = this.suggestTransportModes(straightDistance)
      reasoning.push({
        type: 'query',
        content: `根据距离推荐交通方式：${suggestedModes.map(m => MODE_NAMES[m]).join('、')}`,
        data: { suggestedModes },
      })

      // =============================================
      // Step 3: 规划路线
      // =============================================
      
      // 方案一：打车（短途）
      if (suggestedModes.includes('taxi')) {
        reasoning.push({
          type: 'plan',
          content: '正在规划打车路线...',
        })
        const taxiRoute = await this.planTaxiRoute(request.origin, request.destination, originCoord, destCoord)
        if (taxiRoute) {
          routes.push(taxiRoute)
          reasoning.push({
            type: 'plan',
            content: `打车方案：${Math.round(taxiRoute.totalDistance / 1000)}km，约 ${Math.round(taxiRoute.totalDuration / 60)} 分钟`,
          })
        }
      }

      // 方案二：高铁（中途/长途）
      if (suggestedModes.includes('train')) {
        reasoning.push({
          type: 'plan',
          content: '正在查询高铁班次...',
        })
        const trainRoute = await this.planTrainRoute(request.origin, request.destination)
        if (trainRoute) {
          routes.push(trainRoute)
          reasoning.push({
            type: 'plan',
            content: `高铁方案：${Math.round(trainRoute.totalDistance / 1000)}km，约 ${Math.round(trainRoute.totalDuration / 60)} 分钟`,
          })
        }
      }

      // 方案三：飞机（超长途）
      if (suggestedModes.includes('flight')) {
        reasoning.push({
          type: 'plan',
          content: '正在查询航班信息...',
        })
        const flightRoute = await this.planFlightRoute(request.origin, request.destination)
        if (flightRoute) {
          routes.push(flightRoute)
          reasoning.push({
            type: 'plan',
            content: `飞机方案：${Math.round(flightRoute.totalDistance / 1000)}km，约 ${Math.round(flightRoute.totalDuration / 60)} 分钟`,
          })
        }
      }

      // =============================================
      // Step 4: 拆分任务
      // =============================================
      if (routes.length > 0) {
        const recommendedRoute = routes[0] // 默认推荐第一个方案
        reasoning.push({
          type: 'split',
          content: `正在拆分「${recommendedRoute.name}」为具体任务...`,
        })

        splitTasks = await this.splitRouteToTasks(recommendedRoute, request.departureTime || new Date())
        
        reasoning.push({
          type: 'split',
          content: `已拆分为 ${splitTasks.length} 个任务`,
          data: { tasks: splitTasks.map(t => t.title) },
        })
      }

      // =============================================
      // Step 5: 生成总结
      // =============================================
      const summary = this.generateSummary(routes, splitTasks)
      reasoning.push({
        type: 'conclude',
        content: summary,
      })

      return {
        success: true,
        routes,
        recommendedIndex: 0,
        splitTasks,
        summary,
        reasoning: reasoning.map(r => r.content),
      }
    } catch (error) {
      this.logger.error('行程规划失败:', error)
      return {
        success: false,
        routes: [],
        recommendedIndex: -1,
        splitTasks: [],
        summary: '行程规划失败',
        reasoning: reasoning.map(r => r.content),
        error: error.message,
      }
    }
  }

  /**
   * 根据距离建议交通方式
   */
  private suggestTransportModes(distance: number): TransportMode[] {
    const modes: TransportMode[] = []

    if (distance <= DISTANCE_THRESHOLD.SHORT) {
      // 短途：打车或步行
      modes.push('taxi')
      if (distance <= 2000) modes.push('walking')
    } else if (distance <= DISTANCE_THRESHOLD.MEDIUM) {
      // 中途：打车
      modes.push('taxi')
    } else if (distance <= DISTANCE_THRESHOLD.LONG) {
      // 长途：高铁
      modes.push('train')
      modes.push('taxi') // 作为备选
    } else if (distance <= DISTANCE_THRESHOLD.VERY_LONG) {
      // 较长途：高铁优先
      modes.push('train')
      modes.push('flight')
    } else {
      // 超长途：飞机优先
      modes.push('flight')
      modes.push('train')
    }

    return modes
  }

  /**
   * 规划打车路线
   */
  private async planTaxiRoute(
    origin: Location,
    destination: Location,
    originCoord: Coordinate,
    destCoord: Coordinate
  ): Promise<RoutePlan | null> {
    try {
      const route = await getDrivingRoute(originCoord, destCoord)
      if (!route) return null

      const segment: RouteSegment = {
        mode: 'taxi',
        origin,
        destination,
        distance: route.distance,
        duration: route.duration,
        cost: Math.round(route.distance * 0.003 + 10), // 预估费用
        polyline: route.polyline,
      }

      return {
        id: 'taxi_1',
        name: '打车直达',
        totalDistance: route.distance,
        totalDuration: route.duration,
        totalCost: segment.cost,
        segments: [segment],
        highlights: ['门到门服务', '无需换乘'],
      }
    } catch (error) {
      this.logger.error('规划打车路线失败:', error)
      return null
    }
  }

  /**
   * 规划高铁路线
   */
  private async planTrainRoute(origin: Location, destination: Location): Promise<RoutePlan | null> {
    try {
      // 提取城市名
      const originCity = this.extractCity(origin.name)
      const destCity = this.extractCity(destination.name)

      if (!originCity || !destCity) {
        this.logger.warn('无法识别城市名称')
        return null
      }

      // 查找火车站
      const [originStation, destStation] = await Promise.all([
        searchTransportPOI('火车站', originCity, 'train_station').then(r => r[0] || null),
        searchTransportPOI('火车站', destCity, 'train_station').then(r => r[0] || null),
      ])

      if (!originStation || !destStation) {
        this.logger.warn('未找到火车站')
        return null
      }

      // 获取坐标
      const originCoord = await getCoordinates(origin.name)
      const destCoord = await getCoordinates(destination.name)
      const stationCoord1 = { latitude: originStation.latitude, longitude: originStation.longitude }
      const stationCoord2 = { latitude: destStation.latitude, longitude: destStation.longitude }

      // 计算各段距离
      const distance1 = calculateStraightDistance(
        originCoord.latitude, originCoord.longitude,
        stationCoord1.latitude, stationCoord1.longitude
      )
      const distance2 = calculateStraightDistance(
        stationCoord1.latitude, stationCoord1.longitude,
        stationCoord2.latitude, stationCoord2.longitude
      )
      const distance3 = calculateStraightDistance(
        stationCoord2.latitude, stationCoord2.longitude,
        destCoord.latitude, destCoord.longitude
      )

      // 构建路径段
      const segments: RouteSegment[] = []

      // 第一段：打车去火车站
      if (distance1 > 1000) {
        segments.push({
          mode: 'taxi',
          origin,
          destination: { name: originStation.name, coordinate: stationCoord1, type: 'train_station' },
          distance: distance1,
          duration: Math.round(distance1 / SPEED.taxi),
          cost: Math.round(distance1 * 0.003 + 10),
          polyline: generateStraightPolyline(originCoord, stationCoord1),
        })
      }

      // 第二段：高铁
      const trainDuration = Math.round(distance2 / SPEED.train)
      segments.push({
        mode: 'train',
        origin: { name: originStation.name, coordinate: stationCoord1, type: 'train_station' },
        destination: { name: destStation.name, coordinate: stationCoord2, type: 'train_station' },
        distance: distance2,
        duration: trainDuration,
        cost: Math.round(distance2 * 0.0005), // 约 0.5 元/km
      })

      // 第三段：打车到目的地
      if (distance3 > 1000) {
        segments.push({
          mode: 'taxi',
          origin: { name: destStation.name, coordinate: stationCoord2, type: 'train_station' },
          destination,
          distance: distance3,
          duration: Math.round(distance3 / SPEED.taxi),
          cost: Math.round(distance3 * 0.003 + 10),
          polyline: generateStraightPolyline(stationCoord2, destCoord),
        })
      }

      const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0)
      const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0)
      const totalCost = segments.reduce((sum, s) => sum + (s.cost || 0), 0)

      return {
        id: 'train_1',
        name: `高铁（${originCity} → ${destCity}）`,
        totalDistance,
        totalDuration,
        totalCost,
        segments,
        highlights: ['快速便捷', '准点率高'],
      }
    } catch (error) {
      this.logger.error('规划高铁路线失败:', error)
      return null
    }
  }

  /**
   * 规划飞机路线
   */
  private async planFlightRoute(origin: Location, destination: Location): Promise<RoutePlan | null> {
    try {
      // 提取城市名
      const originCity = this.extractCity(origin.name)
      const destCity = this.extractCity(destination.name)

      if (!originCity || !destCity) {
        this.logger.warn('无法识别城市名称')
        return null
      }

      // 查找机场
      const [originAirport, destAirport] = await Promise.all([
        searchTransportPOI('机场', originCity, 'airport').then(r => r[0] || null),
        searchTransportPOI('机场', destCity, 'airport').then(r => r[0] || null),
      ])

      if (!originAirport || !destAirport) {
        this.logger.warn('未找到机场')
        return null
      }

      // 获取坐标
      const originCoord = await getCoordinates(origin.name)
      const destCoord = await getCoordinates(destination.name)
      const airportCoord1 = { latitude: originAirport.latitude, longitude: originAirport.longitude }
      const airportCoord2 = { latitude: destAirport.latitude, longitude: destAirport.longitude }

      // 计算各段距离
      const distance1 = calculateStraightDistance(
        originCoord.latitude, originCoord.longitude,
        airportCoord1.latitude, airportCoord1.longitude
      )
      const distance2 = calculateStraightDistance(
        airportCoord1.latitude, airportCoord1.longitude,
        airportCoord2.latitude, airportCoord2.longitude
      )
      const distance3 = calculateStraightDistance(
        airportCoord2.latitude, airportCoord2.longitude,
        destCoord.latitude, destCoord.longitude
      )

      // 构建路径段
      const segments: RouteSegment[] = []

      // 第一段：打车去机场
      if (distance1 > 1000) {
        segments.push({
          mode: 'taxi',
          origin,
          destination: { name: originAirport.name, coordinate: airportCoord1, type: 'airport' },
          distance: distance1,
          duration: Math.round(distance1 / SPEED.taxi),
          cost: Math.round(distance1 * 0.003 + 10),
          polyline: generateStraightPolyline(originCoord, airportCoord1),
        })
      }

      // 第二段：飞行（加上提前 2 小时值机时间）
      const flightDuration = Math.round(distance2 / SPEED.flight) + 120 * 60 // 加上值机时间
      segments.push({
        mode: 'flight',
        origin: { name: originAirport.name, coordinate: airportCoord1, type: 'airport' },
        destination: { name: destAirport.name, coordinate: airportCoord2, type: 'airport' },
        distance: distance2,
        duration: flightDuration,
        cost: Math.round(distance2 * 0.001 + 300), // 预估机票价格
      })

      // 第三段：打车到目的地
      if (distance3 > 1000) {
        segments.push({
          mode: 'taxi',
          origin: { name: destAirport.name, coordinate: airportCoord2, type: 'airport' },
          destination,
          distance: distance3,
          duration: Math.round(distance3 / SPEED.taxi),
          cost: Math.round(distance3 * 0.003 + 10),
          polyline: generateStraightPolyline(airportCoord2, destCoord),
        })
      }

      const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0)
      const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0)
      const totalCost = segments.reduce((sum, s) => sum + (s.cost || 0), 0)

      return {
        id: 'flight_1',
        name: `飞机（${originCity} → ${destCity}）`,
        totalDistance,
        totalDuration,
        totalCost,
        segments,
        highlights: ['速度最快', '适合长途'],
      }
    } catch (error) {
      this.logger.error('规划飞机路线失败:', error)
      return null
    }
  }

  /**
   * 将路线拆分为任务
   */
  private async splitRouteToTasks(route: RoutePlan, startTime: Date): Promise<SplitTask[]> {
    const tasks: SplitTask[] = []
    let currentTime = new Date(startTime)

    for (const segment of route.segments) {
      const task = this.segmentToTask(segment, currentTime)
      if (task) {
        tasks.push(task)
        // 更新时间为这段行程结束时间
        currentTime = new Date(currentTime.getTime() + segment.duration * 1000)
      }
    }

    return tasks
  }

  /**
   * 将路径段转换为任务
   */
  private segmentToTask(segment: RouteSegment, scheduledTime: Date): SplitTask | null {
    const mode = segment.mode

    if (mode === 'taxi') {
      return {
        title: `打车前往「${segment.destination.name}」`,
        type: 'taxi',
        scheduledTime,
        origin: segment.origin,
        destination: segment.destination,
        metadata: {
          distance: segment.distance,
          duration: segment.duration,
          cost: segment.cost,
          polyline: segment.polyline,
        },
        description: `约 ${Math.round(segment.distance / 1000)} 公里，${Math.round(segment.duration / 60)} 分钟`,
      }
    }

    if (mode === 'train') {
      const trainNo = this.generateTrainNo()
      return {
        title: `乘坐高铁前往「${segment.destination.name}」`,
        type: 'train',
        scheduledTime,
        origin: segment.origin,
        destination: segment.destination,
        metadata: {
          distance: segment.distance,
          duration: segment.duration,
          cost: segment.cost,
          trainNo,
        },
        description: `约 ${Math.round(segment.distance / 1000)} 公里，${Math.round(segment.duration / 60)} 分钟`,
      }
    }

    if (mode === 'flight') {
      const flightNo = this.generateFlightNo()
      return {
        title: `乘坐飞机前往「${segment.destination.name}」`,
        type: 'flight',
        scheduledTime,
        origin: segment.origin,
        destination: segment.destination,
        metadata: {
          distance: segment.distance,
          duration: segment.duration,
          cost: segment.cost,
          flightNo,
        },
        description: `约 ${Math.round(segment.distance / 1000)} 公里，需提前 2 小时到达机场`,
      }
    }

    return null
  }

  /**
   * 提取城市名
   */
  private extractCity(locationName: string): string | null {
    const cities = [
      '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都',
      '武汉', '西安', '重庆', '天津', '长沙', '郑州', '青岛', '厦门',
      '宁波', '无锡', '合肥', '福州', '大连', '沈阳', '哈尔滨', '长春',
      '昆明', '贵阳', '南宁', '海口', '三亚', '兰州', '乌鲁木齐', '拉萨',
    ]

    for (const city of cities) {
      if (locationName.includes(city)) {
        return city
      }
    }

    return null
  }

  /**
   * 生成虚拟列车号
   */
  private generateTrainNo(): string {
    const numbers = ['G', 'D', 'C']
    const prefix = numbers[Math.floor(Math.random() * numbers.length)]
    const num = Math.floor(Math.random() * 9000) + 1000
    return `${prefix}${num}`
  }

  /**
   * 生成虚拟航班号
   */
  private generateFlightNo(): string {
    const airlines = ['CA', 'MU', 'CZ', 'HU', 'FM', 'ZH', 'MU', '3U']
    const airline = airlines[Math.floor(Math.random() * airlines.length)]
    const num = Math.floor(Math.random() * 9000) + 1000
    return `${airline}${num}`
  }

  /**
   * 生成总结文案
   */
  private generateSummary(routes: RoutePlan[], tasks: SplitTask[]): string {
    if (routes.length === 0) {
      return '未找到合适的出行方案'
    }

    const route = routes[0]
    const distanceKm = Math.round(route.totalDistance / 1000)
    const durationMin = Math.round(route.totalDuration / 60)
    const cost = route.totalCost ? `，约 ${route.totalCost} 元` : ''

    return `为您规划「${route.name}」方案：全程 ${distanceKm} 公里，预计 ${durationMin} 分钟${cost}。已拆分为 ${tasks.length} 个任务，请确认后创建。`
  }
}
