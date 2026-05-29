import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const urlObj = new URL(url);
  const poolConfig = {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 3306,
    user: decodeURIComponent(urlObj.username),
    password: decodeURIComponent(urlObj.password),
    database: urlObj.pathname.substring(1),
    // Limit connections so Vercel doesn't overwhelm the DB
    connectionLimit: process.env.NODE_ENV === 'production' ? 1 : 2,
    // Extremely important for Vercel serverless to close idle connections
    idleTimeout: 15000, 
  };
  
  const adapter = new PrismaMariaDb(poolConfig as any);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

