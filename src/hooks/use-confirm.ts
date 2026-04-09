/**
 * 确认操作 Hook
 * 封装批量创建/删除/更新任务的确认逻辑
 */

import { useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
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
  conflicts: any[]
  hasConflict: boolean
  canConfirm: boolean
  conflictOptimization: any
  isOptimizing: boolean

  // 操作
  confirmBatchAdd: () => Promise<void>
  confirmBatchDelete: () => Promise<void>
  confirmModify: () => Promise<void>
  confirmTripPlan: () => Promise<void>
  optimizeConflicts: () => Promise<void>
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
    conflicts,
    hasConflict,
    canConfirm,
    conflictOptimization,
    isOptimizing,
    hide: hideConfirmModal,
    clearPendingTasks,
    clearPendingDeleteTasks,
    clearAll,
    setConflicts,
    setConflictOptimization,
    setOptimizing,
  } = useConfirmStore()
  
  const {
    setLoading,
    addMessage,
  } = useChatStore()

  // =============================================
  // 时间冲突检测
  // =============================================

  /**
   * 检测任务时间冲突
   */
  const checkConflicts = useCallback(async (tasks: any[]) => {
    if (tasks.length === 0) {
      setConflicts([], true)
      return
    }

    try {
      // 获取已有的任务
      const existingTasks = await taskService.getTasks()

      // 检测每个新任务与已有任务的冲突
      const conflictList: any[] = []
      let hasSeriousConflict = false

      for (const newTask of tasks) {
        const newStart = new Date(newTask.scheduled_time).getTime()
        const newDuration = newTask.metadata?.duration || 60 // 默认60分钟
        const newEnd = newStart + newDuration * 60 * 1000

        for (const existingTask of existingTasks) {
          // 跳过非pending状态的任务
          if (existingTask.status !== 'pending') continue

          const existingStart = new Date(existingTask.scheduled_time).getTime()
          // 从 metadata 中获取 duration，如果没有则使用默认值
          const existingDuration = existingTask.metadata?.duration ? Math.ceil((existingTask.metadata.duration as number) / 60) : 60
          const existingEnd = existingStart + existingDuration * 60 * 1000

          // 检测时间重叠
          if (newStart < existingEnd && newEnd > existingStart) {
            const overlapStart = Math.max(newStart, existingStart)
            const overlapEnd = Math.min(newEnd, existingEnd)
            const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000)

            // 只报告严重冲突（重叠超过5分钟）
            if (overlapMinutes > 5) {
              conflictList.push({
                newTask,
                existingTask,
                overlapMinutes,
              })

              // 严重冲突：重叠超过15分钟
              if (overlapMinutes > 15) {
                hasSeriousConflict = true
              }
            }
          }
        }
      }

      console.log('[useConfirm] 冲突检测结果:', {
        总任务数: tasks.length,
        冲突数: conflictList.length,
        严重冲突: hasSeriousConflict,
      })

      // 如果有严重冲突，不允许确认
      setConflicts(conflictList, !hasSeriousConflict)
    } catch (error) {
      console.error('[useConfirm] 冲突检测失败:', error)
      setConflicts([], true) // 出错时允许确认
    }
  }, [setConflicts, taskService])

  // 当 pendingTasks 变化时，自动检测冲突
  useEffect(() => {
    if (visible && (confirmType === 'batch_add' || confirmType === 'trip_plan') && pendingTasks.length > 0) {
      checkConflicts(pendingTasks)
    }
  }, [visible, confirmType, pendingTasks, checkConflicts])
  
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

  // 优化冲突
  const optimizeConflicts = useCallback(async () => {
    if (conflicts.length === 0) return

    try {
      setOptimizing(true)
      console.log('[useConfirm] 请求冲突优化方案')

      const result = await Network.request({
        url: '/api/agent/optimize-conflicts',
        method: 'POST',
        data: {
          conflicts: conflicts.map(c => ({
            newTask: c.newTask,
            existingTask: c.existingTask,
            overlapMinutes: c.overlapMinutes,
          })),
          userId: 'default-user', // TODO: 从 store 获取真实 userId
        },
      })

      console.log('[useConfirm] 冲突优化结果:', result)

      if (result.data?.data?.success) {
        setConflictOptimization(result.data.data.data)
      } else {
        Taro.showToast({ title: '优化失败', icon: 'error' })
      }
    } catch (error) {
      console.error('[useConfirm] 冲突优化失败:', error)
      Taro.showToast({ title: '优化失败', icon: 'error' })
    } finally {
      setOptimizing(false)
    }
  }, [conflicts, setConflictOptimization, setOptimizing])

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
    conflicts,
    hasConflict,
    canConfirm,
    conflictOptimization,
    isOptimizing,
    confirmBatchAdd,
    confirmBatchDelete,
    confirmModify,
    confirmTripPlan,
    optimizeConflicts,
    cancelConfirm,
  }
}
