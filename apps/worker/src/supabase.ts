import { createClient } from "@supabase/supabase-js";
import { WebSocket } from "ws";
import { getEnv } from "./config.js";

const env = getEnv();

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket }
});