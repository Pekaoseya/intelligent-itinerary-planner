import { View, Text, ScrollView, Input } from '@tarojs/components'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Send, Car, TrainFront, Plane, Users, Utensils, Building2, Check, Loader, MapPin, Clock, Trash2, Locate } from 'lucide-react-taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { streamingClient, type StreamConnection } from '@/streaming'
import './index.css'

// =============================================
// 类型定义
// =============================================

type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'
type TaskStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

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

interface ToolResult {
  tool: string
  args: unknown
  result: {
    success: boolean
    data?: unknown
    message?: string
    error?: string
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string[]
  tool_results?: ToolResult[]
  data?: unknown
  timestamp: Date
}

// =============================================
// 主组件
// =============================================

const Index: FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是您的智能助手。\n\n我可以帮您管理任务：打车、火车、飞机、会议、餐饮、酒店、事务等。\n\n直接告诉我您想做什么，我会理解您的需求。',
      timestamp: new Date(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [scrollCounter, setScrollCounter] = useState(0)
  
  // 定位相关状态
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationError, setLocationError] = useState<string | null>(null)
  
  // 保存当前流式连接，用于取消
  const connectionRef = useRef<StreamConnection | null>(null)
  
  // 保存当前 AI 消息 ID，避免闭包问题
  const currentAiMessageIdRef = useRef<string | null>(null)
  
  // ========== 性能优化：缓冲渲染 ==========
  // 内容缓冲区：收到 chunk 先存这里，定时批量更新到 state
  const contentBufferRef = useRef<string>('')
  // 缓冲定时器（使用 ReturnType<typeof setTimeout> 兼容各环境）
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 缓冲更新间隔（毫秒）
  const BUFFER_INTERVAL = 80
  
  /**
   * 将内容追加到缓冲区，定时批量更新到 state
   * 避免每个 chunk 都触发 setMessages 遍历整个列表
   */
  const appendToBuffer = useCallback((chunk: string) => {
    if (!chunk) return
    
    // 追加到缓冲区
    contentBufferRef.current += chunk
    
    // 如果定时器不存在，创建一个
    if (!bufferTimerRef.current) {
      bufferTimerRef.current = setTimeout(() => {
        const bufferedContent = contentBufferRef.current
        contentBufferRef.current = ''  // 清空缓冲区
        bufferTimerRef.current = null  // 清空定时器
        
        const targetId = currentAiMessageIdRef.current
        if (bufferedContent && targetId) {
          // 批量更新到 state
          setMessages(prev => prev.map(m => {
            if (m.id === targetId) {
              return { ...m, content: m.content + bufferedContent }
            }
            return m
          }))
        }
      }, BUFFER_INTERVAL)
    }
    // 如果定时器已存在，等待它触发（期间新内容会继续追加到 buffer）
  }, [])
  
  /**
   * 立即刷新缓冲区（用于流结束时确保所有内容都更新）
   */
  const flushBuffer = useCallback(() => {
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current)
      bufferTimerRef.current = null
    }
    
    const bufferedContent = contentBufferRef.current
    contentBufferRef.current = ''
    
    const targetId = currentAiMessageIdRef.current
    if (bufferedContent && targetId) {
      setMessages(prev => prev.map(m => {
        if (m.id === targetId) {
          return { ...m, content: m.content + bufferedContent }
        }
        return m
      }))
    }
  }, [])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    setScrollCounter(prev => prev + 1)
  }, [])

  // =============================================
  // 获取用户定位（重构版）
  // =============================================
  const fetchLocation = useCallback(async () => {
    setLocationLoading(true)
    setLocationError(null)
    console.log('[定位] 开始获取...')

    try {
      const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

      if (isWeapp) {
        // 小程序端：获取定位
        const location = await Taro.getLocation({ type: 'gcj02' })
        console.log('[定位] 小程序获取成功:', location.latitude, location.longitude)

        // 调用逆地理编码获取地址名称
        try {
          const res = await Network.request({
            url: '/api/map/reverse-geocode',
            method: 'GET',
            data: { lng: location.longitude, lat: location.latitude },
          })
          // 优先显示地址，如果地址是坐标格式也接受，最后才显示"定位失败"
          const addressName = res.data?.data?.address
          console.log('[定位] 逆地理编码响应:', res.data)
          console.log('[定位] 逆地理编码结果:', addressName)
          setUserLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: addressName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          })
          setLocationError(null)
        } catch (geocodeError) {
          console.warn('[定位] 逆地理编码失败:', geocodeError)
          // 逆地理编码失败时，显示坐标
          setUserLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          })
        }
      } else {
        // H5 端：尝试获取定位
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
                  console.log('[定位] H5逆地理编码响应:', res.data)
                  setUserLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    name: addressName || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
                  })
                } catch {
                  // 逆地理编码失败时，显示坐标
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
                // 使用默认位置
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
      // 定位失败，使用默认位置
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

  // 启动时获取定位
  useEffect(() => {
    fetchLocation()
  }, [fetchLocation])

  // =============================================
  // 清理 JSON 代码块
  // =============================================
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

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)

    // 创建 AI 消息占位
    const aiMessageId = (Date.now() + 1).toString()
    currentAiMessageIdRef.current = aiMessageId  // 保存到 ref
    console.log('[主页面] 创建 AI 消息 ID:', aiMessageId)
    
    setMessages(prev => [...prev, {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      reasoning: [],
      tool_results: [],
      data: undefined,
      timestamp: new Date(),
    }])

    // 使用流式客户端
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
          console.log('[主页面] 开始处理:', data, 'targetId:', currentAiMessageIdRef.current)
          const targetId = currentAiMessageIdRef.current
          if (targetId) {
            setMessages(prev => prev.map(m =>
              m.id === targetId ? { ...m, reasoning: ['正在思考...'] } : m
            ))
          }
          scrollToBottom()
        },

        onReasoning: (data) => {
          console.log('[主页面] 思考步骤:', data.step)
          const targetId = currentAiMessageIdRef.current
          if (!targetId) return
          
          setMessages(prev => prev.map(m => {
            if (m.id !== targetId) return m
            const newReasoning = [...(m.reasoning || [])]
            if (data.step && !newReasoning.includes(data.step)) {
              newReasoning.push(data.step)
            }
            return { ...m, reasoning: newReasoning }
          }))
          scrollToBottom()
        },

        onToolResult: (data) => {
          console.log('[主页面] 工具结果:', data.tool, data.success)
          const targetId = currentAiMessageIdRef.current
          if (!targetId) return
          
          setMessages(prev => prev.map(m => {
            if (m.id !== targetId) return m
            const newToolResults = [...(m.tool_results || [])]
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
            return { ...m, tool_results: newToolResults }
          }))
          scrollToBottom()
        },

        onContent: (data) => {
          const chunkText = data.content || ''
          if (chunkText) {
            // 使用缓冲机制，避免每个 chunk 都触发 state 更新
            appendToBuffer(chunkText)
          }
        },

        onDone: (data) => {
          console.log('[主页面] 完成')
          
          // 先刷新缓冲区，确保所有内容都更新
          flushBuffer()
          
          const targetId = currentAiMessageIdRef.current
          if (!targetId) return
          
          setMessages(prev => prev.map(m => {
            if (m.id !== targetId) return m
            // 正确解析 tool_results 结构：{ tool, args, result: { success, message, error } }
            const toolResults = data.tool_results?.map((tr: { tool: string; args?: unknown; result?: { success?: boolean; message?: string; error?: string } }) => ({
              tool: tr.tool,
              args: tr.args || {},
              result: {
                success: tr.result?.success ?? true,
                message: tr.result?.message,
                error: tr.result?.error,
              },
            })) || m.tool_results
            return {
              ...m,
              content: data.content || m.content,
              reasoning: data.reasoning || m.reasoning,
              tool_results: toolResults,
              data: data.data,
            }
          }))
          scrollToBottom()
          setIsLoading(false)
          connectionRef.current = null
          currentAiMessageIdRef.current = null
        },

        onError: (error) => {
          console.error('[主页面] 错误:', error)
          
          // 先刷新缓冲区
          flushBuffer()
          
          const targetId = currentAiMessageIdRef.current
          if (targetId) {
            setMessages(prev => prev.map(m =>
              m.id === targetId ? { ...m, content: `错误: ${error.message || '未知错误'}` } : m
            ))
          }
          scrollToBottom()
          setIsLoading(false)
          connectionRef.current = null
          currentAiMessageIdRef.current = null
        },

        onFinally: () => {
          console.log('[主页面] 最终回调')
          setIsLoading(false)
        },
      }
    )

    connectionRef.current = connection

  }, [inputText, isLoading, userLocation, scrollToBottom])

  // 取消流式输出
  const handleCancel = useCallback(() => {
    if (connectionRef.current) {
      console.log('[主页面] 用户取消')
      connectionRef.current.abort()
      connectionRef.current = null
      setIsLoading(false)
    }
  }, [])

  // =============================================
  // 删除任务
  // =============================================

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

    const data = message.data as Record<string, unknown>

    // 单个任务
    if (data.task) {
      const task = data.task as Task
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
      const task = data.deleted as Task
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
      const deletedCount = data.deletedCount as number
      return (
        <Card className="rounded-xl mt-2 overflow-hidden bg-red-50">
          <CardContent className="p-3">
            <View className="flex items-center gap-2">
              <Trash2 size={16} color="#ff4d4f" />
              <Text className="text-sm font-medium text-red-500">已删除 {deletedCount} 个任务</Text>
            </View>
          </CardContent>
        </Card>
      )
    }

    // 任务列表
    if (data.tasks) {
      const tasks = data.tasks as Task[]
      if (tasks.length > 0) {
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
    }

    // 待确认删除
    if (data.needConfirm && data.tasks) {
      const tasks = data.tasks as Task[]
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
        onClick={locationLoading ? undefined : fetchLocation}
        style={{ minHeight: '36px' }}
      >
        {locationLoading ? (
          <View className="flex items-center gap-1">
            <Loader size={12} color="#1890ff" className="animate-spin" />
            <Text className="text-xs text-gray-500">获取定位中...</Text>
          </View>
        ) : locationError ? (
          <View className="flex items-center gap-1">
            <MapPin size={12} color="#ff4d4f" />
            <Text className="text-xs text-red-500">{locationError}</Text>
            <Locate size={12} color="#1890ff" style={{ marginLeft: '4px' }} />
          </View>
        ) : (
          <View className="flex items-center gap-1">
            <MapPin size={12} color="#1890ff" />
            <Text className="text-xs text-gray-600">{userLocation?.name || '未知位置'}</Text>
            <Text className="text-xs text-gray-400 ml-1">点击刷新</Text>
          </View>
        )}
      </View>

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
    </View>
  )
}

export default Index
