import { NextResponse } from "next/server";

const SENTRY_ORG = "windping";
const SENTRY_PROJECT = "windping";
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN || "";

export async function GET() {
  if (!SENTRY_TOKEN) {
    return NextResponse.json({ error: "No SENTRY_AUTH_TOKEN" }, { status: 500 });
  }

  const headers = {
    Authorization: `Bearer ${SENTRY_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    const [issues24h, issues7d] = await Promise.all([
      fetch(
        `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&statsPeriod=24h&limit=5&sort=date`,
        { headers }
      ).then(r => r.json()),
      fetch(
        `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&statsPeriod=7d&limit=25`,
        { headers }
      ).then(r => r.json()),
    ]);

    const recentIssues = Array.isArray(issues24h) ? issues24h.map((i: any) => ({
      id: i.id,
      title: i.title,
      culprit: i.culprit,
      count: i.count,
      lastSeen: i.lastSeen,
      level: i.level,
      permalink: i.permalink,
    })) : [];

    const total7d = Array.isArray(issues7d) ? issues7d.length : 0;
    const total24h = Array.isArray(issues24h) ? issues24h.length : 0;

    const culprits: Record<string, number> = {};
    if (Array.isArray(issues7d)) {
      issues7d.forEach((i: any) => {
        const key = i.culprit || "unknown";
        culprits[key] = (culprits[key] || 0) + parseInt(i.count || "0");
      });
    }
    const topCulprit = Object.entries(culprits).sort((a, b) => b[1] - a[1])[0];

    return NextResponse.json({
      total24h,
      total7d,
      recentIssues,
      topCulprit: topCulprit ? { route: topCulprit[0], count: topCulprit[1] } : null,
      sentryUrl: `https://windping.sentry.io/projects/windping/`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
