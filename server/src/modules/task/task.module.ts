import { Module } from '@nestjs/common'
import { TaskController } from './task.controller'
import { TaskScheduler } from './task.scheduler'

@Module({
  controllers: [TaskController],
  providers: [TaskScheduler],
})
export class TaskModule {}
