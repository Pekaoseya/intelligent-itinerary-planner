/**
 * 确认弹窗容器组件
 * 支持批量创建、批量删除、单个更新
 */

import { View, Text, ScrollView } from '@tarojs/components'
import { type FC } from 'react'
import { Plus, Trash2, X, Car, TrainFront, Plane, Users, Utensils, Building2, Check, Pencil } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import type { ConfirmModalProps, PendingTask } from './types'

// 任务类型图标映射
const getTaskIcon = (type: string) => {
  const icons: Record<string, any> = {
    taxi: Car,
    train: TrainFront,
    flight: Plane,
    meeting: Users,
    dining: Utensils,
    hotel: Building2,
    todo: Check,
    other: Check,
  }
  return icons[type] || Check
}

// 任务类型名称映射
const getTaskTypeName = (type: string) => {
  const names: Record<string, string> = {
    taxi: '打车',
    train: '火车',
    flight: '飞机',
    meeting: '会议',
    dining: '餐饮',
    hotel: '酒店',
    todo: '事务',
    other: '其他',
  }
  return names[type] || type
}

// 时间格式化
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 任务卡片组件
const TaskCard: FC<{ task: PendingTask }> = ({ task }) => {
  const Icon = getTaskIcon(task.type)
  
  return (
    <View className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-2">
      <View className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
        <Icon size={16} color="#3b82f6" />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex items-center gap-2 mb-1">
          <Text className="text-sm font-medium text-gray-900">{task.title}</Text>
          <Text className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            {getTaskTypeName(task.type)}
          </Text>
        </View>
        <View className="flex items-center gap-2 text-xs text-gray-500">
          <Text>{formatTime(task.scheduled_time)}</Text>
          {task.destination_name && (
            <>
              <Text>→</Text>
              <Text>{task.destination_name}</Text>
            </>
          )}
        </View>
        {task.conflictWarning && (
          <Text className="text-xs text-orange-500 mt-1">{task.conflictWarning}</Text>
        )}
      </View>
    </View>
  )
}

// 批量创建确认
const BatchAddConfirm: FC<{
  tasks: PendingTask[]
  onConfirm: () => void
  onCancel: () => void
}> = ({ tasks, onConfirm, onCancel }) => {
  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <Plus size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">新增日程确认</Text>
          <Text className="text-sm text-gray-500">({tasks.length}个)</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务列表 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '50vh' }}>
        <View className="mb-3">
          <Text className="text-sm text-gray-500">AI 为您规划了以下行程，确认后将添加到日程</Text>
        </View>
        {tasks.map((task, index) => (
          <TaskCard key={index} task={task} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex gap-3 px-4 py-4 border-t border-gray-100">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button className="flex-1 bg-green-500" onClick={onConfirm}>
          <Plus size={16} color="#fff" />
          <Text className="text-white ml-1">确认添加 ({tasks.length}个)</Text>
        </Button>
      </View>
    </View>
  )
}

// 批量删除确认
const BatchDeleteConfirm: FC<{
  tasks: any[]
  onConfirm: () => void
  onCancel: () => void
}> = ({ tasks, onConfirm, onCancel }) => {
  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">删除日程确认</Text>
          <Text className="text-sm text-gray-500">({tasks.length}个)</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务列表 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '50vh' }}>
        <View className="mb-3">
          <Text className="text-sm text-red-500">以下日程将被删除，此操作不可恢复</Text>
        </View>
        {tasks.map((task, index) => (
          <TaskCard key={task.id || index} task={task} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex gap-3 px-4 py-4 border-t border-gray-100">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button className="flex-1 bg-red-500" onClick={onConfirm}>
          <Trash2 size={16} color="#fff" />
          <Text className="text-white ml-1">确认删除 ({tasks.length}个)</Text>
        </Button>
      </View>
    </View>
  )
}

// 修改确认
const ModifyConfirm: FC<{
  originalTask?: PendingTask
  updatedTask?: PendingTask
  onConfirm: () => void
  onCancel: () => void
}> = ({ originalTask: _originalTask, updatedTask, onConfirm, onCancel }) => {
  if (!updatedTask) return null
  
  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <Pencil size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">修改日程确认</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务详情 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '60vh' }}>
        <View className="mb-3">
          <Text className="text-sm text-gray-500">日程将被修改为以下内容</Text>
        </View>
        <TaskCard task={updatedTask} />
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex gap-3 px-4 py-4 border-t border-gray-100">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button className="flex-1 bg-blue-500" onClick={onConfirm}>
          <Pencil size={16} color="#fff" />
          <Text className="text-white ml-1">确认修改</Text>
        </Button>
      </View>
    </View>
  )
}

// 主弹窗组件
export const ConfirmModal: FC<ConfirmModalProps> = ({
  type,
  visible,
  pendingTasks,
  pendingDeleteTasks,
  originalTask,
  updatedTask,
  onConfirmBatchAdd,
  onConfirmBatchDelete,
  onConfirmModify,
  onCancel,
}) => {
  if (!visible) return null

  const renderContent = () => {
    switch (type) {
      case 'batch_add':
        return pendingTasks && pendingTasks.length > 0 ? (
          <BatchAddConfirm
            tasks={pendingTasks}
            onConfirm={onConfirmBatchAdd}
            onCancel={onCancel}
          />
        ) : null
      case 'batch_delete':
        return pendingDeleteTasks && pendingDeleteTasks.length > 0 ? (
          <BatchDeleteConfirm
            tasks={pendingDeleteTasks}
            onConfirm={onConfirmBatchDelete}
            onCancel={onCancel}
          />
        ) : null
      case 'modify':
        return (
          <ModifyConfirm
            originalTask={originalTask}
            updatedTask={updatedTask}
            onConfirm={onConfirmModify}
            onCancel={onCancel}
          />
        )
      default:
        return null
    }
  }

  return (
    <View
      className="fixed inset-0 z-50"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        maxWidth: '100vw',
        backgroundColor: 'rgba(0,0,0,0.5)',
        overflowX: 'hidden'
      }}
    >
      <View
        className="absolute left-0 right-0 bg-white rounded-t-2xl"
        style={{
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          maxHeight: '85vh',
          overflowX: 'hidden',
          paddingBottom: '20px'
        }}
      >
        {renderContent()}
      </View>
    </View>
  )
}

export default ConfirmModal
