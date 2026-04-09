/**
 * 确认弹窗容器组件
 * 支持批量创建、批量删除、单个更新、行程规划
 * 
 * 已修复真机溢出问题：
 * - ScrollView 使用明确的 px 高度
 * - 所有容器添加 maxWidth 和 overflowX 限制
 * - 底部按钮使用 flex-shrink-0 防止被压缩
 * - ScrollView 底部添加 padding 避开按钮区域
 */

import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { type FC, useMemo } from 'react'
import { Plus, Trash2, X, Car, TrainFront, Plane, Users, Utensils, Building2, Check, Pencil, MapPin, Clock, Route, Sparkles, TriangleAlert, Lightbulb, Loader, CircleCheck } from 'lucide-react-taro'
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
    <View 
      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-2"
      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <View className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
        <Icon size={16} color="#3b82f6" />
      </View>
      <View style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '4px', maxWidth: '100%' }}>
          <Text className="text-sm font-medium text-gray-900" style={{ flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</Text>
          <Text className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded" style={{ flexShrink: 0 }}>
            {getTaskTypeName(task.type)}
          </Text>
        </View>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', maxWidth: '100%' }}>
          <Text className="text-xs text-gray-500" style={{ flexShrink: 0 }}>{formatTime(task.scheduled_time)}</Text>
          {task.destination_name && (
            <>
              <Text className="text-xs text-gray-500" style={{ flexShrink: 0 }}>→</Text>
              <Text className="text-xs text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.destination_name}</Text>
            </>
          )}
        </View>
        {task.conflictWarning && (
          <Text className="text-xs text-orange-500 mt-1" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.conflictWarning}</Text>
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
      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {/* 序号 */}
      <View className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
        <Text className="text-xs font-bold text-white">{index + 1}</Text>
      </View>
      {/* 图标 */}
      <View className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
        <Icon size={16} color="#3b82f6" />
      </View>
      <View style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
        <Text className="text-sm font-medium text-gray-900 mb-1" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</Text>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', maxWidth: '100%' }}>
          <Clock size={12} color="#999" />
          <Text className="text-xs text-gray-500" style={{ flexShrink: 0 }}>{formatTimeOnly(task.scheduled_time)}</Text>
          {duration && (
            <>
              <Text className="text-xs text-gray-500" style={{ flexShrink: 0 }}>·</Text>
              <Text className="text-xs text-gray-500" style={{ flexShrink: 0 }}>{formatDuration(duration)}</Text>
            </>
          )}
        </View>
        {task.description && (
          <Text className="text-xs text-gray-400 mt-1" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</Text>
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
      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Sparkles size={14} color="#3b82f6" />
        <Text className="text-sm font-medium text-blue-600">AI 规划思路</Text>
      </View>
      {reasoning.map((step, index) => (
        <View key={index} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '8px', marginBottom: '4px', maxWidth: '100%' }}>
          <Text className="text-xs text-blue-400" style={{ flexShrink: 0 }}>{index + 1}.</Text>
          <Text className="text-xs text-gray-600" style={{ flex: 1, wordBreak: 'break-word', overflow: 'hidden' }}>{step}</Text>
        </View>
      ))}
    </View>
  )
}

// 时间冲突提示
const ConflictSection: FC<{ conflicts: any[] }> = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) return null

  return (
    <View
      className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4"
      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <TriangleAlert size={16} color="#f97316" />
        <Text className="text-sm font-medium text-orange-600">时间冲突检测</Text>
      </View>
      {conflicts.map((conflict, index) => (
        <View key={index} className="bg-white rounded p-2 mb-2" style={{ border: '1px solid #fed7aa' }}>
          <Text className="text-xs font-medium text-orange-700 mb-1" style={{ display: 'block' }}>
            冲突 {index + 1}: &ldquo;{conflict.newTask.title}&rdquo; 与 &ldquo;{conflict.existingTask.title}&rdquo;
          </Text>
          <Text className="text-xs text-gray-600 mb-1" style={{ display: 'block' }}>
            重叠时间: {conflict.overlapMinutes} 分钟
          </Text>
          <Text className="text-xs text-gray-500" style={{ display: 'block' }}>
            已有任务: {new Date(conflict.existingTask.scheduled_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(new Date(conflict.existingTask.scheduled_time).getTime() + ((conflict.existingTask.metadata?.duration as number) || 60) * 60000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      ))}
      <Text className="text-xs text-orange-700 font-medium" style={{ display: 'block' }}>
        ⚠️ 存在时间冲突，建议调整时间或取消冲突任务
      </Text>
    </View>
  )
}

// 冲突优化方案
const OptimizationSection: FC<{
  optimization: any
  isOptimizing: boolean
  onOptimize: () => void
}> = ({ optimization, isOptimizing, onOptimize }) => {
  if (!optimization && !isOptimizing) return null

  return (
    <View
      className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4"
      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <Lightbulb size={16} color="#9333ea" />
          <Text className="text-sm font-medium text-purple-600">AI 优化方案</Text>
        </View>
        {!optimization && (
          <Button size="sm" style={{ padding: '4px 8px', height: 'auto' }} onClick={onOptimize} disabled={isOptimizing}>
            {isOptimizing ? (
              <>
                <Loader size={12} color="#9333ea" className="animate-spin" />
                <Text className="text-xs text-purple-600 ml-1">生成中...</Text>
              </>
            ) : (
              <Text className="text-xs text-purple-600">生成方案</Text>
            )}
          </Button>
        )}
      </View>

      {isOptimizing && (
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
          <Loader size={16} color="#9333ea" className="animate-spin" />
          <Text className="text-xs text-gray-600">正在分析冲突并生成优化方案...</Text>
        </View>
      )}

      {optimization && (
        <>
          {/* 冲突分析 */}
          <View className="bg-white rounded p-2 mb-2" style={{ border: '1px solid #e9d5ff' }}>
            <Text className="text-xs font-medium text-purple-700 mb-1" style={{ display: 'block' }}>冲突分析</Text>
            <Text className="text-xs text-gray-600" style={{ display: 'block', wordBreak: 'break-word' }}>
              {optimization.conflictAnalysis}
            </Text>
          </View>

          {/* 优化建议 */}
          {optimization.optimizationSuggestions && optimization.optimizationSuggestions.length > 0 && (
            <View className="mb-2">
              <Text className="text-xs font-medium text-purple-700 mb-1" style={{ display: 'block' }}>优化建议</Text>
              {optimization.optimizationSuggestions.map((suggestion: any, index: number) => (
                <View key={index} className="bg-white rounded p-2 mb-1" style={{ border: '1px solid #e9d5ff' }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CircleCheck size={12} color="#9333ea" />
                    <Text className="text-xs font-medium text-purple-700">{suggestion.description}</Text>
                  </View>
                  {suggestion.affectedTasks && suggestion.affectedTasks.length > 0 && (
                    <Text className="text-xs text-gray-500" style={{ display: 'block', marginLeft: '18px' }}>
                      影响任务: {suggestion.affectedTasks.map((t: string) => `「${t}」`).join('、')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* AI 思考过程 */}
          {optimization.reasoning && optimization.reasoning.length > 0 && (
            <View className="mb-2">
              <Text className="text-xs font-medium text-purple-700 mb-1" style={{ display: 'block' }}>思考过程</Text>
              {optimization.reasoning.map((step: string, index: number) => (
                <View key={index} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
                  <Text className="text-xs text-purple-400" style={{ flexShrink: 0 }}>{index + 1}.</Text>
                  <Text className="text-xs text-gray-600" style={{ flex: 1, wordBreak: 'break-word' }}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 会被修改的日程 */}
          {optimization.modifiedTasks && optimization.modifiedTasks.length > 0 && (
            <View>
              <Text className="text-xs font-medium text-purple-700 mb-1" style={{ display: 'block' }}>会被修改的日程</Text>
              {optimization.modifiedTasks.map((task: any, index: number) => (
                <View key={index} className="bg-white rounded p-2 mb-1" style={{ border: '1px solid #e9d5ff' }}>
                  <Text className="text-xs font-medium text-gray-900 mb-1" style={{ display: 'block' }}>
                    {task.title}
                  </Text>
                  {task.originalTitle && (
                    <Text className="text-xs text-gray-500 mb-1" style={{ display: 'block' }}>
                      原标题: {task.originalTitle}
                    </Text>
                  )}
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} color="#999" />
                    <Text className="text-xs text-gray-600">{formatTime(task.scheduled_time)}</Text>
                  </View>
                  {task.description && (
                    <Text className="text-xs text-gray-500 mt-1" style={{ display: 'block', wordBreak: 'break-word' }}>
                      {task.description}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  )
}

// 行程规划确认
const TripPlanConfirm: FC<{
  tasks: PendingTask[]
  routes: RouteInfo[]
  summary: string
  reasoning: string[]
  conflicts: any[]
  canConfirm: boolean
  conflictOptimization: any
  isOptimizing: boolean
  onOptimize: () => void
  onConfirm: () => void
  onCancel: () => void
}> = ({ tasks, routes, summary, reasoning, conflicts, canConfirm, conflictOptimization, isOptimizing, onOptimize, onConfirm, onCancel }) => {
  const route = routes[0] // 使用第一个推荐方案

  // 计算可用高度
  const scrollViewHeight = useMemo(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      // 弹窗最大高度 85vh，减去头部(140px)和底部按钮(80px)和安全区域
      const maxModalHeight = systemInfo.windowHeight * 0.85
      const headerHeight = 140
      const buttonHeight = 80
      const safeBottom = 20
      return Math.max(maxModalHeight - headerHeight - buttonHeight - safeBottom, 200)
    } catch {
      return 300
    }
  }, [])
  
  return (
    <View 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        maxWidth: '100vw', 
        maxHeight: '85vh',
        overflow: 'hidden'
      }}
    >
      {/* 标题栏 - flex-shrink-0 不压缩 */}
      <View 
        style={{ 
          flexShrink: 0,
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: '#f3f4f6',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <View className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center" style={{ flexShrink: 0 }}>
            <Route size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>行程规划确认</Text>
          <Text className="text-sm text-gray-500" style={{ flexShrink: 0 }}>({tasks.length}个任务)</Text>
        </View>
        <Button size="sm" variant="ghost" style={{ flexShrink: 0, padding: '4px' }} onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 路线概览 - flex-shrink-0 不压缩 */}
      {route && (
        <View 
          style={{ 
            flexShrink: 0,
            padding: '12px 16px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            background: 'linear-gradient(to right, #eff6ff, #faf5ff)'
          }}
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', maxWidth: '100%' }}>
            <Text className="text-base font-bold text-gray-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{route.name}</Text>
            {route.highlights && route.highlights.length > 0 && (
              <Text className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full" style={{ flexShrink: 0, marginLeft: '8px' }}>
                {route.highlights[0]}
              </Text>
            )}
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
              <MapPin size={14} color="#666" />
              <Text className="text-sm text-gray-600">{formatDistance(route.totalDistance)}</Text>
            </View>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} color="#666" />
              <Text className="text-sm text-gray-600">{formatDuration(route.totalDuration)}</Text>
            </View>
            {route.totalCost && (
              <Text className="text-sm text-orange-500">约 ¥{route.totalCost}</Text>
            )}
          </View>
        </View>
      )}

      {/* 任务列表 - flex-1 自动填充剩余空间，底部留出 padding 避开按钮 */}
      <ScrollView
        scrollY
        style={{
          flex: 1,
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          padding: '16px',
          paddingBottom: '100px'  // 关键：底部留出空间避开按钮
        }}
      >
        {/* 冲突提示 */}
        <ConflictSection conflicts={conflicts} />

        {/* 优化方案 */}
        <OptimizationSection
          optimization={conflictOptimization}
          isOptimizing={isOptimizing}
          onOptimize={onOptimize}
        />

        {/* 思考过程 */}
        <ReasoningSection reasoning={reasoning} />
        
        {/* 摘要 */}
        <View style={{ marginBottom: '12px', width: '100%' }}>
          <Text className="text-sm text-gray-500" style={{ wordBreak: 'break-word' }}>{summary}</Text>
        </View>
        
        {/* 任务卡片 */}
        <View style={{ marginBottom: '8px', width: '100%' }}>
          <Text className="text-sm font-medium text-gray-700 mb-2" style={{ display: 'block' }}>行程安排</Text>
        </View>
        {tasks.map((task, index) => (
          <TripTaskCard key={index} task={task} index={index} />
        ))}
      </ScrollView>

      {/* 底部按钮 - flex-shrink-0 不压缩，始终可见 */}
      <View
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: '12px',
          padding: '16px',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: '#f3f4f6',
          backgroundColor: '#fff',
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      >
        <Button variant="outline" style={{ flex: 1 }} onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button
          style={{ flex: 1, backgroundColor: canConfirm ? '#a855f7' : '#f97316' }}
          onClick={canConfirm ? onConfirm : undefined}
          disabled={!canConfirm}
        >
          {canConfirm ? (
            <>
              <Route size={16} color="#fff" />
              <Text className="text-white ml-1">确认创建 ({tasks.length}个)</Text>
            </>
          ) : (
            <Text className="text-white">⚠️ 存在时间冲突</Text>
          )}
        </Button>
      </View>
    </View>
  )
}

// 批量创建确认
const BatchAddConfirm: FC<{
  tasks: PendingTask[]
  conflicts: any[]
  canConfirm: boolean
  onConfirm: () => void
  onCancel: () => void
}> = ({ tasks, conflicts, canConfirm, onConfirm, onCancel }) => {
  const scrollViewHeight = useMemo(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      const maxModalHeight = systemInfo.windowHeight * 0.85
      const headerHeight = 60
      const buttonHeight = 80
      return Math.max(maxModalHeight - headerHeight - buttonHeight - 20, 200)
    } catch {
      return 300
    }
  }, [])
  
  return (
    <View 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        maxWidth: '100vw', 
        maxHeight: '85vh',
        overflow: 'hidden'
      }}
    >
      {/* 标题栏 */}
      <View 
        style={{ 
          flexShrink: 0,
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: '#f3f4f6',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <View className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center" style={{ flexShrink: 0 }}>
            <Plus size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>新增日程确认</Text>
          <Text className="text-sm text-gray-500" style={{ flexShrink: 0 }}>({tasks.length}个)</Text>
        </View>
        <Button size="sm" variant="ghost" style={{ flexShrink: 0, padding: '4px' }} onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务列表 */}
      <ScrollView
        scrollY
        style={{
          flex: 1,
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          padding: '16px',
          paddingBottom: '100px'
        }}
      >
        {/* 冲突提示 */}
        <ConflictSection conflicts={conflicts} />

        <View style={{ marginBottom: '12px', width: '100%' }}>
          <Text className="text-sm text-gray-500">AI 为您规划了以下行程，确认后将添加到日程</Text>
        </View>
        {tasks.map((task, index) => (
          <TaskCard key={index} task={task} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: '12px',
          padding: '16px',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: '#f3f4f6',
          backgroundColor: '#fff',
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      >
        <Button variant="outline" style={{ flex: 1 }} onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button
          style={{ flex: 1, backgroundColor: canConfirm ? '#22c55e' : '#f97316' }}
          onClick={canConfirm ? onConfirm : undefined}
          disabled={!canConfirm}
        >
          {canConfirm ? (
            <>
              <Plus size={16} color="#fff" />
              <Text className="text-white ml-1">确认添加 ({tasks.length}个)</Text>
            </>
          ) : (
            <Text className="text-white">⚠️ 存在时间冲突</Text>
          )}
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
  const scrollViewHeight = useMemo(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      const maxModalHeight = systemInfo.windowHeight * 0.85
      const headerHeight = 60
      const buttonHeight = 80
      return Math.max(maxModalHeight - headerHeight - buttonHeight - 20, 200)
    } catch {
      return 300
    }
  }, [])
  
  return (
    <View 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        maxWidth: '100vw', 
        maxHeight: '85vh',
        overflow: 'hidden'
      }}
    >
      {/* 标题栏 */}
      <View 
        style={{ 
          flexShrink: 0,
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: '#f3f4f6',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <View className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center" style={{ flexShrink: 0 }}>
            <Trash2 size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>删除日程确认</Text>
          <Text className="text-sm text-gray-500" style={{ flexShrink: 0 }}>({tasks.length}个)</Text>
        </View>
        <Button size="sm" variant="ghost" style={{ flexShrink: 0, padding: '4px' }} onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务列表 */}
      <ScrollView 
        scrollY 
        style={{ 
          flex: 1,
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          padding: '16px',
          paddingBottom: '100px'
        }}
      >
        <View style={{ marginBottom: '12px', width: '100%' }}>
          <Text className="text-sm text-red-500">以下日程将被删除，此操作不可恢复</Text>
        </View>
        {tasks.map((task, index) => (
          <TaskCard key={task.id || index} task={task} />
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View 
        style={{ 
          flexShrink: 0,
          display: 'flex', 
          flexDirection: 'row', 
          gap: '12px', 
          padding: '16px', 
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: '#f3f4f6',
          backgroundColor: '#fff',
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      >
        <Button variant="outline" style={{ flex: 1 }} onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button style={{ flex: 1, backgroundColor: '#ef4444' }} onClick={onConfirm}>
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
  const scrollViewHeight = useMemo(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      const maxModalHeight = systemInfo.windowHeight * 0.85
      const headerHeight = 60
      const buttonHeight = 80
      return Math.max(maxModalHeight - headerHeight - buttonHeight - 20, 200)
    } catch {
      return 300
    }
  }, [])
  
  if (!updatedTask) return null
  
  return (
    <View 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        maxWidth: '100vw', 
        maxHeight: '85vh',
        overflow: 'hidden'
      }}
    >
      {/* 标题栏 */}
      <View 
        style={{ 
          flexShrink: 0,
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: '#f3f4f6',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <View className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center" style={{ flexShrink: 0 }}>
            <Pencil size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold">修改日程确认</Text>
        </View>
        <Button size="sm" variant="ghost" style={{ flexShrink: 0, padding: '4px' }} onClick={onCancel}>
          <X size={24} color="#999" />
        </Button>
      </View>

      {/* 任务详情 */}
      <ScrollView 
        scrollY 
        style={{ 
          flex: 1,
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          padding: '16px',
          paddingBottom: '100px'
        }}
      >
        <View style={{ marginBottom: '12px', width: '100%' }}>
          <Text className="text-sm text-gray-500">日程将被修改为以下内容</Text>
        </View>
        <TaskCard task={updatedTask} />
      </ScrollView>

      {/* 底部按钮 */}
      <View 
        style={{ 
          flexShrink: 0,
          display: 'flex', 
          flexDirection: 'row', 
          gap: '12px', 
          padding: '16px', 
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: '#f3f4f6',
          backgroundColor: '#fff',
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      >
        <Button variant="outline" style={{ flex: 1 }} onClick={onCancel}>
          <Text className="text-gray-600">取消</Text>
        </Button>
        <Button style={{ flex: 1, backgroundColor: '#3b82f6' }} onClick={onConfirm}>
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
  conflicts = [],
  canConfirm = true,
  conflictOptimization,
  isOptimizing,
  onOptimize,
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
            conflicts={conflicts}
            canConfirm={canConfirm ?? true}
            conflictOptimization={conflictOptimization ?? undefined}
            isOptimizing={isOptimizing ?? false}
            onOptimize={onOptimize || (() => {})}
            onConfirm={onConfirmTripPlan || (() => {})}
            onCancel={onCancel}
          />
        ) : null
      case 'batch_add':
        return pendingTasks && pendingTasks.length > 0 ? (
          <BatchAddConfirm
            tasks={pendingTasks}
            conflicts={conflicts}
            canConfirm={canConfirm}
            onConfirm={onConfirmBatchAdd || (() => {})}
            onCancel={onCancel}
          />
        ) : null
      case 'batch_delete':
        return pendingDeleteTasks && pendingDeleteTasks.length > 0 ? (
          <BatchDeleteConfirm
            tasks={pendingDeleteTasks}
            onConfirm={onConfirmBatchDelete || (() => {})}
            onCancel={onCancel}
          />
        ) : null
      case 'modify':
        return (
          <ModifyConfirm
            originalTask={originalTask}
            updatedTask={updatedTask}
            onConfirm={onConfirmModify || (() => {})}
            onCancel={onCancel}
          />
        )
      default:
        return null
    }
  }

  return (
    <View
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
        zIndex: 200
      }}
    >
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          backgroundColor: '#fff',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          maxHeight: '85vh',
          overflow: 'hidden'
        }}
      >
        {renderContent()}
      </View>
    </View>
  )
}

export default ConfirmModal
