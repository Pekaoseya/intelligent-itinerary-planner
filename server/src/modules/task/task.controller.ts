import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';

@Controller('tasks')
export class TaskController {
  /**
   * 获取任务列表
   * GET /api/tasks?status=pending&date=2024-01-01
   */
  @Get()
  async getTasks(
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('type') type?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('tasks')
      .select('*')
      .order('scheduled_time', { ascending: true });

    // 状态过滤
    if (status) {
      query = query.eq('status', status);
    }

    // 类型过滤
    if (type) {
      query = query.eq('type', type);
    }

    // 日期过滤（单日）
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query = query.gte('scheduled_time', start.toISOString());
      query = query.lte('scheduled_time', end.toISOString());
    }

    // 日期范围过滤
    if (startDate) {
      query = query.gte('scheduled_time', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_time', endDate);
    }

    const { data, error } = await query;

    if (error) {
      return {
        code: 500,
        msg: '查询失败',
        error: error.message,
      };
    }

    return {
      code: 200,
      msg: 'success',
      data: data || [],
    };
  }

  /**
   * 获取单个任务详情
   * GET /api/tasks/:id
   */
  @Get(':id')
  async getTask(@Param('id') id: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return {
        code: 404,
        msg: '任务不存在',
        error: error.message,
      };
    }

    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  /**
   * 删除任务
   * DELETE /api/tasks/:id
   */
  @Delete(':id')
  async deleteTask(@Param('id') id: string) {
    const supabase = getSupabaseClient();
    // 先获取任务信息用于记录
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    // 删除任务
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      return {
        code: 500,
        msg: '删除失败',
        error: error.message,
      };
    }

    // 记录事件
    if (task) {
      await supabase.from('task_events').insert({
        task_id: id,
        event_type: 'deleted',
        event_data: { task },
      });
    }

    return {
      code: 200,
      msg: '删除成功',
      data: { deleted: task },
    };
  }

  /**
   * 完成任务
   * GET /api/tasks/:id/complete
   */
  @Get(':id/complete')
  async completeTask(@Param('id') id: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return {
        code: 500,
        msg: '更新失败',
        error: error.message,
      };
    }

    // 记录事件
    await supabase.from('task_events').insert({
      task_id: id,
      event_type: 'completed',
      event_data: { task: data },
    });

    return {
      code: 200,
      msg: '已完成',
      data,
    };
  }
}
