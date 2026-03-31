/**
 * 消息项组件
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Check, Loader } from 'lucide-react-taro'
import type { Message, ToolResult } from '@/stores/chatStore'
import { DataCard } from './data-card'

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

// =============================================
// 子组件
// =============================================

// 思考过程渲染
const ReasoningDisplay: FC<{ reasoning: string[]; isStreaming?: boolean }> = ({ reasoning, isStreaming }) => {
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

// 工具结果渲染
const ToolResultsDisplay: FC<{ toolResults: ToolResult[] }> = ({ toolResults }) => {
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
// 消息项组件
// =============================================

export interface MessageItemProps {
  message: Message
  isStreaming?: boolean
}

export const MessageItem: FC<MessageItemProps> = ({ message, isStreaming }) => {
  const showThinking = isStreaming && !message.content && (!message.reasoning || message.reasoning.length === 0)

  return (
    <View 
      className={`flex mb-3 w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
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
          <ReasoningDisplay reasoning={message.reasoning || []} isStreaming={isStreaming} />
          {message.content && (
            <Text className="block text-sm text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>
              {cleanJsonFromContent(message.content)}
            </Text>
          )}
          <ToolResultsDisplay toolResults={message.tool_results || []} />
          {message.data && <DataCard data={message.data} />}
        </View>
      )}
    </View>
  )
}

export default MessageItem
