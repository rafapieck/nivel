"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { useSession } from "./useSession";

export type PipaCtx = { sb: SupabaseClient; session: Session };

/** undefined while loading; null when not configured or signed out. */
export function usePipa(): PipaCtx | null | undefined {
  const sb = getSupabase();
  const session = useSession();
  if (!sb) return null;
  if (session === undefined) return undefined;
  if (session === null) return null;
  return { sb, session };
}

export function defaultDisplayName(session: Session): string {
  const meta = session.user.user_metadata ?? {};
  const name = (meta.full_name || meta.name || session.user.email?.split("@")[0] || "") as string;
  return name.slice(0, 60);
}

const PENDING_INVITE = "nivel-pending-invite";

export function savePendingInvite(code: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE, code);
  } catch {
    // Storage blocked: the user just opens the link again after signing in.
  }
}

export function takePendingInvite(): string | null {
  try {
    const c = sessionStorage.getItem(PENDING_INVITE);
    sessionStorage.removeItem(PENDING_INVITE);
    return c;
  } catch {
    return null;
  }
}
