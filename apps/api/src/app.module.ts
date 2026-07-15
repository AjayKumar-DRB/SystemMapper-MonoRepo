import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueueModule } from './queue/queue.module';
import { WebhooksModule } from './features/webhooks/webhooks.module';
import { VisualizationModule } from './features/visualization/visualization.module';

@Module({
  imports: [QueueModule, WebhooksModule, VisualizationModule],
  controllers: [AppController],
  providers: [AppService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
