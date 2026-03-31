/**
 * 出行偏好统计卡片组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Car, TrainFront, Plane, MapPin } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { TravelStats } from '@/types'
import { TRAVEL_TYPE_CONFIG, TIME_PERIOD_CONFIG } from '@/types'

export interface TravelStatsCardProps {
  stats: TravelStats | null
}

// 获取出行类型图标
const getTravelIcon = (type: string, size = 16) => {
  const config = TRAVEL_TYPE_CONFIG[type]
  switch (type) {
    case 'taxi': return <Car size={size} color={config?.color || '#faad14'} />
    case 'train': return <TrainFront size={size} color={config?.color || '#1890ff'} />
    case 'flight': return <Plane size={size} color={config?.color || '#722ed1'} />
    default: return <Car size={size} color="#999" />
  }
}

// 计算出行类型占比
const getTravelPercentage = (stats: TravelStats | null, type: string): number => {
  if (!stats) return 0
  const total = stats.by_type.taxi + stats.by_type.train + stats.by_type.flight
  return total > 0 ? Math.round((stats.by_type[type as keyof typeof stats.by_type] / total) * 100) : 0
}

// 获取最大值
const getMaxValue = (obj: Record<string, number>): number => {
  const values = Object.values(obj)
  return Math.max(...values, 1)
}

export const TravelStatsCard: FC<TravelStatsCardProps> = ({ stats }) => {
  if (!stats) return null

  return (
    <View className="mb-4">
      <View className="flex items-center gap-2 mb-3">
        <Car size={18} color="#1890ff" />
        <Text className="text-base font-bold">出行偏好</Text>
      </View>

      {/* 出行方式分布 */}
      <Card className="rounded-xl mb-3">
        <CardContent className="p-4">
          <Text className="text-sm text-gray-500 mb-3">出行方式分布</Text>

          {/* 出行类型统计 */}
          <View className="flex items-center justify-around mb-4">
            {['taxi', 'train', 'flight'].map((type) => {
              const config = TRAVEL_TYPE_CONFIG[type]
              return (
                <View key={type} className="flex flex-col items-center">
                  <View
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                    style={{ backgroundColor: config?.bgColor || '#f5f5f5' }}
                  >
                    {getTravelIcon(type, 24)}
                  </View>
                  <Text className="text-lg font-bold">{stats.by_type[type as keyof typeof stats.by_type] || 0}</Text>
                  <Text className="text-xs text-gray-500">{config?.name || type}</Text>
                  <Text className="text-xs text-blue-500 mt-1">{getTravelPercentage(stats, type)}%</Text>
                </View>
              )
            })}
          </View>

          {/* 进度条展示 */}
          <View className="space-y-2">
            {['taxi', 'train', 'flight'].map((type) => {
              const config = TRAVEL_TYPE_CONFIG[type]
              const percentage = getTravelPercentage(stats, type)
              return (
                <View key={type} className="flex items-center gap-2">
                  <Text className="text-xs w-12">{config?.name || type}</Text>
                  <View className="flex-1">
                    <Progress value={percentage} className="h-2" />
                  </View>
                  <Text className="text-xs text-gray-500 w-10 text-right">{percentage}%</Text>
                </View>
              )
            })}
          </View>
        </CardContent>
      </Card>

      {/* 常去地点 */}
      {stats.top_locations.length > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <Text className="text-sm text-gray-500 mb-3">常去地点 Top 5</Text>
            {stats.top_locations.map((loc, idx) => (
              <View key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <View className="flex items-center gap-2">
                  <View
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: idx < 3 ? '#1890ff' : '#e5e5e5',
                      color: idx < 3 ? '#fff' : '#999',
                    }}
                  >
                    {idx + 1}
                  </View>
                  <MapPin size={14} color="#999" />
                  <Text className="text-sm">{loc.name}</Text>
                </View>
                <Text className="text-sm text-gray-500">{loc.count}次</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 时段分布 */}
      <Card className="rounded-xl mt-3">
        <CardContent className="p-4" style={{ overflow: 'hidden' }}>
          <View className="mb-3" style={{ minHeight: '20px' }}>
            <Text className="text-sm text-gray-500">出行时段分布</Text>
          </View>
          <View
            className="flex items-end justify-around"
            style={{ height: '100px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}
          >
            {Object.entries(stats.time_distribution).map(([key, value]) => {
              const config = TIME_PERIOD_CONFIG[key]
              const maxVal = getMaxValue(stats.time_distribution)
              const height = maxVal > 0 ? (value / maxVal) * 60 : 0
              return (
                <View key={key} className="flex flex-col items-center" style={{ minWidth: 0, flex: 1 }}>
                  <Text className="text-xs text-gray-500 mb-1">{value}</Text>
                  <View
                    className="rounded-t"
                    style={{
                      width: '24px',
                      maxWidth: '32px',
                      height: `${Math.max(height, 3.5)}px`,
                      backgroundColor: config?.color || '#999',
                    }}
                  />
                  <Text className="text-xs text-gray-400 mt-2" style={{ whiteSpace: 'nowrap' }}>
                    {config?.name || key}
                  </Text>
                </View>
              )
            })}
          </View>
        </CardContent>
      </Card>
    </View>
  )
}

export default TravelStatsCard
