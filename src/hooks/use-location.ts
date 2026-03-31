/**
 * 定位 Hook
 * 封装定位获取逻辑
 */

import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import type { UserLocation } from '@/types'
import { DEFAULT_LOCATION } from '@/types'

export interface UseLocationResult {
  location: UserLocation | null
  loading: boolean
  error: string | null
  showDetail: boolean
  fetchLocation: () => Promise<void>
  setShowDetail: (show: boolean) => void
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const fetchLocation = useCallback(async () => {
    setLoading(true)
    setError(null)
    console.log('[定位] 开始获取...')

    try {
      const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

      if (isWeapp) {
        const locationData = await Taro.getLocation({ type: 'gcj02' })
        console.log('[定位] 小程序获取成功:', locationData.latitude, locationData.longitude)

        try {
          const res = await Network.request({
            url: '/api/map/reverse-geocode',
            method: 'GET',
            data: { lng: locationData.longitude, lat: locationData.latitude },
          })
          const addressName = res.data?.data?.address
          setLocation({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            name: addressName || `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`,
          })
          setError(null)
        } catch (geocodeError) {
          console.warn('[定位] 逆地理编码失败:', geocodeError)
          setLocation({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            name: `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`,
          })
        }
      } else {
        // H5 端
        if (navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocation({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  name: '当前位置',
                })
                console.log('[定位] H5 获取成功:', pos.coords.latitude, pos.coords.longitude)
                resolve()
              },
              (err) => {
                console.warn('[定位] H5 获取失败:', err)
                // 使用默认位置
                setLocation(DEFAULT_LOCATION)
                setError('定位失败，使用默认位置')
                resolve()
              },
              { timeout: 5000 }
            )
          })
        } else {
          setLocation(DEFAULT_LOCATION)
          setError('浏览器不支持定位，使用默认位置')
        }
      }
    } catch (err) {
      console.error('[定位] 获取失败:', err)
      setLocation(DEFAULT_LOCATION)
      setError('定位失败，使用默认位置')
    } finally {
      setLoading(false)
    }
  }, [])

  return { location, loading, error, showDetail, fetchLocation, setShowDetail }
}
