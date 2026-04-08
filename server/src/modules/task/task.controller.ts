/**
 * 任务控制器
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, Inject, forwardRef } from '@nestjs/common'
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
   * 批量创建任务（用户确认后调用）
   */
  @Post('batch')
  async batchCreateTasks(@Body() body: { tasks: any[] }) {
    console.log('[TaskController] 批量创建任务请求，任务数:', body.tasks?.length)
    console.log('[TaskController] 请求体:', JSON.stringify(body, null, 2))

    try {
      if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
        console.error('[TaskController] 请求参数无效：未提供任务列表')
        return { code: 400, msg: '请提供任务列表' }
      }

      const results: any[] = []
      const errors: string[] = []

      for (let i = 0; i < body.tasks.length; i++) {
        const taskData = body.tasks[i]
        console.log(`[TaskController] 处理任务 ${i + 1}/${body.tasks.length}:`, {
          title: taskData.title,
          type: taskData.type,
          scheduled_time: taskData.scheduled_time,
        })

        try {
          const task = await this.taskService.createTask('default-user', taskData)
          console.log(`[TaskController] 任务 ${i + 1} 创建成功:`, task.id)
          results.push(task)
        } catch (err) {
          const errorMessage = `创建「${taskData.title}」失败: ${err.message}`
          console.error(`[TaskController] 任务 ${i + 1} 创建失败:`, err)
          errors.push(errorMessage)
        }
      }

      const response = {
        code: 200,
        msg: errors.length > 0
          ? `成功创建 ${results.length} 个任务，${errors.length} 个失败`
          : `成功创建 ${results.length} 个任务`,
        data: {
          created: results,
          createdCount: results.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      }

      console.log('[TaskController] 批量创建完成:', {
        成功: results.length,
        失败: errors.length,
      })

      return response
    } catch (error) {
      console.error('[TaskController] 批量创建异常:', error)
      return {
        code: 500,
        msg: '批量创建失败',
        error: error.message,
      }
    }
  }

  /**
   * 批量删除任务（用户确认后调用）
   */
  @Post('batch-delete')
  async batchDeleteTasks(@Body() body: { taskIds: string[] }) {
    try {
      if (!body.taskIds || !Array.isArray(body.taskIds) || body.taskIds.length === 0) {
        return { code: 400, msg: '请提供任务ID列表' }
      }

      const deletedTasks: any[] = []

      for (const taskId of body.taskIds) {
        const task = await this.taskRepository.findById(taskId)
        if (task) {
          await this.taskRepository.logEvent(taskId, 'default-user', 'deleted', { task })
          await this.taskRepository.delete(taskId)
          deletedTasks.push(task)
        }
      }

      return {
        code: 200,
        msg: `成功删除 ${deletedTasks.length} 个任务`,
        data: {
          deletedCount: deletedTasks.length,
          deletedTasks,
        },
      }
    } catch (error) {
      return {
        code: 500,
        msg: '批量删除失败',
        error: error.message,
      }
    }
  }

  /**
   * 创建单个任务
   */
  @Post()
  async createTask(@Body() taskData: any) {
    try {
      const task = await this.taskService.createTask('default-user', taskData)
      return {
        code: 200,
        msg: '创建成功',
        data: task,
      }
    } catch (error) {
      return {
        code: 500,
        msg: '创建失败',
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
   * 更新任务
   */
  @Put(':id')
  async updateTask(@Param('id') id: string, @Body() updates: any) {
    try {
      const task = await this.taskService.updateTask(id, 'default-user', updates)
      return {
        code: 200,
        msg: '更新成功',
        data: task,
      }
    } catch (error) {
      return {
        code: 500,
        msg: '更新失败',
        error: error.message,
      }
    }
  }

  /**
   * 删除单个任务
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
