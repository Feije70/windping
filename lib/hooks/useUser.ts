/* ── lib/hooks/useUser.ts ─────────────────────────────────────
   Centrale auth hook voor WindPing.
   
   Gebruik in elke pagina:
     const { user, authId, token, loading, signOut } = useUser();
   
   - user:    { id: number, email: string, name: string, ... } of null
   - authId:  UUID string van Supabase auth (voor DB queries)
   - token:   JWT access token (voor Authorization header)
   - loading: true totdat sessie bekend is
   - signOut: uitloggen + redirect naar /login
   
   De hook:
   - Haalt sessie op via Supabase client (automatische token refresh)
   - Laadt WindPing user record (users tabel) op basis van auth_id
   - Redirect naar /login als geen sessie
   - Luistert naar auth state changes (uitloggen in ander tabblad werkt)
   ──────────────────────────────────────────────────────────── */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export interface WindPingUser {
  id: number;
  auth_id: string;
  email: string;
  name: string;
  min_wind_speed: number;
  max_wind_speed: number;
  language: string;
  welcome_shown: boolean;
}

interface UseUserResult {
  user: WindPingUser | null;
  authId: string | null;
  token: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useUser(options?: { redirectIfUnauthenticated?: boolean }): UseUserResult {
  const { redirectIfUnauthenticated = true } = options ?? {};
  const router = useRouter();

  const [user, setUser] = useState<WindPingUser | null>(null);
  const [authId, setAuthId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Haal sessie op via Supabase client (token refresh automatisch)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setLoading(false);
          if (redirectIfUnauthenticated) {
            window.location.href = "/login";
          }
        }
        return;
      }

      const currentAuthId = session.user.id;
      const currentToken = session.access_token;

      // 2. Laad WindPing user record uit de users tabel
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(currentAuthId)}&select=id,auth_id,email,name,min_wind_speed,max_wind_speed,language,welcome_shown&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (!cancelled) {
        if (res.ok) {
          const rows = await res.json();
          setUser(rows[0] ?? null);
        }
        setAuthId(currentAuthId);
        setToken(currentToken);
        setLoading(false);
      }
    }

    init();

    // 3. Luister naar auth state changes (uitloggen in ander tabblad etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          setUser(null);
          setAuthId(null);
          setToken(null);
          if (redirectIfUnauthenticated) {
            window.location.href = "/login";
          }
        } else if (event === "TOKEN_REFRESHED" && session) {
          // Token is automatisch gerefreshed — update de token state
          setToken(session.access_token);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [redirectIfUnauthenticated]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return { user, authId, token, loading, signOut };
}