/**
 * 任务卡片组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { MapPin, Check } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getTaskTypeColor, getTaskTypeName } from '@/types'
import type { Task } from '@/types'
import { TaskTypeIcon } from './task-type-icon'

export interface TaskCardProps {
  task: Task
  onViewDetail: (task: Task) => void
}

// 格式化时间
const formatTime = (timeStr?: string | null): string => {
  if (!timeStr) return '--:--'
  try {
    const date = new Date(timeStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch {
    return '--:--'
  }
}

export const TaskCard: FC<TaskCardProps> = ({ task, onViewDetail }) => {
  const typeColor = getTaskTypeColor(task.type)
  const isCompleted = task.status === 'completed'

  return (
    <Card
      className={`rounded-xl overflow-hidden ${isCompleted ? 'opacity-60' : ''} ${task.is_expired ? 'border-red-200' : ''}`}
      style={{ maxWidth: '100vw' }}
    >
      <CardContent className="p-0" style={{ maxWidth: '100%' }}>
        <View className="flex items-start p-3" style={{ maxWidth: '100%' }}>
          {/* 时间和图标 */}
          <View className="flex flex-col items-center mr-3" style={{ width: '50px', flexShrink: 0 }}>
            <Text className="text-sm font-medium text-gray-700">{formatTime(task.scheduled_time)}</Text>
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center mt-2"
              style={{ backgroundColor: `${typeColor}15` }}
            >
              {isCompleted ? <Check size={20} color="#52c41a" /> : <TaskTypeIcon type={task.type} />}
            </View>
          </View>

          {/* 内容 */}
          <View className="flex-1" style={{ minWidth: 0, maxWidth: '100%' }}>
            <View className="flex items-center gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
              <Text
                className={`text-base font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                style={{ wordBreak: 'break-all' }}
              >
                {task.title}
              </Text>
              <View className="px-2 py-1 rounded" style={{ backgroundColor: `${typeColor}15` }}>
                <Text className="text-xs" style={{ color: typeColor }}>{getTaskTypeName(task.type)}</Text>
              </View>
              {task.is_expired && (
                <View className="px-2 py-1 rounded bg-red-100">
                  <Text className="text-xs text-red-500">已过期</Text>
                </View>
              )}
            </View>

            {/* 地点信息 */}
            {task.destination_name && (
              <Text className="text-xs text-gray-500 mb-1" style={{ wordBreak: 'break-all' }}>
                {task.destination_name}
              </Text>
            )}
            {task.location_name && (
              <View className="flex items-center gap-1">
                <MapPin size={12} color="#999" />
                <Text className="text-xs text-gray-400" style={{ wordBreak: 'break-all' }}>
                  {task.location_name}
                </Text>
              </View>
            )}
          </View>

          {/* 操作按钮 */}
          <View className="ml-2 flex gap-1" style={{ flexShrink: 0 }}>
            <Button size="sm" className="rounded-full px-3" onClick={() => onViewDetail(task)}>
              <Text className="text-xs text-white">{isCompleted ? '详情' : '操作'}</Text>
            </Button>
          </View>
        </View>
      </CardContent>
    </Card>
  )
}

export default TaskCard
