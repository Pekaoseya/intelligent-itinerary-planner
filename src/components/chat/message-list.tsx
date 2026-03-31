/**
 * 消息列表组件
 */

import { View, ScrollView } from '@tarojs/components'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import type { Message } from '@/stores/chatStore'
import { MessageItem } from './message-item'

export interface MessageListProps {
  messages: Message[]
  scrollCounter: number
  isLoading: boolean
}

export const MessageList: FC<MessageListProps> = ({ messages, scrollCounter, isLoading }) => {
  // 计算ScrollView高度：屏幕高度 - 定位栏高度(36px) - 底部输入框和TabBar(约120px)
  const systemInfo = Taro.getSystemInfoSync()
  const locationBarHeight = 36
  const inputBarHeight = 120  // 输入框 + TabBar + 安全区域
  const scrollViewHeight = systemInfo.windowHeight - locationBarHeight - inputBarHeight

  return (
    <ScrollView
      scrollY
      scrollIntoView={scrollCounter > 0 ? `scroll-bottom-${scrollCounter}` : 'scroll-bottom'}
      scrollWithAnimation
      style={{
        height: `${scrollViewHeight}px`,
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <View className="w-full px-4 box-border" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
        {messages.map((message, index) => {
          const isStreaming = isLoading && message.role === 'assistant' && index === messages.length - 1
          return (
            <MessageItem 
              key={message.id} 
              message={message} 
              isStreaming={isStreaming}
            />
          )
        })}
        <View id={`scroll-bottom-${scrollCounter}`} style={{ height: '1px' }} />
      </View>
    </ScrollView>
  )
}

export default MessageList
