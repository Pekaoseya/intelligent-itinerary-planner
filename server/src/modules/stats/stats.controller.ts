import { Controller, Get, Query } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';

@Controller('stats')
export class StatsController {
  /**
   * 获取用户统计数据
   * GET /api/stats?userId=xxx
   */
  @Get()
  async getStats(@Query('userId') userId?: string) {
    const supabase = getSupabaseClient();
    
    // 默认用户ID
    const targetUserId = userId || 'default-user';

    try {
      // 获取所有任务
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('获取任务失败:', tasksError);
      }

      const allTasks = tasks || [];

      // 出行统计
      const travelTasks = allTasks.filter(t => ['taxi', 'train', 'flight'].includes(t.type));
      const travelByType = {
        taxi: travelTasks.filter(t => t.type === 'taxi').length,
        train: travelTasks.filter(t => t.type === 'train').length,
        flight: travelTasks.filter(t => t.type === 'flight').length,
      };

      // 常去地点统计
      const locationCount: Record<string, number> = {};
      allTasks.forEach(task => {
        if (task.destination_name) {
          locationCount[task.destination_name] = (locationCount[task.destination_name] || 0) + 1;
        }
        if (task.location_name) {
          locationCount[task.location_name] = (locationCount[task.location_name] || 0) + 1;
        }
      });
      const topLocations = Object.entries(locationCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // 时段分布
      const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      allTasks.forEach(task => {
        const date = new Date(task.scheduled_time);
        const hour = date.getHours();
        if (hour >= 6 && hour < 12) timeDistribution.morning++;
        else if (hour >= 12 && hour < 18) timeDistribution.afternoon++;
        else if (hour >= 18 && hour < 24) timeDistribution.evening++;
        else timeDistribution.night++;
      });

      // 日程统计
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

      // 本月会议统计
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTasks = allTasks.filter(t => new Date(t.scheduled_time) >= monthStart);
      const monthMeetings = monthTasks.filter(t => t.type === 'meeting').length;

      // 工作日/周末分布
      const weekdayDistribution = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
      const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
      allTasks.forEach(task => {
        const date = new Date(task.scheduled_time);
        const dayKey = weekdayKeys[date.getDay()];
        weekdayDistribution[dayKey]++;
      });

      // 类型分布
      const typeDistribution: Record<string, number> = {};
      allTasks.forEach(task => {
        typeDistribution[task.type] = (typeDistribution[task.type] || 0) + 1;
      });

      // 最近7天趋势
      const last7Days: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayTasks = allTasks.filter(t => {
          const taskDate = new Date(t.scheduled_time);
          return taskDate >= date && taskDate < nextDate;
        });
        
        last7Days.push({
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          count: dayTasks.length,
        });
      }

      return {
        code: 200,
        msg: 'success',
        data: {
          travel: {
            total_trips: travelTasks.length,
            by_type: travelByType,
            top_locations: topLocations,
            time_distribution: timeDistribution,
          },
          schedule: {
            total_tasks: totalTasks,
            completed: completedTasks,
            completion_rate: Math.round(completionRate * 100),
            meetings_this_month: monthMeetings,
            by_weekday: weekdayDistribution,
            by_type: typeDistribution,
          },
          trend: {
            last_7_days: last7Days,
          },
        },
      };
    } catch (error) {
      console.error('统计失败:', error);
      return {
        code: 500,
        msg: '获取统计失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取用户偏好设置
   * GET /api/stats/preferences?userId=xxx
   */
  @Get('preferences')
  async getPreferences(@Query('userId') userId?: string) {
    const supabase = getSupabaseClient();
    const targetUserId = userId || 'default-user';

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return {
        code: 500,
        msg: '获取偏好失败',
        error: error.message,
      };
    }

    // 默认偏好
    const defaultPreferences = {
      default_travel_type: 'taxi',
      reminder_minutes: 30,
      favorite_locations: [],
      notification_enabled: true,
    };

    return {
      code: 200,
      msg: 'success',
      data: data || defaultPreferences,
    };
  }

  /**
   * 更新用户偏好设置
   * 注意：这里简化处理，实际应该用 POST + Body
   * GET /api/stats/preferences/update?userId=xxx&default_travel_type=taxi
   */
  @Get('preferences/update')
  async updatePreferences(
    @Query('userId') userId?: string,
    @Query('default_travel_type') defaultTravelType?: string,
    @Query('reminder_minutes') reminderMinutes?: string,
    @Query('notification_enabled') notificationEnabled?: string,
  ) {
    const supabase = getSupabaseClient();
    const targetUserId = userId || 'default-user';

    const updates: Record<string, any> = {
      user_id: targetUserId,
      updated_at: new Date().toISOString(),
    };

    if (defaultTravelType) updates.default_travel_type = defaultTravelType;
    if (reminderMinutes) updates.reminder_minutes = parseInt(reminderMinutes, 10);
    if (notificationEnabled !== undefined) updates.notification_enabled = notificationEnabled === 'true';

    // Upsert
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(updates, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return {
        code: 500,
        msg: '更新偏好失败',
        error: error.message,
      };
    }

    return {
      code: 200,
      msg: '更新成功',
      data,
    };
  }
}
