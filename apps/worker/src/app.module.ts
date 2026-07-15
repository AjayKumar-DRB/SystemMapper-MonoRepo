import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParserConsumer } from './processors/parser.consumer';
import { BlastRadiusConsumer } from './processors/blast-radius.consumer';
import { ExploreConsumer } from './processors/explore.consumer';
import { QueueNames } from '@systemmapper/types';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({
      name: QueueNames.PARSE,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, ParserConsumer, BlastRadiusConsumer, ExploreConsumer],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
