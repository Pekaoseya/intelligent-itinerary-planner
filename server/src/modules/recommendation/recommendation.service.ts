import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class RecommendationService {
  private supabase = getSupabaseClient()

  async findAll(userId: string = 'default-user', type?: string) {
    let query = this.supabase.from('recommendations').select('*').eq('user_id', userId)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('查询推荐失败:', error)
      throw error
    }

    return data
  }

  async create(recommendationData: any) {
    const { data, error } = await this.supabase
      .from('recommendations')
      .insert({
        ...recommendationData,
        user_id: recommendationData.user_id || 'default-user',
      })
      .select()
      .single()

    if (error) {
      console.error('创建推荐失败:', error)
      throw error
    }

    return data
  }

  async toggleFavorite(id: string) {
    // 先查询当前状态
    const { data: current, error: queryError } = await this.supabase
      .from('recommendations')
      .select('is_favorite')
      .eq('id', id)
      .single()

    if (queryError) {
      console.error('查询推荐失败:', queryError)
      throw queryError
    }

    // 切换收藏状态
    const { data, error } = await this.supabase
      .from('recommendations')
      .update({
        is_favorite: !current.is_favorite,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('更新推荐失败:', error)
      throw error
    }

    return data
  }

  async getByTimeAndLocation(params: { time?: string; location?: string; type?: string }) {
    // 根据时间和位置生成推荐
    const currentHour = new Date().getHours()
    const recommendations: any[] = []

    // 根据时间段推荐不同类型的场所
    if (params.type === 'restaurant' || (!params.type && currentHour >= 11 && currentHour <= 14) || (currentHour >= 17 && currentHour <= 20)) {
      recommendations.push(
        {
          type: 'restaurant',
          title: '粤式茶餐厅',
          description: '地道粤式茶点，环境优雅',
          rating: '4.5',
          distance: '500m',
          price: '¥58/人',
          tags: ['粤菜', '茶点'],
        },
        {
          type: 'restaurant',
          title: '日式拉面',
          description: '正宗日式拉面，口味纯正',
          rating: '4.3',
          distance: '800m',
          price: '¥45/人',
          tags: ['日料', '快餐'],
        }
      )
    }

    if (params.type === 'cafe' || (!params.type && currentHour >= 14 && currentHour <= 17)) {
      recommendations.push(
        {
          type: 'cafe',
          title: '星巴克咖啡',
          description: '经典咖啡品牌，环境舒适',
          rating: '4.2',
          distance: '300m',
          price: '¥35/人',
          tags: ['咖啡', '西式'],
        },
        {
          type: 'cafe',
          title: '瑞幸咖啡',
          description: '性价比咖啡，提神醒脑',
          rating: '4.0',
          distance: '400m',
          price: '¥20/人',
          tags: ['咖啡', '性价比'],
        }
      )
    }

    // 如果没有匹配的推荐，返回默认推荐
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general',
        title: '附近的公园',
        description: '散步放松的好地方',
        rating: '4.5',
        distance: '1km',
        tags: ['休闲', '户外'],
      })
    }

    return recommendations.slice(0, 3)
  }
}
