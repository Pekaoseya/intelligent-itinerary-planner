import { Module } from '@nestjs/common'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { UserContextModule } from '../user-context/user-context.module'
import { ConflictOptimizer } from './tools/conflict-optimizer'

@Module({
  imports: [UserContextModule],
  controllers: [AgentController],
  providers: [AgentService, ConflictOptimizer],
  exports: [AgentService],
})
export class AgentModule {}
