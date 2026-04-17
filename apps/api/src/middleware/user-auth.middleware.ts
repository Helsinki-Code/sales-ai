import type { RequestHandler } from "express";
import { supabaseAnon } from "../lib/supabase.js";

function getBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

function getSupabaseSessionToken(req: Parameters<RequestHandler>[0]): string | null {
  const explicit = req.header("x-supabase-access-token");
  if (explicit && explicit.trim().length > 0) return explicit.trim();
  return getBearerToken(req.header("authorization"));
}

export const requireUserSession: RequestHandler = async (req, res, next) => {
  try {
    const token = getSupabaseSessionToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: "MISSING_SESSION", message: "Bearer session token is required." }
      });
    }

    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_SESSION", message: "Unable to validate Supabase session." }
      });
    }

    req.userAuth = {
      userId: data.user.id,
      email: data.user.email
    };
    return next();
  } catch (err) {
    return next(err);
  }
};
