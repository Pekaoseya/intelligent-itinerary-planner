/**
 * 确认弹窗容器组件
 * 支持批量创建、批量删除、单个更新、行程规划
 * 
 * 已修复真机溢出问题：
 * - ScrollView 添加 maxWidth 和 overflowX 限制
 * - 长文本使用 truncate 截断
 * - 底部按钮使用 fixed 布局确保可见
 */

import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { type FC, useMemo } from 'react'
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

/**
 * 计算 ScrollView 安全高度
 * 小程序端必须使用明确的 px 高度，不能用 flex-1
 */
const useScrollViewHeight = (headerHeight: number = 180, bottomButtonHeight: number = 80) => {
  return useMemo(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      // 屏幕高度 - 头部 - 底部按钮 - TabBar(约50) - 安全边距
      const tabBarHeight = 50
      const safeMargin = 20
      const height = systemInfo.windowHeight - headerHeight - bottomButtonHeight - tabBarHeight - safeMargin
      return Math.max(height, 200) // 最小 200px
    } catch {
      // 降级值
      return 300
    }
  }, [headerHeight, bottomButtonHeight])
}

// 任务卡片组件
const TaskCard: FC<{ task: PendingTask }> = ({ task }) => {
  const Icon = getTaskIcon(task.type)
  
  return (
    <View 
      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-2"
      style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
    >
      <View className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
        <Icon size={16} color="#3b82f6" />
      </View>
      <View className="flex-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <View className="flex items-center gap-2 mb-1" style={{ maxWidth: '100%' }}>
          <Text className="text-sm font-medium text-gray-900 truncate">{task.title}</Text>
          <Text className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded flex-shrink-0">
            {getTaskTypeName(task.type)}
          </Text>
        </View>
        <View className="flex items-center gap-1 text-xs text-gray-500" style={{ maxWidth: '100%' }}>
          <Text className="flex-shrink-0">{formatTime(task.scheduled_time)}</Text>
          {task.destination_name && (
            <>
              <Text className="flex-shrink-0">→</Text>
              <Text className="truncate">{task.destination_name}</Text>
            </>
          )}
        </View>
        {task.conflictWarning && (
          <Text className="text-xs text-orange-500 mt-1 block truncate">{task.conflictWarning}</Text>
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
    <View 
      className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-lg mb-2 shadow-sm"
      style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
    >
      {/* 序号 */}
      <View className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
        <Text className="text-xs font-bold text-white">{index + 1}</Text>
      </View>
      {/* 图标 */}
      <View className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
        <Icon size={16} color="#3b82f6" />
      </View>
      <View className="flex-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text className="text-sm font-medium text-gray-900 mb-1 block truncate">{task.title}</Text>
        <View className="flex items-center gap-1 text-xs text-gray-500" style={{ maxWidth: '100%' }}>
          <Clock size={12} color="#999" />
          <Text className="flex-shrink-0">{formatTimeOnly(task.scheduled_time)}</Text>
          {duration && (
            <>
              <Text className="flex-shrink-0">·</Text>
              <Text className="flex-shrink-0">{formatDuration(duration)}</Text>
            </>
          )}
        </View>
        {task.description && (
          <Text className="text-xs text-gray-400 mt-1 block truncate">{task.description}</Text>
        )}
      </View>
    </View>
  )
}

// 思考过程展示
const ReasoningSection: FC<{ reasoning: string[] }> = ({ reasoning }) => {
  if (!reasoning || reasoning.length === 0) return null
  
  return (
    <View 
      className="bg-blue-50 rounded-lg p-3 mb-4"
      style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
    >
      <View className="flex items-center gap-2 mb-2">
        <Sparkles size={14} color="#3b82f6" />
        <Text className="text-sm font-medium text-blue-600">AI 规划思路</Text>
      </View>
      {reasoning.map((step, index) => (
        <View key={index} className="flex items-start gap-2 mb-1" style={{ maxWidth: '100%' }}>
          <Text className="text-xs text-blue-400 flex-shrink-0">{index + 1}.</Text>
          <Text className="text-xs text-gray-600 block" style={{ wordBreak: 'break-all' }}>{step}</Text>
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
  const scrollViewHeight = useScrollViewHeight(240, 80) // 头部+路线概览约240px，底部按钮80px
  
  return (
    <View style={{ width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <View 
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        <View className="flex items-center gap-2" style={{ maxWidth: 'calc(100% - 40px)' }}>
          <View className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
            <Route size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold truncate">行程规划确认</Text>
          <Text className="text-sm text-gray-500 flex-shrink-0">({tasks.length}个任务)</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1 flex-shrink-0" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 路线概览 */}
      {route && (
        <View 
          className="px-4 py-3"
          style={{ 
            width: '100%', 
            maxWidth: '100%',
            background: 'linear-gradient(to right, #eff6ff, #faf5ff)',
            overflow: 'hidden'
          }}
        >
          <View className="flex items-center justify-between mb-2" style={{ maxWidth: '100%' }}>
            <Text className="text-base font-bold text-gray-900 truncate">{route.name}</Text>
            {route.highlights && route.highlights.length > 0 && (
              <Text className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full flex-shrink-0">
                {route.highlights[0]}
              </Text>
            )}
          </View>
          <View className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
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

      {/* 任务列表 - 使用明确高度 */}
      <ScrollView 
        scrollY 
        className="px-4 py-4"
        style={{ 
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        {/* 思考过程 */}
        <ReasoningSection reasoning={reasoning} />
        
        {/* 摘要 */}
        <View className="mb-3" style={{ maxWidth: '100%' }}>
          <Text className="text-sm text-gray-500 block" style={{ wordBreak: 'break-all' }}>{summary}</Text>
        </View>
        
        {/* 任务卡片 */}
        <View className="mb-2">
          <Text className="text-sm font-medium text-gray-700 mb-2 block">行程安排</Text>
        </View>
        {tasks.map((task, index) => (
          <TripTaskCard key={index} task={task} index={index} />
        ))}
      </ScrollView>

      {/* 底部按钮 - fixed 布局确保可见 */}
      <View 
        className="flex gap-3 px-4 py-4 border-t border-gray-100 bg-white"
        style={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 10
        }}
      >
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button className="flex-1 bg-purple-500" onClick={onConfirm}>
          <Route size={16} color="#fff" />
          <Text className="text-white ml-1">确认创建 ({tasks.length}个)</Text>
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
  const scrollViewHeight = useScrollViewHeight(120, 80) // 头部120px，底部按钮80px
  
  return (
    <View style={{ width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <View 
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        <View className="flex items-center gap-2" style={{ maxWidth: 'calc(100% - 40px)' }}>
          <View className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Plus size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold truncate">新增日程确认</Text>
          <Text className="text-sm text-gray-500 flex-shrink-0">({tasks.length}个)</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1 flex-shrink-0" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务列表 */}
      <ScrollView 
        scrollY 
        className="px-4 py-4"
        style={{ 
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <View className="mb-3">
          <Text className="text-sm text-gray-500 block">AI 为您规划了以下行程，确认后将添加到日程</Text>
        </View>
        {tasks.map((task, index) => (
          <TaskCard key={index} task={task} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View 
        className="flex gap-3 px-4 py-4 border-t border-gray-100 bg-white"
        style={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 10
        }}
      >
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
  const scrollViewHeight = useScrollViewHeight(120, 80)
  
  return (
    <View style={{ width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <View 
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        <View className="flex items-center gap-2" style={{ maxWidth: 'calc(100% - 40px)' }}>
          <View className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold truncate">删除日程确认</Text>
          <Text className="text-sm text-gray-500 flex-shrink-0">({tasks.length}个)</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1 flex-shrink-0" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务列表 */}
      <ScrollView 
        scrollY 
        className="px-4 py-4"
        style={{ 
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <View className="mb-3">
          <Text className="text-sm text-red-500 block">以下日程将被删除，此操作不可恢复</Text>
        </View>
        {tasks.map((task, index) => (
          <TaskCard key={task.id || index} task={task} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View 
        className="flex gap-3 px-4 py-4 border-t border-gray-100 bg-white"
        style={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 10
        }}
      >
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
  const scrollViewHeight = useScrollViewHeight(120, 80)
  
  if (!updatedTask) return null
  
  return (
    <View style={{ width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <View 
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        <View className="flex items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Pencil size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">修改日程确认</Text>
        </View>
        <Button size="sm" variant="ghost" className="p-1 flex-shrink-0" onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务详情 */}
      <ScrollView 
        scrollY 
        className="px-4 py-4"
        style={{ 
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <View className="mb-3">
          <Text className="text-sm text-gray-500 block">日程将被修改为以下内容</Text>
        </View>
        <TaskCard task={updatedTask} />
      </ScrollView>

      {/* 底部按钮 */}
      <View 
        className="flex gap-3 px-4 py-4 border-t border-gray-100 bg-white"
        style={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 10
        }}
      >
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
        overflow: 'hidden',
        overflowX: 'hidden',
        zIndex: 200
      }}
    >
      <View
        className="absolute left-0 right-0 bg-white rounded-t-2xl"
        style={{
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          maxHeight: '85vh',
          overflow: 'hidden',
          overflowX: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {renderContent()}
      </View>
    </View>
  )
}

export default ConfirmModal
