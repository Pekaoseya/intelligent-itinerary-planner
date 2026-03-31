/**
 * 时间冲突检测模块
 */

import { getSupabaseClient } from '../../../storage/database/supabase-client'
import type { TaskType } from './types'
import { getDayRange } from './date-utils'

const supabase = getSupabaseClient()

// =============================================
// 时长估算
// =============================================

export function estimateTaskDuration(type: TaskType, distance?: number, metadata?: any): number {
  // 如果已有时长信息，直接使用
  if (metadata?.duration) {
    return Math.ceil(metadata.duration / 60) // 秒转分钟
  }

  switch (type) {
    case 'taxi':
      if (distance) {
        const hours = distance / 1000 / 30
        return Math.max(15, Math.ceil(hours * 60))
      }
      return 30

    case 'train':
      if (distance) {
        const hours = distance / 1000 / 200
        return Math.ceil(hours * 60) + 30
      }
      return 120

    case 'flight':
      if (distance) {
        const hours = distance / 1000 / 600
        return Math.ceil(hours * 60) + 150
      }
      return 180

    case 'meeting':
      return 60

    case 'dining':
      return 90

    case 'hotel':
      return 480

    default:
      return 60
  }
}

// =============================================
// 冲突检测结果类型
// =============================================

export interface ConflictResult {
  hasConflict: boolean
  conflicts: Array<{
    id: string
    title: string
    type: string
    scheduled_time: string
    duration_minutes: number | null
    overlap_minutes: number
  }>
  severity: 'none' | 'warning' | 'error'
}

// =============================================
// 时间冲突检测
// =============================================

export async function checkTimeConflict(
  userId: string,
  scheduledTime: Date,
  duration: number,
  excludeTaskId?: string
): Promise<ConflictResult> {
  const newStart = scheduledTime.getTime()
  const newEnd = newStart + duration * 60 * 1000

  // 使用统一工具函数获取日期范围
  const dateStr = scheduledTime.toISOString().split('T')[0]
  const range = getDayRange(dateStr)

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('scheduled_time', range.start)
    .lte('scheduled_time', range.end)

  if (error || !tasks) {
    console.warn('[checkTimeConflict] 查询失败:', error)
    return { hasConflict: false, conflicts: [], severity: 'none' }
  }

  const conflicts: ConflictResult['conflicts'] = []

  for (const task of tasks) {
    if (excludeTaskId && task.id === excludeTaskId) continue

    const taskStart = new Date(task.scheduled_time).getTime()
    const taskDuration = task.duration_minutes || estimateTaskDuration(task.type as TaskType, task.metadata?.distance, task.metadata)
    const taskEnd = taskStart + taskDuration * 60 * 1000

    if (newStart < taskEnd && newEnd > taskStart) {
      const overlapStart = Math.max(newStart, taskStart)
      const overlapEnd = Math.min(newEnd, taskEnd)
      const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000)

      conflicts.push({
        id: task.id,
        title: task.title,
        type: task.type,
        scheduled_time: task.scheduled_time,
        duration_minutes: task.duration_minutes,
        overlap_minutes: overlapMinutes,
      })
    }
  }

  let severity: 'none' | 'warning' | 'error' = 'none'
  if (conflicts.length > 0) {
    const hasSeriousConflict = conflicts.some(c => c.overlap_minutes > 15)
    severity = hasSeriousConflict ? 'error' : 'warning'
  }

  return { hasConflict: conflicts.length > 0, conflicts, severity }
}
