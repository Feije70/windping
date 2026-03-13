"use client";
import { useEffect, useState } from "react";
import { C } from "../lib/constants";

function SimulatorTab({ token }: { token: string | null }) {
  const [simUsers, setSimUsers] = useState<any[]>([]);
  const [simSpots, setSimSpots] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSessions, setUserSessions] = useState<any[]>([]);
  const [userFriendships, setUserFriendships] = useState<any[]>([]);
  const [userFeed, setUserFeed] = useState<any[]>([]);
  const [feedFriendCount, setFeedFriendCount] = useState(0);
  const [feedDebug, setFeedDebug] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<"sessions" | "friends" | "feed" | "create">("feed");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Create session form
  const [createSpotId, setCreateSpotId] = useState<number | null>(null);
  const [createStatus, setCreateStatus] = useState("completed");
  const [createRating, setCreateRating] = useState<number>(4);
  const [createWind, setCreateWind] = useState<number>(18);
  const [createDir, setCreateDir] = useState("SW");
  const [createGearType, setCreateGearType] = useState("kite twintip");
  const [createGearSize, setCreateGearSize] = useState("9");
  const [createNotes, setCreateNotes] = useState("");
  const [createDate, setCreateDate] = useState(new Date().toISOString().split("T")[0]);
  const [createPhotoUrl, setCreatePhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Add friend form
  const [friendTargetId, setFriendTargetId] = useState<number | null>(null);

  async function adminFetch(url: string) {
    const t = token || (await import("@/lib/supabase").then(m => m.getValidToken()))
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    return res.json();
  }

  async function adminPost(url: string, body: any) {
    const t = token || (await import("@/lib/supabase").then(m => m.getValidToken()))
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function adminDelete(url: string) {
    const t = token || (await import("@/lib/supabase").then(m => m.getValidToken()))
    await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
  }

  useEffect(() => {
    async function load() {
      const [usersRes, spotsRes] = await Promise.all([
        adminFetch("/api/admin/simulate?action=users"),
        adminFetch("/api/admin/simulate?action=spots"),
      ]);
      setSimUsers(usersRes.users || []);
      setSimSpots(spotsRes.spots || []);
      if (usersRes.users?.length) setCreateSpotId(null);
    }
    load();
  }, []);

  async function selectUser(user: any) {
    setSelectedUser(user);
    setMsg("");
    setLoading(true);
    const [sessRes, friendRes, feedRes] = await Promise.all([
      adminFetch(`/api/admin/simulate?action=user_sessions&user_id=${user.id}`),
      adminFetch(`/api/admin/simulate?action=user_friendships&user_id=${user.id}`),
      adminFetch(`/api/admin/simulate?action=user_feed&user_id=${user.id}`),
    ]);
    setUserSessions(sessRes.sessions || []);
    setUserFriendships(friendRes.friendships || []);
    setUserFeed(feedRes.feed || []);
    setFeedFriendCount(feedRes.friendCount || 0);
    setFeedDebug(feedRes.debug || null);
    setLoading(false);
  }

  async function createSession() {
    if (!selectedUser || !createSpotId) return;
    setLoading(true);
    const res = await adminPost("/api/admin/simulate", {
      action: "create_session",
      userId: selectedUser.id,
      spotId: createSpotId,
      sessionDate: createDate,
      status: createStatus,
      rating: createStatus === "completed" ? createRating : null,
      gearType: createGearType || null,
      gearSize: createGearSize || null,
      forecastWind: createWind,
      forecastDir: createDir,
      notes: createNotes || null,
      photoUrl: createPhotoUrl || null,
    });
    if (res.error) { setMsg("❌ " + res.error); }
    else { setMsg("✓ Sessie aangemaakt! Push verstuurd naar vrienden."); setCreatePhotoUrl(null); await selectUser(selectedUser); setActivePanel("sessions"); }
    setLoading(false);
  }

  async function deleteSession(id: number) {
    if (!confirm("Sessie verwijderen?")) return;
    await adminDelete(`/api/admin/simulate?action=session&id=${id}`);
    setUserSessions(prev => prev.filter(s => s.id !== id));
    setMsg("✓ Sessie verwijderd");
  }

  async function createFriendship() {
    if (!selectedUser || !friendTargetId) return;
    setLoading(true);
    const res = await adminPost("/api/admin/simulate", {
      action: "create_friendship",
      userId1: selectedUser.id,
      userId2: friendTargetId,
    });
    if (res.error) setMsg("❌ " + res.error);
    else { setMsg("✓ Vriendschap aangemaakt!"); await selectUser(selectedUser); }
    setLoading(false);
  }

  async function deleteFriendship(id: number) {
    await adminDelete(`/api/admin/simulate?action=friendship&id=${id}`);
    setUserFriendships(prev => prev.filter(f => f.id !== id));
    setMsg("✓ Vriendschap verwijderd");
  }

  const ratingLabels: Record<number, string> = { 1: "Shit 😬", 2: "Mwah 😐", 3: "Oké 👌", 4: "Lekker 😎", 5: "EPIC 🤙" };
  const [spotSearch, setSpotSearch] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* User picker */}
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8, letterSpacing: "0.06em" }}>SELECTEER GEBRUIKER</div>
        <select
          value={selectedUser?.id || ""}
          onChange={e => {
            const user = simUsers.find(u => u.id === Number(e.target.value));
            if (user) selectUser(user);
          }}
          style={{ width: "100%", padding: "10px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 13, color: C.navy, outline: "none" }}
        >
          <option value="">Kies gebruiker...</option>
          {simUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.name || u.email?.split("@")[0] || "?"} — {u.email}
            </option>
          ))}
        </select>
      </div>

      {/* Panel */}
      {selectedUser && (
        <div style={{ background: C.card, borderRadius: 14, boxShadow: C.cardShadow, overflow: "hidden" }}>

          {/* Context header */}
          <div style={{ padding: "12px 16px", background: `${C.sky}10`, borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.sky}, ${C.skyDark || C.navy})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(selectedUser.name || selectedUser.email || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{selectedUser.name || selectedUser.email}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {userFriendships.filter(f => f.status === "accepted").length} vrienden
                {userFriendships.filter(f => f.status === "accepted").length > 0 && (
                  <span> — {userFriendships.filter(f => f.status === "accepted").map((f: any) => f.friendName).join(", ")}</span>
                )}
                {" · "}
                {userSessions.length} sessies
              </div>
            </div>
          </div>

          {/* Panel tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.cardBorder}` }}>
            {([
              { id: "feed" as const,     label: `👁️ Feed (${feedFriendCount} vrienden)` },
              { id: "sessions" as const, label: `📋 Sessies (${userSessions.length})` },
              { id: "friends" as const,  label: `🤝 Vrienden (${userFriendships.filter(f => f.status === "accepted").length})` },
              { id: "create" as const,   label: "➕ Simuleer" },
            ]).map(p => (
              <button key={p.id} onClick={() => setActivePanel(p.id)} style={{
                flex: 1, padding: "10px 4px", fontSize: 11, fontWeight: 700,
                background: activePanel === p.id ? C.cream : "transparent",
                color: activePanel === p.id ? C.sky : C.muted,
                border: "none", cursor: "pointer",
                borderBottom: activePanel === p.id ? `2px solid ${C.sky}` : "2px solid transparent",
              }}>{p.label}</button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {msg && (
              <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600,
                background: msg.startsWith("✓") ? `${C.green}15` : `${C.terra}15`,
                color: msg.startsWith("✓") ? C.green : C.terra,
              }}>{msg}</div>
            )}

            {loading && (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ width: 20, height: 20, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
              </div>
            )}

            {/* FEED PANEL */}
            {!loading && activePanel === "feed" && (
              <div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 8, padding: "8px 12px", background: C.oceanTint, borderRadius: 8 }}>
                  👁️ <strong>Feed viewer</strong> — Dit is exact wat {selectedUser.name || selectedUser.email} ziet op zijn homepage. Handig om te controleren of sessies van vrienden correct verschijnen.
                </div>
                {feedDebug && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, padding: "6px 10px", background: C.creamDark, borderRadius: 6 }}>
                    Debug: {feedDebug.totalFriendships} vriendschappen totaal · {feedDebug.acceptedFriendships} accepted · {feedDebug.sessionCount ?? 0} sessies gevonden (laatste 90 dagen)
                  </div>
                )}
                {feedFriendCount === 0 && (
                  <div style={{ color: C.amber, fontSize: 12, marginBottom: 10 }}>
                    ⚠️ Geen vrienden — voeg vrienden toe via het 🤝 tabblad om de feed te testen.
                  </div>
                )}
                {userFeed.length === 0 && feedFriendCount > 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>
                    Vrienden hebben de afgelopen 90 dagen geen sessies gelogd. Maak er een aan via ➕ Simuleer.
                  </div>
                ) : userFeed.map((item: any) => (
                  <div key={item.id} style={{ padding: "10px 12px", background: C.creamDark, borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{item.friendName} · {item.spotName}</div>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, fontWeight: 700,
                        background: item.status === "completed" ? `${C.green}20` : `${C.sky}20`,
                        color: item.status === "completed" ? C.green : C.sky,
                      }}>{item.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {item.sessionDate} · {item.forecastWind}kn {item.forecastDir}
                      {item.gearType && ` · ${item.gearType}`}
                      {item.rating && ` · ${ratingLabels[item.rating]}`}
                    </div>
                    {item.notes && <div style={{ fontSize: 11, color: C.sub, marginTop: 4, fontStyle: "italic" }}>{item.notes}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* SESSIONS PANEL */}
            {!loading && activePanel === "sessions" && (
              <div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, padding: "8px 12px", background: C.oceanTint, borderRadius: 8 }}>
                  📋 <strong>Sessies</strong> — Alle sessies van deze gebruiker. Je kunt sessies verwijderen of nieuwe aanmaken via ➕ Simuleer. Gesimuleerde sessies verschijnen direct in de feed van vrienden.
                </div>
                {userSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>Geen sessies</div>
                ) : userSessions.map((s: any) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{s.spotName || s.spots?.display_name || `Spot #${s.spot_id}`}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {s.session_date} · {s.status}
                        {s.forecast_wind && ` · ${s.forecast_wind}kn`}
                        {s.gear_type && ` · ${s.gear_type}`}
                        {s.rating && ` · ${ratingLabels[s.rating]}`}
                      </div>
                      {s.notes && <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic" }}>{s.notes}</div>}
                    </div>
                    <button onClick={() => deleteSession(s.id)} style={{ padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* FRIENDS PANEL */}
            {!loading && activePanel === "friends" && (
              <div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, padding: "8px 12px", background: C.oceanTint, borderRadius: 8 }}>
                  🤝 <strong>Vrienden</strong> — Beheer vriendschappen voor deze gebruiker. Maak een vriendschap aan om de feed te testen: koppel twee gebruikers en maak dan via ➕ Simuleer een sessie aan namens de vriend. Die sessie verschijnt dan in de feed.
                </div>
                {/* Add friendship */}
                <div style={{ marginBottom: 14, padding: "12px", background: C.creamDark, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8 }}>VRIENDSCHAP AANMAKEN</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={friendTargetId || ""} onChange={e => setFriendTargetId(Number(e.target.value))}
                      style={{ flex: 1, padding: "8px 10px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12, color: C.navy }}>
                      <option value="">Kies gebruiker...</option>
                      {simUsers.filter(u => u.id !== selectedUser.id).map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                    <button onClick={createFriendship} disabled={!friendTargetId || loading} style={{ padding: "8px 14px", background: C.sky, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Toevoegen
                    </button>
                  </div>
                </div>

                {userFriendships.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>Geen vriendschappen</div>
                ) : userFriendships.map((f: any) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{f.friendName}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{f.status}</div>
                    </div>
                    <button onClick={() => deleteFriendship(f.id)} style={{ padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CREATE SESSION PANEL */}
            {!loading && activePanel === "create" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, color: C.sub }}>
                  Maak een sessie aan namens <strong style={{ color: C.navy }}>{selectedUser.name || selectedUser.email}</strong>.
                  Deze verschijnt direct in de feed van zijn vrienden.
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>SPOT</label>
                  <input
                    type="text"
                    placeholder="Zoek spot... (200 beschikbaar)"
                    value={spotSearch}
                    onChange={e => { setSpotSearch(e.target.value); setCreateSpotId(null); }}
                    style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${createSpotId ? C.green : C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }}
                  />
                  {spotSearch.length >= 2 && !createSpotId && (
                    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      {simSpots.filter(s => s.display_name.toLowerCase().includes(spotSearch.toLowerCase())).slice(0, 8).map(s => (
                        <div key={s.id} onClick={() => { setCreateSpotId(s.id); setSpotSearch(s.display_name); }}
                          style={{ padding: "8px 12px", fontSize: 13, color: C.navy, cursor: "pointer", borderBottom: `1px solid ${C.cardBorder}` }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.creamDark)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >{s.display_name}</div>
                      ))}
                      {simSpots.filter(s => s.display_name.toLowerCase().includes(spotSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: "8px 12px", fontSize: 12, color: C.muted }}>Geen resultaten</div>
                      )}
                    </div>
                  )}
                  {createSpotId && <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>✓ Spot geselecteerd (ID: {createSpotId})</div>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>DATUM</label>
                    <input type="date" value={createDate} onChange={e => setCreateDate(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>STATUS</label>
                    <select value={createStatus} onChange={e => setCreateStatus(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy }}>
                      <option value="completed">completed</option>
                      <option value="going">going</option>
                    </select>
                  </div>
                </div>

                {createStatus === "completed" && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>RATING</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(r => (
                        <button key={r} onClick={() => setCreateRating(r)} style={{
                          flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                          background: createRating === r ? C.sky : C.creamDark,
                          color: createRating === r ? "#fff" : C.muted,
                        }}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>WIND (KN)</label>
                    <input type="number" value={createWind} onChange={e => setCreateWind(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>RICHTING</label>
                    <select value={createDir} onChange={e => setCreateDir(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy }}>
                      {["N","NE","E","SE","S","SW","W","NW"].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>GEAR TYPE</label>
                    <select value={createGearType} onChange={e => setCreateGearType(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy }}>
                      <option value="kite twintip">kite twintip</option>
                      <option value="kite surfboard">kite surfboard</option>
                      <option value="kite foil">kite foil</option>
                      <option value="windsurf">windsurf</option>
                      <option value="wingfoil">wingfoil</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>MAAT</label>
                    <input value={createGearSize} onChange={e => setCreateGearSize(e.target.value)} placeholder="bijv. 9"
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>FOTO (optioneel)</label>
                  {createPhotoUrl ? (
                    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                      <img src={createPhotoUrl} alt="Sessie foto" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                      <button onClick={() => setCreatePhotoUrl(null)} style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ) : (
                    <div onClick={() => document.getElementById("sim-photo-upload")?.click()}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "18px", borderRadius: 10, border: `2px dashed ${C.cardBorder}`, background: C.creamDark, cursor: "pointer", fontSize: 13, color: C.muted }}>
                      {photoUploading ? "⏳ Uploaden..." : "📷 Klik om foto toe te voegen"}
                    </div>
                  )}
                  <input id="sim-photo-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoUploading(true);
                    const fd = new FormData(); fd.append("file", file);
                    try {
                      const res = await fetch("/api/upload", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.url) setCreatePhotoUrl(data.url);
                      else setMsg("❌ Foto upload mislukt");
                    } catch { setMsg("❌ Foto upload mislukt"); }
                    setPhotoUploading(false);
                    e.target.value = "";
                  }} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>NOTITIE (optioneel)</label>
                  <input value={createNotes} onChange={e => setCreateNotes(e.target.value)} placeholder="Super sessie!"
                    style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                </div>

                <button onClick={createSession} disabled={!createSpotId || loading} style={{
                  width: "100%", padding: "12px", background: C.green, color: "#fff", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: createSpotId ? "pointer" : "not-allowed", opacity: createSpotId ? 1 : 0.5,
                }}>
                  {loading ? "Aanmaken..." : `✓ Sessie aanmaken namens ${selectedUser.name || selectedUser.email}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );

}

export { SimulatorTab };
