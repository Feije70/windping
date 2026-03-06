# WindPing - Overdrachtsdocument
*Bijgewerkt: 6 maart 2026 - na avondsessie*

---

## 🚀 Snelstart voor nieuwe chat

### Wat aanleveren aan het begin van een chat:
1. **Dit document** (OVERDRACHT.md)
2. **Een ZIP van het project** via: `cd ~ && zip -r windping-$(date +%Y%m%d).zip windping/`
3. Of gewoon de GitHub link: `github.com/Feije70/windping`

### Directe werkwijze die WERKT:
- Claude maakt **complete bestanden** als download
- Jij **downloadt** en **plakt** in VS Code (Cmd+A, plakken, Cmd+S)
- Dan: `git add . && git commit -m "..." && git push`
- **NOOIT** kleine sed-fixes doen op complexe bestanden — dit corrupt de code

---

## 📱 App Structuur & Pagina's

### Live URL: www.windping.com
### Stack: Next.js, Supabase, Vercel, GitHub

### Pagina overzicht (`~/windping/app/`):
| Route | Bestand | Functie |
|---|---|---|
| `/` | `app/page.tsx` | Homepage / Dashboard (hoofdbestand ~1400 regels) |
| `/mijn-sessies` | `app/mijn-sessies/page.tsx` | Alle sessies van gebruiker |
| `/sessie/[id]` | `app/sessie/[id]/page.tsx` | Publieke sessiepagina |
| `/mijn-spots` | `app/mijn-spots/page.tsx` | Beheer eigen spots |
| `/spots` | `app/spots/page.tsx` | Alle spots, zoeken |
| `/voorkeuren` | `app/voorkeuren/page.tsx` | Gebruikersinstellingen |
| `/vrienden` | `app/vrienden/page.tsx` | Vrienden systeem |
| `/add-spot` | `app/add-spot/page.tsx` | Spot aanmaken |
| `/login` | `app/login/page.tsx` | Login |
| `/signup` | `app/signup/page.tsx` | Registratie |
| `/onboarding` | `app/onboarding/page.tsx` | Onboarding flow |
| `/check` | `app/check/page.tsx` | Wind check |

### Componenten (`~/windping/components/`):
- `NavBar.tsx` — Onderste navigatiebalk
- `Icons.tsx` — SVG iconen
- `Logo.tsx` — WindPing logo
- `WPing.tsx` — W. Ping mascotte

### Lib (`~/windping/lib/`):
- `design.ts` — Kleuren (C.navy, C.sky, C.gold, etc.) en fonts
- `supabase.ts` — Auth helpers, SUPABASE_URL, SUPABASE_ANON_KEY

---

## 🗄️ Database (Supabase)

### Tabellen:
| Tabel | Belangrijke kolommen |
|---|---|
| `users` | id, auth_id, name, min_wind_speed, max_wind_speed |
| `sessions` | id, created_by (→users.id), spot_id, session_date, status, rating, gear_type, gear_size, forecast_wind, forecast_dir, wind_feel, notes, **photo_url** |
| `spots` | id, display_name, lat, lng |
| `user_spots` | user_id, spot_id |
| `alert_history` | id, user_id, spot_id, target_date, created_at |
| `alert_preferences` | user_id, spot_id |
| `ideal_conditions` | user_id, spot_id, wind_min, wind_max, directions |
| `user_stats` | user_id, total_sessions, current_streak, avg_rating, favorite_spot_id, total_spots |
| `user_settings` | user_id, alerts_paused_until |

### ⚠️ Kritieke kolom: `photo_url` (NIET `image_url`)
- `sessions.photo_url` = foto opgeslagen in Supabase Storage bucket `session-photos`
- Oude code gebruikte soms `image_url` — dit geeft 400 errors!
- Altijd `photo_url` gebruiken in queries

### Auth patroon:
```javascript
const authId = getAuthId(); // UUID uit localStorage
const users = await sbGet(`users?auth_id=eq.${authId}&select=id`);
const userId = users[0].id; // INTEGER, niet UUID
```

---

## 🏗️ Homepage (app/page.tsx) Structuur

De homepage is het grootste bestand (~1400 regels) met:
- **Feed sectie** — alerts per dag met Go/Downgrade spots
- **Sessies sectie** — `SessionStatsSection` component met:
  - 3-kolom grid: totaal sessies, streak, gem. rating
  - 2-kolom grid: spots bezocht, favoriete spot
  - **Grote sessie card** met foto van laatste sessie
  - "Alle X sessies bekijken →" link naar /mijn-sessies
- **Badges sectie**
- **+ Sessie modal** — 6-staps flow voor handmatig aanmaken sessie

### RecentSession interface:
```typescript
interface RecentSession {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: string | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  photo_url: string | null;
  notes: string | null;
  spots?: { display_name: string };
}
```

### Sessies query (homepage):
```javascript
`sessions?created_by=eq.${user.id}&order=id.desc&limit=10&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,photo_url,notes`
```
⚠️ Geen `spots(display_name)` join — geeft 400 error. Spotnames worden apart opgehaald via `spotNames` state.

---

## ✅ Wat is gebouwd (chronologisch)

### Build 29-31 (5 maart 2026):
- Sessie logging modal (6 stappen)
- Photo upload naar Supabase Storage
- PropIcon SVG componenten
- Spot picker (mijn spots / alle spots)
- Git auto-deploy workflow gefixed

### Avondsessie 5-6 maart 2026:
- **photo_url fix** in `sessie/[id]/page.tsx` (was gecorrupt door sed)
- **mijn-sessies**: foto's werken nu met `photo_url || image_url` fallback
- **Homepage sessie links** → /sessie/{id} en /mijn-sessies
- **Grote sessie card** op homepage met foto, gear, notes
- **Session ordering** → `order=id.desc` zodat nieuwste altijd bovenaan

---

## 🔧 Lessons Learned (voor volgende developer)

### VS Code problemen:
- Er staan **twee WindPing mappen**: `~/windping` (correct) en `~/Desktop/Github/windping` (verkeerd)
- Altijd openen via terminal: `code ~/windping`
- Als je 137 TypeScript errors ziet → verkeerde map open!
- "No problems detected" = juiste map

### sed is gevaarlijk:
- Meerdere sed-operaties op dezelfde regel corrumpeert de code
- Bij complexe wijzigingen: maak complete file, download, plak in VS Code
- node -e met een /tmp script werkt beter dan sed voor complexe vervangingen

### Deploy workflow:
```bash
git add . && git commit -m "beschrijving" && git push
# Vercel deployt automatisch via GitHub webhook
# Check status op vercel.com/feije70s-projects/windping
```

### Bij Vercel build errors:
- Kijk altijd naar de exacte regel in Build Logs
- TypeScript errors zijn ECHT (anders dan VS Code met verkeerde map)
- Meest voorkomende: duplicate interface properties door sed

---

## 🚧 Openstaande Features (voor morgen)

### 1. Spot kiezen bij sessie aanmaken
**Huidig probleem**: dropdown met 400 spots — onbruikbaar
**Gewenste oplossing**: twee knoppen:
- "Mijn spots" → lijst van eigen spots als klikbare kaarten
- "Andere spot" → naar /spots pagina met zoekfunctie + zoom op locatie
- (Optioneel 3e knop: "Nieuwe spot aanmaken" → /add-spot)

### 2. Deel knop op sessie card
- Deel knop in/onder de grote sessie card op homepage
- Deelt sessie naar WindPing vrienden
- Vrienden krijgen push notificatie

### 3. Push notificaties naar vrienden
- Als je sessie deelt → vrienden krijgen push
- Vrienden systeem bestaat al (/vrienden pagina)

---

## 🎨 Design Systeem

```typescript
// Kleuren (uit lib/design.ts)
C.navy    // Donkerblauw - titels
C.sky     // Lichtblauw - accenten
C.gold    // Goud - ratings
C.green   // Groen - positief/go
C.cream   // Achtergrond
C.card    // Kaart achtergrond
C.sub     // Subtekst
C.muted   // Gemute tekst
C.cardBorder  // Kaart rand
C.cardShadow  // Kaart schaduw
C.goBg    // Groene achtergrond
C.epicBg  // Gouden achtergrond
C.amber   // Amber
```

### Rating systeem:
```typescript
{ 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" }
```

---

## 🔑 Credentials (bewaar veilig!)

- **Supabase URL**: `https://kaimbtcuyemwzvhsqwgu.supabase.co`
- **Supabase Anon Key**: in `lib/supabase.ts`
- **GitHub**: `github.com/Feije70/windping`
- **Vercel**: `vercel.com/feije70s-projects/windping`

---

## 💡 WindPing Strategie

- **Community-first**: gratis features voor groei
- **Sessies**: handmatig aanmaken (niet alleen na alert)
- **Focus**: gebruikersgroei en interactie tussen users
- **Later monetizen** bij veel gebruikers
