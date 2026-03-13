"use client";
import { useEffect, useState } from "react";
import { C } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export function EnrichmentCronPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [jobsRes, enrichRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/enrichment_jobs?select=status,created_at,updated_at,job_type&order=created_at.desc&limit=100`, {
            headers: { apikey: SUPABASE_ANON_KEY }
          }).then(r => r.json()),
          fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?select=spot_id,scanned_at&order=scanned_at.desc&limit=1`, {
            headers: { apikey: SUPABASE_ANON_KEY }
          }).then(r => r.json()),
        ]);
        const jobs = Array.isArray(jobsRes) ? jobsRes : [];
        const pending = jobs.filter((j: any) => j.status === "pending").length;
        const running = jobs.filter((j: any) => j.status === "running").length;
        const done = jobs.filter((j: any) => j.status === "done").length;
        const failed = jobs.filter((j: any) => j.status === "failed").length;
        const lastScanned = Array.isArray(enrichRes) && enrichRes[0] ? enrichRes[0].scanned_at : null;
        const lastJob = jobs.find((j: any) => j.status === "done");
        setData({ pending, running, done, failed, lastScanned, lastJob: lastJob?.updated_at || null, total: jobs.length });
      } catch {}
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const crons = [
    { name: "Enrichment scan", schedule: "Elke 5 min", desc: "Verwerkt 3 spots per run uit de wachtrij", key: "scan" },
    { name: "Nieuws-check", schedule: "Maandag 07:00", desc: "Controleert nieuws voor alle actieve spots", key: "news" },
    { name: "Jaarlijkse refresh", schedule: "1 januari 00:00", desc: "Volledige herindexering alle actieve spots", key: "annual" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {crons.map(cron => (
          <div key={cron.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.creamDark, borderRadius: 10, marginBottom: 8, border: `1px solid ${C.cardBorder}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: cron.key === "scan" ? "#22C55E" : C.muted, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{cron.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{cron.desc}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.sky, background: `${C.sky}12`, padding: "3px 9px", borderRadius: 6 }}>{cron.schedule}</span>
          </div>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: C.muted, fontSize: 12 }}>Laden...</div>
      ) : data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "In wachtrij", value: data.pending, color: C.sky },
              { label: "Bezig", value: data.running, color: "#F59E0B" },
              { label: "Klaar", value: data.done, color: "#22C55E" },
              { label: "Mislukt", value: data.failed, color: "#EF4444" },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, borderRadius: 10, padding: "12px 14px", boxShadow: C.cardShadow, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, padding: "8px 12px", background: C.creamDark, borderRadius: 8 }}>
            {data.lastScanned ? (
              <>Laatste scan: <strong style={{ color: C.navy }}>{new Date(data.lastScanned).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></>
            ) : "Nog geen scans uitgevoerd"}
            {data.pending > 0 && <span style={{ marginLeft: 12, color: C.sky }}>⏱ Geschatte tijd: ~{Math.ceil(data.pending / 3) * 5} min</span>}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: C.amber }}>Kon wachtrij niet laden.</div>
      )}
    </div>
  );
}
