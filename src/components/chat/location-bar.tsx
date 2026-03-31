/**
 * 定位栏组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Loader, MapPin, Locate } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { simplifyAddress } from '@/utils/address'
import type { UserLocation } from '@/types'

export interface LocationBarProps {
  location: UserLocation | null
  loading: boolean
  error: string | null
  showDetail: boolean
  onRefresh: () => void
  onShowDetail: (show: boolean) => void
}

export const LocationBar: FC<LocationBarProps> = ({
  location,
  loading,
  error,
  showDetail,
  onRefresh,
  onShowDetail,
}) => {
  return (
    <>
      {/* 定位栏 */}
      <View
        className="flex items-center justify-center py-2 px-4 bg-white border-b border-gray-100"
        style={{ minHeight: '36px' }}
      >
        {loading ? (
          <View className="flex items-center gap-1">
            <Loader size={16} color="#1890ff" className="animate-spin" />
            <Text className="text-xs text-gray-500">获取定位中...</Text>
          </View>
        ) : error ? (
          <View className="flex items-center gap-1" onClick={onRefresh}>
            <MapPin size={16} color="#ff4d4f" />
            <Text className="text-xs text-red-500">{error}</Text>
            <Locate size={14} color="#1890ff" style={{ marginLeft: '4px' }} />
          </View>
        ) : (
          <View className="flex items-center gap-1" style={{ maxWidth: '100%' }}>
            <View 
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '2px' }}
              onClick={() => onShowDetail(true)}
            >
              <MapPin size={16} color="#1890ff" />
            </View>
            <Text className="text-xs text-gray-600 truncate" style={{ maxWidth: '200px' }}>
              {simplifyAddress(location?.name || '')}
            </Text>
            <Text 
              className="text-xs text-gray-400 ml-1" 
              style={{ flexShrink: 0 }}
              onClick={onRefresh}
            >
              刷新
            </Text>
          </View>
        )}
      </View>

      {/* 详细地址弹窗 */}
      {showDetail && location?.name && (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => onShowDetail(false)}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '16px 20px',
              margin: '20px',
              maxWidth: '80%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <View className="flex items-center gap-2 mb-2">
              <MapPin size={18} color="#1890ff" />
              <Text className="text-sm font-medium">当前位置</Text>
            </View>
            <Text className="text-sm text-gray-600 leading-relaxed">{location.name}</Text>
            <View className="flex justify-end mt-3">
              <Button 
                size="sm" 
                onClick={() => onShowDetail(false)}
              >
                <Text className="text-sm">关闭</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </>
  )
}

export default LocationBar
