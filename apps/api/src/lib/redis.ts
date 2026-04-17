import Redis from "ioredis";
import type { Redis as RedisClient, RedisOptions } from "ioredis";
import { getEnv } from "../config/env.js";

const env = getEnv();
const RedisCtor = Redis as unknown as new (url: string, options?: RedisOptions) => RedisClient;

export const redis = new RedisCtor(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false
});
