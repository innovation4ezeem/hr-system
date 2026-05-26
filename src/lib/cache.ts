import Redis from 'ioredis';

// In-Memory Cache Fallback (TTL in-memory Map)
type InMemoryCacheEntry = {
  value: string;
  expiresAt: number;
};
const inMemoryCache = new Map<string, InMemoryCacheEntry>();

let redisClient: Redis | null = null;
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    const globalForRedis = globalThis as unknown as {
      redis: Redis | undefined;
    };
    if (!globalForRedis.redis) {
      globalForRedis.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      globalForRedis.redis.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
      });
    }
    redisClient = globalForRedis.redis;
  } catch (err) {
    console.error('Failed to initialize Redis client:', err);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  // 1. Try Redis first if configured
  if (redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (err) {
      console.warn(`Redis getCache failed for key "${key}", falling back to in-memory:`, err);
    }
  }

  // 2. Fallback to in-memory TTL cache
  const entry = inMemoryCache.get(key);
  if (entry) {
    if (Date.now() < entry.expiresAt) {
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return null;
      }
    } else {
      inMemoryCache.delete(key); // Evict expired key
    }
  }
  return null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  const serialized = JSON.stringify(value);

  // 1. Set in Redis first if configured
  if (redisClient) {
    try {
      await redisClient.set(key, serialized, 'EX', ttlSeconds);
      return;
    } catch (err) {
      console.warn(`Redis setCache failed for key "${key}":`, err);
    }
  }

  // 2. Set/fallback in in-memory TTL cache
  inMemoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

export async function deleteCache(key: string): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.warn(`Redis deleteCache failed for key "${key}":`, err);
    }
  }
  inMemoryCache.delete(key);
}

export async function clearCachePattern(prefix: string): Promise<void> {
  // 1. Clear in Redis
  if (redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {
      console.warn(`Redis clearCachePattern failed for prefix "${prefix}*":`, err);
    }
  }

  // 2. Clear in-memory Map
  for (const key of inMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      inMemoryCache.delete(key);
    }
  }
}

