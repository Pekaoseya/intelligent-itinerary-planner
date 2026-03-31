/**
 * 任务管理 Hook
 * 封装任务 CRUD 逻辑
 */

import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
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
      const res = await Network.request({ url: '/api/tasks', method: 'GET' })
      const taskList: Task[] = res.data?.data || []
      taskList.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
      setTasks(taskList)
    } catch (error) {
      console.error('获取任务失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const completeTask = useCallback(async (taskId: string) => {
    try {
      await Network.request({
        url: `/api/tasks/${taskId}/complete`,
        method: 'GET',
      })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as TaskStatus } : t))
      Taro.showToast({ title: '已完成', icon: 'success' })
    } catch (error) {
      console.error('完成失败:', error)
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
              await Network.request({
                url: `/api/tasks/${task.id}`,
                method: 'DELETE',
              })
              setTasks(prev => prev.filter(t => t.id !== task.id))
              Taro.showToast({ title: '已删除', icon: 'success' })
              resolve()
            } catch (error) {
              console.error('删除失败:', error)
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
