import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import { LocationService } from '../location/location.service'

export interface GeoLocation {
  longitude: number
  latitude: number
  formatted_address: string
  province: string
  city: string
  district: string
}

export interface POI {
  id: string
  name: string
  type: string
  address: string
  location: {
    longitude: number
    latitude: number
  }
  distance: number
  tel?: string
  rating?: number
  cost?: number
}

export interface RouteStep {
  instruction: string
  road: string
  distance: number
  duration: number
  action: string
}

export interface RoutePlan {
  distance: number // 米
  duration: number // 秒
  steps: RouteStep[]
  taxi_cost?: number
  polyline?: Array<{ latitude: number; longitude: number }> // 路线坐标点
}

@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name)
  private readonly tencentMapKey: string
  private readonly tencentMapSecret: string
  private readonly tencentMapBaseUrl = 'https://apis.map.qq.com/ws'
  private readonly amapKey: string
  private readonly amapBaseUrl = 'https://restapi.amap.com/v3'

  constructor(
    private configService: ConfigService,
    private locationService: LocationService,
  ) {
    // 从环境变量获取腾讯地图 API Key 和 Secret
    this.tencentMapKey = this.configService.get<string>('TENCENT_MAP_KEY') || ''
    this.tencentMapSecret = this.configService.get<string>('TENCENT_MAP_SECRET') || ''
    // 高德地图 API Key
    this.amapKey = this.configService.get<string>('AMAP_KEY') || ''
    
    if (!this.tencentMapKey) {
      this.logger.warn('TENCENT_MAP_KEY 未配置，地图服务将使用缓存或模拟数据')
    }
    if (!this.tencentMapSecret) {
      this.logger.warn('TENCENT_MAP_SECRET 未配置，API 调用可能失败')
    }
    if (!this.amapKey) {
      this.logger.warn('AMAP_KEY 未配置，逆地理编码将使用腾讯地图')
    }
  }

  /**
   * 生成腾讯地图 API 签名
   * 签名规则（根据腾讯地图官方文档）：
   * 1. 将请求参数（包括 key）按字典序升序排列
   * 2. 拼接成 key=value 格式（value 不进行 URL 编码）
   * 3. 拼接：路径 + "?" + 参数字符串
   * 4. 追加 "&sk=密钥"
   * 5. MD5 加密
   */
  private generateSignature(path: string, params: Record<string, string>): string {
    // 1. 将参数按 key 升序排列
    const sortedKeys = Object.keys(params).sort()
    
    // 2. 拼接参数（值不进行 URL 编码）
    const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&')
    
    // 3. 拼接路径和参数
    const requestPath = path + '?' + queryString
    
    // 4. 追加 sk
    const stringToSign = requestPath + '&sk=' + this.tencentMapSecret
    
    // 调试日志
    this.logger.log(`签名计算: ${stringToSign}`)
    
    // 5. MD5 加密
    const signature = createHash('md5').update(stringToSign).digest('hex')
    
    return signature
  }

  /**
   * 构建带签名的腾讯地图 API URL
   */
  private buildSignedUrl(path: string, params: Record<string, string>): string {
    // 添加 key 到参数
    const allParams = { ...params, key: this.tencentMapKey }
    
    // 签名路径需要包含 /ws 前缀
    const signedPath = '/ws' + path
    
    // 生成签名
    const sig = this.generateSignature(signedPath, allParams)
    
    // 构建完整 URL
    const queryString = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `${this.tencentMapBaseUrl}${path}?${queryString}&sig=${sig}`
  }

  /**
   * 地理编码 - 地址转坐标（腾讯地图）
   * 优先使用缓存
   */
  async geocode(address: string, city?: string): Promise<GeoLocation | null> {
    // 1. 先查询缓存
    const cached = await this.locationService.getCachedLocation(address)
    if (cached) {
      this.logger.log(`geocode 缓存命中: ${address}`)
      return {
        longitude: cached.longitude,
        latitude: cached.latitude,
        formatted_address: cached.address || address,
        province: cached.province || '',
        city: cached.city || '',
        district: '',
      }
    }

    // 2. API 未配置则返回默认
    if (!this.tencentMapKey) {
      return this.mockGeocode(address)
    }

    // 3. 调用腾讯地图 API（带签名）
    try {
      const params: Record<string, string> = {
        address,
        output: 'json',
      }
      if (city) params.city = city

      const url = this.buildSignedUrl('/geocoder/v1/', params)
      this.logger.log(`geocode 请求: ${url}`)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 0 && data.result) {
        const location = data.result.location
        const adInfo = data.result.ad_info

        const result: GeoLocation = {
          longitude: location.lng,
          latitude: location.lat,
          formatted_address: data.result.address || address,
          province: adInfo.province,
          city: adInfo.city,
          district: adInfo.district,
        }

        // 保存到缓存
        await this.locationService.saveLocation({
          name: address,
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.formatted_address,
          city: result.city,
          province: result.province,
          source: 'api',
        })

        return result
      }

      this.logger.warn(`地理编码失败: status=${data.status}, message=${data.message}`)
      return null
    } catch (error) {
      this.logger.error('地理编码失败:', error)
      return this.mockGeocode(address)
    }
  }

  /**
   * 逆地理编码 - 坐标转地址（优先使用高德地图，失败回退腾讯地图）
   */
  async reverseGeocode(longitude: number, latitude: number): Promise<string> {
    // 优先使用高德地图（不需要签名，更稳定）
    if (this.amapKey) {
      try {
        const url = `${this.amapBaseUrl}/geocode/regeo?key=${this.amapKey}&location=${longitude},${latitude}&output=JSON`
        this.logger.log(`高德逆地理编码请求: ${url}`)
        
        const response = await fetch(url)
        const data = await response.json()
        
        if (data.status === '1' && data.regeocode) {
          const address = data.regeocode.formatted_address
          this.logger.log(`高德逆地理编码成功: ${address}`)
          return address
        }
        
        this.logger.warn(`高德逆地理编码失败: status=${data.status}, info=${data.info}`)
      } catch (error) {
        this.logger.error('高德逆地理编码请求失败:', error)
      }
    }

    // 回退到腾讯地图
    if (this.tencentMapKey && this.tencentMapSecret) {
      try {
        const params: Record<string, string> = {
          location: `${latitude},${longitude}`,
          output: 'json',
        }
        const url = this.buildSignedUrl('/geocoder/v1/', params)
        this.logger.log(`腾讯逆地理编码请求: ${url}`)

        const response = await fetch(url)
        const data = await response.json()

        if (data.status === 0 && data.result) {
          return data.result.address
        }

        this.logger.warn(`腾讯逆地理编码失败: status=${data.status}, message=${data.message}`)
      } catch (error) {
        this.logger.error('腾讯逆地理编码失败:', error)
      }
    }

    // 所有方式都失败，返回坐标
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
  }

  /**
   * POI 搜索 - 搜索附近的餐厅、咖啡厅等（腾讯地图）
   */
  async searchPOI(
    keywords: string,
    location?: { longitude: number; latitude: number },
    radius: number = 3000,
    limit: number = 10
  ): Promise<POI[]> {
    if (!this.tencentMapKey) {
      return this.mockPOISearch(keywords)
    }

    try {
      const params: Record<string, string> = {
        keyword: keywords,
        output: 'json',
        page_size: limit.toString(),
        page_index: '1',
      }

      if (location) {
        params.boundary = `nearby(${location.latitude},${location.longitude},${radius})`
      }

      const url = this.buildSignedUrl('/place/v1/explore', params)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 0 && data.data) {
        return data.data.map((poi: any) => ({
          id: poi.id,
          name: poi.title,
          type: poi.category,
          address: poi.address,
          location: {
            longitude: poi.location.lng,
            latitude: poi.location.lat,
          },
          distance: poi._distance || 0,
          tel: poi.tel,
        }))
      }

      return []
    } catch (error) {
      this.logger.error('POI 搜索失败:', error)
      return this.mockPOISearch(keywords)
    }
  }

  /**
   * 路径规划 - 驾车（腾讯地图）
   * 返回 polyline 数据用于地图显示
   */
  async planDrivingRoute(
    origin: { longitude: number; latitude: number; name?: string },
    destination: { longitude: number; latitude: number; name?: string }
  ): Promise<RoutePlan | null> {
    this.logger.log(`planDrivingRoute 调用: origin=${JSON.stringify(origin)}, dest=${JSON.stringify(destination)}, key=${this.tencentMapKey ? '已配置' : '未配置'}`)
    const originName = origin.name || '起点'
    const destName = destination.name || '终点'

    // 1. 先查询 polyline 缓存
    const cachedPolyline = await this.locationService.getPolyline(originName, destName)
    if (cachedPolyline) {
      this.logger.log(`polyline 缓存命中: ${originName} -> ${destName}`)
      try {
        const polyline = JSON.parse(cachedPolyline)
        const distance = this.calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude)
        return {
          distance: Math.round(distance),
          duration: Math.round(distance / 30),
          steps: [],
          polyline,
          taxi_cost: Math.round(distance * 0.003),
        }
      } catch {}
    }

    // 2. API 未配置则用模拟
    if (!this.tencentMapKey) {
      return this.mockRoutePlan(origin, destination)
    }

    // 3. 调用腾讯地图 API（带签名）
    try {
      const params: Record<string, string> = {
        from: `${origin.latitude},${origin.longitude}`,
        to: `${destination.latitude},${destination.longitude}`,
        output: 'json',
      }

      const url = this.buildSignedUrl('/direction/v1/driving/', params)
      this.logger.log(`planDrivingRoute 请求: ${url}`)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 0 && data.result && data.result.routes) {
        const route = data.result.routes[0]
        
        // 转换 polyline 格式
        const polyline: Array<{ latitude: number; longitude: number }> = []
        if (route.polyline) {
          for (const point of route.polyline) {
            polyline.push({
              latitude: point[0],
              longitude: point[1],
            })
          }
        }

        // 保存 polyline 到缓存
        if (polyline.length > 0) {
          await this.locationService.savePolyline(originName, destName, JSON.stringify(polyline))
        }

        return {
          distance: route.distance,
          duration: route.duration,
          steps: route.polyline ? route.polyline.map((point: number[], idx: number, arr: number[][]) => ({
            instruction: idx === 0 ? '从起点出发' : idx === arr.length - 1 ? '到达终点' : '继续行驶',
            road: '',
            distance: Math.round(route.distance / arr.length),
            duration: Math.round(route.duration / arr.length),
            action: idx === 0 ? '出发' : idx === arr.length - 1 ? '到达' : '直行',
          })) : [],
          taxi_cost: route.taxi_cost,
          polyline,
        }
      }

      // API 调用失败，使用 mock 数据
      this.logger.warn(`腾讯地图 API 返回失败: status=${data.status}, message=${data.message}`)
      return this.mockRoutePlan(origin, destination)
    } catch (error) {
      this.logger.error('路径规划失败:', error)
      return this.mockRoutePlan(origin, destination)
    }
  }

  /**
   * 路径规划 - 步行（腾讯地图）
   */
  async planWalkingRoute(
    origin: { longitude: number; latitude: number },
    destination: { longitude: number; latitude: number }
  ): Promise<RoutePlan | null> {
    if (!this.tencentMapKey) {
      return this.mockRoutePlan(origin, destination, 'walking')
    }

    try {
      const params: Record<string, string> = {
        from: `${origin.latitude},${origin.longitude}`,
        to: `${destination.latitude},${destination.longitude}`,
        output: 'json',
      }

      const url = this.buildSignedUrl('/direction/v1/walking/', params)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 0 && data.result && data.result.routes) {
        const route = data.result.routes[0]

        // 转换 polyline 格式
        const polyline: Array<{ latitude: number; longitude: number }> = []
        if (route.polyline) {
          for (const point of route.polyline) {
            polyline.push({
              latitude: point[0],
              longitude: point[1],
            })
          }
        }

        return {
          distance: route.distance,
          duration: route.duration,
          steps: route.polyline ? route.polyline.map((point: number[], idx: number, arr: number[][]) => ({
            instruction: idx === 0 ? '从起点出发' : idx === arr.length - 1 ? '到达终点' : '继续步行',
            road: '',
            distance: Math.round(route.distance / arr.length),
            duration: Math.round(route.duration / arr.length),
            action: idx === 0 ? '出发' : idx === arr.length - 1 ? '到达' : '步行',
          })) : [],
          polyline,
        }
      }

      return null
    } catch (error) {
      this.logger.error('步行路径规划失败:', error)
      return this.mockRoutePlan(origin, destination, 'walking')
    }
  }

  /**
   * 路径规划 - 公交/地铁（腾讯地图）
   */
  async planTransitRoute(
    origin: { longitude: number; latitude: number },
    destination: { longitude: number; latitude: number },
    city: string
  ): Promise<RoutePlan | null> {
    if (!this.tencentMapKey) {
      return this.mockRoutePlan(origin, destination, 'transit')
    }

    try {
      const params: Record<string, string> = {
        from: `${origin.latitude},${origin.longitude}`,
        to: `${destination.latitude},${destination.longitude}`,
        output: 'json',
      }

      const url = this.buildSignedUrl('/direction/v1/transit/', params)

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 0 && data.result && data.result.routes) {
        const route = data.result.routes[0]
        
        return {
          distance: route.distance,
          duration: route.duration,
          steps: route.steps ? route.steps.map((step: any) => ({
            instruction: step.instruction || step.mode,
            road: step.road || '',
            distance: step.distance || 0,
            duration: step.duration || 0,
            action: step.mode || '公交/地铁',
          })) : [],
        }
      }

      return null
    } catch (error) {
      this.logger.error('公交路径规划失败:', error)
      return this.mockRoutePlan(origin, destination, 'transit')
    }
  }

  /**
   * 综合出行规划 - 根据距离推荐交通方式
   */
  async planTrip(
    originAddress: string,
    destinationAddress: string,
    departureTime?: Date
  ): Promise<{
    origin: GeoLocation | null
    destination: GeoLocation | null
    routes: {
      type: string
      route: RoutePlan | null
    }[]
  }> {
    // 地理编码（使用缓存）
    const origin = await this.geocode(originAddress)
    const destination = await this.geocode(destinationAddress)

    if (!origin || !destination) {
      return {
        origin,
        destination,
        routes: [],
      }
    }

    const routes: { type: string; route: RoutePlan | null }[] = []

    // 计算直线距离
    const distance = this.calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    )

    // 根据距离选择交通方式
    if (distance < 2000) {
      // 2km 以内推荐步行
      routes.push({
        type: 'walking',
        route: await this.planWalkingRoute(
          { longitude: origin.longitude, latitude: origin.latitude },
          { longitude: destination.longitude, latitude: destination.latitude }
        ),
      })
    }

    if (distance > 1000 && distance < 50000) {
      // 1km-50km 推荐公交
      routes.push({
        type: 'transit',
        route: await this.planTransitRoute(
          { longitude: origin.longitude, latitude: origin.latitude },
          { longitude: destination.longitude, latitude: destination.latitude },
          origin.city || '北京'
        ),
      })
    }

    if (distance > 3000) {
      // 3km 以上推荐驾车
      routes.push({
        type: 'driving',
        route: await this.planDrivingRoute(
          { longitude: origin.longitude, latitude: origin.latitude, name: originAddress },
          { longitude: destination.longitude, latitude: destination.latitude, name: destinationAddress }
        ),
      })
    }

    return { origin, destination, routes }
  }

  /**
   * 计算两点之间的直线距离（米）
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000 // 地球半径（米）
    const dLat = this.toRad(lat2 - lat1)
    const dLng = this.toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180)
  }

  // 模拟数据方法
  private mockGeocode(address: string): GeoLocation {
    // 尝试从缓存获取
    const defaultLocation = this.locationService.getDefaultLocation()
    
    return {
      longitude: defaultLocation.longitude + (Math.random() - 0.5) * 0.01,
      latitude: defaultLocation.latitude + (Math.random() - 0.5) * 0.01,
      formatted_address: `浙江省杭州市${address}`,
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
    }
  }

  private mockPOISearch(keywords: string): POI[] {
    const defaultLoc = this.locationService.getDefaultLocation()
    const results: POI[] = [
      {
        id: '1',
        name: `${keywords}推荐1`,
        type: keywords.includes('餐厅') ? '餐饮服务' : '咖啡厅',
        address: '杭州市西湖区示例路1号',
        location: { longitude: defaultLoc.longitude, latitude: defaultLoc.latitude },
        distance: 500,
        rating: 4.5,
        cost: 80,
      },
      {
        id: '2',
        name: `${keywords}推荐2`,
        type: keywords.includes('餐厅') ? '餐饮服务' : '咖啡厅',
        address: '杭州市西湖区示例路2号',
        location: { longitude: defaultLoc.longitude + 0.001, latitude: defaultLoc.latitude + 0.001 },
        distance: 800,
        rating: 4.3,
        cost: 60,
      },
    ]
    return results
  }

  private mockRoutePlan(
    origin: { longitude: number; latitude: number },
    destination: { longitude: number; latitude: number },
    type: string = 'driving'
  ): RoutePlan {
    const distance = this.calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude)
    const speed = type === 'walking' ? 1.2 : type === 'transit' ? 10 : 30 // 米/秒
    const duration = distance / speed

    // 生成模拟 polyline（直线）
    const polyline: Array<{ latitude: number; longitude: number }> = []
    const steps = 10
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps
      polyline.push({
        latitude: origin.latitude + (destination.latitude - origin.latitude) * ratio,
        longitude: origin.longitude + (destination.longitude - origin.longitude) * ratio,
      })
    }

    return {
      distance: Math.round(distance),
      duration: Math.round(duration),
      steps: [
        {
          instruction: `从起点出发`,
          road: '',
          distance: Math.round(distance * 0.3),
          duration: Math.round(duration * 0.3),
          action: '出发',
        },
        {
          instruction: `沿示例路行驶`,
          road: '示例路',
          distance: Math.round(distance * 0.5),
          duration: Math.round(duration * 0.5),
          action: '直行',
        },
        {
          instruction: `到达终点`,
          road: '',
          distance: Math.round(distance * 0.2),
          duration: Math.round(duration * 0.2),
          action: '到达',
        },
      ],
      taxi_cost: type === 'driving' ? Math.round(distance * 0.003) : undefined,
      polyline,
    }
  }
}
