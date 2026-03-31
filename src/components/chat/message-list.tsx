/**
 * 消息列表组件
 */

import { View, ScrollView } from '@tarojs/components'
import type { FC } from 'react'
import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import { MessageItem } from './message-item'

export interface MessageListProps {
  messages: Message[]
  scrollCounter?: number
}

export const MessageList: FC<MessageListProps> = ({ messages, scrollCounter = 0 }) => {
  const scrollViewRef = useRef<string>(`scroll-${Date.now()}`)

  // 滚动到底部
  useEffect(() => {
    // 触发滚动
    scrollViewRef.current = `scroll-${Date.now()}-${scrollCounter}`
  }, [scrollCounter, messages.length])

  return (
    <ScrollView
      scrollY
      scrollIntoView={scrollViewRef.current}
      className="flex-1 px-4"
      style={{ height: '100%', width: '100%' }}
    >
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <View id={scrollViewRef.current} />
    </ScrollView>
  )
}

export default MessageList
