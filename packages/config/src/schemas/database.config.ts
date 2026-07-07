import { z } from 'zod';

export const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
