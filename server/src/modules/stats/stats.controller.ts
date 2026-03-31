import { Controller, Get, Query } from '@nestjs/common';
import { UserContextService } from '../user-context/user-context.service';
import { getSupabaseClient } from '../../storage/database/supabase-client';

@Controller('stats')
export class StatsController {
  constructor(private readonly userContextService: UserContextService) {}

  /**
   * 获取用户统计数据（API 格式，用于前端展示）
   * GET /api/stats?userId=xxx
   */
  @Get()
  async getStats(@Query('userId') userId?: string) {
    const targetUserId = userId || 'default-user';

    try {
      const data = await this.userContextService.getApiResponse(targetUserId);

      return {
        code: 200,
        msg: 'success',
        data,
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
