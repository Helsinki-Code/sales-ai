import Redis from "ioredis";
import { getEnv } from "./config.js";

export const redis = new Redis(getEnv().REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});