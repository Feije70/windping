/* ── lib/db/client.ts ─────────────────────────────────────────
   Centrale fetch helpers voor de data access laag.
   Alle lib/db/ bestanden importeren hieruit — nooit direct
   SUPABASE_URL/ANON_KEY aanroepen buiten deze laag.
──────────────────────────────────────────────────────────── */

import { SUPABASE_URL, SUPABASE_ANON_KEY, getValidToken } from "@/lib/supabase";

function buildHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** GET — geeft T | null terug, gooit bij HTTP fout */
export async function dbGet<T>(
  path: string,
  token?: string | null
): Promise<T | null> {
  const t = token ?? (await getValidToken());
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: buildHeaders(t),
  });
  if (!res.ok) throw new Error(`DB GET ${path}: ${res.status}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

/** PATCH — stuurt body, geeft niets terug */
export async function dbPatch(
  path: string,
  body: Record<string, unknown>,
  token?: string | null
): Promise<void> {
  const t = token ?? (await getValidToken());
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...buildHeaders(t), Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DB PATCH ${path}: ${res.status}`);
}

/** POST — geeft de aangemaakte rij terug als T */
export async function dbPost<T>(
  path: string,
  body: Record<string, unknown>,
  token?: string | null
): Promise<T> {
  const t = token ?? (await getValidToken());
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...buildHeaders(t), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DB POST ${path}: ${res.status}`);
  const text = await res.text();
  return JSON.parse(text) as T;
}

/** DELETE — verwijdert rijen die overeenkomen met path filter */
export async function dbDelete(
  path: string,
  token?: string | null
): Promise<void> {
  const t = token ?? (await getValidToken());
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: buildHeaders(t),
  });
  if (!res.ok) throw new Error(`DB DELETE ${path}: ${res.status}`);
}