import { PrismaClient } from '@prisma/client';

/**
 * Creates a Prisma Client with standard extensions applied.
 * This pattern ensures that any repository or service using this client
 * automatically benefits from global behaviors like soft-deletes, logging, or metrics.
 */
export function createPrismaClient() {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return prisma.$extends({
    name: 'SoftDeleteExtension',
    query: {
      $allModels: {
        // Automatically filter out soft-deleted records for all find queries
        async findMany({ args, query }) {
          args.where = { deletedAt: null, ...args.where };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { deletedAt: null, ...args.where };
          return query(args);
        },
        async findUnique({ args, query }) {
          // findUnique doesn't support arbitrary where clauses easily if not on unique fields,
          // but we can let it pass or convert to findFirst if needed.
          // For simplicity in this wrapper, we leave findUnique as is, but rely on findFirst
          // for soft-delete safe unique queries, or explicitly check `deletedAt` after fetching.
          return query(args);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * NestJS-compatible Prisma Service Wrapper.
 * Note: If using outside NestJS, simply call `createPrismaClient()` directly.
 */
export class PrismaService {
  private static instance: ExtendedPrismaClient;

  public static getInstance(): ExtendedPrismaClient {
    if (!this.instance) {
      this.instance = createPrismaClient();
    }
    return this.instance;
  }
}
