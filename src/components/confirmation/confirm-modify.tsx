/**
 * 修改确认组件
 * 显示原计划 vs 修改后对比，用户可调整后确认修改
 */

import { View, Text, ScrollView } from '@tarojs/components'
import { useState, type FC } from 'react'
import { ArrowRight, X, Clock, MapPin } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TaskTypeIcon } from '@/components/task'
import { TaskEditor } from './task-editor'
import type { ConfirmProps, PendingTask } from './types'

// 格式化时间显示
const formatTimeDisplay = (timeStr: string): string => {
  try {
    const date = new Date(timeStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hours}:${minutes}`
  } catch {
    return '--'
  }
}

export const ConfirmModify: FC<ConfirmProps> = ({
  task,
  originalTask,
  onConfirm,
  onCancel,
}) => {
  const [editedTask, setEditedTask] = useState<PendingTask>(task)

  const handleConfirm = () => {
    // 验证必填字段
    if (!editedTask.title.trim()) {
      Taro.showToast({ title: '请输入任务名称', icon: 'none' })
      return
    }
    if (!editedTask.scheduled_time) {
      Taro.showToast({ title: '请选择出发时间', icon: 'none' })
      return
    }
    onConfirm(editedTask)
  }

  // 检测变化
  const hasTimeChanged = originalTask && originalTask.scheduled_time !== editedTask.scheduled_time
  const hasTypeChanged = originalTask && originalTask.type !== editedTask.type
  const hasTitleChanged = originalTask && originalTask.title !== editedTask.title

  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <ArrowRight size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">修改日程确认</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 内容区域 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '60vh' }}>
        {/* 原计划 */}
        {originalTask && (
          <View className="mb-4">
            <Text className="text-sm text-gray-400 mb-2">原计划</Text>
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-3">
                <View className="flex items-center gap-2 mb-2">
                  <TaskTypeIcon type={originalTask.type} size={18} />
                  <Text className="text-base font-medium text-gray-600">{originalTask.title}</Text>
                </View>
                <View className="flex items-center gap-4">
                  <View className="flex items-center gap-1">
                    <Clock size={14} color="#999" />
                    <Text className="text-sm text-gray-500">{formatTimeDisplay(originalTask.scheduled_time)}</Text>
                  </View>
                  {originalTask.destination_name && (
                    <View className="flex items-center gap-1">
                      <MapPin size={14} color="#999" />
                      <Text className="text-sm text-gray-500">{originalTask.destination_name}</Text>
                    </View>
                  )}
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* 变化提示 */}
        {(hasTimeChanged || hasTypeChanged || hasTitleChanged) && (
          <View className="flex items-center justify-center mb-4">
            <View className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
              <ArrowRight size={16} color="#1890ff" />
              <Text className="text-sm text-blue-500">修改为</Text>
            </View>
          </View>
        )}

        {/* 修改后的编辑器 */}
        <View className="mb-4">
          <Text className="text-sm text-gray-400 mb-2">修改后</Text>
          <TaskEditor
            task={editedTask}
            onChange={setEditedTask}
            editable
            showLocation
          />
        </View>
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
          className="flex-1 bg-blue-500"
          onClick={handleConfirm}
        >
          <ArrowRight size={16} color="#fff" />
          <Text className="text-white ml-1">确认修改</Text>
        </Button>
      </View>
    </View>
  )
}

export default ConfirmModify
