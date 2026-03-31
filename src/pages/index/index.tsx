import { View, Text, ScrollView, Input } from '@tarojs/components'
import { useCallback, useEffect } from 'react'
import type { FC } from 'react'
import { Send, Car, TrainFront, Plane, Users, Utensils, Building2, Check, Loader, MapPin, Clock, Trash2, Locate } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmModal } from '@/components/confirmation'
import { simplifyAddress } from '@/utils/address'
import { useLocation, useAI, useConfirm } from '@/hooks'
import { useChatStore, type Message, type ToolResult } from '@/stores/chatStore'
import type { Task, TaskType } from '@/types'
import './index.css'

// =============================================
// 辅助函数
// =============================================

// 清理 JSON 代码块
const cleanJsonFromContent = (content: string): string => {
  if (!content) return ''
  let cleaned = content.replace(/```json\s*[\s\S]*?```/g, '').trim()
  cleaned = cleaned.replace(/```\s*[\s\S]*?```/g, '').trim()
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed.content) return parsed.content
    } catch {
      // 解析失败，返回原内容
    }
  }
  return cleaned || content
}

// 任务类型图标
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

// 任务类型名称
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

// 格式化时间
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '--:--'
  try {
    const date = new Date(timeStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch { return '--:--' }
}

// 格式化日期
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
// 主组件
// =============================================

const Index: FC = () => {
  // ========== 使用 Store 管理状态 ==========
  const {
    messages,
    inputText,
    scrollCounter,
    setInputText,
    triggerScroll,
  } = useChatStore()
  
  // ========== 使用 Hooks ==========
  // 定位 Hook
  const {
    location: userLocation,
    loading: locationLoading,
    error: locationError,
    showDetail: showLocationDetail,
    fetchLocation,
    setShowDetail: setShowLocationDetail,
  } = useLocation()
  
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    triggerScroll()
  }, [triggerScroll])
  
  // AI 对话 Hook
  const {
    isLoading,
    sendMessage,
    cancelStream,
  } = useAI({
    userLocation,
    onScrollToBottom: scrollToBottom,
  })
  
  // 确认弹窗 Hook
  const {
    visible: showConfirmModal,
    confirmType,
    pendingTasks,
    pendingDeleteTasks,
    originalTask,
    updatedTask,
    confirmBatchAdd,
    confirmBatchDelete,
    confirmModify,
    cancelConfirm,
  } = useConfirm({
    onScrollToBottom: scrollToBottom,
  })
  
  // ========== 初始化 ==========
  useEffect(() => {
    fetchLocation()
  }, [fetchLocation])
  
  // ========== 发送消息 ==========
  const handleSend = useCallback(() => {
    sendMessage(inputText)
  }, [inputText, sendMessage])
  
  // ========== 渲染函数 ==========
  
  // 渲染思考过程
  const renderReasoning = (reasoning: string[], isStreaming?: boolean) => {
    if (!reasoning?.length) return null
    const displaySteps = reasoning.slice(-3)

    return (
      <View className="mb-2 p-2 bg-blue-50 rounded-lg">
        {displaySteps.map((step, idx) => {
          const isCurrentStep = idx === displaySteps.length - 1 && isStreaming
          return (
            <View key={idx} className="flex flex-row items-start gap-2 py-1">
              <View style={{ flexShrink: 0, width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isCurrentStep ? (
                  <Loader size={14} color="#1890ff" className="thinking-icon" />
                ) : (
                  <Check size={14} color="#52c41a" />
                )}
              </View>
              <Text className="text-xs text-blue-600 flex-1" style={{ lineHeight: '16px' }}>{step}</Text>
            </View>
          )
        })}
      </View>
    )
  }

  // 渲染工具调用结果
  const renderToolResults = (toolResults: ToolResult[]) => {
    if (!toolResults?.length) return null
    return (
      <View className="mt-2">
        {toolResults.map((tr, idx) => (
          <View key={idx} className="mb-2">
            {tr.result.success ? (
              <View className="flex items-center gap-1 text-xs text-green-600">
                <Check size={12} color="#52c41a" />
                <Text className="text-xs text-green-600">{tr.result.message}</Text>
              </View>
            ) : (
              <Text className="text-xs text-red-500">{tr.result.error || '执行失败'}</Text>
            )}
          </View>
        ))}
      </View>
    )
  }

  // 渲染数据卡片
  const renderDataCard = (message: Message) => {
    if (!message.data) return null

    const data = message.data

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
          {tasks.slice(0, 5).map((task, idx) => (
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

  // 渲染消息
  const renderMessage = (message: Message, index: number) => {
    const isStreaming = isLoading && message.role === 'assistant' && index === messages.length - 1
    const showThinking = isStreaming && !message.content && (!message.reasoning || message.reasoning.length === 0)

    return (
      <View key={message.id} id={`msg-${index}`} className={`flex mb-3 w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {message.role === 'user' ? (
          <View className="bg-blue-500 rounded-2xl rounded-br-sm px-4 py-2 max-w-[75%]">
            <Text className="text-sm text-white">{message.content}</Text>
          </View>
        ) : (
          <View className="bg-white rounded-2xl rounded-bl-sm px-4 py-2 max-w-[88%] shadow-sm">
            {showThinking && (
              <View className="flex flex-row items-center gap-2">
                <View style={{ flexShrink: 0, width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader size={14} color="#1890ff" className="thinking-icon" />
                </View>
                <Text className="text-sm text-gray-500 thinking-text">思考中...</Text>
              </View>
            )}
            {renderReasoning(message.reasoning || [], isStreaming)}
            {message.content && (
              <Text className="block text-sm text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>{cleanJsonFromContent(message.content)}</Text>
            )}
            {renderToolResults(message.tool_results || [])}
            {renderDataCard(message)}
          </View>
        )}
      </View>
    )
  }

  // =============================================
  // 渲染
  // =============================================

  return (
    <View
      className="flex flex-col overflow-hidden bg-gray-50 safe-container"
      style={{ width: '100%', height: '100%', backgroundColor: '#f5f5f5', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {/* 定位栏 */}
      <View
        className="flex items-center justify-center py-2 px-4 bg-white border-b border-gray-100"
        style={{ minHeight: '36px' }}
      >
        {locationLoading ? (
          <View className="flex items-center gap-1">
            <Loader size={16} color="#1890ff" className="animate-spin" />
            <Text className="text-xs text-gray-500">获取定位中...</Text>
          </View>
        ) : locationError ? (
          <View className="flex items-center gap-1" onClick={locationLoading ? undefined : fetchLocation}>
            <MapPin size={16} color="#ff4d4f" />
            <Text className="text-xs text-red-500">{locationError}</Text>
            <Locate size={14} color="#1890ff" style={{ marginLeft: '4px' }} />
          </View>
        ) : (
          <View className="flex items-center gap-1" style={{ maxWidth: '100%' }}>
            <View 
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '2px' }}
              onClick={() => setShowLocationDetail(true)}
            >
              <MapPin size={16} color="#1890ff" />
            </View>
            <Text className="text-xs text-gray-600 truncate" style={{ maxWidth: '200px' }}>
              {simplifyAddress(userLocation?.name || '')}
            </Text>
            <Text 
              className="text-xs text-gray-400 ml-1" 
              style={{ flexShrink: 0 }}
              onClick={fetchLocation}
            >
              刷新
            </Text>
          </View>
        )}
      </View>

      {/* 详细地址弹窗 */}
      {showLocationDetail && userLocation?.name && (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setShowLocationDetail(false)}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '16px 20px',
              margin: '20px',
              maxWidth: '80%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <View className="flex items-center gap-2 mb-2">
              <MapPin size={18} color="#1890ff" />
              <Text className="text-sm font-medium">当前位置</Text>
            </View>
            <Text className="text-sm text-gray-600 leading-relaxed">{userLocation.name}</Text>
            <View className="flex justify-end mt-3">
              <Button 
                size="sm" 
                onClick={() => setShowLocationDetail(false)}
              >
                <Text className="text-sm">关闭</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 消息列表 */}
      <ScrollView
        scrollY
        scrollIntoView={scrollCounter > 0 ? `scroll-bottom-${scrollCounter}` : 'scroll-bottom'}
        scrollWithAnimation
        className="flex-1 w-full overflow-hidden"
        style={{ paddingBottom: '80px', boxSizing: 'border-box' }}
      >
        <View className="w-full px-4 box-border">
          {messages.map((message, index) => renderMessage(message, index))}
          <View id={`scroll-bottom-${scrollCounter}`} style={{ height: '1px' }} />
        </View>
      </ScrollView>

      {/* 输入框 */}
      <View
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e7eb',
          zIndex: 100
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: '20px', padding: '8px 12px' }}>
          <Input
            style={{ width: '100%', fontSize: '14px' }}
            placeholder="告诉我您想做什么..."
            value={inputText}
            onInput={(e) => setInputText(e.detail.value)}
            onConfirm={handleSend}
            confirmType="send"
          />
        </View>
        <View style={{ flexShrink: 0 }}>
          {isLoading ? (
            <Button size="default" className="rounded-full px-4" onClick={cancelStream}>
              <Text className="text-sm text-white">取消</Text>
            </Button>
          ) : (
            <Button size="default" className="rounded-full px-4" onClick={handleSend} disabled={!inputText.trim()}>
              <Send size={18} color={inputText.trim() ? '#fff' : '#999'} />
            </Button>
          )}
        </View>
      </View>

      {/* 确认弹窗 */}
      <ConfirmModal
        type={confirmType || 'batch_add'}
        visible={showConfirmModal}
        pendingTasks={pendingTasks}
        pendingDeleteTasks={pendingDeleteTasks}
        originalTask={originalTask ?? undefined}
        updatedTask={updatedTask ?? undefined}
        onConfirmBatchAdd={confirmBatchAdd}
        onConfirmBatchDelete={confirmBatchDelete}
        onConfirmModify={confirmModify}
        onCancel={cancelConfirm}
      />
    </View>
  )
}

export default Index
