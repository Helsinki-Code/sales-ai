import { Router } from "express";
import { redis } from "../lib/redis.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  return res.json({ success: true, status: "ok", service: "api" });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await redis.ping();
    const { error } = await supabaseAdmin.from("orgs").select("id").limit(1);
    if (error) throw error;
    return res.json({ success: true, status: "ready", checks: { redis: "ok", supabase: "ok" } });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: "not_ready",
      error: error instanceof Error ? error.message : "unknown"
    });
  }
});