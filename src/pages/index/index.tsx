import { View } from '@tarojs/components'
import { useCallback, useEffect } from 'react'
import type { FC } from 'react'
import { ConfirmModal } from '@/components/confirmation'
import { LocationBar, ChatInput, MessageList } from '@/components/chat'
import { useLocation, useAI, useConfirm } from '@/hooks'
import { useChatStore } from '@/stores/chatStore'
import './index.css'

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
    routes,
    summary,
    reasoning,
    conflicts,
    canConfirm,
    conflictOptimization,
    isOptimizing,
    confirmBatchAdd,
    confirmBatchDelete,
    confirmModify,
    confirmTripPlan,
    optimizeConflicts,
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
  
  // =============================================
  // 渲染
  // =============================================

  return (
    <View
      className="flex flex-col overflow-hidden bg-gray-50 safe-container"
      style={{ width: '100%', height: '100%', backgroundColor: '#f5f5f5', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {/* 定位栏 */}
      <LocationBar
        location={userLocation}
        loading={locationLoading}
        error={locationError}
        showDetail={showLocationDetail}
        onRefresh={fetchLocation}
        onShowDetail={setShowLocationDetail}
      />

      {/* 消息列表 */}
      <MessageList
        messages={messages}
        scrollCounter={scrollCounter}
        isLoading={isLoading}
      />

      {/* 输入框 */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        loading={isLoading}
        onCancel={cancelStream}
      />

      {/* 确认弹窗 */}
      <ConfirmModal
        type={confirmType || 'batch_add'}
        visible={showConfirmModal}
        pendingTasks={pendingTasks}
        pendingDeleteTasks={pendingDeleteTasks}
        originalTask={originalTask ?? undefined}
        updatedTask={updatedTask ?? undefined}
        routes={routes}
        summary={summary}
        reasoning={reasoning}
        conflicts={conflicts}
        canConfirm={canConfirm}
        conflictOptimization={conflictOptimization}
        isOptimizing={isOptimizing}
        onOptimize={optimizeConflicts}
        onConfirmBatchAdd={confirmBatchAdd}
        onConfirmBatchDelete={confirmBatchDelete}
        onConfirmModify={confirmModify}
        onConfirmTripPlan={confirmTripPlan}
        onCancel={cancelConfirm}
      />
    </View>
  )
}

export default Index
