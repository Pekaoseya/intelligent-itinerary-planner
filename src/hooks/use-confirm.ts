/**
 * 确认操作 Hook
 * 封装批量创建/删除/更新任务的确认逻辑
 */

import { useCallback } from 'react'
import Taro from '@tarojs/taro'
import { taskService } from '@/services'
import { useConfirmStore, type ConfirmType } from '@/stores/confirmStore'
import { useChatStore } from '@/stores/chatStore'

export interface UseConfirmOptions {
  onScrollToBottom?: () => void
}

export interface UseConfirmResult {
  // 状态
  visible: boolean
  confirmType: ConfirmType
  pendingTasks: any[]
  pendingDeleteTasks: any[]
  pendingDeleteIds: string[]
  originalTask: any | null
  updatedTask: any | null
  routes: any[]
  summary: string
  reasoning: string[]
  
  // 操作
  confirmBatchAdd: () => Promise<void>
  confirmBatchDelete: () => Promise<void>
  confirmModify: () => Promise<void>
  confirmTripPlan: () => Promise<void>
  cancelConfirm: () => void
}

export function useConfirm(options: UseConfirmOptions = {}): UseConfirmResult {
  const { onScrollToBottom } = options
  
  const {
    visible,
    confirmType,
    pendingTasks,
    pendingDeleteTasks,
    pendingDeleteIds,
    originalTask,
    updatedTask,
    routes,
    summary,
    reasoning,
    hide: hideConfirmModal,
    clearPendingTasks,
    clearPendingDeleteTasks,
    clearAll,
  } = useConfirmStore()
  
  const {
    setLoading,
    addMessage,
  } = useChatStore()
  
  // 确认批量创建
  const confirmBatchAdd = useCallback(async () => {
    if (pendingTasks.length === 0) return
    
    try {
      setLoading(true)
      console.log('[useConfirm] 批量创建任务:', pendingTasks.length)
      
      const result = await taskService.batchCreateTasks(pendingTasks)
      const createdCount = result.createdCount || pendingTasks.length
      
      Taro.showToast({ title: `成功创建 ${createdCount} 个日程`, icon: 'success' })
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 已添加 ${createdCount} 个日程`,
        timestamp: new Date(),
      })
      
      hideConfirmModal()
      clearPendingTasks()
      onScrollToBottom?.()
    } catch (error) {
      console.error('[useConfirm] 批量创建失败:', error)
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [pendingTasks, onScrollToBottom, setLoading, addMessage, hideConfirmModal, clearPendingTasks])
  
  // 确认批量删除
  const confirmBatchDelete = useCallback(async () => {
    if (pendingDeleteIds.length === 0) return
    
    try {
      setLoading(true)
      console.log('[useConfirm] 批量删除任务:', pendingDeleteIds.length)
      
      const result = await taskService.batchDeleteTasks(pendingDeleteIds)
      const deletedCount = result.deletedCount || pendingDeleteIds.length
      
      Taro.showToast({ title: `已删除 ${deletedCount} 个日程`, icon: 'success' })
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `🗑️ 已删除 ${deletedCount} 个日程`,
        timestamp: new Date(),
      })
      
      hideConfirmModal()
      clearPendingDeleteTasks()
      onScrollToBottom?.()
    } catch (error) {
      console.error('[useConfirm] 批量删除失败:', error)
      Taro.showToast({ title: '删除失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [pendingDeleteIds, onScrollToBottom, setLoading, addMessage, hideConfirmModal, clearPendingDeleteTasks])
  
  // 确认修改
  const confirmModify = useCallback(async () => {
    if (!updatedTask) return
    
    try {
      setLoading(true)
      console.log('[useConfirm] 更新任务:', updatedTask.title)
      
      await taskService.updateTask((updatedTask as any).id, updatedTask)
      
      Taro.showToast({ title: '修改成功', icon: 'success' })
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 已修改日程：${updatedTask.title}`,
        timestamp: new Date(),
      })
      
      hideConfirmModal()
      clearAll()
      onScrollToBottom?.()
    } catch (error) {
      console.error('[useConfirm] 更新失败:', error)
      Taro.showToast({ title: '修改失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [updatedTask, onScrollToBottom, setLoading, addMessage, hideConfirmModal, clearAll])
  
  // 确认行程规划
  const confirmTripPlan = useCallback(async () => {
    if (pendingTasks.length === 0) {
      console.warn('[useConfirm] confirmTripPlan: pendingTasks 为空')
      return
    }

    try {
      setLoading(true)
      console.log('[useConfirm] 确认行程规划:', pendingTasks.length, '个任务')
      console.log('[useConfirm] pendingTasks 数据结构:', JSON.stringify(pendingTasks, null, 2))

      // 检查每个任务的必需字段
      for (let i = 0; i < pendingTasks.length; i++) {
        const task = pendingTasks[i]
        console.log(`[useConfirm] 任务 ${i + 1}:`, {
          title: task.title,
          type: task.type,
          scheduled_time: task.scheduled_time,
          destination_name: task.destination_name,
          hasMetadata: !!task.metadata,
        })

        if (!task.title || !task.type || !task.scheduled_time) {
          console.error(`[useConfirm] 任务 ${i + 1} 缺少必需字段:`, task)
          Taro.showToast({ title: '任务数据不完整', icon: 'error' })
          return
        }
      }

      const result = await taskService.batchCreateTasks(pendingTasks)
      console.log('[useConfirm] 批量创建结果:', result)
      const createdCount = result.createdCount || pendingTasks.length

      Taro.showToast({ title: `已创建 ${createdCount} 个行程任务`, icon: 'success' })

      // 生成行程摘要
      const taskSummary = pendingTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')

      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 行程规划已完成，已创建 ${createdCount} 个任务：\n${taskSummary}`,
        timestamp: new Date(),
      })

      hideConfirmModal()
      clearAll()
      onScrollToBottom?.()
    } catch (error) {
      console.error('[useConfirm] 行程规划确认失败:', error)
      console.error('[useConfirm] 错误详情:', {
        message: (error as any).message,
        stack: (error as any).stack,
        response: (error as any).response,
      })
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [pendingTasks, onScrollToBottom, setLoading, addMessage, hideConfirmModal, clearAll])
  
  // 取消确认
  const cancelConfirm = useCallback(() => {
    console.log('[useConfirm] 用户取消操作')
    
    // 根据操作类型生成取消消息
    let cancelMessage = '操作已取消'
    if (confirmType === 'trip_plan') {
      cancelMessage = '已取消行程规划'
    } else if (confirmType === 'batch_add' && pendingTasks.length > 0) {
      cancelMessage = `已取消添加 ${pendingTasks.length} 个日程`
    } else if (confirmType === 'batch_delete' && pendingDeleteTasks.length > 0) {
      cancelMessage = `已取消删除 ${pendingDeleteTasks.length} 个日程`
    } else if (confirmType === 'modify') {
      cancelMessage = '已取消修改日程'
    }
    
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: `❌ ${cancelMessage}`,
      timestamp: new Date(),
    })
    
    hideConfirmModal()
    clearAll()
    onScrollToBottom?.()
  }, [confirmType, pendingTasks.length, pendingDeleteTasks.length, onScrollToBottom, addMessage, hideConfirmModal, clearAll])
  
  return {
    visible,
    confirmType: confirmType || 'batch_add',
    pendingTasks,
    pendingDeleteTasks,
    pendingDeleteIds,
    originalTask,
    updatedTask,
    routes,
    summary,
    reasoning,
    confirmBatchAdd,
    confirmBatchDelete,
    confirmModify,
    confirmTripPlan,
    cancelConfirm,
  }
}
