import Redis from "ioredis";
import { getEnv } from "../config/env.js";

const env = getEnv();

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false
});