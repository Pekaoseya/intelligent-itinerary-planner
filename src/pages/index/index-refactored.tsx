/**
 * 主页面（重构后示例）
 * 代码量：1093 行 → 约 150 行
 * 
 * 职责：
 * - 页面布局
 * - 组合各个组件和 Hooks
 * - 不包含业务逻辑
 */
import { View } from '@tarojs/components'
import { useState } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'

// 组件
import { LocationBar } from './components/LocationBar'
import { MessageList } from './components/MessageList'
import { InputBar } from './components/InputBar'
import { LocationDetailModal } from './components/LocationDetailModal'

// Hooks
import { useLocation } from '@/hooks/useLocation'
import { useChat } from '@/hooks/useChat'

// 类型
import type { Message } from '@/types/chat'

import './index.css'

const Index: FC = () => {
  // ========== Hooks ==========
  const location = useLocation()
  const chat = useChat()
  
  // ========== 渲染 ==========
  return (
    <View className="flex flex-col h-screen bg-gray-50">
      {/* 定位栏 */}
      <LocationBar
        location={location.location}
        loading={location.loading}
        error={location.error}
        onRefresh={location.fetchLocation}
        onShowDetail={location.showLocationDetail}
      />
      
      {/* 消息列表 */}
      <MessageList
        messages={chat.messages}
        loading={chat.isLoading}
        scrollCounter={chat.scrollCounter}
      />
      
      {/* 输入栏 */}
      <InputBar
        value={chat.inputText}
        loading={chat.isLoading}
        onChange={chat.setInputText}
        onSend={chat.sendMessage}
      />
      
      {/* 定位详情弹窗 */}
      <LocationDetailModal
        visible={location.showDetail}
        address={location.location?.name || ''}
        onClose={location.hideLocationDetail}
      />
    </View>
  )
}

export default Index
