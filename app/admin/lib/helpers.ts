import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export async function sbGet(path: string, token?: string) {
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function sbPatch(path: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

export async function sbDelete(path: string, token?: string) {
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers,
  });
}

export async function sbPost2(path: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function apiPost(path: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}