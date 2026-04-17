import Redis from "ioredis";
import type { Redis as RedisClient, RedisOptions } from "ioredis";
import { getEnv } from "./config.js";

const RedisCtor = Redis as unknown as new (url: string, options?: RedisOptions) => RedisClient;

export const redis = new RedisCtor(getEnv().REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});
