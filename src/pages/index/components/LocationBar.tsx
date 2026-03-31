/**
 * 定位栏组件
 * 显示当前位置，支持点击查看详情
 */
import { View, Text } from '@tarojs/components'
import { MapPin, Loader, Locate } from 'lucide-react-taro'
import { simplifyAddress } from '@/utils/address'
import type { UserLocation } from '@/stores/locationStore'

interface Props {
  location: UserLocation | null
  loading: boolean
  error: string | null
  onRefresh: () => void
  onShowDetail: () => void
}

export function LocationBar({ 
  location, 
  loading, 
  error, 
  onRefresh, 
  onShowDetail 
}: Props) {
  return (
    <View className="flex items-center gap-2 px-4 py-2 bg-gray-50">
      {/* 定位图标 */}
      <View style={{ width: '16px', height: '16px', flexShrink: 0 }}>
        {loading ? (
          <Loader size={16} color="#999" className="animate-spin" />
        ) : error ? (
          <Locate size={16} color="#ff4d4f" />
        ) : (
          <MapPin size={16} color="#1890ff" />
        )}
      </View>
      
      {/* 地址文本 */}
      {error ? (
        <Text className="text-xs text-red-500 flex-1" onClick={onRefresh}>
          {error}
        </Text>
      ) : location?.name ? (
        <View 
          className="flex flex-row items-center flex-1 overflow-hidden" 
          onClick={onShowDetail}
        >
          <Text 
            className="text-xs text-gray-600 truncate"
            style={{ flexShrink: 1 }}
          >
            {simplifyAddress(location.name)}
          </Text>
          <Text 
            className="text-xs text-gray-400 ml-1" 
            style={{ flexShrink: 0 }}
            onClick={onRefresh}
          >
            刷新
          </Text>
        </View>
      ) : (
        <Text className="text-xs text-gray-400 flex-1">正在定位...</Text>
      )}
    </View>
  )
}
