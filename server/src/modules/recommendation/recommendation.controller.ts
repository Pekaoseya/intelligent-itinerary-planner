import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get()
  async findAll(@Query('userId') userId?: string, @Query('type') type?: string) {
    console.log('查询推荐列表, userId:', userId, 'type:', type)
    const data = await this.recommendationService.findAll(userId, type)
    return data
  }

  @Get('smart')
  async getSmartRecommendations(@Query() query: { time?: string; location?: string; type?: string }) {
    console.log('智能推荐查询:', query)
    const data = await this.recommendationService.getByTimeAndLocation(query)
    return data
  }

  @Post()
  async create(@Body() body: any) {
    console.log('创建推荐:', body)
    const data = await this.recommendationService.create(body)
    return data
  }

  @Post(':id/favorite')
  async toggleFavorite(@Param('id') id: string) {
    console.log('切换收藏状态:', id)
    const data = await this.recommendationService.toggleFavorite(id)
    return data
  }
}
