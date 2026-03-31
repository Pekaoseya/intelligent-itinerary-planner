/**
 * 消息列表组件
 */

import { View, ScrollView } from '@tarojs/components'
import type { FC } from 'react'
import type { Message } from '@/stores/chatStore'
import { MessageItem } from './message-item'

export interface MessageListProps {
  messages: Message[]
  scrollCounter: number
  isLoading: boolean
}

export const MessageList: FC<MessageListProps> = ({ messages, scrollCounter, isLoading }) => {
  return (
    <ScrollView
      scrollY
      scrollIntoView={scrollCounter > 0 ? `scroll-bottom-${scrollCounter}` : 'scroll-bottom'}
      scrollWithAnimation
      className="flex-1 w-full overflow-hidden"
      style={{ paddingBottom: '80px', boxSizing: 'border-box' }}
    >
      <View className="w-full px-4 box-border">
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
