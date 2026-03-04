"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { colors as C, fonts } from "@/lib/design";
import { Icons } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { clearAuth, getEmail, isTokenExpired } from "@/lib/supabase";

const navItems = [
  { href: "/", label: "Home", icon: Icons.home },
  { href: "/check", label: "Check", icon: Icons.wind },
  { href: "/spots", label: "Spots", icon: Icons.search },
  { href: "/mijn-spots", label: "Mijn Spots", icon: Icons.mapPin },
  { href: "/voorkeuren", label: "Instellingen", icon: Icons.sliders },
];

async function handleLogout() {
  await clearAuth();
  window.location.href = "/login";
}

export default function NavBar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const email = getEmail();
    setLoggedIn(!!email && !isTokenExpired());
  }, []);

  if (loggedIn === null) return null;

  return (
    <>
      {/* ═══ Desktop top nav ═══ */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 60,
          background: "#fff",
          borderBottom: `1px solid ${C.cardBorder}`,
        }}
        className="wp-desktop-nav"
      >
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <Logo size={28} />
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {loggedIn ? (
            <>
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    padding: "8px 14px", borderRadius: 10, textDecoration: "none",
                    color: active ? C.sky : C.muted,
                    background: active ? C.skyGlow : "transparent",
                    fontSize: 12, fontWeight: active ? 700 : 500, transition: "all 0.15s",
                  }}>
                    {item.icon({ color: active ? C.sky : C.muted, size: 20 })}
                    {item.label}
                  </Link>
                );
              })}
              <button onClick={handleLogout} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                borderRadius: 10, cursor: "pointer", color: C.muted,
                fontSize: 13, fontWeight: 500, border: "none", background: "none", marginLeft: 8,
              }}>
                {Icons.logout({ size: 18 })}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{
                padding: "8px 18px", borderRadius: 10, textDecoration: "none",
                color: C.textSub, fontSize: 13, fontWeight: 600,
              }}>
                Log in
              </Link>
              <Link href="/signup" style={{
                padding: "8px 18px", borderRadius: 10, textDecoration: "none",
                background: C.sky, color: "#fff",
                fontSize: 13, fontWeight: 700,
                boxShadow: "0 2px 8px rgba(46,111,126,0.2)",
              }}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ═══ Mobile bottom nav ═══ */}
      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
          background: "#fff",
          borderTop: `1px solid ${C.cardBorder}`,
          zIndex: 9999,
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -2px 16px rgba(31,53,76,0.04)",
        }}
        className="wp-mobile-nav"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", height: "100%" }}>
          {loggedIn ? (
            <>
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    padding: "6px 10px", borderRadius: 12, textDecoration: "none",
                    color: active ? C.sky : C.muted,
                    fontSize: 10, fontWeight: active ? 700 : 500, minWidth: 44,
                    transition: "color 0.15s",
                  }}>
                    {item.icon({ color: active ? C.sky : C.muted, size: 22 })}
                    {item.label}
                  </Link>
                );
              })}
            </>
          ) : (
            <>
              <Link href="/login" style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "6px 16px", borderRadius: 12, textDecoration: "none",
                color: C.textSub, fontSize: 11, fontWeight: 600,
              }}>
                Log in
              </Link>
              <Link href="/signup" style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 24px", borderRadius: 12, textDecoration: "none",
                background: C.sky, color: "#fff",
                fontSize: 13, fontWeight: 700,
                boxShadow: "0 2px 8px rgba(46,111,126,0.2)",
              }}>
                Sign up →
              </Link>
            </>
          )}
        </div>
      </nav>

      <style>{`
        @media (max-width: 640px) { .wp-desktop-nav { display: none !important; } }
        @media (min-width: 641px) { .wp-mobile-nav { display: none !important; } }
      `}</style>
    </>
  );
}