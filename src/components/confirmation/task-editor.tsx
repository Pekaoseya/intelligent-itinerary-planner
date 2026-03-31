/**
 * 行程编辑器组件
 * 可调整时间、交通工具、任务名称
 */

import { View, Text, Input } from '@tarojs/components'
import { useState, useEffect, type FC } from 'react'
import Taro from '@tarojs/taro'
import { Clock, MapPin, TrainFront, Plane, Check } from 'lucide-react-taro'
import { TaskTypeIcon } from '@/components/task'
import { getTaskTypeName, type TaskType } from '@/types'
import type { TaskEditorProps, PendingTask } from './types'

// 出行方式选项
const TRANSPORT_OPTIONS: TaskType[] = ['taxi', 'train', 'flight']

// 其他任务类型选项
const OTHER_TASK_OPTIONS: TaskType[] = ['meeting', 'dining', 'hotel', 'todo']

// 格式化时间为表单值
const formatTimeForInput = (timeStr: string): string => {
  try {
    const date = new Date(timeStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

// 格式化时间为显示
const formatTimeForDisplay = (timeStr: string): string => {
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

// 解析表单时间
const parseInputTime = (value: string): string => {
  try {
    return new Date(value).toISOString()
  } catch {
    return ''
  }
}

export const TaskEditor: FC<TaskEditorProps> = ({
  task,
  onChange,
  editable = true,
  showLocation = true,
}) => {
  const [title, setTitle] = useState(task.title)
  const [scheduledTime, setScheduledTime] = useState(task.scheduled_time)
  const [selectedType, setSelectedType] = useState<TaskType>(task.type)

  // 同步外部变化
  useEffect(() => {
    setTitle(task.title)
    setScheduledTime(task.scheduled_time)
    setSelectedType(task.type)
  }, [task])

  // 更新任务
  const updateTask = (updates: Partial<PendingTask>) => {
    const newTask = { ...task, ...updates }
    onChange(newTask)
  }

  // 判断是否是出行类型
  const isTransportTask = TRANSPORT_OPTIONS.includes(task.type)

  // 获取可用的任务类型选项
  const getAvailableTypes = (): TaskType[] => {
    // 如果当前是出行类型，只显示出行选项
    if (isTransportTask) return TRANSPORT_OPTIONS
    // 否则显示其他任务类型
    return OTHER_TASK_OPTIONS
  }

  // 处理时间变更
  const handleTimeChange = (e: any) => {
    const value = e.detail.value
    setScheduledTime(parseInputTime(value))
    updateTask({ scheduled_time: parseInputTime(value) })
  }

  // 处理标题变更
  const handleTitleChange = (e: any) => {
    setTitle(e.detail.value)
    updateTask({ title: e.detail.value })
  }

  // 处理类型变更
  const handleTypeChange = (type: TaskType) => {
    setSelectedType(type)
    updateTask({ type })
  }

  return (
    <View className="w-full">
      {/* 任务名称 */}
      <View className="mb-4">
        <Text className="text-sm text-gray-500 mb-2 block">任务名称</Text>
        {editable ? (
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent text-base"
              value={title}
              onInput={handleTitleChange}
              placeholder="请输入任务名称"
              maxlength={50}
            />
          </View>
        ) : (
          <Text className="text-base font-medium">{task.title}</Text>
        )}
      </View>

      {/* 出行方式 / 任务类型 */}
      <View className="mb-4">
        <Text className="text-sm text-gray-500 mb-2 block">
          {isTransportTask ? '出行方式' : '任务类型'}
        </Text>
        <View className="flex flex-wrap gap-2">
          {getAvailableTypes().map((type) => {
            const isSelected = selectedType === type
            return (
              <View
                key={type}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
                onClick={() => editable && handleTypeChange(type)}
              >
                <TaskTypeIcon type={type} size={18} />
                <Text className={`text-sm ${isSelected ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                  {getTaskTypeName(type)}
                </Text>
                {isSelected && (
                  <View className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </View>

      {/* 出发时间 */}
      <View className="mb-4">
        <Text className="text-sm text-gray-500 mb-2 block">出发时间</Text>
        {editable ? (
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            {Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? (
              // 小程序端使用 picker
              <View
                className="flex items-center justify-between"
                onClick={() => {
                  Taro.showActionSheet({
                    itemList: ['选择日期时间'],
                    success: () => {
                      // 简化处理：直接修改时间
                      const now = new Date(scheduledTime || new Date())
                      now.setHours(now.getHours() + 1)
                      updateTask({ scheduled_time: now.toISOString() })
                      setScheduledTime(now.toISOString())
                      Taro.showToast({ title: '时间已调整', icon: 'success' })
                    }
                  })
                }}
              >
                <Text className="text-base">{formatTimeForDisplay(scheduledTime)}</Text>
                <Clock size={18} color="#1890ff" />
              </View>
            ) : (
              // H5 端使用 datetime-local
              <input
                type="datetime-local"
                value={formatTimeForInput(scheduledTime)}
                onChange={(e: any) => handleTimeChange({ detail: { value: e.target.value } })}
                className="w-full bg-transparent text-base outline-none"
              />
            )}
          </View>
        ) : (
          <View className="flex items-center gap-2">
            <Clock size={18} color="#1890ff" />
            <Text className="text-base">{formatTimeForDisplay(scheduledTime)}</Text>
          </View>
        )}
      </View>

      {/* 地点信息 */}
      {showLocation && (task.location_name || task.destination_name) && (
        <View className="mb-4">
          <Text className="text-sm text-gray-500 mb-2 block">地点信息</Text>
          <View className="flex flex-col gap-2">
            {task.location_name && (
              <View className="flex items-start gap-2">
                <MapPin size={16} color="#faad14" className="flex-shrink-0 mt-1" />
                <Text className="text-sm text-gray-600">{task.location_name}</Text>
              </View>
            )}
            {task.destination_name && (
              <View className="flex items-start gap-2">
                <MapPin size={16} color="#52c41a" className="flex-shrink-0 mt-1" />
                <Text className="text-sm text-gray-600">{task.destination_name}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 额外信息 */}
      {task.metadata && (
        <View className="bg-gray-50 rounded-xl p-3">
          {task.metadata.train_number && (
            <View className="flex items-center gap-2 mb-2">
              <TrainFront size={16} color="#1890ff" />
              <Text className="text-sm">车次: {task.metadata.train_number}</Text>
              {task.metadata.seat_type && (
                <Text className="text-sm text-gray-500">({task.metadata.seat_type})</Text>
              )}
            </View>
          )}
          {task.metadata.flight_number && (
            <View className="flex items-center gap-2 mb-2">
              <Plane size={16} color="#722ed1" />
              <Text className="text-sm">航班: {task.metadata.flight_number}</Text>
              {task.metadata.seat_type && (
                <Text className="text-sm text-gray-500">({task.metadata.seat_type})</Text>
              )}
            </View>
          )}
          {task.metadata.cost && (
            <View className="flex items-center gap-2 mb-2">
              <Text className="text-sm text-gray-500">预估费用:</Text>
              <Text className="text-sm font-medium text-orange-500">¥{task.metadata.cost}</Text>
            </View>
          )}
          {task.metadata.duration && (
            <View className="flex items-center gap-2">
              <Text className="text-sm text-gray-500">预计时长:</Text>
              <Text className="text-sm font-medium">{Math.round(task.metadata.duration / 60)}分钟</Text>
            </View>
          )}
          {task.metadata.tip && (
            <View className="mt-2 pt-2 border-t border-gray-200">
              <Text className="text-xs text-blue-500">💡 {task.metadata.tip}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export default TaskEditor
