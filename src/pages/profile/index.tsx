import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { User, Car, TrainFront, Plane, MapPin, Calendar, Check, Clock, Settings, TrendingUp, Bell } from 'lucide-react-taro'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import './index.css'

// =============================================
// 类型定义
// =============================================

interface TravelStats {
  total_trips: number
  by_type: { taxi: number; train: number; flight: number }
  top_locations: { name: string; count: number }[]
  time_distribution: { morning: number; afternoon: number; evening: number; night: number }
}

interface ScheduleStats {
  total_tasks: number
  completed: number
  completion_rate: number
  meetings_this_month: number
  by_weekday: { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number }
  by_type: Record<string, number>
}

interface TrendStats {
  last_7_days: { date: string; count: number }[]
}

interface UserPreferences {
  default_travel_type: string
  reminder_minutes: number
  notification_enabled: boolean
}

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
  
  // 底部偏移 - 设为0，由系统自动处理
  // 注意：小程序 TabBar 会自动预留空间，fixed 元素 bottom: 0 即可
  const bottomOffset = 0
  
  // 获取屏幕信息，用于计算 ScrollView 高度
  // 小程序端 ScrollView 需要明确高度，flex-1 不生效
  const systemInfo = Taro.getSystemInfoSync()
  const headerHeight = 160 // 头部蓝色区域大约高度（px）
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

  // 更新偏好设置
  const updatePreferences = async (key: keyof UserPreferences, value: any) => {
    try {
      const params = new URLSearchParams()
      params.append(key, String(value))
      await Network.request({
        url: `/api/stats/preferences/update?${params.toString()}`,
        method: 'GET',
      })
      setPreferences(prev => ({ ...prev, [key]: value }))
      Taro.showToast({ title: '已更新', icon: 'success' })
    } catch (error) {
      console.error('更新偏好失败:', error)
      Taro.showToast({ title: '更新失败', icon: 'error' })
    }
  }

  // 获取出行类型图标
  const getTravelIcon = (type: string, size = 16) => {
    switch (type) {
      case 'taxi': return <Car size={size} color="#faad14" />
      case 'train': return <TrainFront size={size} color="#1890ff" />
      case 'flight': return <Plane size={size} color="#722ed1" />
      default: return <Car size={size} color="#999" />
    }
  }

  // 获取出行类型名称
  const getTravelName = (type: string) => {
    const names: Record<string, string> = {
      taxi: '打车',
      train: '高铁',
      flight: '飞机',
    }
    return names[type] || type
  }

  // 计算出行类型占比
  const getTravelPercentage = (type: string) => {
    if (!travelStats) return 0
    const total = travelStats.by_type.taxi + travelStats.by_type.train + travelStats.by_type.flight
    return total > 0 ? Math.round((travelStats.by_type[type as keyof typeof travelStats.by_type] / total) * 100) : 0
  }

  // 获取最大值（用于柱状图）
  const getMaxValue = (obj: Record<string, number>) => {
    const values = Object.values(obj)
    return Math.max(...values, 1)
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
        style={{ height: `${scrollViewHeight}px`, width: '100%', maxWidth: '100vw', overflowX: 'hidden', paddingBottom: `${bottomOffset + 20}px` }}
      >
        <View className="w-full px-4 py-4 box-border">
          {loading ? (
            <View className="flex items-center justify-center py-12">
              <Text className="text-gray-400">加载中...</Text>
            </View>
          ) : (
            <>
              {/* 出行偏好统计 */}
              <View className="mb-4">
                <View className="flex items-center gap-2 mb-3">
                  <Car size={18} color="#1890ff" />
                  <Text className="text-base font-bold">出行偏好</Text>
                </View>
                
                <Card className="rounded-xl mb-3">
                  <CardContent className="p-4">
                    <Text className="text-sm text-gray-500 mb-3">出行方式分布</Text>
                    
                    {/* 出行类型统计 */}
                    <View className="flex items-center justify-around mb-4">
                      {['taxi', 'train', 'flight'].map(type => (
                        <View key={type} className="flex flex-col items-center">
                          <View 
                            className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                            style={{ 
                              backgroundColor: type === 'taxi' ? '#fff7e6' : type === 'train' ? '#e6f7ff' : '#f9f0ff' 
                            }}
                          >
                            {getTravelIcon(type, 24)}
                          </View>
                          <Text className="text-lg font-bold">{travelStats?.by_type[type as keyof typeof travelStats.by_type] || 0}</Text>
                          <Text className="text-xs text-gray-500">{getTravelName(type)}</Text>
                          <Text className="text-xs text-blue-500 mt-1">{getTravelPercentage(type)}%</Text>
                        </View>
                      ))}
                    </View>

                    {/* 进度条展示 */}
                    <View className="space-y-2">
                      {['taxi', 'train', 'flight'].map(type => (
                        <View key={type} className="flex items-center gap-2">
                          <Text className="text-xs w-12">{getTravelName(type)}</Text>
                          <View className="flex-1">
                            <Progress 
                              value={getTravelPercentage(type)} 
                              className="h-2"
                            />
                          </View>
                          <Text className="text-xs text-gray-500 w-10 text-right">{getTravelPercentage(type)}%</Text>
                        </View>
                      ))}
                    </View>
                  </CardContent>
                </Card>

                {/* 常去地点 */}
                {travelStats && travelStats.top_locations.length > 0 && (
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <Text className="text-sm text-gray-500 mb-3">常去地点 Top 5</Text>
                      {travelStats.top_locations.map((loc, idx) => (
                        <View key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <View className="flex items-center gap-2">
                            <View 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ 
                                backgroundColor: idx < 3 ? '#1890ff' : '#e5e5e5',
                                color: idx < 3 ? '#fff' : '#999'
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
                  <CardContent className="p-4">
                    <Text className="text-sm text-gray-500 mb-3">出行时段分布</Text>
                    <View className="flex items-end justify-around h-24">
                      {travelStats && Object.entries(travelStats.time_distribution).map(([key, value]) => {
                        const maxVal = getMaxValue(travelStats.time_distribution)
                        const height = maxVal > 0 ? (value / maxVal) * 80 : 0
                        return (
                          <View key={key} className="flex flex-col items-center">
                            <Text className="text-xs text-gray-500 mb-1">{value}</Text>
                            <View 
                              className="w-8 rounded-t"
                              style={{ 
                                height: `${height}px`,
                                backgroundColor: key === 'morning' ? '#faad14' : key === 'afternoon' ? '#1890ff' : key === 'evening' ? '#722ed1' : '#52c41a'
                              }}
                            />
                            <Text className="text-xs text-gray-400 mt-2">{key === 'morning' ? '上午' : key === 'afternoon' ? '下午' : key === 'evening' ? '晚间' : '凌晨'}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </CardContent>
                </Card>
              </View>

              {/* 日程习惯统计 */}
              <View className="mb-4">
                <View className="flex items-center gap-2 mb-3">
                  <Calendar size={18} color="#52c41a" />
                  <Text className="text-base font-bold">日程习惯</Text>
                </View>

                <Card className="rounded-xl mb-3">
                  <CardContent className="p-4">
                    {/* 完成率 */}
                    <View className="flex items-center justify-between mb-4">
                      <View>
                        <Text className="text-sm text-gray-500">任务完成率</Text>
                        <Text className="text-2xl font-bold text-green-500">{scheduleStats?.completion_rate || 0}%</Text>
                      </View>
                      <View className="w-16 h-16">
                        <Progress value={scheduleStats?.completion_rate || 0} className="h-4" />
                      </View>
                    </View>

                    {/* 本月会议 */}
                    <View className="flex items-center justify-between py-3 border-t border-gray-100">
                      <View className="flex items-center gap-2">
                        <Clock size={16} color="#1890ff" />
                        <Text className="text-sm">本月会议</Text>
                      </View>
                      <Badge variant="secondary">{scheduleStats?.meetings_this_month || 0} 场</Badge>
                    </View>

                    {/* 总任务/已完成 */}
                    <View className="flex items-center justify-between py-3 border-t border-gray-100">
                      <View className="flex items-center gap-2">
                        <Check size={16} color="#52c41a" />
                        <Text className="text-sm">已完成 / 总任务</Text>
                      </View>
                      <Text className="text-sm font-medium">{scheduleStats?.completed || 0} / {scheduleStats?.total_tasks || 0}</Text>
                    </View>
                  </CardContent>
                </Card>

                {/* 一周分布 */}
                <Card className="rounded-xl">
                  <CardContent className="p-4">
                    <Text className="text-sm text-gray-500 mb-3">一周任务分布</Text>
                    <View className="flex items-end justify-around h-20">
                      {scheduleStats && Object.entries(scheduleStats.by_weekday).map(([key, value]) => {
                        const maxVal = getMaxValue(scheduleStats.by_weekday)
                        const height = maxVal > 0 ? (value / maxVal) * 60 : 0
                        const isWeekend = key === 'sat' || key === 'sun'
                        return (
                          <View key={key} className="flex flex-col items-center">
                            <Text className="text-xs text-gray-500 mb-1">{value}</Text>
                            <View 
                              className="w-6 rounded-t"
                              style={{ 
                                height: `${height}px`,
                                backgroundColor: isWeekend ? '#ff7875' : '#1890ff'
                              }}
                            />
                            <Text className={`text-xs mt-2 ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                              {key === 'mon' ? '一' : key === 'tue' ? '二' : key === 'wed' ? '三' : key === 'thu' ? '四' : key === 'fri' ? '五' : key === 'sat' ? '六' : '日'}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  </CardContent>
                </Card>
              </View>

              {/* 智能推荐设置 */}
              <View className="mb-4">
                <View className="flex items-center gap-2 mb-3">
                  <Settings size={18} color="#faad14" />
                  <Text className="text-base font-bold">智能推荐设置</Text>
                </View>

                <Card className="rounded-xl">
                  <CardContent className="p-0">
                    {/* 默认出行方式 */}
                    <View className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                      <View className="flex items-center gap-2">
                        <Car size={18} color="#faad14" />
                        <Text className="text-sm">默认出行方式</Text>
                      </View>
                      <View className="flex gap-2">
                        {['taxi', 'train', 'flight'].map(type => (
                          <View 
                            key={type}
                            className={`px-3 py-1 rounded-full ${preferences.default_travel_type === type ? 'bg-blue-500' : 'bg-gray-100'}`}
                            onClick={() => updatePreferences('default_travel_type', type)}
                          >
                            <Text className={`text-xs ${preferences.default_travel_type === type ? 'text-white' : 'text-gray-600'}`}>
                              {getTravelName(type)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* 提醒时间 */}
                    <View className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                      <View className="flex items-center gap-2">
                        <Bell size={18} color="#1890ff" />
                        <Text className="text-sm">提前提醒时间</Text>
                      </View>
                      <View className="flex gap-2">
                        {[15, 30, 60].map(mins => (
                          <View 
                            key={mins}
                            className={`px-3 py-1 rounded-full ${preferences.reminder_minutes === mins ? 'bg-blue-500' : 'bg-gray-100'}`}
                            onClick={() => updatePreferences('reminder_minutes', mins)}
                          >
                            <Text className={`text-xs ${preferences.reminder_minutes === mins ? 'text-white' : 'text-gray-600'}`}>
                              {mins}分钟
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* 通知开关 */}
                    <View className="flex items-center justify-between px-4 py-4">
                      <View className="flex items-center gap-2">
                        <Bell size={18} color="#52c41a" />
                        <Text className="text-sm">消息通知</Text>
                      </View>
                      <Switch
                        checked={preferences.notification_enabled}
                        onCheckedChange={(checked) => updatePreferences('notification_enabled', checked)}
                      />
                    </View>
                  </CardContent>
                </Card>
              </View>

              {/* 7天趋势 */}
              {trendStats && trendStats.last_7_days.length > 0 && (
                <View className="mb-4">
                  <View className="flex items-center gap-2 mb-3">
                    <TrendingUp size={18} color="#722ed1" />
                    <Text className="text-base font-bold">最近7天趋势</Text>
                  </View>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <View className="flex items-end justify-around h-20">
                        {trendStats.last_7_days.map((day, idx) => {
                          const maxVal = Math.max(...trendStats.last_7_days.map(d => d.count), 1)
                          const height = (day.count / maxVal) * 60
                          return (
                            <View key={idx} className="flex flex-col items-center">
                              <Text className="text-xs text-gray-500 mb-1">{day.count}</Text>
                              <View 
                                className="w-6 rounded-t bg-purple-400"
                                style={{ height: `${height}px` }}
                              />
                              <Text className="text-xs text-gray-400 mt-2">{day.date}</Text>
                            </View>
                          )
                        })}
                      </View>
                    </CardContent>
                  </Card>
                </View>
              )}

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
