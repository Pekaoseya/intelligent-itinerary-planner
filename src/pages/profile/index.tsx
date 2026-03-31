import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { User } from 'lucide-react-taro'
import { Network } from '@/network'
import { TravelStatsCard, ScheduleStatsCard, PreferenceSettings, TrendChart } from '@/components/profile'
import type { TravelStats, ScheduleStats, TrendStats, UserPreferences } from '@/types'
import './index.css'

// =============================================
// 主组件
// =============================================

const ProfilePage: FC = () => {
  const [travelStats, setTravelStats] = useState<TravelStats | null>(null)
  const [scheduleStats, setScheduleStats] = useState<ScheduleStats | null>(null)
  const [trendStats, setTrendStats] = useState<TrendStats | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences>({
    default_travel_type: 'taxi',
    reminder_minutes: 30,
    notification_enabled: true,
  })
  const [loading, setLoading] = useState(true)

  // 获取屏幕信息
  const systemInfo = Taro.getSystemInfoSync()
  const headerHeight = 160
  const scrollViewHeight = systemInfo.windowHeight - headerHeight

  useEffect(() => {
    fetchStats()
    fetchPreferences()
  }, [])

  // 获取统计数据
  const fetchStats = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/stats', method: 'GET' })
      if (res.data?.code === 200) {
        setTravelStats(res.data.data.travel)
        setScheduleStats(res.data.data.schedule)
        setTrendStats(res.data.data.trend)
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取偏好设置
  const fetchPreferences = async () => {
    try {
      const res = await Network.request({ url: '/api/stats/preferences', method: 'GET' })
      if (res.data?.code === 200) {
        setPreferences(res.data.data)
      }
    } catch (error) {
      console.error('获取偏好失败:', error)
    }
  }

  return (
    <View
      className="flex flex-col bg-gray-50"
      style={{ width: '100%', maxWidth: '100vw', height: '100%', backgroundColor: '#f5f5f5', boxSizing: 'border-box', overflow: 'hidden', overflowX: 'hidden' }}
    >
      {/* 用户信息卡片 */}
      <View className="flex-shrink-0 w-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-6 box-border">
        <View className="flex items-center w-full">
          <View className="w-16 h-16 rounded-full bg-white flex items-center justify-center mr-4 flex-shrink-0">
            <User size={32} color="#1890ff" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-xl font-bold text-white mb-1">智能出行助手</Text>
            <Text className="block text-sm text-blue-100">让出行更智能，让生活更便捷</Text>
          </View>
        </View>

        {/* 快速统计 */}
        {!loading && scheduleStats && (
          <View className="flex items-center justify-around mt-4 pt-4 border-t border-blue-400 border-opacity-30">
            <View className="flex flex-col items-center">
              <Text className="text-2xl font-bold text-white">{scheduleStats.total_tasks}</Text>
              <Text className="text-xs text-blue-100 mt-1">总任务</Text>
            </View>
            <View className="flex flex-col items-center">
              <Text className="text-2xl font-bold text-white">{scheduleStats.completed}</Text>
              <Text className="text-xs text-blue-100 mt-1">已完成</Text>
            </View>
            <View className="flex flex-col items-center">
              <Text className="text-2xl font-bold text-white">{scheduleStats.completion_rate}%</Text>
              <Text className="text-xs text-blue-100 mt-1">完成率</Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        scrollY
        className="w-full"
        style={{ height: `${scrollViewHeight}px`, width: '100%', maxWidth: '100vw', overflowX: 'hidden', paddingBottom: '80px' }}
      >
        <View className="w-full px-4 py-4 box-border">
          {loading ? (
            <View className="flex items-center justify-center py-12">
              <Text className="text-gray-400">加载中...</Text>
            </View>
          ) : (
            <>
              {/* 出行偏好统计 */}
              <TravelStatsCard stats={travelStats} />

              {/* 日程习惯统计 */}
              <ScheduleStatsCard stats={scheduleStats} />

              {/* 智能推荐设置 */}
              <PreferenceSettings preferences={preferences} onUpdate={setPreferences} />

              {/* 7天趋势 */}
              <TrendChart stats={trendStats} />

              {/* 版本信息 */}
              <View className="flex flex-col items-center py-4">
                <Text className="text-xs text-gray-400">版本 1.0.0</Text>
                <Text className="text-xs text-gray-400 mt-1">智能出行+日程记录助手</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default ProfilePage
