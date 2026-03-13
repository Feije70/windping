"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { useUser } from "@/lib/hooks/useUser";

const h = { fontFamily: fonts.heading };

interface Friend { id: number; name: string; friendshipId: number; }
interface PendingReq { id: number; name: string; friendshipId: number; }
interface SearchResult { id: number; name: string; email: string; }

export default function VriendenPage() {
  const { token, loading: authLoading } = useUser();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<number | null>(null);
  const [tab, setTab] = useState<"buddies" | "add">("buddies");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());

  // Invite accept state
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteCodeUrl, setInviteCodeUrl] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"ready" | "accepting" | "success" | "error" | "not_logged_in">("ready");
  const [inviteError, setInviteError] = useState("");

  async function apiFetch(path: string, options?: RequestInit) {
    if (!token) return { error: "Niet ingelogd" };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    try {
      const res = await fetch(path, { ...options, headers });
      return await res.json();
    } catch (e) {
      console.error("apiFetch error:", e);
      return { error: "Netwerkfout" };
    }
  }

  const loadFriends = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/api/friends?type=list");
      if (!data.error) {
        setFriends(data.friends || []);
        setPending(data.pending || []);
        setInviteCode(data.inviteCode || null);
      }
    } catch {}
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Check for invite code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setInviteMode(true);
      setInviteCodeUrl(code);
      fetch(`/api/friends?type=invite_info&code=${code}`)
        .then(r => r.json())
        .then(d => { if (d.inviterName) setInviterName(d.inviterName); })
        .catch(() => {});
      if (!token && !authLoading) setInviteStatus("not_logged_in");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading]);

  const acceptInviteFromUrl = async () => {
    setInviteStatus("accepting");
    const data = await apiFetch("/api/friends", {
      method: "POST",
      body: JSON.stringify({ action: "accept_invite", code: inviteCodeUrl }),
    });
    if (data.error === "Niet ingelogd") {
      try { localStorage.setItem("wp_invite_code", inviteCodeUrl); } catch {}
      window.location.href = "/login?redirect=/vrienden?code=" + inviteCodeUrl;
      return;
    }
    if (data.success) {
      setInviterName(data.friendName || inviterName);
      setInviteStatus("success");
      window.history.replaceState({}, "", "/vrienden");
      loadFriends();
    } else {
      setInviteError(data.error || "Er ging iets mis");
      setInviteStatus("error");
    }
  };

  const createInvite = async () => {
    try {
      const data = await apiFetch("/api/friends", {
        method: "POST",
        body: JSON.stringify({ action: "create_invite" }),
      });
      if (data.code) {
        setInviteCode(data.code);
        setMessage({ text: "Invite code aangemaakt!", type: "success" });
      } else {
        setMessage({ text: data.error || "Kon geen code aanmaken", type: "error" });
      }
    } catch {
      setMessage({ text: "Er ging iets mis. Probeer opnieuw.", type: "error" });
    }
  };

  const shareInvite = async () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/vrienden?code=${inviteCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: "WindPing", text: "Voeg me toe als wind-buddy op WindPing! 🪁🏄", url: link }); } catch {}
    } else { copyLink(); }
  };

  const copyLink = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/vrienden?code=${inviteCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const acceptCode = async () => {
    if (!codeInput.trim()) return;
    setMessage(null);
    const data = await apiFetch("/api/friends", {
      method: "POST",
      body: JSON.stringify({ action: "accept_invite", code: codeInput.trim() }),
    });
    if (data.success) {
      setMessage({ text: `${data.friendName} is nu je wind-buddy! 🤙`, type: "success" });
      setCodeInput("");
      loadFriends();
    } else {
      setMessage({ text: data.error || "Er ging iets mis", type: "error" });
    }
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await apiFetch(`/api/friends?type=search&q=${encodeURIComponent(q)}`);
      setSearchResults(data.results || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const sendRequest = async (targetUserId: number) => {
    const data = await apiFetch("/api/friends", {
      method: "POST",
      body: JSON.stringify({ action: "send_request", friendId: targetUserId }),
    });
    if (data.success || data.friendshipId) {
      setSentRequests(prev => new Set(prev).add(targetUserId));
      setMessage({ text: "Verzoek verstuurd! 🤙", type: "success" });
    } else {
      setMessage({ text: data.error || "Er ging iets mis", type: "error" });
    }
  };

  const acceptRequest = async (friendshipId: number) => {
    const data = await apiFetch("/api/friends", {
      method: "POST",
      body: JSON.stringify({ action: "accept_request", friendshipId }),
    });
    if (data.success) {
      setMessage({ text: "Geaccepteerd! 🤙", type: "success" });
      loadFriends();
    }
  };

  const removeFriend = async (friendshipId: number) => {
    await apiFetch(`/api/friends?id=${friendshipId}`, { method: "DELETE" });
    setShowRemoveConfirm(null);
    loadFriends();
  };

  // Wacht tot auth bekend is
  if (authLoading) return null;

  /* ═══════════════════════════════════════
     INVITE ACCEPT VIEW (via link)
     ═══════════════════════════════════════ */
  if (inviteMode) {
    return (
      <div style={{ background: C.cream, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NavBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ textAlign: "center", maxWidth: 340 }}>
            {inviteStatus === "success" ? (
              <>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🤙</div>
                <h2 style={{ ...h, fontSize: 24, fontWeight: 800, color: C.navy, margin: "0 0 8px" }}>Yes!</h2>
                <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.5, margin: "0 0 24px" }}>
                  <strong style={{ color: C.navy }}>{inviterName}</strong> en jij zijn nu wind-buddies!<br />
                  Jullie zien wanneer de ander het water opgaat.
                </p>
                <Link href="/" style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 28px", background: C.green, color: "#FFF",
                  fontSize: 15, fontWeight: 700, borderRadius: 12, textDecoration: "none",
                }}>
                  Naar Home →
                </Link>
              </>
            ) : (
              <>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", background: C.oceanTint,
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <h2 style={{ ...h, fontSize: 22, fontWeight: 800, color: C.navy, margin: "0 0 8px" }}>
                  {inviterName ? `${inviterName} nodigt je uit!` : "Je bent uitgenodigd!"}
                </h2>
                <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.5, margin: "0 0 24px" }}>
                  Word wind-buddies en zie wanneer de ander het water opgaat.
                </p>

                {inviteStatus === "error" ? (
                  <div>
                    <div style={{
                      padding: "14px 20px", borderRadius: 12, marginBottom: 16,
                      background: C.terraTint, border: "1px solid rgba(212,146,46,0.2)",
                      fontSize: 14, fontWeight: 600, color: C.amber,
                    }}>
                      {inviteError}
                    </div>
                    <button onClick={() => { setInviteMode(false); window.history.replaceState({}, "", "/vrienden"); }}
                      style={{ fontSize: 13, color: C.sky, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      Ga naar Wind Buddies →
                    </button>
                  </div>
                ) : inviteStatus === "not_logged_in" ? (
                  <a href={`/login?redirect=/vrienden?code=${inviteCodeUrl}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "14px 28px", background: C.green, color: "#FFF",
                      fontSize: 15, fontWeight: 700, borderRadius: 12, textDecoration: "none",
                    }}>
                    Log in of maak account →
                  </a>
                ) : (
                  <button onClick={acceptInviteFromUrl} disabled={inviteStatus === "accepting"} style={{
                    padding: "14px 32px", borderRadius: 12, border: "none",
                    background: C.green, color: "#FFF", fontSize: 16, fontWeight: 700,
                    cursor: inviteStatus === "accepting" ? "default" : "pointer",
                    opacity: inviteStatus === "accepting" ? 0.7 : 1,
                  }}>
                    {inviteStatus === "accepting" ? "Even geduld..." : "🤙 Word buddies!"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     MAIN VIEW
     ═══════════════════════════════════════ */
  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ ...h, fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Wind Buddies</h2>
          <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>
            {friends.length === 0 ? "Nodig je kitemaatjes uit!" : `${friends.length} wind-budd${friends.length === 1 ? "y" : "ies"}`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 4, background: C.card, borderRadius: 12, marginBottom: 20, border: `1px solid ${C.cardBorder}` }}>
          {([["buddies", "Mijn Buddies"], ["add", "Toevoegen"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none",
              background: tab === key ? C.sky : "transparent",
              color: tab === key ? "#FFF" : C.sub,
              fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        {message && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, marginBottom: 16,
            background: message.type === "success" ? C.goBg : C.terraTint,
            border: `1px solid ${message.type === "success" ? "rgba(45,143,111,0.2)" : "rgba(212,146,46,0.2)"}`,
            fontSize: 13, fontWeight: 600, color: message.type === "success" ? C.green : C.amber,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            {message.text}
            <button onClick={() => setMessage(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}

        {tab === "buddies" && (
          <>
            {pending.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.amber, color: "#FFF", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{pending.length}</span>
                  Verzoeken
                </div>
                {pending.map((p) => (
                  <div key={p.friendshipId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.epicBg, borderRadius: 14, marginBottom: 8, border: "1px solid rgba(212,146,46,0.15)" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.sky }}>{p.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Wil je wind-buddy worden</div>
                    </div>
                    <button onClick={() => acceptRequest(p.friendshipId)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.green, color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Accepteer</button>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>Laden...</div>
            ) : friends.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16, boxShadow: C.cardShadow }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round" style={{ marginBottom: 12 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Nog geen wind-buddies</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>Voeg je kitemaatjes toe en zie<br />wanneer zij het water opgaan!</div>
                <button onClick={() => setTab("add")} style={{
                  padding: "12px 24px", borderRadius: 10, border: "none",
                  background: C.green, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Buddies toevoegen
                </button>
              </div>
            ) : (
              <div>
                {friends.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.card, borderRadius: 14, boxShadow: C.cardShadow, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.oceanTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.sky }}>{f.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Wind buddy</div>
                    </div>
                    {showRemoveConfirm === f.friendshipId ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => removeFriend(f.friendshipId)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.amber, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Verwijder</button>
                        <button onClick={() => setShowRemoveConfirm(null)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.card, color: C.sub, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Nee</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowRemoveConfirm(f.friendshipId)} style={{ padding: "6px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: C.muted }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setTab("add")} style={{
                  width: "100%", marginTop: 8, padding: "12px", borderRadius: 12,
                  border: `1.5px dashed ${C.cardBorder}`, background: "transparent",
                  color: C.sky, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Meer buddies toevoegen
                </button>
              </div>
            )}
          </>
        )}

        {tab === "add" && (
          <>
            <div style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: "20px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                Zoek op WindPing
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Zit je maatje al op WindPing? Zoek op naam of e-mail.</div>
              <input type="text" value={searchQuery} onChange={(e) => searchUsers(e.target.value)} placeholder="Naam of e-mailadres..."
                style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.cream, fontSize: 14, color: C.navy, boxSizing: "border-box" }} />
              {searching && <div style={{ textAlign: "center", padding: 12, color: C.muted, fontSize: 12 }}>Zoeken...</div>}
              {searchResults.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {searchResults.map((u) => {
                    const isSent = sentRequests.has(u.id);
                    return (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: `1px solid ${C.cardBorder}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.oceanTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.sky }}>{(u.name || u.email).charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{u.name || u.email.split("@")[0]}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{u.email}</div>
                        </div>
                        {isSent ? (
                          <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>✓ Verstuurd</span>
                        ) : (
                          <button onClick={() => sendRequest(u.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.sky, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Toevoegen</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {searchQuery.length >= 3 && searchResults.length === 0 && !searching && (
                <div style={{ textAlign: "center", padding: "16px 0", color: C.muted, fontSize: 12 }}>Geen gebruikers gevonden. Nodig ze uit via een link! 👇</div>
              )}
            </div>

            <div style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: "20px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Stuur een invite link
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Deel via WhatsApp of iMessage. Werkt voor iedereen — ook als ze al op WindPing zitten.</div>
              {inviteCode ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", background: C.cream, borderRadius: 12, border: `1px solid ${C.cardBorder}`, marginBottom: 10 }}>
                    <div style={{ flex: 1, fontFamily: "monospace", fontSize: 22, fontWeight: 800, letterSpacing: 4, color: C.navy, textAlign: "center" }}>{inviteCode}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={copyLink} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: copied ? C.goBg : C.card, color: copied ? C.green : C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {copied ? "✓ Gekopieerd!" : "📋 Kopieer link"}
                    </button>
                    <button onClick={shareInvite} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: C.green, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      📤 Deel via...
                    </button>
                  </div>
                  <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: C.muted }}>Geldig voor 30 dagen</div>
                </div>
              ) : (
                <button onClick={createInvite} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.green, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  🔗 Maak invite link
                </button>
              )}
            </div>

            <div style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: "20px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                Heb je een code?
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Vul de code in die je van een vriend hebt gekregen.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6}
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.cream, fontSize: 18, fontWeight: 700, letterSpacing: 3, textAlign: "center", color: C.navy, fontFamily: "monospace" }} />
                <button onClick={acceptCode} disabled={codeInput.length < 4} style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: codeInput.length >= 4 ? C.sky : C.cardBorder, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: codeInput.length >= 4 ? "pointer" : "default" }}>Voeg toe</button>
              </div>
            </div>
          </>
        )}

        <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 24, fontSize: 13, color: C.sky, textDecoration: "none", fontWeight: 600 }}>← Terug naar Home</Link>
      </div>
    </div>
  );
}