/**
 * 任务定时任务
 * 定期更新过期任务状态
 */

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { getSupabaseClient } from '../../storage/database/supabase-client'

const supabase = getSupabaseClient()

@Injectable()
export class TaskScheduler {
  private readonly logger = new Logger(TaskScheduler.name)

  /**
   * 每 5 分钟检查并更新过期任务
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateExpiredTasks() {
    const now = new Date().toISOString()
    
    try {
      // 更新所有已过时间但状态仍为 pending/confirmed/in_progress 的任务
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          status: 'expired',
          is_expired: true,
          updated_at: now
        })
        .lt('scheduled_time', now)
        .in('status', ['pending', 'confirmed', 'in_progress'])
        .select('id, title, scheduled_time')

      if (error) {
        this.logger.error('更新过期任务失败:', error)
        return
      }

      const count = data?.length || 0
      if (count > 0) {
        this.logger.log(`已更新 ${count} 个过期任务`)
        data?.forEach(task => {
          this.logger.debug(`  - ${task.title} (${task.scheduled_time})`)
        })
      }
    } catch (e) {
      this.logger.error('更新过期任务异常:', e)
    }
  }

  /**
   * 每天凌晨 2 点清理超过 30 天的已过期任务
   */
  @Cron('0 2 * * *')
  async cleanupOldTasks() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    try {
      // 删除超过 30 天的过期任务
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('status', 'expired')
        .lt('scheduled_time', thirtyDaysAgo)
        .select('id')

      if (error) {
        this.logger.error('清理过期任务失败:', error)
        return
      }

      const count = data?.length || 0
      if (count > 0) {
        this.logger.log(`已清理 ${count} 个超过 30 天的过期任务`)
      }
    } catch (e) {
      this.logger.error('清理过期任务异常:', e)
    }
  }

  /**
   * 每小时检查即将到期的任务（提前 30 分钟提醒）
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkUpcomingTasks() {
    const now = new Date()
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000)
    
    try {
      // 查找即将在 30 分钟内到期的任务
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, type, scheduled_time, user_id')
        .gte('scheduled_time', now.toISOString())
        .lte('scheduled_time', thirtyMinutesLater.toISOString())
        .in('status', ['pending', 'confirmed'])

      if (error) {
        this.logger.error('检查即将到期任务失败:', error)
        return
      }

      const count = data?.length || 0
      if (count > 0) {
        this.logger.log(`发现 ${count} 个即将到期的任务`)
        // TODO: 可以在这里发送通知提醒用户
      }
    } catch (e) {
      this.logger.error('检查即将到期任务异常:', e)
    }
  }
}
