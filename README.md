# Parkking Web (`parkking-web`)

Mobile-first map of geocoded Toronto curb parking bylaws. Data is produced by the separate `parkking-pipeline` project and loaded as static GeoJSON in this app.

## Prerequisites

- Node.js 20+
- Map data: copy `final_parking_map.geojson` from the pipeline repo into this project:

```bash
cp ../parkking-pipeline/data/final_parking_map.geojson public/data/
```

GeoJSON files under `public/data/` are gitignored; refresh the copy whenever you re-run the pipeline fullrun so features include structured `schedule` objects (`v: 1`).

### Address search (Google Places)

1. Create a [Google Cloud](https://console.cloud.google.com/) project with billing enabled.
2. Enable **Places API (New)**.
3. Create a browser API key restricted to HTTP referrers (e.g. `http://localhost:5173/*`) and Places APIs only.
4. Copy `.env.example` to `.env` and set `VITE_GOOGLE_MAPS_API_KEY`.

The app uses session tokens and Place Details (Essentials, location fields only) so typical usage stays within the free monthly Essentials caps (10,000 autocomplete + 10,000 details requests). Set a billing budget alert in Cloud Console if desired.

## Development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Map features

- Full-screen mobile UI with floating location, time, and GPS controls (same chrome on desktop, max-width column)
- Zoom-gated curb lines (appear around zoom 14.5+) with severity-ordered coloring: allowed, unclear, restricted
- Viewport-subset schedule evaluation via a spatial index (avoids re-serializing the whole city on every time change)
- Composed curb-side verdict from all locally overlapping rules: parking allowed, not allowed, likely allowed, or schedule unclear
- Time query defaults to **Now** with duration chips (30m / 1h / 2h / 3h); midnight-crossing durations are truncated and disclosed
- Prominent max-stay warnings when the requested duration exceeds `maxMinutes`
- Search (Google Places), GPS, and map taps all feed the same nearest-curb selection flow with a curb-side switcher
- Local recents and favorites (coordinates + labels only); GPS permission only after first explicit use, then auto-locate when already granted
- Every verdict includes “Check posted signs.”

Schedule logic lives under [`src/lib/schedule/`](src/lib/schedule/) and mirrors the parking-pipeline contract. Display text for bylaws still comes from the `Rule` property; filtering never regex-parses `Rule`.

## Tests

```bash
npm test
```
