import { PrismaClient } from '@prisma/client';

export const isPrismaConfigured = (): boolean => {
  const url = process.env.DATABASE_URL || '';
  return Boolean(url) && (url.startsWith('postgresql://') || url.startsWith('postgres://'));
};

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    throw new Error('Database initialization failed: DATABASE_URL environment variable is required.');
  }

  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  return prismaInstance;
}

// Safe proxy
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    return (client as any)[prop];
  },
});

export default prisma;
