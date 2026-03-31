/**
 * 定位 Hook
 * 封装定位获取、刷新、错误处理逻辑
 */
import { useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useLocationStore } from '@/stores/locationStore'

export function useLocation() {
  const { 
    location, 
    loading, 
    error, 
    showDetail,
    setLocation, 
    setLoading, 
    setError, 
    setShowDetail 
  } = useLocationStore()
  
  // 获取定位
  const fetchLocation = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 获取坐标
      const { latitude, longitude } = await Taro.getLocation({ type: 'gcj02' })
      
      // 逆地理编码
      const res = await Taro.requestReverseGeocoder({ latitude, longitude })
      
      setLocation({
        latitude,
        longitude,
        name: `${res.result.address_components.street}${res.result.address_components.street_number}`,
      })
    } catch (err) {
      console.error('定位失败:', err)
      setError('定位失败，请检查权限设置')
    }
  }, [setLocation, setLoading, setError])
  
  // 初始化
  useEffect(() => {
    fetchLocation()
  }, [fetchLocation])
  
  // 显示详细地址
  const showLocationDetail = useCallback(() => {
    setShowDetail(true)
  }, [setShowDetail])
  
  // 隐藏详细地址
  const hideLocationDetail = useCallback(() => {
    setShowDetail(false)
  }, [setShowDetail])
  
  return {
    location,
    loading,
    error,
    showDetail,
    fetchLocation,
    showLocationDetail,
    hideLocationDetail,
  }
}
