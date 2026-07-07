import { Controller, Post, Headers, Req, Res, HttpStatus } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import type { Request, Response } from 'express';

@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  async handleGithub(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!signature) {
      return res.status(HttpStatus.UNAUTHORIZED).send('Missing signature');
    }

    try {
      // In a real NestJS app, rawBody requires specific body-parser configuration.
      // Assuming req.body contains the parsed JSON and req.rawBody contains the buffer.
      // For this scaffold, we cast it for type checking.
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      
      const result = await this.webhooksService.handleGithubWebhook(
        signature,
        event,
        req.body,
        rawBody,
      );
      
      return res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: error.message });
    }
  }
}
