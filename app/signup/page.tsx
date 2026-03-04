"use client";

import { useState } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError("");
    setSuccess("");
    if (!email || !pw || !pw2) { setError("Please fill in all fields."); return; }
    if (pw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email, password: pw });

      if (authError) {
        if (authError.message?.includes("already registered")) {
          setError("This email is already in use. Try logging in.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        // Session stored automatically — redirect
        window.location.href = "/";
      } else {
        setSuccess("Account aangemaakt! Check je inbox voor de bevestigingsmail.");
        setLoading(false);
      }
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "13px 16px", border: "2px solid #E5E7EB", borderRadius: 12,
    fontSize: 15, color: C.text, outline: "none", background: "#F8FBFF", boxSizing: "border-box" as const,
  };

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
          <p style={{ fontSize: 13, color: C.sub, fontStyle: "italic", margin: 0 }}>Your perfect session, our obsession!</p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.97)", borderRadius: 18, padding: "32px 28px",
          border: "1px solid rgba(14,165,233,0.2)", boxShadow: "0 8px 40px rgba(0,0,0,.08)",
        }}>
          <h1 className="font-bebas" style={{ ...h, fontSize: 26, letterSpacing: 1, color: C.text, margin: "0 0 4px" }}>Create account</h1>
          <p style={{ fontSize: 13, color: C.textSub, margin: "0 0 24px" }}>Free, no credit card required.</p>

          {error && <div style={{ background: "#FDF6F3", border: "1px solid #F0D0C0", borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#B86444", marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#16A34A", marginBottom: 16 }}>{success}</div>}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jouw@email.nl" style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.sky)} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min. 8 characters" style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.sky)} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Confirm password</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat password"
              onKeyDown={(e) => e.key === "Enter" && handleSignup()} style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.sky)} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>

          <button onClick={handleSignup} disabled={loading}
            style={{
              width: "100%", padding: 15, background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1, transition: "all 0.2s",
            }}>
            {loading ? "Loading..." : "Create account"}
          </button>

          <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
            By creating an account you agree to our terms.
          </p>

          <div style={{ textAlign: "center", margin: "24px 0", fontSize: 13, color: C.muted, position: "relative" }}>
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(14,165,233,0.15)" }} />
            <span style={{ background: "rgba(255,255,255,0.97)", padding: "0 12px", position: "relative" }}>of</span>
          </div>

          <p style={{ textAlign: "center", fontSize: 13, color: C.textSub, margin: 0 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ fontWeight: 700, color: C.sky, textDecoration: "none" }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}