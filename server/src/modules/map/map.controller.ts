import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { MapService, GeoLocation, POI, RoutePlan } from './map.service'

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('geocode')
  async geocode(@Query('address') address: string, @Query('city') city?: string) {
    console.log('地理编码请求:', { address, city })
    const data = await this.mapService.geocode(address, city)
    return { code: 200, msg: 'success', data }
  }

  @Get('reverse-geocode')
  async reverseGeocode(@Query('lng') lng: string, @Query('lat') lat: string) {
    const lngNum = parseFloat(lng)
    const latNum = parseFloat(lat)
    console.log('逆地理编码请求:', { lng: lngNum, lat: latNum })
    const address = await this.mapService.reverseGeocode(lngNum, latNum)
    return { code: 200, msg: 'success', data: { address } }
  }

  @Get('search')
  async searchPOI(
    @Query('keywords') keywords: string,
    @Query('lng') lng?: number,
    @Query('lat') lat?: number,
    @Query('radius') radius?: number
  ) {
    console.log('POI 搜索请求:', { keywords, lng, lat, radius })
    const location = lng && lat ? { longitude: lng, latitude: lat } : undefined
    const data = await this.mapService.searchPOI(keywords, location, radius || 3000)
    return { code: 200, msg: 'success', data }
  }

  @Post('route/driving')
  async planDrivingRoute(
    @Body() body: { origin: { lng: number; lat: number }; destination: { lng: number; lat: number } }
  ) {
    console.log('驾车路径规划请求:', body)
    const data = await this.mapService.planDrivingRoute(
      { longitude: body.origin.lng, latitude: body.origin.lat },
      { longitude: body.destination.lng, latitude: body.destination.lat }
    )
    return { code: 200, msg: 'success', data }
  }

  @Post('route/walking')
  async planWalkingRoute(
    @Body() body: { origin: { lng: number; lat: number }; destination: { lng: number; lat: number } }
  ) {
    console.log('步行路径规划请求:', body)
    const data = await this.mapService.planWalkingRoute(
      { longitude: body.origin.lng, latitude: body.origin.lat },
      { longitude: body.destination.lng, latitude: body.destination.lat }
    )
    return { code: 200, msg: 'success', data }
  }

  @Post('route/transit')
  async planTransitRoute(
    @Body() body: {
      origin: { lng: number; lat: number }
      destination: { lng: number; lat: number }
      city: string
    }
  ) {
    console.log('公交路径规划请求:', body)
    const data = await this.mapService.planTransitRoute(
      { longitude: body.origin.lng, latitude: body.origin.lat },
      { longitude: body.destination.lng, latitude: body.destination.lat },
      body.city
    )
    return { code: 200, msg: 'success', data }
  }

  // 注意：综合出行规划（plan-trip）已迁移到 Agent 的 trip_plan 工具
  // 新的行程规划使用高德长途交通 API，支持真实车次/航班查询
}
