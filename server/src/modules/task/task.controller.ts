/**
 * 任务控制器
 */

import { Controller, Get, Delete, Param, Query, Inject, forwardRef } from '@nestjs/common'
import { TaskService } from './task.service'
import { TaskRepository } from './task.repository'

@Controller('tasks')
export class TaskController {
  constructor(
    @Inject(forwardRef(() => TaskService))
    private readonly taskService: TaskService,
    private readonly taskRepository: TaskRepository,
  ) {}

  /**
   * 获取任务列表
   */
  @Get()
  async getTasks(
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('type') type?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    try {
      const tasks = await this.taskRepository.findAll('default-user', {
        status: status as any,
        type: type as any,
        date,
        startDate,
        endDate,
      })

      return {
        code: 200,
        msg: 'success',
        data: tasks,
      }
    } catch (error) {
      return {
        code: 500,
        msg: '查询失败',
        error: error.message,
      }
    }
  }

  /**
   * 获取单个任务详情
   */
  @Get(':id')
  async getTask(@Param('id') id: string) {
    try {
      const task = await this.taskRepository.findById(id)
      if (!task) {
        return { code: 404, msg: '任务不存在' }
      }
      return { code: 200, msg: 'success', data: task }
    } catch (error) {
      return { code: 500, msg: '查询失败', error: error.message }
    }
  }

  /**
   * 删除任务
   */
  @Delete(':id')
  async deleteTask(@Param('id') id: string) {
    try {
      const task = await this.taskRepository.findById(id)
      if (task) {
        await this.taskRepository.logEvent(id, 'default-user', 'deleted', { task })
      }
      await this.taskRepository.delete(id)
      return { code: 200, msg: '删除成功', data: { deleted: task } }
    } catch (error) {
      return { code: 500, msg: '删除失败', error: error.message }
    }
  }

  /**
   * 完成任务
   */
  @Get(':id/complete')
  async completeTask(@Param('id') id: string) {
    try {
      const task = await this.taskRepository.markCompleted(id)
      await this.taskRepository.logEvent(id, 'default-user', 'completed', { task })
      return { code: 200, msg: '已完成', data: task }
    } catch (error) {
      return { code: 500, msg: '更新失败', error: error.message }
    }
  }
}
