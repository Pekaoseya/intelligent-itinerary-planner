import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { UserContextModule } from '../user-context/user-context.module';

@Module({
  imports: [UserContextModule],
  controllers: [StatsController],
})
export class StatsModule {}
