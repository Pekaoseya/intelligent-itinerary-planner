/**
 * 任务服务层
 * 处理业务逻辑，调用 Repository 进行数据访问
 */

import { Injectable, Logger } from '@nestjs/common'
import { TaskRepository } from './task.repository'
import type { Task, TaskType, TaskStatus } from '../../common/types'

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name)

  constructor(private readonly taskRepository: TaskRepository) {}

  /**
   * 获取任务列表
   */
  async getTasks(userId: string, filters?: {
    status?: TaskStatus
    type?: TaskType
    date?: string
    startDate?: string
    endDate?: string
  }): Promise<Task[]> {
    return this.taskRepository.findAll(userId, filters)
  }

  /**
   * 获取任务详情
   */
  async getTask(id: string, userId?: string): Promise<Task | null> {
    return this.taskRepository.findById(id, userId)
  }

  /**
   * 创建任务
   */
  async createTask(userId: string, taskData: Partial<Task>): Promise<Task> {
    const task = await this.taskRepository.create({
      user_id: userId,
      ...taskData,
    })

    await this.taskRepository.logEvent(task.id, userId, 'created', {
      reasoning: `创建${taskData.type}类型任务: ${taskData.title}`,
    })

    return task
  }

  /**
   * 更新任务
   */
  async updateTask(id: string, userId: string, updates: Partial<Task>): Promise<Task> {
    const task = await this.taskRepository.findById(id, userId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.is_expired) {
      throw new Error('该任务已过期，无法修改')
    }

    const updated = await this.taskRepository.update(id, updates)

    await this.taskRepository.logEvent(id, userId, 'updated', {
      changes: updates,
      reasoning: `更新任务: ${JSON.stringify(updates)}`,
    })

    return updated
  }

  /**
   * 删除任务
   */
  async deleteTask(id: string, userId: string): Promise<void> {
    const task = await this.taskRepository.findById(id, userId)
    if (!task) {
      throw new Error('任务不存在')
    }

    await this.taskRepository.logEvent(id, userId, 'cancelled', {
      reasoning: `用户删除任务: ${task.title}`,
    })

    await this.taskRepository.delete(id)
  }

  /**
   * 完成任务
   */
  async completeTask(id: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findById(id, userId)
    if (!task) {
      throw new Error('任务不存在')
    }

    const updated = await this.taskRepository.markCompleted(id)

    await this.taskRepository.logEvent(id, userId, 'completed', {
      reasoning: `标记完成: ${task.title}`,
    })

    return updated
  }

  /**
   * 批量删除任务
   */
  async deleteTasks(userId: string, filter: {
    type?: TaskType
    date?: string
    dateRange?: { start: string; end: string }
    status?: TaskStatus
    keyword?: string
    expired?: boolean
    all?: boolean
  }): Promise<{ count: number; tasks?: Task[] }> {
    // 这里需要根据 filter 查询任务
    // 然后批量删除
    // 简化实现，实际应该复用 Repository 的查询逻辑
    return { count: 0 }
  }
}
