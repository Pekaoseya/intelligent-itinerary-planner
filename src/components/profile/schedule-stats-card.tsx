/**
 * 日程习惯统计卡片组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Calendar, Clock, Check } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { ScheduleStats } from '@/types'
import { WEEKDAY_CONFIG } from '@/types'

export interface ScheduleStatsCardProps {
  stats: ScheduleStats | null
}

// 获取最大值
const getMaxValue = (obj: Record<string, number>): number => {
  const values = Object.values(obj)
  return Math.max(...values, 1)
}

export const ScheduleStatsCard: FC<ScheduleStatsCardProps> = ({ stats }) => {
  if (!stats) return null

  return (
    <View className="mb-4">
      <View className="flex items-center gap-2 mb-3">
        <Calendar size={18} color="#52c41a" />
        <Text className="text-base font-bold">日程习惯</Text>
      </View>

      {/* 完成率统计 */}
      <Card className="rounded-xl mb-3">
        <CardContent className="p-4">
          {/* 完成率 */}
          <View className="flex items-center justify-between mb-4">
            <View>
              <Text className="text-sm text-gray-500">任务完成率</Text>
              <Text className="text-2xl font-bold text-green-500">{stats.completion_rate || 0}%</Text>
            </View>
            <View className="w-16 h-16">
              <Progress value={stats.completion_rate || 0} className="h-4" />
            </View>
          </View>

          {/* 本月会议 */}
          <View className="flex items-center justify-between py-3 border-t border-gray-100">
            <View className="flex items-center gap-2">
              <Clock size={16} color="#1890ff" />
              <Text className="text-sm">本月会议</Text>
            </View>
            <Badge variant="secondary">{stats.meetings_this_month || 0} 场</Badge>
          </View>

          {/* 总任务/已完成 */}
          <View className="flex items-center justify-between py-3 border-t border-gray-100">
            <View className="flex items-center gap-2">
              <Check size={16} color="#52c41a" />
              <Text className="text-sm">已完成 / 总任务</Text>
            </View>
            <Text className="text-sm font-medium">{stats.completed || 0} / {stats.total_tasks || 0}</Text>
          </View>
        </CardContent>
      </Card>

      {/* 一周分布 */}
      <Card className="rounded-xl">
        <CardContent className="p-4" style={{ overflow: 'hidden' }}>
          <View className="mb-3" style={{ minHeight: '20px' }}>
            <Text className="text-sm text-gray-500">一周任务分布</Text>
          </View>
          <View
            className="flex items-end justify-around"
            style={{ height: '90px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}
          >
            {Object.entries(stats.by_weekday).map(([key, value]) => {
              const config = WEEKDAY_CONFIG[key]
              const maxVal = getMaxValue(stats.by_weekday)
              const height = maxVal > 0 ? (value / maxVal) * 45 : 0
              return (
                <View key={key} className="flex flex-col items-center" style={{ minWidth: 0, flex: 1 }}>
                  <Text className="text-xs text-gray-500 mb-2">{value}</Text>
                  <View
                    className="rounded-t"
                    style={{
                      width: '24px',
                      maxWidth: '32px',
                      height: `${Math.max(height, 4)}px`,
                      backgroundColor: config?.isWeekend ? '#ff7875' : '#1890ff',
                    }}
                  />
                  <Text className={`text-xs mt-2 ${config?.isWeekend ? 'text-red-400' : 'text-gray-400'}`} style={{ whiteSpace: 'nowrap' }}>
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

export default ScheduleStatsCard
