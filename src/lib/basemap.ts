/**
 * Apple Maps-inspired vector streets + labels for MapLibre GL.
 * Uses OpenFreeMap vector tiles (free, no API key required) with Apple Maps pastel palette,
 * crisp white roads, sage green parks, soft blue water, and SF-style charcoal typography.
 *
 * NOTE FOR FUTURE:
 * If migrating to official Apple MapKit JS:
 * 1. Requires Apple Developer Program account ($99/year).
 * 2. Generate Maps ID + Private Key (.p8).
 * 3. Can run with zero server on Cloudflare Pages using a pre-generated long-lived JWT token
 *    (via `VITE_MAPKIT_TOKEN`) or a Cloudflare Pages Function (`functions/api/token.ts`).
 * 4. Refactor map layer rendering from MapLibre GL WebGL layers to MapKit JS overlays.
 */
export const BASE_MAP_STYLE_URL = '/style/apple-maps.json'
