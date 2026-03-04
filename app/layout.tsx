import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WindPing — Kitesurf & Windsurf Alerts",
  description:
    "Get notified when the wind is right at your favorite spot. No more checking apps — WindPing monitors the wind for you.",
  manifest: "/manifest.json",
  openGraph: {
    title: "WindPing — Kitesurf & Windsurf Alerts",
    description: "We'll let you know when you should go. Get pinged when the wind will be right.",
    url: "https://www.windping.com",
    siteName: "WindPing",
    images: [
      {
        url: "https://www.windping.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "WindPing — Kitesurf & Windsurf Alerts",
      },
    ],
    locale: "nl_NL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WindPing — Kitesurf & Windsurf Alerts",
    description: "We'll let you know when you should go. Get pinged when the wind will be right.",
    images: ["https://www.windping.com/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WindPing",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F1EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body
        className="font-body antialiased"
        style={{ background: "#F6F1EB", color: "#1F354C" }}
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}