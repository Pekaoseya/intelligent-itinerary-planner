/**
 * 任务服务
 * 封装任务相关的 API 调用
 */

import { Network } from '@/network'
import type { Task, TaskStatus } from '@/types'

// =============================================
// 类型定义
// =============================================

export interface CreateTaskDTO {
  title: string
  type: string
  scheduled_time: string
  end_time?: string
  location_name?: string
  location_address?: string
  destination_name?: string
  destination_address?: string
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
  metadata?: Record<string, unknown>
  status?: TaskStatus
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {
  id?: string
}

export interface BatchCreateResult {
  createdCount: number
  tasks: Task[]
}

export interface BatchDeleteResult {
  deletedCount: number
  deletedIds: string[]
}

// =============================================
// Task Service
// =============================================

class TaskService {
  /**
   * 获取所有任务
   */
  async getTasks(): Promise<Task[]> {
    const res = await Network.request({
      url: '/api/tasks',
      method: 'GET',
    })
    return res.data?.data || []
  }

  /**
   * 获取今日任务
   */
  async getTodayTasks(): Promise<Task[]> {
    const res = await Network.request({
      url: '/api/tasks/today',
      method: 'GET',
    })
    return res.data?.data || []
  }

  /**
   * 获取单个任务
   */
  async getTask(taskId: string): Promise<Task | null> {
    const res = await Network.request({
      url: `/api/tasks/${taskId}`,
      method: 'GET',
    })
    return res.data?.data || null
  }

  /**
   * 创建任务
   */
  async createTask(task: CreateTaskDTO): Promise<Task | null> {
    const res = await Network.request({
      url: '/api/tasks',
      method: 'POST',
      data: task,
    })
    return res.data?.data || null
  }

  /**
   * 批量创建任务
   */
  async batchCreateTasks(tasks: CreateTaskDTO[]): Promise<BatchCreateResult> {
    console.log('[TaskService] 批量创建任务，任务数:', tasks.length)
    console.log('[TaskService] 请求数据:', JSON.stringify({ tasks }, null, 2))

    const res = await Network.request({
      url: '/api/tasks/batch',
      method: 'POST',
      data: { tasks },
    })

    console.log('[TaskService] 响应数据:', JSON.stringify(res.data, null, 2))

    return res.data?.data || { createdCount: 0, tasks: [] }
  }

  /**
   * 更新任务
   */
  async updateTask(taskId: string, updates: Partial<CreateTaskDTO>): Promise<Task | null> {
    const res = await Network.request({
      url: `/api/tasks/${taskId}`,
      method: 'PUT',
      data: updates,
    })
    return res.data?.data || null
  }

  /**
   * 部分更新任务
   */
  async patchTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    const res = await Network.request({
      url: `/api/tasks/${taskId}`,
      method: 'PATCH',
      data: updates,
    })
    return res.data?.data || null
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<boolean> {
    await Network.request({
      url: `/api/tasks/${taskId}`,
      method: 'DELETE',
    })
    return true
  }

  /**
   * 批量删除任务
   */
  async batchDeleteTasks(taskIds: string[]): Promise<BatchDeleteResult> {
    const res = await Network.request({
      url: '/api/tasks/batch-delete',
      method: 'POST',
      data: { taskIds },
    })
    return res.data?.data || { deletedCount: 0, deletedIds: [] }
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: string): Promise<Task | null> {
    const res = await Network.request({
      url: `/api/tasks/${taskId}/complete`,
      method: 'GET',
    })
    return res.data?.data || null
  }
}

// 导出单例
export const taskService = new TaskService()
