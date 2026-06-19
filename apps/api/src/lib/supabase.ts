import { createClient } from "@supabase/supabase-js";
import { WebSocket } from "ws";
import { getEnv } from "../config/env.js";

const env = getEnv();
const realtime = { transport: WebSocket as unknown as typeof globalThis.WebSocket };

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime
});

export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime
});