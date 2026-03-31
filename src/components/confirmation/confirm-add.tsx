/**
 * 新增确认组件
 * 用户可以调整行程细节后确认新增
 */

import { View, Text, ScrollView } from '@tarojs/components'
import { useState, type FC } from 'react'
import { Plus, X } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { TaskEditor } from './task-editor'
import type { ConfirmProps, PendingTask } from './types'

export const ConfirmAdd: FC<ConfirmProps> = ({
  task,
  createdCount,
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

  // 显示创建的任务数量
  const countText = createdCount && createdCount > 1 
    ? `AI 已为您生成 ${createdCount} 个行程，点击取消可撤销全部` 
    : 'AI 已为您生成以下行程，请确认或调整后提交'

  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <Plus size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">
            {createdCount && createdCount > 1 ? `新增日程确认 (${createdCount}个)` : '新增日程确认'}
          </Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 内容区域 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '60vh' }}>
        <View className="mb-4">
          <Text className="text-sm text-gray-400">{countText}</Text>
        </View>

        <TaskEditor
          task={editedTask}
          onChange={setEditedTask}
          editable
          showLocation
        />
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex gap-3 px-4 py-4 border-t border-gray-100">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          <Text className="text-gray-600">{createdCount && createdCount > 1 ? '取消全部' : '取消'}</Text>
        </Button>
        <Button
          className="flex-1 bg-green-500"
          onClick={handleConfirm}
        >
          <Plus size={16} color="#fff" />
          <Text className="text-white ml-1">确认新增</Text>
        </Button>
      </View>
    </View>
  )
}

export default ConfirmAdd
