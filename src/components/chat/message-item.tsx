/**
 * 消息项组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { User, Bot, Check, MapPin, Clock, Car, TrainFront, Plane } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import type { Message, ToolResult } from '@/types'

export interface MessageItemProps {
  message: Message
}

// 格式化时间
const formatTime = (timeStr?: string | null): string => {
  if (!timeStr) return '--:--'
  try {
    const date = new Date(timeStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch {
    return '--:--'
  }
}

// 获取工具图标
const getToolIcon = (toolName: string) => {
  if (toolName.includes('taxi')) return <Car size={16} color="#faad14" />
  if (toolName.includes('train')) return <TrainFront size={16} color="#1890ff" />
  if (toolName.includes('flight')) return <Plane size={16} color="#722ed1" />
  return <Check size={16} color="#52c41a" />
}

// 工具结果卡片
const ToolResultCard: FC<{ result: ToolResult }> = ({ result }) => {
  const isSuccess = result.result.success
  const data = result.result.data as any

  return (
    <Card className="rounded-lg mb-2">
      <CardContent className="p-3">
        <View className="flex items-center gap-2 mb-2">
          {getToolIcon(result.tool)}
          <Text className="text-sm font-medium">{result.tool.replace(/_/g, ' ')}</Text>
          <View className={`px-2 py-1 rounded text-xs ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            <Text className={isSuccess ? 'text-green-600' : 'text-red-600'}>
              {isSuccess ? '成功' : '失败'}
            </Text>
          </View>
        </View>

        {data?.title && (
          <Text className="text-sm text-gray-700 mb-1">{data.title}</Text>
        )}
        {data?.scheduled_time && (
          <View className="flex items-center gap-1 mb-1">
            <Clock size={12} color="#999" />
            <Text className="text-xs text-gray-500">{formatTime(data.scheduled_time)}</Text>
          </View>
        )}
        {data?.location_name && (
          <View className="flex items-center gap-1">
            <MapPin size={12} color="#999" />
            <Text className="text-xs text-gray-500">{data.location_name}</Text>
          </View>
        )}
      </CardContent>
    </Card>
  )
}

export const MessageItem: FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user'

  return (
    <View className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 头像 */}
        <View
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-blue-500 ml-2' : 'bg-gray-200 mr-2'}`}
        >
          {isUser ? <User size={16} color="#fff" /> : <Bot size={16} color="#666" />}
        </View>

        {/* 消息内容 */}
        <View className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* 文本内容 */}
          <View
            className={`px-4 py-2 rounded-2xl ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            <Text className="text-sm whitespace-pre-wrap">{message.content}</Text>
          </View>

          {/* 工具结果 */}
          {message.tool_results && message.tool_results.length > 0 && (
            <View className="mt-2 w-full">
              {message.tool_results.map((result, idx) => (
                <ToolResultCard key={idx} result={result} />
              ))}
            </View>
          )}

          {/* 时间戳 */}
          <Text className="text-xs text-gray-400 mt-1">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    </View>
  )
}

export default MessageItem
