import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

export interface CachedLocation {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  city: string | null
  province: string | null
  source: string
  polyline: string | null
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name)
  private supabase = getSupabaseClient()

  /**
   * 查询缓存的位置信息
   */
  async getCachedLocation(name: string): Promise<CachedLocation | null> {
    try {
      const { data, error } = await this.supabase
        .from('location_cache')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      return {
        id: data.id,
        name: data.name,
        address: data.address,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        city: data.city,
        province: data.province,
        source: data.source,
        polyline: data.polyline,
      }
    } catch (error) {
      this.logger.error('查询位置缓存失败:', error)
      return null
    }
  }

  /**
   * 保存位置到缓存
   */
  async saveLocation(location: {
    name: string
    address?: string
    latitude: number
    longitude: number
    city?: string
    province?: string
    source?: string
    polyline?: string
  }): Promise<CachedLocation | null> {
    try {
      const { data, error } = await this.supabase
        .from('location_cache')
        .upsert({
          name: location.name,
          address: location.address || null,
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          city: location.city || null,
          province: location.province || null,
          source: location.source || 'api',
          polyline: location.polyline || null,
        }, {
          onConflict: 'name',
        })
        .select()
        .single()

      if (error) {
        this.logger.error('保存位置缓存失败:', error)
        return null
      }

      return {
        id: data.id,
        name: data.name,
        address: data.address,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        city: data.city,
        province: data.province,
        source: data.source,
        polyline: data.polyline,
      }
    } catch (error) {
      this.logger.error('保存位置缓存失败:', error)
      return null
    }
  }

  /**
   * 获取或创建位置缓存
   * 先查询缓存，如果没有则调用 API 获取并保存
   */
  async getOrCreateLocation(
    name: string,
    fetchFn: () => Promise<{ latitude: number; longitude: number; address?: string; city?: string; province?: string } | null>
  ): Promise<CachedLocation | null> {
    // 1. 先查询缓存
    const cached = await this.getCachedLocation(name)
    if (cached) {
      this.logger.log(`命中缓存: ${name}`)
      return cached
    }

    // 2. 调用 API 获取
    this.logger.log(`缓存未命中，调用 API: ${name}`)
    const result = await fetchFn()

    if (!result) {
      return null
    }

    // 3. 保存到缓存
    const saved = await this.saveLocation({
      name,
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
      city: result.city,
      province: result.province,
      source: 'api',
    })

    return saved
  }

  /**
   * 保存路线 polyline
   */
  async savePolyline(originName: string, destName: string, polyline: string): Promise<void> {
    try {
      const key = `${originName} -> ${destName}`
      await this.supabase
        .from('location_cache')
        .upsert({
          name: key,
          latitude: '0',
          longitude: '0',
          source: 'polyline',
          polyline,
        }, {
          onConflict: 'name',
        })
    } catch (error) {
      this.logger.error('保存 polyline 失败:', error)
    }
  }

  /**
   * 获取路线 polyline
   */
  async getPolyline(originName: string, destName: string): Promise<string | null> {
    try {
      const key = `${originName} -> ${destName}`
      const { data } = await this.supabase
        .from('location_cache')
        .select('polyline')
        .eq('name', key)
        .single()

      return data?.polyline || null
    } catch {
      return null
    }
  }

  /**
   * 获取默认位置（杭州西湖）
   */
  getDefaultLocation(): CachedLocation {
    return {
      id: 'default',
      name: '杭州西湖',
      address: '浙江省杭州市西湖区',
      latitude: 30.242489,
      longitude: 120.148532,
      city: '杭州',
      province: '浙江',
      source: 'default',
      polyline: null,
    }
  }
}
