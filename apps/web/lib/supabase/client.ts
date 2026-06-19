import { createBrowserClient } from "@supabase/ssr";

function getSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
  const key = getSupabaseKey() || "build-time-placeholder-anon-key";

  return createBrowserClient(url, key) as any;
}
