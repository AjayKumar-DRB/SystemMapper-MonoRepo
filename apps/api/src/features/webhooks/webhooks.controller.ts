import {
  Controller,
  Post,
  Headers,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import type { Request, Response } from 'express';

// Extend the Express Request type to include the rawBody buffer
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  async handleGithub(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Req() req: RequestWithRawBody,
    @Res() res: Response,
  ): Promise<Response> {
    if (!signature) {
      return res.status(HttpStatus.UNAUTHORIZED).send('Missing signature');
    }

    try {
      // rawBody is populated by the NestJS raw body middleware (configured in main.ts)
      const rawBody: Buffer =
        req.rawBody ?? Buffer.from(JSON.stringify(req.body));

      const result = await this.webhooksService.handleGithubWebhook(
        signature,
        event,
        req.body as Record<string, unknown>,
        rawBody,
      );

      return res.status(HttpStatus.OK).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: message });
    }
  }
}
