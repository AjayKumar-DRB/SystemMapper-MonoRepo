import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueNames } from '@systemmapper/types';
import { VisualizationController } from './visualization.controller';
import { VisualizationService } from './visualization.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueNames.SCAN,
    }),
  ],
  controllers: [VisualizationController],
  providers: [VisualizationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class VisualizationModule {}
