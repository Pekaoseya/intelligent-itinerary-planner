/**
 * 趋势图表组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { TrendingUp } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import type { TrendStats } from '@/types'

export interface TrendChartProps {
  stats: TrendStats | null
}

export const TrendChart: FC<TrendChartProps> = ({ stats }) => {
  if (!stats || stats.last_7_days.length === 0) return null

  const maxVal = Math.max(...stats.last_7_days.map((d) => d.count), 1)

  return (
    <View className="mb-4">
      <View className="flex items-center gap-2 mb-3">
        <TrendingUp size={18} color="#722ed1" />
        <Text className="text-base font-bold">最近7天趋势</Text>
      </View>

      <Card className="rounded-xl">
        <CardContent className="p-4" style={{ overflow: 'hidden' }}>
          <View
            className="flex items-end justify-around"
            style={{ height: '90px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}
          >
            {stats.last_7_days.map((day, idx) => {
              const height = (day.count / maxVal) * 45
              return (
                <View key={idx} className="flex flex-col items-center" style={{ minWidth: 0, flex: 1 }}>
                  <Text className="text-xs text-gray-500 mb-2">{day.count}</Text>
                  <View
                    className="rounded-t bg-purple-400"
                    style={{
                      width: '24px',
                      maxWidth: '32px',
                      height: `${Math.max(height, 4)}px`
                    }}
                  />
                  <Text className="text-xs text-gray-400 mt-2" style={{ whiteSpace: 'nowrap' }}>{day.date}</Text>
                </View>
              )
            })}
          </View>
        </CardContent>
      </Card>
    </View>
  )
}

export default TrendChart
