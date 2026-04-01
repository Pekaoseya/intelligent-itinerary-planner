/**
 * AI 对话 Hook
 * 封装 AI 对话、流式响应、消息处理逻辑
 */

import { useCallback, useRef } from 'react'
import { streamingClient, type StreamConnection } from '@/streaming'
import { useChatStore, type Message } from '@/stores/chatStore'
import { useConfirmStore } from '@/stores/confirmStore'
import type { UserLocation } from '@/types'

export interface UseAIOptions {
  userLocation: UserLocation | null
  onScrollToBottom?: () => void
}

export interface UseAIResult {
  isLoading: boolean
  sendMessage: (content: string) => Promise<void>
  cancelStream: () => void
}

export function useAI(options: UseAIOptions): UseAIResult {
  const { userLocation, onScrollToBottom } = options
  
  const {
    isLoading,
    setLoading,
    addMessage,
    updateMessage,
    setInputText,
    setCurrentAiMessageId,
    appendToBuffer,
    flushBuffer,
    setConnection,
  } = useChatStore()
  
  const {
    showBatchAdd,
    showBatchDelete,
    showModify,
    showTripPlan,
  } = useConfirmStore()
  
  // 保存当前流式连接
  const connectionRef = useRef<StreamConnection | null>(null)
  
  // 发送消息
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }
    
    addMessage(userMessage)
    setInputText('')
    setLoading(true)
    
    const aiMessageId = (Date.now() + 1).toString()
    setCurrentAiMessageId(aiMessageId)
    
    addMessage({
      id: aiMessageId,
      role: 'assistant',
      content: '',
      reasoning: [],
      tool_results: [],
      data: undefined,
      timestamp: new Date(),
    })
    
    console.log('[useAI] 开始流式请求')
    
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
        onStart: () => {
          updateMessage(aiMessageId, { reasoning: ['正在思考...'] })
          onScrollToBottom?.()
        },
        
        onReasoning: (data) => {
          const currentMessages = useChatStore.getState().messages
          const msg = currentMessages.find(m => m.id === aiMessageId)
          if (!msg) return
          
          const newReasoning = [...(msg.reasoning || [])]
          if (data.step && !newReasoning.includes(data.step)) {
            newReasoning.push(data.step)
          }
          updateMessage(aiMessageId, { reasoning: newReasoning })
          onScrollToBottom?.()
        },
        
        onSubAgentProgress: (data) => {
          // 子 Agent 进度：实时显示子智能体的思考过程
          const currentMessages = useChatStore.getState().messages
          const msg = currentMessages.find(m => m.id === aiMessageId)
          if (!msg) return
          
          // 将子 Agent 进度添加到 reasoning 中显示
          // 新格式: { agent, phase, message, messageKey?, data?, timestamp? }
          const progressText = data.message
          const newReasoning = [...(msg.reasoning || [])]
          if (progressText && !newReasoning.includes(progressText)) {
            newReasoning.push(progressText)
          }
          updateMessage(aiMessageId, { reasoning: newReasoning })
          onScrollToBottom?.()
        },
        
        onToolResult: (data) => {
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
          onScrollToBottom?.()
        },
        
        onContent: (data) => {
          const chunkText = data.content || ''
          if (chunkText) {
            appendToBuffer(chunkText, aiMessageId)
          }
        },
        
        onDone: (data) => {
          flushBuffer()
          
          // 检查是否需要确认
          const responseData = data.data as any
          if (responseData?.needConfirmation) {
            handleConfirmation(responseData)
          }
          
          // 获取当前消息状态
          const currentMessages = useChatStore.getState().messages
          const msg = currentMessages.find(m => m.id === aiMessageId)
          
          // 使用后端返回的数据，但如果为空则保留流式过程中收集的数据
          const finalReasoning = (data.reasoning && data.reasoning.length > 0) 
            ? data.reasoning 
            : (msg?.reasoning || [])
          
          const finalToolResults = (data.tool_results && data.tool_results.length > 0)
            ? data.tool_results.map((tr: any) => ({
                tool: tr.tool,
                args: tr.args || {},
                result: {
                  success: tr.result?.success ?? true,
                  message: tr.result?.message,
                  error: tr.result?.error,
                },
              }))
            : (msg?.tool_results || [])
          
          updateMessage(aiMessageId, {
            content: data.content || '',
            reasoning: finalReasoning,
            tool_results: finalToolResults,
            data: data.data as any,
          })
          
          onScrollToBottom?.()
          setLoading(false)
          setConnection(null)
          setCurrentAiMessageId(null)
        },
        
        onError: (error) => {
          console.error('[useAI] 错误:', error)
          flushBuffer()
          updateMessage(aiMessageId, { content: `错误: ${error.message || '未知错误'}` })
          onScrollToBottom?.()
          setLoading(false)
          setConnection(null)
          setCurrentAiMessageId(null)
        },
        
        onFinally: () => {
          setLoading(false)
        },
      }
    )
    
    setConnection(connection)
    connectionRef.current = connection
  }, [isLoading, userLocation, onScrollToBottom, addMessage, updateMessage, setInputText, setLoading, setCurrentAiMessageId, appendToBuffer, flushBuffer, setConnection, showBatchAdd, showBatchDelete, showModify])
  
  // 处理确认操作
  const handleConfirmation = (responseData: any) => {
    console.log('[useAI] 检测到待确认操作，类型:', responseData.confirmType)
    
    if (responseData.confirmType === 'trip_plan' && responseData.splitTasks) {
      // 行程规划确认
      showTripPlan(
        responseData.splitTasks,
        responseData.routes || [],
        responseData.summary || '',
        responseData.reasoning || []
      )
    } else if (responseData.confirmType === 'batch_add' && responseData.pendingTasks) {
      showBatchAdd(responseData.pendingTasks)
    } else if (responseData.confirmType === 'batch_delete' && responseData.pendingDeleteTasks) {
      showBatchDelete(responseData.pendingDeleteTasks, responseData.pendingDeleteIds || [])
    } else if (responseData.confirmType === 'modify' && responseData.updatedTask) {
      showModify(responseData.originalTask, responseData.updatedTask)
    }
  }
  
  // 取消流式输出
  const cancelStream = useCallback(() => {
    if (connectionRef.current) {
      console.log('[useAI] 用户取消')
      connectionRef.current.abort()
      connectionRef.current = null
      setLoading(false)
    }
  }, [setLoading])
  
  return {
    isLoading,
    sendMessage,
    cancelStream,
  }
}
