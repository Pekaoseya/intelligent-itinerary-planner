/**
 * 任务管理 Hook
 * 封装任务 CRUD 逻辑
 */

import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { taskService } from '@/services'
import type { Task, TaskStatus } from '@/types'

export interface UseTasksResult {
  tasks: Task[]
  loading: boolean
  fetchTasks: () => Promise<void>
  completeTask: (taskId: string) => Promise<void>
  deleteTask: (task: Task) => Promise<void>
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const taskList = await taskService.getTasks()
      taskList.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
      setTasks(taskList)
    } catch (error) {
      console.error('[useTasks] 获取任务失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const completeTask = useCallback(async (taskId: string) => {
    try {
      await taskService.completeTask(taskId)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as TaskStatus } : t))
      Taro.showToast({ title: '已完成', icon: 'success' })
    } catch (error) {
      console.error('[useTasks] 完成失败:', error)
    }
  }, [])

  const deleteTask = useCallback(async (task: Task) => {
    return new Promise<void>((resolve) => {
      Taro.showModal({
        title: '确认删除',
        content: `确定要删除「${task.title}」吗？`,
        confirmColor: '#ff4d4f',
        success: async (res) => {
          if (res.confirm) {
            try {
              await taskService.deleteTask(task.id)
              setTasks(prev => prev.filter(t => t.id !== task.id))
              Taro.showToast({ title: '已删除', icon: 'success' })
              resolve()
            } catch (error) {
              console.error('[useTasks] 删除失败:', error)
              Taro.showToast({ title: '删除失败', icon: 'error' })
              resolve()
            }
          } else {
            resolve()
          }
        },
      })
    })
  }, [])

  return { tasks, loading, fetchTasks, completeTask, deleteTask }
}
