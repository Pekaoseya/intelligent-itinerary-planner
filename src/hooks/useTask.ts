/**
 * 任务管理 Hook
 * 封装任务的增删改查逻辑
 */
import { useCallback } from 'react'
import { Network } from '@/network'
import type { Task, CreateTaskDTO } from '@/types/task'

export function useTask() {
  // 获取今日任务
  const getTodayTasks = useCallback(async (): Promise<Task[]> => {
    try {
      const res = await Network.request({
        url: '/api/tasks/today',
      })
      console.log('[useTask] getTodayTasks:', res.data)
      return res.data.data || []
    } catch (error) {
      console.error('[useTask] getTodayTasks error:', error)
      return []
    }
  }, [])
  
  // 创建任务
  const createTask = useCallback(async (task: CreateTaskDTO): Promise<Task | null> => {
    try {
      const res = await Network.request({
        url: '/api/tasks',
        method: 'POST',
        data: task,
      })
      console.log('[useTask] createTask:', res.data)
      return res.data.data
    } catch (error) {
      console.error('[useTask] createTask error:', error)
      return null
    }
  }, [])
  
  // 批量创建任务
  const batchCreateTasks = useCallback(async (tasks: CreateTaskDTO[]): Promise<Task[]> => {
    try {
      const res = await Network.request({
        url: '/api/tasks/batch',
        method: 'POST',
        data: { tasks },
      })
      console.log('[useTask] batchCreateTasks:', res.data)
      return res.data.data || []
    } catch (error) {
      console.error('[useTask] batchCreateTasks error:', error)
      return []
    }
  }, [])
  
  // 删除任务
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      await Network.request({
        url: `/api/tasks/${taskId}`,
        method: 'DELETE',
      })
      console.log('[useTask] deleteTask success:', taskId)
      return true
    } catch (error) {
      console.error('[useTask] deleteTask error:', error)
      return false
    }
  }, [])
  
  // 批量删除任务
  const batchDeleteTasks = useCallback(async (taskIds: string[]): Promise<boolean> => {
    try {
      await Network.request({
        url: '/api/tasks/batch-delete',
        method: 'POST',
        data: { taskIds },
      })
      console.log('[useTask] batchDeleteTasks success:', taskIds)
      return true
    } catch (error) {
      console.error('[useTask] batchDeleteTasks error:', error)
      return false
    }
  }, [])
  
  // 更新任务
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>): Promise<Task | null> => {
    try {
      const res = await Network.request({
        url: `/api/tasks/${taskId}`,
        method: 'PATCH',
        data: updates,
      })
      console.log('[useTask] updateTask:', res.data)
      return res.data.data
    } catch (error) {
      console.error('[useTask] updateTask error:', error)
      return null
    }
  }, [])
  
  return {
    getTodayTasks,
    createTask,
    batchCreateTasks,
    deleteTask,
    batchDeleteTasks,
    updateTask,
  }
}
