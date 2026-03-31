/**
 * 统计服务
 * 封装用户统计和偏好设置相关的 API 调用
 */

import { Network } from '@/network'

// =============================================
// 类型定义
// =============================================

export interface UserStats {
  totalTasks: number
  completedTasks: number
  upcomingTasks: number
  expiredTasks: number
  taskTypeStats: Record<string, number>
}

export interface UserPreferences {
  preferredTransport?: 'taxi' | 'train' | 'flight'
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening'
  notificationEnabled?: boolean
  reminderMinutes?: number
}

// =============================================
// Stats Service
// =============================================

class StatsService {
  /**
   * 获取用户统计数据
   */
  async getStats(): Promise<UserStats | null> {
    const res = await Network.request({
      url: '/api/stats',
      method: 'GET',
    })
    return res.data?.data || null
  }

  /**
   * 获取用户偏好设置
   */
  async getPreferences(): Promise<UserPreferences | null> {
    const res = await Network.request({
      url: '/api/stats/preferences',
      method: 'GET',
    })
    return res.data?.data || null
  }

  /**
   * 更新用户偏好设置
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
    const res = await Network.request({
      url: '/api/stats/preferences',
      method: 'POST',
      data: preferences,
    })
    return res.data?.data || null
  }
}

// 导出单例
export const statsService = new StatsService()
