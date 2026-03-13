/* ── lib/services/notificationService.ts ─────────────────
   Email + Push notificaties
   Verantwoordelijk voor: bundled emails, downgrade emails, push notificaties
──────────────────────────────────────────────────────────── */

import { formatDateLabel } from "./alertService";

export function generateGoToken(userId: number, spotId: number, date: string): string {
  const secret = process.env.CRON_SECRET || "windping-secret";
  const raw = `${userId}-${spotId}-${date}-${secret}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function sendBundledEmail(
  to: string,
  name: string | null,
  userId: number,
  days: { targetDate: string; spots: any[]; alertType: string }[],
  hourlyBySpotDate: Record<string, any[]>,
  tideBySpotDate: Record<string, { time: string; type: string }[]>
): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const greeting = name ? `Hey ${name}` : "Hey";
  const dayLabels = days.map(d => formatDateLabel(d.targetDate));
  const subject = `✅ ${dayLabels.join(" en ")} ${dayLabels.length > 1 ? "zijn" : "is"} Go!`;

  const daySections = days.map(day => {
    const dateLabel = formatDateLabel(day.targetDate);

    const spotRows = day.spots.map(s => {
      let extra = "";
      if (s.changed) {
        const parts: string[] = [];
        if (s.prevWind !== s.wind) parts.push(`was ${s.prevWind}kn`);
        if (s.prevDir !== s.dir) parts.push(`was ${s.prevDir}`);
        extra = `<span style="color:#8A9BB0;font-size:11px;"> (${parts.join(", ")})</span>`;
      }

      const hours = hourlyBySpotDate[`${s.spotId}_${day.targetDate}`] || [];
      const wMin = s.userWindMin || 12;
      const ochtend = hours.filter((h: any) => h.hour >= 6 && h.hour < 12).some((h: any) => h.wind >= wMin);
      const middag = hours.filter((h: any) => h.hour >= 12 && h.hour < 17).some((h: any) => h.wind >= wMin);
      const avond = hours.filter((h: any) => h.hour >= 17 && h.hour <= 21).some((h: any) => h.wind >= wMin);

      let whenLabel = "";
      if (hours.length > 0) {
        if (ochtend && middag && avond) whenLabel = "hele dag";
        else if (ochtend && middag) whenLabel = "ochtend + middag";
        else if (middag && avond) whenLabel = "middag + avond";
        else if (ochtend && avond) whenLabel = "ochtend + avond";
        else if (ochtend) whenLabel = "ochtend";
        else if (middag) whenLabel = "middag";
        else if (avond) whenLabel = "avond";
      }
      const whenHtml = whenLabel
        ? `<div style="font-size:12px;color:#2E8FAE;font-weight:600;margin-top:2px;">${whenLabel}</div>`
        : "";

      const goToken = generateGoToken(userId, s.spotId, day.targetDate);
      const goUrl = `https://www.windping.com/api/sessions/going?user=${userId}&spot=${s.spotId}&date=${day.targetDate}&wind=${s.wind}&gust=${s.gust}&dir=${encodeURIComponent(s.dir)}&token=${goToken}`;

      return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#1F354C;font-size:13px;">${s.spotName}${whenHtml}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#3EAA8C;font-weight:700;font-size:13px;">${s.wind}kn ${s.dir}${extra}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;text-align:center;">
          <a href="${goUrl}" style="display:inline-block;padding:6px 14px;background:#3EAA8C;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;white-space:nowrap;">⚡ Ik ga!</a>
        </td>
      </tr>`;
    }).join("");

    const hourlyTables = day.spots.map(s => {
      const hours = hourlyBySpotDate[`${s.spotId}_${day.targetDate}`];
      if (!hours?.length) return "";
      const wMin = s.userWindMin || 12;

      const hourCells = hours.map((h: any) =>
        `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:#6B7B8F;font-size:11px;">${h.hour}:00</td>`
      ).join("");
      const windCells = hours.map((h: any) => {
        const color = h.wind >= wMin ? "#3EAA8C" : "#8A9BB0";
        return `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:${color};font-weight:600;font-size:12px;">${h.wind}</td>`;
      }).join("");
      const gustCells = hours.map((h: any) =>
        `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:#6B7B8F;font-size:11px;">${h.gust}</td>`
      ).join("");
      const dirCells = hours.map((h: any) =>
        `<td style="padding:4px 6px;text-align:center;color:#8A9BB0;font-size:10px;">${h.dir}</td>`
      ).join("");

      const tides = tideBySpotDate[`${s.spotId}_${day.targetDate}`] || [];
      const tideHtml = tides.length > 0
        ? `<div style="margin-top:4px;font-size:11px;color:#2E8FAE;">🌊 ${tides.map(t => `${t.type} ${t.time}`).join(" · ")}</div>`
        : "";

      return `
        <div style="margin:8px 0 12px;">
          <div style="font-size:11px;color:#6B7B8F;font-weight:600;margin-bottom:4px;padding-left:2px;">${s.spotName}</div>
          <table style="width:100%;border-collapse:collapse;background:#F6F1EB;border-radius:8px;overflow:hidden;">
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;"></td>${hourCells}</tr>
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;">kn</td>${windCells}</tr>
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;">gust</td>${gustCells}</tr>
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;">dir</td>${dirCells}</tr>
          </table>
          ${tideHtml}
        </div>`;
    }).join("");

    return `
      <div style="margin-bottom:24px;">
        <div style="font-size:16px;font-weight:700;color:#2E8FAE;margin-bottom:10px;">📅 ${dateLabel}</div>
        <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:12px;overflow:hidden;margin-bottom:4px;box-shadow:0 1px 4px rgba(31,53,76,0.06);">
          <thead><tr>
            <th style="padding:8px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">SPOT</th>
            <th style="padding:8px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">MAX WIND</th>
            <th style="padding:8px 14px;text-align:center;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;"></th>
          </tr></thead>
          <tbody>${spotRows}</tbody>
        </table>
        ${hourlyTables}
      </div>`;
  }).join("");

  const html = `
    <div style="background:#F6F1EB;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;">
        <div style="margin-bottom:28px;">
          <span style="color:#2E8FAE;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Wind</span><span style="color:#3EAA8C;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Ping</span>
        </div>
        <p style="color:#1F354C;font-size:15px;margin:0 0 6px;">${greeting},</p>
        <p style="color:#3EAA8C;font-size:17px;font-weight:700;margin:0 0 20px;">${dayLabels.join(" en ")} ${dayLabels.length > 1 ? "zijn" : "is"} Go! 🤙</p>
        ${daySections}
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#2E8FAE;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Bekijk je alerts →</a>
        </div>
        <p style="color:#8A9BB0;font-size:11px;margin:28px 0 0;text-align:center;line-height:1.6;">
          <a href="https://www.windping.com/voorkeuren" style="color:#8A9BB0;text-decoration:underline;">Alert settings</a>
          &nbsp;·&nbsp; <a href="https://www.windping.com" style="color:#8A9BB0;text-decoration:underline;">WindPing</a>
        </p>
      </div>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "WindPing <alerts@windping.com>", to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend bundled: ${res.status} ${await res.text()}`);
}

export async function sendAlertEmail(
  to: string,
  name: string | null,
  alertType: string,
  message: string,
  spots: any[],
  targetDate: string
): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log("No RESEND_API_KEY — email skipped:", { to, alertType });
    return;
  }

  const dateLabel = formatDateLabel(targetDate);
  const subjects: Record<string, string> = {
    heads_up: `🏄 Wind alert: ${dateLabel} ziet er goed uit!`,
    go: `✅ Go! ${dateLabel} waait het op je spot`,
    downgrade: `⬇️ Forecast update: ${dateLabel} — condities gewijzigd`,
  };

  const greeting = name ? `Hey ${name}` : "Hey";
  const dateHeaderText =
    alertType === "go" ? `${dateLabel} is Go! 🤙`
    : alertType === "heads_up" ? `${dateLabel} ziet er goed uit`
    : `Update voor ${dateLabel}`;

  const spotRows = spots.map(s => {
    let extra = "";
    if (s.changed) {
      const parts: string[] = [];
      if (s.prevWind !== s.wind) parts.push(`was ${s.prevWind}kn`);
      if (s.prevDir !== s.dir) parts.push(`was ${s.prevDir}`);
      extra = `<span style="color:#8A9BB0;font-size:11px;"> (${parts.join(", ")})</span>`;
    }
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#1F354C;font-size:14px;">${s.spotName}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:${s.inRange !== false ? "#3EAA8C" : "#C97A63"};font-weight:700;font-size:14px;">${s.wind}kn ${s.dir}${extra}</td>
    </tr>`;
  }).join("");

  const actionHtml = alertType === "downgrade"
    ? `<div style="margin:20px 0;padding:14px 18px;background:#FFF5F2;border:1px solid #E8E0D8;border-radius:12px;">
        <p style="margin:0;color:#C97A63;font-size:13px;line-height:1.6;white-space:pre-line;">${message.replace(/\n/g, "<br>")}</p>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#E8A83E;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">I'm going anyway 🤙</a>
      </div>`
    : `<div style="text-align:center;margin:24px 0;">
        <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#2E8FAE;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Bekijk je alerts →</a>
      </div>`;

  const html = `
    <div style="background:#F6F1EB;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;">
        <div style="margin-bottom:28px;">
          <span style="color:#2E8FAE;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Wind</span><span style="color:#3EAA8C;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Ping</span>
        </div>
        <p style="color:#1F354C;font-size:15px;margin:0 0 6px;">${greeting},</p>
        <p style="color:#2E8FAE;font-size:17px;font-weight:700;margin:0 0 20px;">${dateHeaderText}</p>
        <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:12px;overflow:hidden;margin-bottom:4px;box-shadow:0 1px 4px rgba(31,53,76,0.06);">
          <thead><tr>
            <th style="padding:10px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">SPOT</th>
            <th style="padding:10px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">FORECAST</th>
          </tr></thead>
          <tbody>${spotRows}</tbody>
        </table>
        ${actionHtml}
        <p style="color:#8A9BB0;font-size:11px;margin:28px 0 0;text-align:center;line-height:1.6;">
          <a href="https://www.windping.com/voorkeuren" style="color:#8A9BB0;text-decoration:underline;">Alert settings</a>
          &nbsp;·&nbsp; <a href="https://www.windping.com" style="color:#8A9BB0;text-decoration:underline;">WindPing</a>
        </p>
      </div>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "WindPing <alerts@windping.com>",
      to,
      subject: subjects[alertType] || "WindPing Alert",
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
}