import { View, Text, ScrollView, Input } from '@tarojs/components'
import { useCallback, useEffect, useRef } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Send, Car, TrainFront, Plane, Users, Utensils, Building2, Check, Loader, MapPin, Clock, Trash2, Locate } from 'lucide-react-taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { streamingClient, type StreamConnection } from '@/streaming'
import { ConfirmModal } from '@/components/confirmation'
import { simplifyAddress } from '@/utils/address'
import { useChatStore, type Message, type ToolResult } from '@/stores/chatStore'
import { useLocationStore } from '@/stores/locationStore'
import { useConfirmStore } from '@/stores/confirmStore'
import './index.css'

// =============================================
// 类型定义（业务相关，保留在页面中）
// =============================================

type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'
type TaskStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

interface Task {
  id: string
  title: string
  type: TaskType
  status: TaskStatus
  scheduled_time: string
  end_time?: string
  location_name?: string
  destination_name?: string
  is_expired: boolean
  metadata?: Record<string, unknown>
}

// =============================================
// 主组件
// =============================================

const Index: FC = () => {
  // ========== 使用 Store 管理状态 ==========
  const {
    messages,
    inputText,
    isLoading,
    scrollCounter,
    setInputText,
    addMessage,
    updateMessage,
    setLoading,
    triggerScroll,
    setConnection,
    setCurrentAiMessageId,
    appendToBuffer,
    flushBuffer,
  } = useChatStore()
  
  const {
    location: userLocation,
    loading: locationLoading,
    error: locationError,
    showDetail: showLocationDetail,
    setLocation: setUserLocation,
    setLoading: setLocationLoading,
    setError: setLocationError,
    setShowDetail: setShowLocationDetail,
  } = useLocationStore()
  
  const {
    visible: showConfirmModal,
    confirmType,
    pendingTasks,
    pendingDeleteTasks,
    pendingDeleteIds,
    originalTask,
    updatedTask,
    showBatchAdd,
    showBatchDelete,
    showModify,
    hide: hideConfirmModal,
    clearPendingTasks,
    clearPendingDeleteTasks,
    clearAll,
  } = useConfirmStore()
  
  // 保存当前流式连接，用于取消
  const connectionRef = useRef<StreamConnection | null>(null)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    triggerScroll()
  }, [triggerScroll])

  // =============================================
  // 获取用户定位
  // =============================================
  const fetchLocation = useCallback(async () => {
    setLocationLoading(true)
    setLocationError(null)
    console.log('[定位] 开始获取...')

    try {
      const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

      if (isWeapp) {
        const location = await Taro.getLocation({ type: 'gcj02' })
        console.log('[定位] 小程序获取成功:', location.latitude, location.longitude)

        try {
          const res = await Network.request({
            url: '/api/map/reverse-geocode',
            method: 'GET',
            data: { lng: location.longitude, lat: location.latitude },
          })
          const addressName = res.data?.data?.address
          setUserLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: addressName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          })
          setLocationError(null)
        } catch (geocodeError) {
          console.warn('[定位] 逆地理编码失败:', geocodeError)
          setUserLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          })
        }
      } else {
        if (navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                console.log('[定位] H5获取成功:', pos.coords.latitude, pos.coords.longitude)
                try {
                  const res = await Network.request({
                    url: '/api/map/reverse-geocode',
                    method: 'GET',
                    data: { lng: pos.coords.longitude, lat: pos.coords.latitude },
                  })
                  const addressName = res.data?.data?.address
                  setUserLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    name: addressName || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
                  })
                } catch {
                  setUserLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    name: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
                  })
                }
                resolve()
              },
              (err) => {
                console.warn('[定位] H5获取失败:', err)
                setUserLocation({
                  latitude: 30.242489,
                  longitude: 120.148532,
                  name: '杭州西湖（默认）',
                })
                setLocationError('定位失败')
                resolve()
              },
              { enableHighAccuracy: true, timeout: 5000 }
            )
          })
        } else {
          setUserLocation({
            latitude: 30.242489,
            longitude: 120.148532,
            name: '杭州西湖（默认）',
          })
          setLocationError('浏览器不支持定位')
        }
      }
    } catch (err) {
      console.warn('[定位] 获取失败:', err)
      setUserLocation({
        latitude: 30.242489,
        longitude: 120.148532,
        name: '杭州西湖（默认）',
      })
      setLocationError('定位失败')
    } finally {
      setLocationLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocation()
  }, [fetchLocation])

  // =============================================
  // 简化地址显示（只保留街道和大厦）
  // =============================================
  // 地址简化函数：优先显示建筑名/小区名

  // =============================================
  // 清理 JSON 代码块
  // =============================================
  const cleanJsonFromContent = useCallback((content: string): string => {
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
  }, [])

  // =============================================
  // 处理确认操作 - 批量创建/删除/更新
  // =============================================
  const handleConfirmBatchAdd = useCallback(async () => {
    if (pendingTasks.length === 0) return

    try {
      setLoading(true)
      console.log('[确认] 批量创建任务:', pendingTasks.length)
      
      const res = await Network.request({
        url: '/api/tasks/batch',
        method: 'POST',
        data: { tasks: pendingTasks }
      })
      
      const createdCount = res.data?.data?.createdCount || pendingTasks.length
      Taro.showToast({ title: `成功创建 ${createdCount} 个日程`, icon: 'success' })
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 已添加 ${createdCount} 个日程`,
        timestamp: new Date(),
      })
      
      hideConfirmModal()
      clearPendingTasks()
      scrollToBottom()
    } catch (error) {
      console.error('[确认] 批量创建失败:', error)
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [pendingTasks, scrollToBottom, setLoading, addMessage, hideConfirmModal, clearPendingTasks])

  const handleConfirmBatchDelete = useCallback(async () => {
    if (pendingDeleteIds.length === 0) return

    try {
      setLoading(true)
      console.log('[确认] 批量删除任务:', pendingDeleteIds.length)
      
      const res = await Network.request({
        url: '/api/tasks/batch-delete',
        method: 'POST',
        data: { taskIds: pendingDeleteIds }
      })
      
      const deletedCount = res.data?.data?.deletedCount || pendingDeleteIds.length
      Taro.showToast({ title: `已删除 ${deletedCount} 个日程`, icon: 'success' })
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `🗑️ 已删除 ${deletedCount} 个日程`,
        timestamp: new Date(),
      })
      
      hideConfirmModal()
      clearPendingDeleteTasks()
      scrollToBottom()
    } catch (error) {
      console.error('[确认] 批量删除失败:', error)
      Taro.showToast({ title: '删除失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [pendingDeleteIds, scrollToBottom, setLoading, addMessage, hideConfirmModal, clearPendingDeleteTasks])

  const handleConfirmModify = useCallback(async () => {
    if (!updatedTask) return

    try {
      setLoading(true)
      console.log('[确认] 更新任务:', updatedTask.title)
      
      // 调用更新 API
      await Network.request({
        url: `/api/tasks/${(updatedTask as any).id}`,
        method: 'PUT',
        data: updatedTask
      })
      
      Taro.showToast({ title: '修改成功', icon: 'success' })
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 已修改日程：${updatedTask.title}`,
        timestamp: new Date(),
      })
      
      hideConfirmModal()
      clearAll()
      scrollToBottom()
    } catch (error) {
      console.error('[确认] 更新失败:', error)
      Taro.showToast({ title: '修改失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [updatedTask, scrollToBottom, setLoading, addMessage, hideConfirmModal, clearAll])

  // 处理取消确认 - 直接关闭弹窗（不执行任何操作），并在对话框显示提示
  const handleCancelConfirm = useCallback(() => {
    console.log('[取消] 用户取消操作')
    
    // 根据操作类型生成取消消息
    let cancelMessage = '操作已取消'
    if (confirmType === 'batch_add' && pendingTasks.length > 0) {
      cancelMessage = `已取消添加 ${pendingTasks.length} 个日程`
    } else if (confirmType === 'batch_delete' && pendingDeleteTasks.length > 0) {
      cancelMessage = `已取消删除 ${pendingDeleteTasks.length} 个日程`
    } else if (confirmType === 'modify') {
      cancelMessage = '已取消修改日程'
    }
    
    // 在对话框添加取消消息
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: `❌ ${cancelMessage}`,
      timestamp: new Date(),
    })
    
    // 重置状态
    hideConfirmModal()
    clearAll()
    
    scrollToBottom()
  }, [confirmType, pendingTasks.length, pendingDeleteTasks.length, scrollToBottom, addMessage, hideConfirmModal, clearAll])

  // =============================================
  // 发送消息 - 使用流式客户端
  // =============================================

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setInputText('')
    setLoading(true)

    const aiMessageId = (Date.now() + 1).toString()
    setCurrentAiMessageId(aiMessageId)
    console.log('[主页面] 创建 AI 消息 ID:', aiMessageId)
    
    addMessage({
      id: aiMessageId,
      role: 'assistant',
      content: '',
      reasoning: [],
      tool_results: [],
      data: undefined,
      timestamp: new Date(),
    })

    console.log('[主页面] 开始流式请求，平台:', streamingClient.getPlatform())
    console.log('[主页面] 适配器能力:', streamingClient.getCapabilities())
    console.log('[主页面] 用户位置:', userLocation)

    const connection = streamingClient.connect(
      {
        url: '/api/agent/chat/stream',
        method: 'POST',
        data: {
          message: userMessage.content,
          userId: 'default-user',
          userLocation: userLocation,
        },
        timeout: 120000,
        retryCount: 1,
      },
      {
        onStart: (data) => {
          console.log('[主页面] 开始处理:', data, 'targetId:', aiMessageId)
          updateMessage(aiMessageId, { reasoning: ['正在思考...'] })
          scrollToBottom()
        },

        onReasoning: (data) => {
          console.log('[主页面] 思考步骤:', data.step)
          const currentMessages = useChatStore.getState().messages
          const msg = currentMessages.find(m => m.id === aiMessageId)
          if (!msg) return
          
          const newReasoning = [...(msg.reasoning || [])]
          if (data.step && !newReasoning.includes(data.step)) {
            newReasoning.push(data.step)
          }
          updateMessage(aiMessageId, { reasoning: newReasoning })
          scrollToBottom()
        },

        onToolResult: (data) => {
          console.log('[主页面] 工具结果:', data.tool, data.success)
          const currentMessages = useChatStore.getState().messages
          const msg = currentMessages.find(m => m.id === aiMessageId)
          if (!msg) return
          
          const newToolResults = [...(msg.tool_results || [])]
          newToolResults.push({
            tool: data.tool,
            args: {},
            result: {
              success: data.success,
              message: data.message,
              error: data.error,
              data: data.data,
            },
          })
          updateMessage(aiMessageId, { tool_results: newToolResults })
          scrollToBottom()
        },

        onContent: (data) => {
          const chunkText = data.content || ''
          if (chunkText) {
            appendToBuffer(chunkText, aiMessageId)
          }
        },

        onDone: (data) => {
          console.log('[主页面] 完成，原始数据:', data)
          
          flushBuffer()
          
          // ========== 检查是否需要确认 ==========
          const responseData = data.data as any
          if (responseData?.needConfirmation) {
            console.log('[主页面] 检测到待确认操作，类型:', responseData.confirmType)
            
            // 批量创建任务
            if (responseData.confirmType === 'batch_add' && responseData.pendingTasks) {
              console.log('[主页面] 待创建任务数量:', responseData.pendingTasks.length)
              showBatchAdd(responseData.pendingTasks)
            }
            // 批量删除任务
            else if (responseData.confirmType === 'batch_delete' && responseData.pendingDeleteTasks) {
              console.log('[主页面] 待删除任务数量:', responseData.pendingDeleteTasks.length)
              showBatchDelete(responseData.pendingDeleteTasks, responseData.pendingDeleteIds || [])
            }
            // 单个任务更新
            else if (responseData.confirmType === 'modify' && responseData.updatedTask) {
              console.log('[主页面] 待更新任务:', responseData.updatedTask.title)
              showModify(responseData.originalTask, responseData.updatedTask)
            }
          }
          
          const toolResults = data.tool_results?.map((tr: { tool: string; args?: unknown; result?: { success?: boolean; message?: string; error?: string } }) => ({
            tool: tr.tool,
            args: tr.args || {},
            result: {
              success: tr.result?.success ?? true,
              message: tr.result?.message,
              error: tr.result?.error,
            },
          })) || []
          
          updateMessage(aiMessageId, {
            content: data.content || '',
            reasoning: data.reasoning || [],
            tool_results: toolResults,
            data: data.data as any,
          })
          
          scrollToBottom()
          setLoading(false)
          setConnection(null)
          setCurrentAiMessageId(null)
        },

        onError: (error) => {
          console.error('[主页面] 错误:', error)
          
          flushBuffer()
          
          updateMessage(aiMessageId, { content: `错误: ${error.message || '未知错误'}` })
          scrollToBottom()
          setLoading(false)
          setConnection(null)
          setCurrentAiMessageId(null)
        },

        onFinally: () => {
          console.log('[主页面] 最终回调')
          setLoading(false)
        },
      }
    )

    setConnection(connection)

  }, [inputText, isLoading, userLocation, scrollToBottom, appendToBuffer, flushBuffer])

  // 取消流式输出
  const handleCancel = useCallback(() => {
    if (connectionRef.current) {
      console.log('[主页面] 用户取消')
      connectionRef.current.abort()
      connectionRef.current = null
      setLoading(false)
    }
  }, [setLoading])

  // 删除任务
  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await Network.request({
        url: '/api/agent/chat',
        method: 'POST',
        data: { message: `确认删除任务 ${taskId}` },
      })
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (error) {
      console.error('删除失败:', error)
    }
  }, [])

  // =============================================
  // 渲染任务图标
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

  // =============================================
  // 格式化时间
  // =============================================

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
  // 渲染思考过程
  // =============================================

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

  // =============================================
  // 渲染工具调用结果
  // =============================================

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

  // =============================================
  // 渲染数据卡片
  // =============================================

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

    // 待确认删除
    if (data.needConfirm && data.tasks) {
      const tasks = data.tasks
      return (
        <View className="mt-2">
          <Text className="text-sm font-medium text-red-500 mb-2">确认删除以下 {tasks.length} 个任务？</Text>
          {tasks.map((task, idx) => (
            <View key={idx} className="bg-white rounded-lg p-2 mb-2 flex items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium">{task.title}</Text>
                <Text className="text-xs text-gray-500">{formatDate(task.scheduled_time)}</Text>
              </View>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteTask(task.id)}>
                <Text className="text-xs text-white">删除</Text>
              </Button>
            </View>
          ))}
        </View>
      )
    }

    return null
  }

  // =============================================
  // 渲染消息
  // =============================================

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
            <Button size="default" className="rounded-full px-4" onClick={handleCancel}>
              <Text className="text-sm text-white">取消</Text>
            </Button>
          ) : (
            <Button size="default" className="rounded-full px-4" onClick={handleSend} disabled={!inputText.trim()}>
              <Send size={18} color={inputText.trim() ? '#fff' : '#999'} />
            </Button>
          )}
        </View>
      </View>

      {/* ========== 确认弹窗 ========== */}
      <ConfirmModal
        type={confirmType}
        visible={showConfirmModal}
        pendingTasks={pendingTasks}
        pendingDeleteTasks={pendingDeleteTasks}
        originalTask={originalTask ?? undefined}
        updatedTask={updatedTask ?? undefined}
        onConfirmBatchAdd={handleConfirmBatchAdd}
        onConfirmBatchDelete={handleConfirmBatchDelete}
        onConfirmModify={handleConfirmModify}
        onCancel={handleCancelConfirm}
      />
    </View>
  )
}

export default Index
