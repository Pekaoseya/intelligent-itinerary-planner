/**
 * 删除确认组件
 * 只读展示待删除任务，用户确认后执行删除
 */

import { View, Text, ScrollView } from '@tarojs/components'
import { type FC } from 'react'
import { Trash2, X, Clock, MapPin, CircleAlert } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TaskTypeIcon } from '@/components/task'
import { getTaskTypeName } from '@/types'
import type { ConfirmProps } from './types'

// 格式化时间显示
const formatTimeDisplay = (timeStr: string): string => {
  try {
    const date = new Date(timeStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${month}月${day}日 ${weekdays[date.getDay()]} ${hours}:${minutes}`
  } catch {
    return '--'
  }
}

export const ConfirmDelete: FC<ConfirmProps> = ({
  task,
  onConfirm,
  onCancel,
}) => {
  const handleConfirm = () => {
    onConfirm(task)
  }

  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">删除日程确认</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 内容区域 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '60vh' }}>
        {/* 警告提示 */}
        <View className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 rounded-lg">
          <CircleAlert size={18} color="#ff4d4f" />
          <Text className="text-sm text-red-500">确定要删除以下日程吗？此操作不可恢复</Text>
        </View>

        {/* 任务信息卡片（只读） */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            {/* 任务类型和名称 */}
            <View className="flex items-center gap-2 mb-3">
              <TaskTypeIcon type={task.type} size={24} />
              <Text className="text-lg font-bold">{task.title}</Text>
            </View>

            {/* 任务类型标签 */}
            <View className="mb-3">
              <View className="inline-block px-2 py-1 bg-gray-200 rounded">
                <Text className="text-xs text-gray-600">{getTaskTypeName(task.type)}</Text>
              </View>
            </View>

            {/* 时间 */}
            <View className="flex items-center gap-2 mb-2">
              <Clock size={16} color="#999" />
              <Text className="text-sm text-gray-600">{formatTimeDisplay(task.scheduled_time)}</Text>
            </View>

            {/* 起点 */}
            {task.location_name && (
              <View className="flex items-start gap-2 mb-2">
                <MapPin size={16} color="#faad14" className="flex-shrink-0 mt-1" />
                <Text className="text-sm text-gray-600">{task.location_name}</Text>
              </View>
            )}

            {/* 终点 */}
            {task.destination_name && (
              <View className="flex items-start gap-2 mb-2">
                <MapPin size={16} color="#52c41a" className="flex-shrink-0 mt-1" />
                <Text className="text-sm text-gray-600">{task.destination_name}</Text>
              </View>
            )}

            {/* 额外信息 */}
            {task.metadata && (
              <View className="mt-3 pt-3 border-t border-red-200">
                {task.metadata.train_number && (
                  <Text className="text-sm text-gray-500 mb-1 block">
                    车次: {task.metadata.train_number}
                  </Text>
                )}
                {task.metadata.flight_number && (
                  <Text className="text-sm text-gray-500 mb-1 block">
                    航班: {task.metadata.flight_number}
                  </Text>
                )}
                {task.metadata.cost && (
                  <Text className="text-sm text-gray-500 mb-1 block">
                    预估费用: ¥{task.metadata.cost}
                  </Text>
                )}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex gap-3 px-4 py-4 border-t border-gray-100">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button
          className="flex-1 bg-red-500"
          onClick={handleConfirm}
        >
          <Trash2 size={16} color="#fff" />
          <Text className="text-white ml-1">确认删除</Text>
        </Button>
      </View>
    </View>
  )
}

export default ConfirmDelete
