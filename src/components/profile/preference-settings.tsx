/**
 * 智能推荐设置组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Settings, Car, Bell } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Network } from '@/network'
import type { UserPreferences } from '@/types'
import { TRAVEL_TYPE_CONFIG } from '@/types'

export interface PreferenceSettingsProps {
  preferences: UserPreferences
  onUpdate: (preferences: UserPreferences) => void
}

export const PreferenceSettings: FC<PreferenceSettingsProps> = ({ preferences, onUpdate }) => {
  // 更新偏好设置
  const updatePreferences = async (key: keyof UserPreferences, value: string | number | boolean) => {
    try {
      const params = new URLSearchParams()
      params.append(key, String(value))
      await Network.request({
        url: `/api/stats/preferences/update?${params.toString()}`,
        method: 'GET',
      })
      onUpdate({ ...preferences, [key]: value })
      Taro.showToast({ title: '已更新', icon: 'success' })
    } catch (error) {
      console.error('更新偏好失败:', error)
      Taro.showToast({ title: '更新失败', icon: 'error' })
    }
  }

  return (
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
              {['taxi', 'train', 'flight'].map((type) => {
                const config = TRAVEL_TYPE_CONFIG[type]
                const isSelected = preferences.default_travel_type === type
                return (
                  <View
                    key={type}
                    className={`px-3 py-1 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-gray-100'}`}
                    onClick={() => updatePreferences('default_travel_type', type)}
                  >
                    <Text className={`text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                      {config?.name || type}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* 提醒时间 */}
          <View className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <View className="flex items-center gap-2">
              <Bell size={18} color="#1890ff" />
              <Text className="text-sm">提前提醒时间</Text>
            </View>
            <View className="flex gap-2">
              {[15, 30, 60].map((mins) => {
                const isSelected = preferences.reminder_minutes === mins
                return (
                  <View
                    key={mins}
                    className={`px-3 py-1 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-gray-100'}`}
                    onClick={() => updatePreferences('reminder_minutes', mins)}
                  >
                    <Text className={`text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                      {mins}分钟
                    </Text>
                  </View>
                )
              })}
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
  )
}

export default PreferenceSettings
