import { Module } from '@nestjs/common'
import { TaskController } from './task.controller'
import { TaskService } from './task.service'
import { TaskRepository } from './task.repository'
import { TaskScheduler } from './task.scheduler'

@Module({
  controllers: [TaskController],
  providers: [TaskService, TaskRepository, TaskScheduler],
  exports: [TaskService, TaskRepository],
})
export class TaskModule {}
