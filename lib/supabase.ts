/* ── lib/supabase.ts ──────────────────────────────────────────
   Supabase client using official @supabase/supabase-js
   Sessions stored in localStorage (persistent across tabs/restarts).
   Token refresh is automatic — no manual refresh needed.
   Install: npm install @supabase/supabase-js
   ──────────────────────────────────────────────────────────── */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kaimbtcuyemwzvhsqwgu.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaW1idGN1eWVtd3p2aHNxd2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNTM0NzgsImV4cCI6MjA4NjcyOTQ3OH0.EVX_hJYy_uJ_-rk-q5izn_6qzo5TbHCnS4llbVUM4Q0";

/* ── Supabase Client (singleton) ── */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "wp_supabase_auth",
  },
});

/* ── Auth helpers (same API surface — all pages keep working) ── */

export async function getValidToken(): Promise<string | null> {
  // Try official Supabase client first
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch {}
  // Fallback: read directly from localStorage (wp_supabase_auth)
  try {
    const raw = localStorage.getItem("wp_supabase_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Check if token is expired
    if (parsed?.expires_at && Math.floor(Date.now() / 1000) > parsed.expires_at) return null;
    return parsed?.access_token || null;
  } catch { return null; }
}

export async function clearAuth() {
  try { await supabase.auth.signOut(); } catch {}
  // Force clear localStorage
  try { localStorage.removeItem("wp_supabase_auth"); } catch {}
  // Clean up old sessionStorage keys from previous version
  try {
    ["wp_token", "wp_email", "wp_auth_id", "wp_refresh"].forEach((k) =>
      sessionStorage.removeItem(k)
    );
  } catch { /* ignore */ }
}

export function setAuth(_data: {
  access_token: string;
  refresh_token?: string;
  user: { email: string; id: string };
}) {
  // No-op: official client stores session automatically after signIn/signUp
}

/* ── Supabase REST helper (unchanged) ── */
export async function sb(
  path: string,
  options?: { method?: string; body?: unknown; token?: string }
) {
  const token = options?.token || (await getValidToken());
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}