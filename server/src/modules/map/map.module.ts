import { Module } from '@nestjs/common'
import { MapController } from './map.controller'
import { MapService } from './map.service'
import { AMapService } from './amap.service'
import { TransportValidator } from './transport-validator'
import { LocationModule } from '../location/location.module'

@Module({
  imports: [LocationModule],
  controllers: [MapController],
  providers: [MapService, AMapService, TransportValidator],
  exports: [MapService, AMapService, TransportValidator],
})
export class MapModule {}
