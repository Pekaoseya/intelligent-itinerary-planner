/**
 * 任务数据访问层
 * 隔离数据库操作，提供统一的数据访问接口
 */

import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import type { Task, TaskType, TaskStatus } from '../../common/types'

@Injectable()
export class TaskRepository {
  private supabase = getSupabaseClient()

  /**
   * 查询所有任务
   */
  async findAll(userId: string, filters?: {
    status?: TaskStatus
    type?: TaskType
    date?: string
    startDate?: string
    endDate?: string
  }): Promise<Task[]> {
    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.type) {
      query = query.eq('type', filters.type)
    }
    if (filters?.date) {
      const start = new Date(filters.date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(filters.date)
      end.setHours(23, 59, 59, 999)
      query = query.gte('scheduled_time', start.toISOString())
      query = query.lte('scheduled_time', end.toISOString())
    }
    if (filters?.startDate) {
      query = query.gte('scheduled_time', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('scheduled_time', filters.endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  /**
   * 根据 ID 查询任务
   */
  async findById(id: string, userId?: string): Promise<Task | null> {
    let query = this.supabase.from('tasks').select('*').eq('id', id)
    if (userId) {
      query = query.eq('user_id', userId)
    }
    const { data, error } = await query.single()
    if (error) return null
    return data
  }

  /**
   * 创建任务
   */
  async create(taskData: Partial<Task>): Promise<Task> {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * 更新任务
   */
  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const { data, error } = await this.supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * 删除任务
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  }

  /**
   * 批量删除任务
   */
  async deleteMany(ids: string[]): Promise<void> {
    const { error } = await this.supabase.from('tasks').delete().in('id', ids)
    if (error) throw error
  }

  /**
   * 标记任务完成
   */
  async markCompleted(id: string): Promise<Task> {
    return this.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    } as any)
  }

  /**
   * 记录任务事件
   */
  async logEvent(taskId: string, userId: string, eventType: string, data?: any): Promise<void> {
    await this.supabase.from('task_events').insert({
      task_id: taskId,
      user_id: userId,
      event_type: eventType,
      ...data,
    })
  }

  /**
   * 按关键词搜索任务
   */
  async search(userId: string, keyword: string, limit: number = 10): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${keyword}%,location_name.ilike.%${keyword}%`)
      .limit(limit)

    if (error) throw error
    return data || []
  }

  /**
   * 检查时间冲突
   */
  async findConflicts(
    userId: string,
    scheduledTime: Date,
    duration: number,
    excludeTaskId?: string
  ): Promise<Task[]> {
    const dateStr = scheduledTime.toISOString().split('T')[0]
    const startOfDay = new Date(`${dateStr}T00:00:00`).toISOString()
    const endOfDay = new Date(`${dateStr}T23:59:59`).toISOString()

    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('scheduled_time', startOfDay)
      .lte('scheduled_time', endOfDay)

    const { data, error } = await query
    if (error || !data) return []

    const newStart = scheduledTime.getTime()
    const newEnd = newStart + duration * 60 * 1000

    return data.filter(task => {
      if (excludeTaskId && task.id === excludeTaskId) return false
      const taskStart = new Date(task.scheduled_time).getTime()
      const taskDuration = task.duration_minutes || 60
      const taskEnd = taskStart + taskDuration * 60 * 1000
      return newStart < taskEnd && newEnd > taskStart
    })
  }
}
