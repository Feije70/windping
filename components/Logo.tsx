"use client";

import { colors as C, fonts } from "@/lib/design";

/* ── WindPing Logo Component ──────────────────────────────
   Usage:
     <Logo />                    — icon + text (default, navbar)
     <Logo variant="icon" />     — icon only (favicon, app icon)
     <Logo variant="text" />     — text only with ping dot
     <Logo size={28} />          — custom size (icon height)
     <Logo dark />               — for dark backgrounds
     <Logo animated={false} />   — disable ping pulse
   ──────────────────────────────────────────────────────── */

interface LogoProps {
  variant?: "full" | "icon" | "text";
  size?: number;
  dark?: boolean;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Logo({
  variant = "full",
  size = 28,
  dark = false,
  animated = true,
  className,
  style,
}: LogoProps) {
  const pinColor = dark ? "#3A8A9B" : C.sky;
  const textColor = dark ? "#FFFFFF" : C.sky;
  const dimOpacity = dark ? 0.45 : 0.5;
  const terra = C.terra || "#C97A63";
  const showDetail = size >= 32;
  const showCurl = size >= 40;

  if (variant === "text") {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          fontFamily: fonts.heading,
          fontWeight: 800,
          fontSize: size * 0.8,
          letterSpacing: -0.3,
          color: textColor,
          lineHeight: 1,
          ...style,
        }}
      >
        Wind
        <span style={{ opacity: dimOpacity }}>Ping</span>
        <span
          style={{
            display: "inline-block",
            width: Math.max(4, size * 0.18),
            height: Math.max(4, size * 0.18),
            background: terra,
            borderRadius: "50%",
            marginLeft: 2,
            marginBottom: size * 0.35,
            verticalAlign: "top",
          }}
        />
      </span>
    );
  }

  const iconSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Pin shape — organic shield/droplet */}
      <path
        d="M34 5C21.5 5 12 14 12 25c0 5 2 10 5.5 15.5C21 46.5 26 52 33 60c.5.6 1.2.6 1.7 0C41 52 46.5 46 50.5 40c3.5-5.5 5.5-10.5 5.5-15.5C56 14 46.5 5 34 5z"
        fill={pinColor}
      />

      {/* Wave 1 (top) — with curl at larger sizes */}
      {showCurl ? (
        <path
          d="M20.5 21c2.5-2 5.5-1.5 8 0.5 2.5 1.8 5 2.5 7.5 1 1.5-0.9 2.5-2 3.2-2.8 0.8-0.9 1.5-0.5 1.2 0.6-0.4 1.2-1.5 2.2-2.8 2.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.95"
        />
      ) : (
        <path
          d="M19 23c3-2.2 6-1 9 0.5s6 2.2 9 0"
          stroke="white"
          strokeWidth={size < 24 ? "4.5" : "3.5"}
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
      )}

      {/* Wave 2 (mid) */}
      {showDetail ? (
        <path
          d="M18 28c3.5-2.8 7-1.5 10.5 0.5 3.5 2 7 3 10.5 0.5 1.5-1 2.8-2 3.5-2.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      ) : (
        <path
          d="M20 31c2.5-1.8 5-0.8 7.5 0.5s5 1.5 7-0.2"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.4"
        />
      )}

      {/* Wave 3 (low) — only at larger sizes */}
      {showCurl && (
        <path
          d="M22 34c2.5-1.8 5-0.8 7.5 0.5s5 1.8 7-0.2"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.3"
        />
      )}

      {/* Ping dot — layered for depth */}
      <circle cx="50" cy="12" r={size < 24 ? "9" : size < 40 ? "7" : "6.5"} fill={terra} />
      {showDetail && (
        <>
          <circle cx="50" cy="12" r="4" fill="#E8A68A" opacity={animated ? undefined : "0.7"}>
            {animated && (
              <animate
                attributeName="opacity"
                values="0.9;0.4;0.9"
                dur="2.6s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx="50" cy="12" r="2.2" fill="white" opacity="0.9" />
        </>
      )}
      {!showDetail && size >= 24 && (
        <circle cx="50" cy="12" r="3" fill="white" opacity="0.8" />
      )}
    </svg>
  );

  if (variant === "icon") {
    return (
      <span className={className} style={{ display: "inline-flex", ...style }}>
        {iconSvg}
      </span>
    );
  }

  // Full: icon + text
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(6, size * 0.28),
        ...style,
      }}
    >
      {iconSvg}
      <span
        style={{
          fontFamily: fonts.heading,
          fontWeight: 800,
          fontSize: Math.max(16, size * 0.75),
          letterSpacing: -0.3,
          color: textColor,
          lineHeight: 1,
        }}
      >
        Wind
        <span style={{ opacity: dimOpacity }}>Ping</span>
      </span>
    </span>
  );
}

export default Logo;