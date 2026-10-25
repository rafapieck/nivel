import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Pipa module only. The tank module never imports this file.
// Keys come from env (Vercel); the publishable key is safe in the browser because RLS guards every table.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      // Exchanges ?code= on /auth/callback when the client starts.
      detectSessionInUrl: true,
      storageKey: "nivel-auth",
    },
  });
  return client;
}

/**
 * The project's Site URL belongs to another app, so the redirect is always explicit:
 * back to this origin's callback page.
 */
export function signInWithGoogle(sb: SupabaseClient) {
  return sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}
