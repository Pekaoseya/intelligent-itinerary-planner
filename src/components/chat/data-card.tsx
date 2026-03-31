/**
 * 数据卡片组件
 * 用于显示消息中的任务数据
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { MapPin, Trash2, Car, TrainFront, Plane, Users, Utensils, Building2, Clock } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import type { Task, TaskType } from '@/types'

// =============================================
// 辅助函数
// =============================================

const getTaskIcon = (type: TaskType, size = 20) => {
  switch (type) {
    case 'taxi': return <Car size={size} color="#faad14" />
    case 'train': return <TrainFront size={size} color="#1890ff" />
    case 'flight': return <Plane size={size} color="#722ed1" />
    case 'meeting': return <Users size={size} color="#1890ff" />
    case 'dining': return <Utensils size={size} color="#faad14" />
    case 'hotel': return <Building2 size={size} color="#722ed1" />
    default: return <Clock size={size} color="#52c41a" />
  }
}

const getTaskTypeName = (type: TaskType): string => {
  const names: Record<TaskType, string> = {
    taxi: '打车',
    train: '火车',
    flight: '飞机',
    meeting: '会议',
    dining: '餐饮',
    hotel: '酒店',
    todo: '事务',
    other: '其他',
  }
  return names[type] || '任务'
}

const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '--:--'
  try {
    const date = new Date(timeStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch { return '--:--' }
}

const formatDate = (timeStr: string): string => {
  const date = new Date(timeStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return '今天'
  if (date.toDateString() === tomorrow.toDateString()) return '明天'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// =============================================
// 数据卡片组件
// =============================================

export interface DataCardProps {
  data: any
}

export const DataCard: FC<DataCardProps> = ({ data }) => {
  // 单个任务
  if (data.task) {
    const task: Task = data.task as Task
    return (
      <Card className="rounded-xl mt-2 overflow-hidden">
        <CardContent className="p-3">
          <View className="flex items-center gap-2 mb-2">
            {getTaskIcon(task.type)}
            <Text className="text-sm font-medium">{getTaskTypeName(task.type)}</Text>
            {task.is_expired && (
              <View className="px-2 py-1 rounded bg-red-100">
                <Text className="text-xs text-red-500">已过期</Text>
              </View>
            )}
          </View>
          <Text className="block text-base font-medium mb-1">{task.title}</Text>
          <View className="flex items-center gap-2 text-xs text-gray-500">
            <Text>{formatDate(task.scheduled_time)} {formatTime(task.scheduled_time)}</Text>
            {task.location_name && (
              <View className="flex items-center gap-1">
                <MapPin size={12} color="#999" />
                <Text>{task.location_name}</Text>
              </View>
            )}
          </View>
        </CardContent>
      </Card>
    )
  }

  // 删除的任务
  if (data.deleted) {
    const task = data.deleted
    return (
      <Card className="rounded-xl mt-2 overflow-hidden bg-red-50">
        <CardContent className="p-3">
          <View className="flex items-center gap-2 mb-2">
            <Trash2 size={16} color="#ff4d4f" />
            <Text className="text-sm font-medium text-red-500">已删除</Text>
          </View>
          <Text className="block text-base font-medium mb-1 line-through text-gray-400">{task.title}</Text>
        </CardContent>
      </Card>
    )
  }

  // 删除多个
  if (data.deletedCount) {
    return (
      <Card className="rounded-xl mt-2 overflow-hidden bg-red-50">
        <CardContent className="p-3">
          <View className="flex items-center gap-2">
            <Trash2 size={16} color="#ff4d4f" />
            <Text className="text-sm font-medium text-red-500">已删除 {data.deletedCount} 个任务</Text>
          </View>
        </CardContent>
      </Card>
    )
  }

  // 任务列表
  if (data.tasks && data.tasks.length > 0) {
    const tasks = data.tasks
    return (
      <View className="mt-2">
        <Text className="text-sm font-medium text-gray-700 mb-2">找到 {tasks.length} 个任务：</Text>
        {tasks.slice(0, 5).map((task: any, idx: number) => (
          <Card key={idx} className="rounded-lg mb-2">
            <CardContent className="p-2">
              <View className="flex items-center gap-2">
                {getTaskIcon(task.type, 16)}
                <View className="flex-1">
                  <Text className="text-sm font-medium">{task.title}</Text>
                  <Text className="text-xs text-gray-500">
                    {formatDate(task.scheduled_time)} {formatTime(task.scheduled_time)}
                  </Text>
                </View>
                {task.is_expired && (
                  <Text className="text-xs text-red-400">已过期</Text>
                )}
              </View>
            </CardContent>
          </Card>
        ))}
        {tasks.length > 5 && (
          <Text className="text-xs text-gray-400 text-center">还有 {tasks.length - 5} 个...</Text>
        )}
      </View>
    )
  }

  return null
}

export default DataCard
