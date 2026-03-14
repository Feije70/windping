/* ── lib/constants/session.ts ─────────────────────────────
   Constanten voor sessie logging
──────────────────────────────────────────────────────────── */

export const RATINGS = [
  { value: 1, label: "Shit" }, { value: 2, label: "Mwah" }, { value: 3, label: "Oké" },
  { value: 4, label: "Lekker!" }, { value: 5, label: "EPIC!" },
];

export const RATING_COLORS: Record<number, string> = {
  1: "#C97A63", 2: "#D4860B", 3: "#E8A83E", 4: "#2E8FAE", 5: "#3EAA8C",
};

export const GEAR_TYPES = [
  { id: "kite", label: "Kite" }, { id: "windsurf", label: "Windsurf" },
  { id: "wing", label: "Wing" }, { id: "foil", label: "Foil" },
];

export const WIND_FEELS = [
  { id: "underpowered", label: "Te weinig" }, { id: "perfect", label: "Perfect" },
  { id: "overpowered", label: "Te veel" }, { id: "gusty", label: "Gusty" },
];

export const KITE_SIZES = ["5","6","7","8","9","10","11","12","13","14"];

export const ALL_BADGES = [
  { id: "local_hero", name: "Local Hero", desc: "10+ sessies op één spot" },
  { id: "storm_chaser", name: "Stormchaser", desc: "Sessie bij 30+ knots" },
  { id: "ice_surfer", name: "Ice Surfer", desc: "Sessie onder 5°C" },
  { id: "early_bird", name: "Dawn Patrol", desc: "Op het water vóór 8:00" },
  { id: "call_in_sick", name: "Called in Sick", desc: "Doordeweeks epic sessie" },
  { id: "streak_5", name: "Wind Junkie", desc: "5 sessies in één week" },
];

export const BADGE_COLORS: Record<string, string> = {
  local_hero: "#2E8FAE",
  storm_chaser: "#1F354C",
  ice_surfer: "#5BA4C9",
  early_bird: "#E8A83E",
  call_in_sick: "#3EAA8C",
  streak_5: "#C97A63",
};

export function getBadgeColor(id: string): string {
  return BADGE_COLORS[id] || "#6B7B8F";
}
