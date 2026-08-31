# Parkking Web (`parkking-web`)

Mobile-first map of geocoded Toronto curb parking bylaws. Data is produced by the separate `parkking-pipeline` project and loaded as static GeoJSON in this app.

## Prerequisites

- Node.js 20+
- Map data: A pre-bundled dataset is included at [`public/data/final_parking_map.geojson`](public/data/final_parking_map.geojson). Whenever you re-run the pipeline in `parkking-pipeline`, refresh the copy so features include updated structured `schedule` objects (`v: 1`):

```bash
cp ../parkking-pipeline/data/final_parking_map.geojson public/data/
```

### Address search (Google Places - Optional)

Map browsing, curb inspection, and map-tap reverse geocoding (via OpenStreetMap Nominatim) work out-of-the-box without an API key. For address autocomplete search:

1. Create a [Google Cloud](https://console.cloud.google.com/) project with billing enabled.
2. Enable **Places API (New)** (and optionally **Geocoding API** for enhanced reverse geocoding fallback).
3. Create a browser API key restricted to HTTP referrers (e.g. `http://localhost:5173/*`) and Places APIs only.
4. Copy `.env.example` to `.env` and set `VITE_GOOGLE_MAPS_API_KEY`.

The app uses session tokens and Place Details (Essentials, location fields only) so typical usage stays within the free monthly Essentials caps (10,000 autocomplete + 10,000 details requests). Set a billing budget alert in Cloud Console if desired.

## Development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

### Lint & Test

```bash
# Run ESLint
npm run lint

# Run Vitest test suite
npm test
```

## Build

```bash
npm run build
npm run preview
```

## Map features

- Full-screen mobile UI with floating location, time, and GPS controls (same chrome on desktop, max-width column)
- Dynamic bottom sheet with gesture detents (peek / expanded / full) and smooth floating control offset tracking
- Zoom-gated curb lines (appear around zoom 14.5+) with severity-ordered coloring: allowed, unclear, restricted
- Viewport-subset schedule evaluation via a spatial index (avoids re-serializing the whole city on every time change)
- Composed curb-side verdict from all locally overlapping rules: parking allowed, not allowed, likely allowed, or schedule unclear
- Time query defaults to **Now** with duration chips (30m / 1h / 2h / 3h); midnight-crossing durations are truncated and disclosed
- Prominent max-stay warnings when the requested duration exceeds `maxMinutes`
- Search (Google Places), GPS, and map taps all feed the same nearest-curb selection flow with a curb-side switcher
- Reverse geocoding on map tap (via OpenStreetMap Nominatim with Google Geocoding fallback) to display human-readable street addresses
- Local recents and favorites (coordinates + labels only); GPS permission only after first explicit use, then auto-locate when already granted
- Every verdict includes “Check posted signs.”

Schedule logic lives under [`src/lib/schedule/`](src/lib/schedule/) and mirrors the parking-pipeline contract. Display text for bylaws still comes from the `Rule` property; filtering never regex-parses `Rule`.

## Basemap Styling

The basemap uses a custom **Apple Maps Light** vector style ([`public/style/apple-maps.json`](public/style/apple-maps.json)) rendered via **MapLibre GL JS** on top of OpenFreeMap vector tiles (`tiles.openfreemap.org`).

- **Aesthetics**: Warm neutral background (`#f4f3ef`), pastel sky-blue water (`#a0c8f0`), soft mint green parks (`#d8ebd4`), crisp white roadways with subtle casings, and charcoal system typography.
- **Cost**: 100% free and open-source with no API keys or tile limits.
- **Contrast**: Provides high-contrast separation for Toronto's green (allowed), red (restricted), and amber (unclear) curb regulations.

### Future Roadmap: Apple MapKit JS Migration

If you decide to switch from MapLibre GL to native **Apple MapKit JS** in the future:
1. **Apple Developer Account**: Requires an Apple Developer Program membership ($99/year) to generate a Maps Identifier and Private Key (`.p8`).
2. **Cloudflare Pages Compatibility (No Server Needed)**:
   - *Option A (Static)*: Generate a long-lived JWT token (valid up to 1 year) restricted to your domain and supply it via `VITE_MAPKIT_TOKEN`.
   - *Option B (Edge Serverless)*: Add a Cloudflare Pages Function at `functions/api/token.ts` that signs short-lived ES256 tokens using the Web Crypto API.
3. **Layer Migration**: Port curb segment drawing from MapLibre GL's WebGL GeoJSON layers to MapKit JS `PolylineOverlay` / `ItemCollection`.


