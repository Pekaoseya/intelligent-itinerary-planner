/**
 * 确认弹窗容器组件
 * 支持批量创建、批量删除、单个更新、行程规划
 */

import { View, Text, ScrollView } from '@tarojs/components'
import { type FC } from 'react'
import { Plus, Trash2, X, Car, TrainFront, Plane, Users, Utensils, Building2, Check, Pencil, MapPin, Clock, Route, Sparkles } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import type { ConfirmModalProps, PendingTask, RouteInfo } from './types'

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

// 时间格式化（仅时分）
const formatTimeOnly = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 距离格式化
const formatDistance = (meters: number) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`
  }
  return `${meters}m`
}

// 时长格式化
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`
  }
  return `${minutes}分钟`
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

// 行程规划任务卡片
const TripTaskCard: FC<{ task: PendingTask; index: number }> = ({ task, index }) => {
  const Icon = getTaskIcon(task.type)
  const duration = task.metadata?.duration as number | undefined
  
  return (
    <View className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-lg mb-2 shadow-sm">
      {/* 序号 */}
      <View className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
        <Text className="text-xs font-bold text-white">{index + 1}</Text>
      </View>
      {/* 图标 */}
      <View className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
        <Icon size={16} color="#3b82f6" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-gray-900 mb-1">{task.title}</Text>
        <View className="flex items-center gap-2 text-xs text-gray-500">
          <Clock size={12} color="#999" />
          <Text>{formatTimeOnly(task.scheduled_time)}</Text>
          {duration && (
            <>
              <Text>·</Text>
              <Text>{formatDuration(duration)}</Text>
            </>
          )}
        </View>
        {task.description && (
          <Text className="text-xs text-gray-400 mt-1">{task.description}</Text>
        )}
      </View>
    </View>
  )
}

// 思考过程展示
const ReasoningSection: FC<{ reasoning: string[] }> = ({ reasoning }) => {
  if (!reasoning || reasoning.length === 0) return null
  
  return (
    <View className="bg-blue-50 rounded-lg p-3 mb-4">
      <View className="flex items-center gap-2 mb-2">
        <Sparkles size={14} color="#3b82f6" />
        <Text className="text-sm font-medium text-blue-600">AI 规划思路</Text>
      </View>
      {reasoning.map((step, index) => (
        <View key={index} className="flex items-start gap-2 mb-1">
          <Text className="text-xs text-blue-400">{index + 1}.</Text>
          <Text className="text-xs text-gray-600">{step}</Text>
        </View>
      ))}
    </View>
  )
}

// 行程规划确认
const TripPlanConfirm: FC<{
  tasks: PendingTask[]
  routes: RouteInfo[]
  summary: string
  reasoning: string[]
  onConfirm: () => void
  onCancel: () => void
}> = ({ tasks, routes, summary, reasoning, onConfirm, onCancel }) => {
  const route = routes[0] // 使用第一个推荐方案
  
  return (
    <View className="w-full">
      {/* 标题栏 */}
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
            <Route size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">行程规划确认</Text>
          <Text className="text-sm text-gray-500">({tasks.length}个任务)</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 路线概览 */}
      {route && (
        <View className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50">
          <View className="flex items-center justify-between mb-2">
            <Text className="text-base font-bold text-gray-900">{route.name}</Text>
            {route.highlights && route.highlights.length > 0 && (
              <Text className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full">
                {route.highlights[0]}
              </Text>
            )}
          </View>
          <View className="flex items-center gap-4 text-sm text-gray-600">
            <View className="flex items-center gap-1">
              <MapPin size={14} color="#666" />
              <Text>{formatDistance(route.totalDistance)}</Text>
            </View>
            <View className="flex items-center gap-1">
              <Clock size={14} color="#666" />
              <Text>{formatDuration(route.totalDuration)}</Text>
            </View>
            {route.totalCost && (
              <Text className="text-orange-500">约 ¥{route.totalCost}</Text>
            )}
          </View>
        </View>
      )}

      {/* 任务列表 */}
      <ScrollView scrollY className="px-4 py-4" style={{ maxHeight: '40vh' }}>
        {/* 思考过程 */}
        <ReasoningSection reasoning={reasoning} />
        
        {/* 摘要 */}
        <View className="mb-3">
          <Text className="text-sm text-gray-500">{summary}</Text>
        </View>
        
        {/* 任务卡片 */}
        <View className="mb-2">
          <Text className="text-sm font-medium text-gray-700 mb-2">行程安排</Text>
        </View>
        {tasks.map((task, index) => (
          <TripTaskCard key={index} task={task} index={index} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex gap-3 px-4 py-4 border-t border-gray-100">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button className="flex-1 bg-purple-500" onClick={onConfirm}>
          <Route size={16} color="#fff" />
          <Text className="text-white ml-1">确认创建行程 ({tasks.length}个)</Text>
        </Button>
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
  routes,
  summary,
  reasoning,
  onConfirmBatchAdd,
  onConfirmBatchDelete,
  onConfirmModify,
  onConfirmTripPlan,
  onCancel,
}) => {
  if (!visible) return null

  const renderContent = () => {
    switch (type) {
      case 'trip_plan':
        return pendingTasks && pendingTasks.length > 0 ? (
          <TripPlanConfirm
            tasks={pendingTasks}
            routes={routes || []}
            summary={summary || ''}
            reasoning={reasoning || []}
            onConfirm={onConfirmTripPlan}
            onCancel={onCancel}
          />
        ) : null
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
      className="fixed inset-0"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        maxWidth: '100vw',
        backgroundColor: 'rgba(0,0,0,0.5)',
        overflowX: 'hidden',
        zIndex: 200  // 高于输入框的 z-index: 100
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
