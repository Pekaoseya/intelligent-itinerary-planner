/**
 * 时间和日历工具执行器
 */

import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { ToolResult } from './definitions'
import { getDayRange, getDateRangeQuery } from './date-utils'

const supabase = getSupabaseClient()

// =============================================
// 时间检查
// =============================================

export async function executeTimeCheck(args: any, userId: string): Promise<ToolResult> {
  const { scheduled_time, duration_minutes } = args

  const scheduledDate = new Date(scheduled_time)
  const now = new Date()
  const isExpired = scheduledDate < now

  if (isExpired) {
    return {
      success: true,
      data: { is_expired: true },
      message: `该时间（${scheduled_time}）已经过去，无法安排`,
    }
  }

  // 检查是否有冲突
  const endTime = duration_minutes
    ? new Date(scheduledDate.getTime() + duration_minutes * 60000)
    : new Date(scheduledDate.getTime() + 60 * 60000)

  const { data: conflicts } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_expired', false)
    .gte('scheduled_time', scheduledDate.toISOString())
    .lte('scheduled_time', endTime.toISOString())

  return {
    success: true,
    data: {
      is_expired: false,
      has_conflict: conflicts && conflicts.length > 0,
      conflicts: conflicts || [],
    },
    message: conflicts && conflicts.length > 0
      ? `该时间段有 ${conflicts.length} 个任务冲突`
      : '该时间段可用',
  }
}

// =============================================
// 日历检查
// =============================================

export async function executeCalendarCheck(args: any, userId: string): Promise<ToolResult> {
  const { date, time_range } = args

  let query = supabase.from('tasks').select('*').eq('user_id', userId)

  if (date) {
    const range = getDayRange(date)
    query = query.gte('scheduled_time', range.start).lte('scheduled_time', range.end)
  } else if (time_range) {
    const range = getDateRangeQuery(time_range.start, time_range.end)
    query = query.gte('scheduled_time', range.start).lte('scheduled_time', range.end)
  }

  const { data: tasks, error } = await query.order('scheduled_time', { ascending: true })

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: { tasks: tasks || [] },
    message: date
      ? `${date} 有 ${tasks?.length || 0} 个任务`
      : `找到 ${tasks?.length || 0} 个任务`,
  }
}
