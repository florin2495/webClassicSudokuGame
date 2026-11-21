import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Sudoku keeps no tables of its own (games are saved on the device). The only server write is feedback into the
// hub's shared hub_feedback table (owned by florin2495/hailataticu-hub).
let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS - must never be imported from client code. */
export function db(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
