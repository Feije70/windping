/* ── app/components/LandingPage.tsx ───────────────────────
   WindPing landing pagina voor niet-ingelogde gebruikers
──────────────────────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import { Icons } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { WPing } from "@/components/WPing";

const h = { fontFamily: fonts.heading };

function FeatureCard({ icon, title, desc, color, soon }: { icon: any; title: string; desc: string; color: string; soon?: boolean }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, boxShadow: C.cardShadow, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon({ color, size: 20 })}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{title}</div>
          {soon && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${C.purple}15`, color: C.purple }}>Binnenkort</span>}
        </div>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ flexShrink: 0 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: C.sky, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 800, fontSize: 14, boxShadow: "0 2px 8px rgba(46,111,126,0.2)" }}>{num}</div></div>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

const features = [
  { icon: Icons.mapPin, title: "Jouw Spots", desc: "Sla je favoriete kite- en windsurfspots op. Wij volgen 393+ locaties met live winddata.", color: C.sky },
  { icon: Icons.bell, title: "Slimme Alerts", desc: "Ontvang dagen van tevoren een melding als de condities matchen. Push en e-mail.", color: C.green },
  { icon: Icons.sliders, title: "Jouw Voorkeuren", desc: "Stel je ideale windsnelheid, richting, getij en temperatuur in.", color: C.gold },
  { icon: Icons.plus, title: "Eigen Spot Toevoegen", desc: "Spot niet in de lijst? Voeg hem toe — privé of gedeeld.", color: C.skyDark },
  { icon: Icons.users, title: "Community", desc: "Zie wie er op het water gaat, deel sessies en ontdek nieuwe spots.", color: C.purple, soon: true },
];

const steps = [
  { num: "1", title: "Kies je spots", desc: "Selecteer spots uit onze database of voeg je eigen geheime plekje toe." },
  { num: "2", title: "Stel je voorkeuren in", desc: "Windsnelheid, richting, temperatuur en de dagen dat jij kunt." },
  { num: "3", title: "Ontvang je ping", desc: "WindPing checkt de forecast en stuurt je een alert zodra het matcht." },
];

export function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  return (
    <main style={{ background: C.cream, minHeight: "100vh", overflowX: "hidden" }}>
      <section style={{ position: "relative", minHeight: "92svh", overflow: "hidden", background: "#1A3A4A" }}>
        <img src="/Hero-ocean.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "70% 40%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(26,58,74,0.88) 0%, rgba(26,58,74,0.7) 30%, rgba(26,58,74,0.35) 55%, rgba(26,58,74,0.1) 75%, transparent 100%)", zIndex: 2 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(to bottom, transparent 0%, ${C.cream}44 30%, ${C.cream}aa 60%, ${C.cream} 90%)`, zIndex: 3 }} />
        <div style={{ position: "relative", zIndex: 10, minHeight: "92svh", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
            <Logo size={28} dark />
            <Link href="/login" style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "8px 18px", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 10, backdropFilter: "blur(4px)", background: "rgba(255,255,255,0.05)" }}>Log in</Link>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 600, width: "100%", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ maxWidth: 440, margin: "0 auto", opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 24, backdropFilter: "blur(8px)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>Kitesurf &amp; Windsurf Alerts</span>
              </div>
              <h1 style={{ ...h, fontSize: "clamp(3rem, 12vw, 4.2rem)", lineHeight: 0.95, color: "white", margin: "0 0 16px", letterSpacing: -1 }}>
                Stop Checkin&apos; The Weather,<br />
                <span style={{ color: C.terra, position: "relative" }}>
                  Start Riding Together!
                  <svg viewBox="0 0 200 12" style={{ position: "absolute", bottom: -4, left: 0, width: "100%", height: 12, overflow: "visible" }}><path d="M5 8 Q50 2 100 7 Q150 12 195 5" stroke={C.terra} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" /></svg>
                </span>
              </h1>
              <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 360, marginBottom: 32, fontWeight: 400 }}>We&apos;ll ping you when it&apos;s Go!</p>
              <div style={{ display: "flex", gap: 12, marginBottom: 40, maxWidth: 380 }}>
                <Link href="/signup" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", background: C.terra, color: "#FFF", fontWeight: 700, fontSize: 15, borderRadius: 12, textDecoration: "none", boxShadow: "0 4px 20px rgba(201,122,99,0.4)" }}>Gratis aanmelden <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></Link>
                <Link href="#how" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", background: "white", color: C.navy, fontWeight: 600, fontSize: 14, borderRadius: 12, textDecoration: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>Hoe werkt het?</Link>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "10px 20px", borderRadius: 14, background: "rgba(26,58,74,0.7)", backdropFilter: "blur(12px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>393+ spots</span></div>
                <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>Alerts vooraf</span></div>
                <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>Push alerts</span></div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Meer</span>
            <div style={{ width: 1, height: 24, background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)", animation: "scrollPulse 2s ease-in-out infinite" }} />
          </div>
        </div>
      </section>

      <section style={{ padding: "20px 20px 12px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: C.oceanTint, borderRadius: 16, border: "1px solid rgba(46,111,126,0.08)", marginBottom: 24 }}>
          <WPing mood="happy" size={48} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Hoi, ik ben W. Ping!</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>Ik houd de wind in de gaten en stuur je <strong style={{ color: C.navy }}>dagen van tevoren</strong> een seintje als er een goede sessie aankomt.</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: C.sky, marginBottom: 16 }}>Waarom WindPing</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{features.map((f: any) => <FeatureCard key={f.title} {...f} />)}</div>
      </section>

      <section id="how" style={{ padding: "36px 20px 40px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ padding: "28px 24px", background: C.creamDark, borderRadius: 18 }}>
          <h2 style={{ ...h, fontSize: 20, fontWeight: 800, color: C.navy, marginBottom: 20 }}>Hoe werkt het?</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{steps.map((s) => <StepCard key={s.num} {...s} />)}</div>
        </div>
      </section>

      <section style={{ padding: "0 20px 36px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: "22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><Logo variant="icon" size={28} /><span style={{ fontSize: 12, fontWeight: 700, color: C.sky, letterSpacing: "0.5px" }}>393+ Spots</span></div>
          <h3 style={{ ...h, fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 6px" }}>Vind Jouw Spot</h3>
          <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.55, margin: "0 0 16px" }}>Ontdek kite- en windsurfspots door heel Europa en Marokko. Staat jouw spot er niet bij? Voeg hem toe.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/spot-select" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", background: C.oceanTint, color: C.sky, fontWeight: 600, fontSize: 13, borderRadius: 12, textDecoration: "none" }}>{Icons.search({ color: C.sky })} Bekijk spots</Link>
            <Link href="/signup" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", background: C.cream, color: C.sub, fontWeight: 600, fontSize: 13, borderRadius: 12, border: `1px solid ${C.cardBorder}`, textDecoration: "none" }}>{Icons.plus({ color: C.sub })} Voeg jouw spot toe</Link>
          </div>
        </div>
      </section>

      <section style={{ padding: "40px 20px 52px", background: "linear-gradient(170deg, #1F354C 0%, #2E6F7E 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 380, margin: "0 auto" }}>
          <div style={{ marginBottom: 12 }}><WPing mood="happy" size={44} style={{ margin: "0 auto" }} /></div>
          <Logo variant="text" size={32} dark style={{ justifyContent: "center", marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontStyle: "italic", marginBottom: 28 }}>Jouw perfecte sessie, onze obsessie</div>
          <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 32px", background: C.terra, color: "#FFF", fontWeight: 700, fontSize: 15, borderRadius: 12, textDecoration: "none", boxShadow: "0 4px 20px rgba(201,122,99,0.3)" }}>Gratis aanmelden <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></Link>
          <div style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Al een account? <Link href="/login" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontWeight: 600 }}>Log in</Link></div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.cardBorder}`, padding: "24px 20px", background: C.cream }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo variant="icon" size={20} /><span style={{ fontSize: 11, color: C.sub }}>© 2026 WindPing</span></div>
          <nav style={{ display: "flex", gap: 20 }}>
            <Link href="/spot-select" style={{ fontSize: 12, color: C.sub, textDecoration: "none" }}>Spots</Link>
            <Link href="/login" style={{ fontSize: 12, color: C.sub, textDecoration: "none" }}>Log in</Link>
            <Link href="/signup" style={{ fontSize: 12, color: C.sky, textDecoration: "none", fontWeight: 600 }}>Aanmelden</Link>
          </nav>
        </div>
      </footer>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes scrollPulse{0%,100%{opacity:0.3;transform:scaleY(1)}50%{opacity:0.8;transform:scaleY(1.3)}}`}</style>
    </main>
  );
}
