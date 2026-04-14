import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AgentModule } from './modules/agent/agent.module'
import { TaskModule } from './modules/task/task.module'
import { RecommendationModule } from './modules/recommendation/recommendation.module'
import { MapModule } from './modules/map/map.module'
import { StatsModule } from './modules/stats/stats.module'
import { FeedbackModule } from './modules/feedback/feedback.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AgentModule,
    TaskModule,
    RecommendationModule,
    MapModule,
    StatsModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
