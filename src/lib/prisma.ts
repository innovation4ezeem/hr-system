// lib/prisma.ts — Prisma 7 with lazy initialization + robust URL parser
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma2: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  try {
    const urlObj = new URL(url);
    const poolConfig = {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 3306,
      user: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      database: urlObj.pathname.substring(1),
      connectionLimit: 50,
    };
    
    // Casting to 'any' to bypass TypeScript nested dependency mismatch 
    // between project mariadb types and @prisma/adapter-mariadb types
    const adapter = new PrismaMariaDb(poolConfig as any);

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  } catch (err) {
    console.error('Prisma: Failed to parse DATABASE_URL, falling back to default:', err);
    // This fallback will only work in environments where DATABASE_URL is a valid URL
    throw new Error(`Invalid DATABASE_URL: ${url}. Prisma 7 requires a valid mysql:// connection URL.`);
  }
}

export const prisma = globalForPrisma.prisma2 ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma2 = prisma;
}

export default prisma;

