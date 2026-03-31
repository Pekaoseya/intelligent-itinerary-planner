/**
 * 地图服务
 * 封装地图相关的 API 调用
 */

import { Network } from '@/network'

// =============================================
// 类型定义
// =============================================

export interface ReverseGeocodeResult {
  address: string
  province?: string
  city?: string
  district?: string
  street?: string
  streetNumber?: string
  poiName?: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  poiName?: string
}

// =============================================
// Map Service
// =============================================

class MapService {
  /**
   * 逆地理编码：根据坐标获取地址
   */
  async reverseGeocode(lng: number, lat: number): Promise<ReverseGeocodeResult | null> {
    try {
      const res = await Network.request({
        url: '/api/map/reverse-geocode',
        method: 'GET',
        data: { lng, lat },
      })
      return res.data?.data || null
    } catch (error) {
      console.error('[MapService] 逆地理编码失败:', error)
      return null
    }
  }

  /**
   * 地理编码：根据地址获取坐标
   */
  async geocode(address: string): Promise<GeocodeResult | null> {
    try {
      const res = await Network.request({
        url: '/api/map/geocode',
        method: 'GET',
        data: { address },
      })
      return res.data?.data || null
    } catch (error) {
      console.error('[MapService] 地理编码失败:', error)
      return null
    }
  }

  /**
   * 获取当前位置的地址名称
   */
  async getAddressByLocation(lng: number, lat: number): Promise<string> {
    const result = await this.reverseGeocode(lng, lat)
    return result?.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

// 导出单例
export const mapService = new MapService()
