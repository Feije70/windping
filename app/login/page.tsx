"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import { Logo } from "@/components/Logo";
import { supabase, isTokenExpired } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"login" | "reset">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/";
    });
  }, []);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter your email and password."); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        if (authError.message?.includes("Email not confirmed")) {
          setError("Please confirm your email first via the link in your inbox.");
        } else {
          setError("Incorrect email or password.");
        }
        setLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  }

  async function handleReset() {
    setResetError("");
    setResetSuccess("");
    if (!resetEmail) { setResetError("Please enter your email."); return; }

    try {
      await supabase.auth.resetPasswordForEmail(resetEmail);
      setResetSuccess("Recovery link sent! Check your inbox.");
    } catch {
      setResetError("Connection error. Please try again.");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.cream,
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-block" }}>
            <Logo size={44} />
          </Link>
          <p style={{ fontSize: 13, color: C.sub, fontStyle: "italic", margin: 0 }}>Stop checkin' the weather, start riding together!</p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.97)", borderRadius: 18, padding: "32px 28px",
          border: "1px solid rgba(14,165,233,0.2)", boxShadow: "0 8px 40px rgba(0,0,0,.08)",
        }}>
          {view === "login" ? (
            <>
              <h1 className="font-bebas" style={{ ...h, fontSize: 26, letterSpacing: 1, color: C.text, margin: "0 0 4px" }}>Log in</h1>
              <p style={{ fontSize: 13, color: C.textSub, margin: "0 0 24px" }}>Welkom terug!</p>

              {error && <div style={{ background: "#FDF6F3", border: "1px solid #F0D0C0", borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#B86444", marginBottom: 16 }}>{error}</div>}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jouw@email.nl"
                  style={{ width: "100%", padding: "13px 16px", border: "2px solid #E5E7EB", borderRadius: 12, fontSize: 15, color: C.text, outline: "none", background: "#F8FBFF", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = C.sky)} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Wachtwoord</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 tekens"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", padding: "13px 16px", border: "2px solid #E5E7EB", borderRadius: 12, fontSize: 15, color: C.text, outline: "none", background: "#F8FBFF", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = C.sky)} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              </div>

              <div style={{ textAlign: "right", marginBottom: 16 }}>
                <button onClick={() => setView("reset")} style={{ fontSize: 12, fontWeight: 600, color: C.sky, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Wachtwoord vergeten?</button>
              </div>

              <button onClick={() => handleLogin()} disabled={loading}
                style={{
                  width: "100%", padding: 15, background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff",
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1, transition: "all 0.2s",
                }}>
                {loading ? "Laden..." : "Inloggen"}
              </button>

              <div style={{ textAlign: "center", margin: "24px 0", fontSize: 13, color: C.muted, position: "relative" }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(14,165,233,0.15)" }} />
                <span style={{ background: "rgba(255,255,255,0.97)", padding: "0 12px", position: "relative" }}>of</span>
              </div>

              <p style={{ textAlign: "center", fontSize: 13, color: C.textSub, margin: 0 }}>
                Nog geen account?{" "}
                <Link href="/signup" style={{ fontWeight: 700, color: C.sky, textDecoration: "none" }}>Account aanmaken</Link>
              </p>
            </>
          ) : (
            <>
              <button onClick={() => setView("login")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.sky, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 20 }}>
                ← Terug naar inloggen
              </button>
              <h1 className="font-bebas" style={{ ...h, fontSize: 26, letterSpacing: 1, color: C.text, margin: "0 0 4px" }}>Wachtwoord vergeten?</h1>
              <p style={{ fontSize: 13, color: C.textSub, margin: "0 0 24px" }}>We sturen je een herstelmail.</p>

              {resetError && <div style={{ background: "#FDF6F3", border: "1px solid #F0D0C0", borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#B86444", marginBottom: 16 }}>{resetError}</div>}
              {resetSuccess && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#16A34A", marginBottom: 16 }}>{resetSuccess}</div>}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="jouw@email.nl"
                  onKeyDown={(e) => e.key === "Enter" && handleReset()}
                  style={{ width: "100%", padding: "13px 16px", border: "2px solid #E5E7EB", borderRadius: 12, fontSize: 15, color: C.text, outline: "none", background: "#F8FBFF", boxSizing: "border-box" }}
                />
              </div>

              <button onClick={handleReset}
                style={{ width: "100%", padding: 15, background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Herstelmail sturen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}