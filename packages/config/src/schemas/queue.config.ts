import { z } from 'zod';

export const QueueConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
});

export type QueueConfig = z.infer<typeof QueueConfigSchema>;
