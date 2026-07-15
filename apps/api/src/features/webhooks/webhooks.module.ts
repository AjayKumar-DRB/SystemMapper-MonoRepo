import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { QueueNames } from '@systemmapper/types';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueNames.SCAN,
    }),
    BullModule.registerQueue({
      name: QueueNames.BLAST_RADIUS,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WebhooksModule {}
