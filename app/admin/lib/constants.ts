import { colors as C } from "@/lib/design";

export { C };

export const h = { fontFamily: "var(--font-bebas, sans-serif)" };

export const NL_REGIONS = ["Noord-Holland", "Zuid-Holland", "Zeeland", "Friesland", "Zeeland, Netherlands", "Groningen", "Drenthe", "Overijssel", "Gelderland", "Utrecht", "Noord-Brabant", "Limburg", "Flevoland"];

export function getLand(region: string): string {
  if (!region) return "Overig";
  if (NL_REGIONS.includes(region)) return "Nederland";
  const parts = region.split(", ");
  return parts.length > 1 ? parts[parts.length - 1] : region;
}

export const LAND_VLAG: Record<string, string> = {
  Nederland: "🇳🇱", Spain: "🇪🇸", Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹",
  Portugal: "🇵🇹", Greece: "🇬🇷", Denmark: "🇩🇰", Ireland: "🇮🇪", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Croatia: "🇭🇷", Norway: "🇳🇴", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Belgium: "🇧🇪", Poland: "🇵🇱",
  Morocco: "🇲🇦", Bulgaria: "🇧🇬", Sweden: "🇸🇪", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", Turkey: "🇹🇷",
  Austria: "🇦🇹", Switzerland: "🇨🇭", Latvia: "🇱🇻", Romania: "🇷🇴", Hungary: "🇭🇺",
  Montenegro: "🇲🇪", Azores: "🇵🇹",
};

export const LAND_CODE: Record<string, string> = {
  "Nederland": "NL", "België": "BE", "Duitsland": "DE", "Frankrijk": "FR",
  "Spanje": "ES", "Portugal": "PT", "Italië": "IT", "Griekenland": "GR",
  "Turkije": "TR", "Marokko": "MA", "Zuid-Afrika": "ZA", "Australië": "AU",
  "Brazilië": "BR", "USA": "US",
};

export const alertTypeColors: Record<string, string> = {
  heads_up: C.sky, go: C.green, epic: C.gold, downgrade: C.amber, alternative: C.purple,
};

export const alertTypeEmoji: Record<string, string> = {
  heads_up: "📢", go: "✅", epic: "🤙", downgrade: "⬇️", alternative: "🔄",
};

export const severityStyles: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  critical: { bg: "#FEF2F2", border: "#FCA5A5", color: "#DC2626", icon: "🔴" },
  warning: { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", icon: "🟡" },
  info: { bg: "#EFF6FF", border: "#93C5FD", color: "#2563EB", icon: "🔵" },
};

export const PROMPT_CATEGORIEEN = [
  { key: "conditions", label: "Conditions", desc: "Windcondities, golfhoogte, seizoenen",
    default: "Wind conditions, directions, best season, wave height, currents, water type. Null if unknown." },
  { key: "facilities", label: "Facilities", desc: "Faciliteiten, parkeren, huur",
    default: "Parking, toilets, showers, food, kite school, rental. Null if unknown." },
  { key: "hazards", label: "Hazards", desc: "Gevaren, regels, obstakels",
    default: "Hazards: rocks, currents, shipping, restricted zones, rules. Null if unknown." },
  { key: "tips", label: "Tips", desc: "Insider tips, beste tijden",
    default: "Practical tips from experienced surfers, best launch spot, local knowledge. Null if unknown." },
  { key: "events", label: "Events", desc: "Evenementen, wedstrijden",
    default: "Kite/windsurf competitions, festivals, markets, events affecting crowding. Null if unknown." },
  { key: "news", label: "News", desc: "Nieuws, recente ontwikkelingen",
    default: "Recent news: beach closures, new rules, construction, upcoming major events. Null if unknown." },
];

export const enrichmentLabels: Record<string, string> = {
  conditions: "Windcondities & karakter",
  facilities: "Faciliteiten",
  hazards: "Gevaren",
  tips: "Tips",
  events: "Events & wedstrijden",
  news: "Actueel nieuws",
};
