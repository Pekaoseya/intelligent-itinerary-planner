/**
 * 任务仓储层
 * 负责与数据库交互
 */

import { Injectable, Logger } from '@nestjs/common'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseService } from '../../services/supabase.service'
import type { Task, TaskType, TaskStatus } from '../../common/types'

/**
 * 转换任务数据的经纬度字段类型（DECIMAL string → number）
 */
function transformTaskData(task: any): Task {
  if (!task) return task

  return {
    ...task,
    // 将 DECIMAL string 转换为 number
    latitude: task.latitude !== null && task.latitude !== undefined
      ? parseFloat(String(task.latitude))
      : undefined,
    longitude: task.longitude !== null && task.longitude !== undefined
      ? parseFloat(String(task.longitude))
      : undefined,
    dest_latitude: task.dest_latitude !== null && task.dest_latitude !== undefined
      ? parseFloat(String(task.dest_latitude))
      : undefined,
    dest_longitude: task.dest_longitude !== null && task.dest_longitude !== undefined
      ? parseFloat(String(task.dest_longitude))
      : undefined,
  }
}

/**
 * 转换任务列表的经纬度字段类型
 */
function transformTaskList(tasks: any[]): Task[] {
  if (!tasks) return []
  return tasks.map(transformTaskData)
}

@Injectable()
export class TaskRepository {
  private readonly logger = new Logger(TaskRepository.name)
  private supabase: SupabaseClient

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient()
  }

  /**
   * 查找所有任务
   */
  async findAll(
    userId: string,
    filters?: {
      status?: TaskStatus
      type?: TaskType
      date?: string
      startDate?: string
      endDate?: string
    },
  ): Promise<Task[]> {
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
      const startOfDay = new Date(filters.date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(filters.date)
      endOfDay.setHours(23, 59, 59, 999)
      query = query.gte('scheduled_time', startOfDay.toISOString()).lte('scheduled_time', endOfDay.toISOString())
    }

    if (filters?.startDate) {
      query = query.gte('scheduled_time', new Date(filters.startDate).toISOString())
    }

    if (filters?.endDate) {
      query = query.lte('scheduled_time', new Date(filters.endDate).toISOString())
    }

    const { data, error } = await query

    if (error) {
      this.logger.error(`查询任务失败: ${error.message}`, error)
      return []
    }

    return transformTaskList(data || [])
  }

  /**
   * 根据ID查找任务
   */
  async findById(id: string, userId?: string): Promise<Task | null> {
    let query = this.supabase.from('tasks').select('*').eq('id', id)
    if (userId) {
      query = query.eq('user_id', userId)
    }
    const { data, error } = await query.single()
    if (error) return null
    return transformTaskData(data)
  }

  /**
   * 创建任务
   */
  async create(taskData: Partial<Task>): Promise<Task> {
    // 确保经纬度字段转换为 string（DECIMAL 类型在数据库中存储为 string）
    const dataToInsert = {
      ...taskData,
      latitude: taskData.latitude !== undefined ? String(taskData.latitude) : null,
      longitude: taskData.longitude !== undefined ? String(taskData.longitude) : null,
      dest_latitude: taskData.dest_latitude !== undefined ? String(taskData.dest_latitude) : null,
      dest_longitude: taskData.dest_longitude !== undefined ? String(taskData.dest_longitude) : null,
    }

    const { data, error } = await this.supabase
      .from('tasks')
      .insert(dataToInsert)
      .select()
      .single()

    if (error) throw error
    return transformTaskData(data)
  }

  /**
   * 更新任务
   */
  async update(id: string, updates: Partial<Task>): Promise<Task> {
    // 确保经纬度字段转换为 string
    const updatesToApply = {
      ...updates,
      latitude: updates.latitude !== undefined ? String(updates.latitude) : undefined,
      longitude: updates.longitude !== undefined ? String(updates.longitude) : undefined,
      dest_latitude: updates.dest_latitude !== undefined ? String(updates.dest_latitude) : undefined,
      dest_longitude: updates.dest_longitude !== undefined ? String(updates.dest_longitude) : undefined,
    }

    const { data, error } = await this.supabase
      .from('tasks')
      .update({
        ...updatesToApply,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return transformTaskData(data)
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
    return transformTaskList(data || [])
  }

  /**
   * 检查时间冲突
   */
  async findConflicts(
    userId: string,
    scheduledTime: Date,
    excludeId?: string,
  ): Promise<Task[]> {
    const startTime = new Date(scheduledTime.getTime() - 15 * 60 * 1000) // 15分钟前
    const endTime = new Date(scheduledTime.getTime() + 15 * 60 * 1000) // 15分钟后

    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_time', startTime.toISOString())
      .lte('scheduled_time', endTime.toISOString())

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query

    if (error) throw error
    return transformTaskList(data || [])
  }

  /**
   * 统计任务数量
   */
  async count(userId: string, filters?: {
    status?: TaskStatus
    type?: TaskType
    date?: string
  }): Promise<number> {
    let query = this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.type) {
      query = query.eq('type', filters.type)
    }

    if (filters?.date) {
      const startOfDay = new Date(filters.date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(filters.date)
      endOfDay.setHours(23, 59, 59, 999)
      query = query.gte('scheduled_time', startOfDay.toISOString()).lte('scheduled_time', endOfDay.toISOString())
    }

    const { count, error } = await query
    if (error) {
      this.logger.error(`统计任务数量失败: ${error.message}`, error)
      return 0
    }
    return count || 0
  }
}
