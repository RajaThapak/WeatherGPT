# 3D Globe + Location Search + Pin-Point Feature
## Full Breakdown, Build Guide & Integration Plan for WeatherGPT

**Prepared as a UI/UX + Frontend engineering breakdown**
**Based on:** `Recording_2026-09-07_193102.mp4` (reference animation) + `WeatherGPT_PRD.md` (v1.3)
**Goal:** Recreate the "rotating 3D satellite globe → type a place → camera flies down and pin-points the location" experience, using only free/open-source tools, at production quality, and wire it into the existing Next.js WeatherGPT stack.

---

## 1. What's Actually Happening in the Reference Video (Frame-by-Frame Analysis)

I extracted and inspected the video frame-by-frame. Good news: it's not a mystery effect — it's a well-known open-source demo, and every piece of it is buildable for free. Here's exactly what's on screen:

| Timestamp (approx.) | What happens | Underlying mechanism |
|---|---|---|
| 0:00–0:03 | A shaded, lit 3D sphere sits in a starfield. Satellite imagery is wrapped around it, country/city labels float on the surface, a thin blue **atmosphere rim-light** outlines the silhouette. | A **3D globe renderer** (sphere geometry + texture + atmosphere post-effect) — the app in the recording is **WebGL Earth** (`examples.webglearth.com`, visible in the corner watermark on some frames), which is itself built on **CesiumJS** + **MapTiler satellite tiles**. |
| 0:03–0:05 | User clicks a search box top-right, types `london`, an autocomplete dropdown appears with a top suggestion ("Greater London"). | A **geocoding/autocomplete API** call fired on keystroke (debounced), rendered as a dropdown list under the input. |
| 0:05–0:10 | Camera **smoothly arcs and zooms** from full-globe view down through a mid-altitude "continent" view, then keeps descending until it's a flat top-down satellite view of Greater London with local place labels. | A **camera "fly-to" animation**: an eased interpolation of camera position/height/heading over ~2–4 seconds (not a jump-cut), which is what makes it feel premium instead of a Google-Maps-style ordinary zoom. |
| 0:10–0:14 | Search is cleared, box shows placeholder again; the globe **auto-rotates** slowly while idle. | An `onRender`/`requestAnimationFrame` loop incrementing longitude (`phi`) each frame when the user isn't interacting. |
| 0:15–0:20 | User types `japan`, dropdown shows multiple matches (日本, Tanzania, Kenya, Jamaica, Uganda) — a **fuzzy/substring search**, not just prefix match. | Client sends the partial query to a geocoder that returns ranked place matches; dropdown renders `name` + `type` (e.g. "country"). |
| 0:20–0:25 | User instead **drags the globe** to freely rotate it to North America, then opens a **basemap/layer switcher** dropdown (MapTiler Satellite / MapTiler Streets / OpenStreetMap). | Pointer-drag → converts drag delta to rotation quaternion/`phi`+`theta` change; a simple `<select>` swaps the active tile source URL. |
| 0:25–0:37 | User types `mathura`, dropdown autocompletes, camera flies down again, ending zoomed into Mathura, UP with surrounding towns (Vrindavan, Govardhan, Gokul, Bharatpur, Agra) labeled. | Same fly-to mechanism as before, proving it's a **reusable, parameterized function**: `flyTo(lat, lon, zoomLevel)`. |

**Important honesty note:** in this reference demo, "pin-pointing" is done implicitly — the camera centers and zooms on the searched coordinate, and the *place labels already baked into the map tiles* do the identifying. **There is no actual drop-pin marker/icon rendered on top of the globe in this recording.** Since your PRD explicitly wants "pin point the location," that's a genuine enhancement I'll add on top of the base recreation (Section 4.4) — a marker + pulse + label, since a weather app needs an explicit "you searched here" marker (especially once multiple markers — e.g. alert zones — are needed).

---

## 2. Choosing the Right Free Tool (this matters a lot for your PRD)

Your PRD's entire second design pillar is **near-zero perceived latency** on **low-end devices** (G7, G9, FE-11 target: Time-to-Interactive < 2s on 3G). The tool the reference video actually uses — **CesiumJS** — is powerful but heavy (~600KB–2MB+ gzipped core, plus a full 3D terrain/imagery streaming engine designed for GIS/aerospace use cases). Shipping full Cesium into a chat-first weather PWA aimed at rural users on patchy 3G would directly work against your own latency budget. So instead of a 1:1 clone, here's a comparison of what's realistically free and light enough:

| Option | Library size | What it gives you | Fit for WeatherGPT |
|---|---|---|---|
| **CesiumJS** (what the video uses) | ~600KB–2MB+ core + streamed imagery | Full GIS-grade 3D globe, terrain, imagery layers | ❌ Overkill; conflicts with your latency/low-end-device goals |
| **MapLibre GL JS (v5+) — native `globe` projection** | ~230KB gzipped, vector tiles streamed on demand | Real georeferenced globe that **morphs into a flat 2D map as you zoom in** — literally the same visual language as the reference video, plus proper `flyTo()`, markers, geocoding hookup, and it **replaces** your PRD's planned 2D Leaflet map (FE‑6) with one library that does both | ✅ **Best fit** — free, open-source (BSD-3), actively maintained, works with the same free MapTiler tiles seen in your reference video |
| **react-globe.gl** (Three.js wrapper) | ~150–300KB + three.js | Nice-looking data-viz globe (arcs, bars, points) | 🟡 Good for a marketing/landing page globe, weaker for "real navigable map with street-level zoom" |
| **Cobe** | **~5KB** (!) | Ultra-light canvas/WebGL rotating globe with markers, momentum drag, CSS-anchored labels | ✅ **Perfect for a decorative hero/landing globe** (e.g. your app's home/splash screen "type a city" moment) — but it's a stylized dot-map, not a navigable geocoded map, so it can't do the "fly all the way down to street-level Mathura" part by itself |

### Recommendation: a **two-layer approach** (best quality *and* best performance)

1. **Hero/Landing globe** (first-paint "wow" moment, before the user has searched anything) → **Cobe**. 5KB, buttery-smooth, dead simple, looks nearly identical to the opening frames of your reference video (lit sphere, starfield via CSS, drag-to-rotate).
2. **Functional search → fly-to → pin-point globe** (the actual location-picker used across the weather app) → **MapLibre GL JS with `globe` projection**. This is a *direct, free, lightweight replacement* for what CesiumJS/WebGL Earth is doing in your video, and it slots straight into your PRD's existing **FE‑6 "Map/location view"** task instead of Leaflet — same team, same skillset (it's a drop-in Leaflet-like API), zero licensing cost, and it auto-degrades to a flat 2D map on low zoom/low-end devices, which is exactly the "degrade gracefully" principle your PRD already commits to (G7).

Everything below builds both, step by step, then shows exactly where each plugs into your existing PRD task list.

---

## 3. Free Resources You'll Use (all $0)

| Purpose | Resource | Notes |
|---|---|---|
| Globe rendering (hero) | **Cobe** (`npm i cobe`) | MIT license, zero dependencies |
| Globe + map rendering (functional) | **MapLibre GL JS** (`npm i maplibre-gl`) | BSD-3, v5+ required for `globe` projection |
| Map tiles (satellite, to match your video's look) | **MapTiler Cloud free tier** | Same provider your reference video uses; free tier covers small/pilot apps, sign-up with no card |
| Map tiles (fallback, fully free forever) | **OpenStreetMap raster/vector via MapLibre demo style** or **self-hosted via MapTiler's free self-host option** | No API key at all if you use `demotiles.maplibre.org` style for dev |
| Geocoding / place search (the autocomplete box) | **MapTiler Geocoding API** (free tier) **or** **Nominatim (OpenStreetMap)** | Nominatim is 100% free but has a strict usage policy (max 1 req/sec, must self-throttle + set a User-Agent) — fine for a pilot, self-host it later if traffic grows |
| Marker/pin icon | **Lucide icons** (`lucide-react`, already implied by your stack) or a custom SVG | Free, MIT |
| Easing/animation helper (optional, hero section only) | **Framer Motion** or plain CSS `@keyframes` | Free |

This lines up 1:1 with your PRD's Section 15 philosophy (free-tier, no local model, no paid gateway) — I'm not introducing anything that breaks the "₹0 infra spend" target.

---

## 4. Step-by-Step Build From Scratch

### 4.1 Part A — The Decorative Hero Globe (Cobe, ~30 min build)

This is the "hook" moment: rotating, lit, satellite-style globe with a few glowing markers, auto-rotating, draggable — basically frames 0:00–0:03 of your reference video, at 5KB.

**Install**
```bash
npm i cobe
```

**Component (`components/HeroGlobe.tsx`)**
```tsx
"use client";
import { useEffect, useRef } from "react";
import createGlobe from "cobe";

const CITY_MARKERS = [
  { location: [28.6139, 77.209], size: 0.05 },   // Delhi
  { location: [19.076, 72.8777], size: 0.05 },   // Mumbai
  { location: [22.5726, 88.3639], size: 0.05 },  // Kolkata
  { location: [13.0827, 80.2707], size: 0.05 },  // Chennai
  { location: [27.5045, 77.6737], size: 0.07 },  // Mathura (highlighted)
];

export default function HeroGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const pointerRef = useRef({ down: false, x: 0, dPhi: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 1000,
      height: 1000,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      scale: 1,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.25, 0.35, 0.55],
      markerColor: [0.98, 0.45, 0.15], // WeatherGPT accent
      glowColor: [0.35, 0.55, 0.95],
      offset: [0, 0],
      markers: CITY_MARKERS as any,
      onRender: (state) => {
        if (!pointerRef.current.down) phiRef.current += 0.0025; // idle auto-rotate
        state.phi = phiRef.current + pointerRef.current.dPhi;
      },
    });
    return () => globe.destroy();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        pointerRef.current.down = true;
        pointerRef.current.x = e.clientX;
      }}
      onPointerUp={() => (pointerRef.current.down = false)}
      onPointerOut={() => (pointerRef.current.down = false)}
      onPointerMove={(e) => {
        if (!pointerRef.current.down) return;
        const delta = e.clientX - pointerRef.current.x;
        pointerRef.current.dPhi += delta / 200;
        pointerRef.current.x = e.clientX;
      }}
      style={{ width: 420, height: 420, maxWidth: "100%", aspectRatio: 1, cursor: "grab" }}
    />
  );
}
```

**Quality/UX polish to make it feel "expert-level," not template-y:**
- Wrap it in a `div` with a soft `radial-gradient` glow behind it (`filter: blur(60px)`) — this is what makes GitHub's homepage globe and similar hero globes feel premium instead of flat.
- Fade the canvas in with `opacity` 0→1 over 400ms on mount (avoids a "pop-in" jank).
- Reduce `mapSamples` to ~8000 and cap `devicePixelRatio` at 1.5 on mobile (`matchMedia('(max-width: 640px)')`) — keeps this section under your Lighthouse performance budget (FE‑11/FE‑13) on low-end phones.
- Respect `prefers-reduced-motion`: if set, render one static frame (call `onRender` once, then `globe.toggle()` to pause) instead of continuous rotation — accessibility win, and it's basically free CPU savings too.

---

### 4.2 Part B — The Functional Globe: Search → Fly-To → Pin (MapLibre GL, the core rebuild of your video)

This is the real feature: a navigable 3D globe that a user searches, watches the camera fly down to, and sees a pin dropped on.

**Install**
```bash
npm i maplibre-gl
```

**Get a free MapTiler key** (matches the exact tile provider/branding in your reference video): sign up at maptiler.com, no card required for the free tier, copy your API key.

**Component (`components/LocationGlobe.tsx`)**
```tsx
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY!;
const STYLE_URL = `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`;

type GeoResult = { name: string; lat: number; lon: number; type?: string };

export default function LocationGlobe({
  onLocationPicked,
}: {
  onLocationPicked?: (r: GeoResult) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Initialize the globe
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [78.9629, 22.5937], // India-centered default
      zoom: 2.4,
      pitch: 0,
      antialias: true,
      attributionControl: { compact: true },
    });

    map.on("style.load", () => {
      map.setProjection({ type: "globe" }); // <-- the exact effect from your video
      map.setSky({
        "sky-color": "#0b1026",
        "sky-horizon-blend": 0.5,
        "horizon-color": "#1b2a4a",
        "horizon-fog-blend": 0.6,
        "fog-color": "#0b1026",
        "fog-ground-blend": 0.5,
      }); // atmosphere/starfield-adjacent effect (dark sky + horizon glow)
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    mapRef.current = map;
    return () => map.remove();
  }, []);

  // 2. Debounced geocoding search (MapTiler Geocoding API, swap for Nominatim if preferred)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=6`
        );
        const data = await res.json();
        const parsed: GeoResult[] = (data.features ?? []).map((f: any) => ({
          name: f.place_name,
          lon: f.center[0],
          lat: f.center[1],
          type: f.place_type?.[0],
        }));
        setResults(parsed);
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setLoading(false);
      }
    }, 300); // debounce — avoids firing a request per keystroke
    return () => clearTimeout(handle);
  }, [query]);

  // 3. Fly-to + pin-point (this is the exact camera move from your video)
  const flyToLocation = useCallback((r: GeoResult) => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [r.lon, r.lat],
      zoom: 9,
      pitch: 45,
      duration: 3200,          // ~3.2s eased flight, matches the video's pacing
      curve: 1.4,               // higher curve = more "zoom out then in" arc, very globe-like
      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic — no jarring stop
    });

    // Drop / move the pin
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "wx-pin";
      el.innerHTML = pinSVG;
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" });
    }
    markerRef.current.setLngLat([r.lon, r.lat]).addTo(map);

    setResults([]);
    setQuery(r.name);
    onLocationPicked?.(r);
  }, [onLocationPicked]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div className="wx-search-box">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city, district, or village…"
          aria-label="Search location"
        />
        {loading && <span className="wx-spinner" />}
        {results.length > 0 && (
          <ul className="wx-dropdown" role="listbox">
            {results.map((r, i) => (
              <li key={i} role="option" tabIndex={0}
                  onClick={() => flyToLocation(r)}
                  onKeyDown={(e) => e.key === "Enter" && flyToLocation(r)}>
                {r.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const pinSVG = `
<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="17" cy="40" rx="8" ry="3" fill="black" opacity="0.25"/>
  <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="#F97316"/>
  <circle cx="17" cy="17" r="6.5" fill="white"/>
</svg>`;
```

**Minimal CSS (`LocationGlobe.module.css` or global)**
```css
.wx-search-box {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  width: min(420px, 90vw); z-index: 5;
}
.wx-search-box input {
  width: 100%; padding: 12px 16px; border-radius: 999px; border: none;
  background: rgba(15, 20, 35, 0.75); backdrop-filter: blur(8px);
  color: #fff; font-size: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.35);
}
.wx-dropdown {
  margin-top: 6px; background: rgba(15, 20, 35, 0.92); border-radius: 12px;
  overflow: hidden; list-style: none; padding: 4px;
}
.wx-dropdown li { padding: 10px 14px; border-radius: 8px; color: #eee; cursor: pointer; }
.wx-dropdown li:hover, .wx-dropdown li:focus { background: rgba(255,255,255,0.08); }
.wx-pin { animation: wx-drop 0.5s cubic-bezier(.34,1.56,.64,1); }
@keyframes wx-drop { from { transform: translateY(-24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
```

This reproduces every beat of the reference video: idle globe → typed search with dropdown → smooth eased fly-down → landed + labeled at destination — **plus** the explicit drop-pin your PRD asks for, which the original demo didn't actually have.

---

### 4.3 Auto-Rotation on Idle (matching the video's "breathing" globe)

Add this to keep the globe gently spinning until the user starts interacting — exactly like the opening seconds of your reference clip:

```tsx
useEffect(() => {
  const map = mapRef.current;
  if (!map) return;
  let frame: number;
  let userInteracting = false;

  map.on("mousedown", () => (userInteracting = true));
  map.on("dragend", () => (userInteracting = false));
  map.on("touchstart", () => (userInteracting = true));
  map.on("touchend", () => (userInteracting = false));

  const spin = () => {
    if (!userInteracting && map.getZoom() < 4) {
      const center = map.getCenter();
      center.lng -= 0.06;
      map.easeTo({ center, duration: 0 });
    }
    frame = requestAnimationFrame(spin);
  };
  frame = requestAnimationFrame(spin);
  return () => cancelAnimationFrame(frame);
}, []);
```

### 4.4 Pin-Point Enhancement: Pulse + Label (the part the reference video is missing)

To make "pin point the location" unambiguous and on-brand for a weather app (imagine layering a cyclone-alert pin on top later), give the marker a live pulse ring and a floating label:

```css
.wx-pin::after {
  content: "";
  position: absolute; left: 50%; top: 50%; width: 34px; height: 34px;
  transform: translate(-50%, -50%);
  border-radius: 50%; background: rgba(249, 115, 22, 0.35);
  animation: wx-pulse 1.8s ease-out infinite;
}
@keyframes wx-pulse {
  0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
}
```

Add a small `Popup` (built into MapLibre, free) anchored to the marker showing the resolved place name + live temperature once your weather API responds — this is the natural bridge into FE‑5 (home dashboard) and BE‑3 (cached weather aggregator) in your PRD.

---

## 5. Performance & Quality Enhancements (the "make it smoother, expert-level" pass)

| Enhancement | Why it matters | How |
|---|---|---|
| **Lazy-load the globe component** | The globe (MapLibre + tiles) shouldn't block first paint of the chat UI, which is your app's real P0 (BE‑4/FE‑3) | `next/dynamic(() => import('./LocationGlobe'), { ssr: false, loading: () => <GlobeSkeleton/> })` |
| **Skeleton/placeholder while WebGL initializes** | Avoids a blank black box — matches your PRD's "optimistic UI, never a frozen screen" principle | A blurred static gradient + spinner shown until `map.on('load')` fires |
| **Debounce + cancel in-flight geocoding requests** | Prevents race conditions where an older, slower response overwrites a newer one | `AbortController`, abort the previous fetch on each new keystroke |
| **Cache recent searches client-side** | Repeat lookups (e.g. same village) feel instant, aligning with your PRD's cache-first philosophy | `sessionStorage` keyed by lowercased query string, TTL a few hours |
| **Reduce `mapSamples`/DPI and disable `pitch` on low-end/mobile** | Keeps frame rate smooth on cheap Android devices (your Persona 1: "Ramesh, Meerut") | `navigator.hardwareConcurrency < 4` or a simple mobile media query → simplified config |
| **`prefers-reduced-motion` support** | Accessibility (FE‑11, WCAG 2.1 AA) | Skip `flyTo` easing and auto-rotate; jump directly with `map.jumpTo()` instead |
| **Preconnect to tile/geocoding host** | Shaves connection-setup latency off the very first tile/geocode request | `<link rel="preconnect" href="https://api.maptiler.com" crossOrigin="" />` in `<head>` |
| **Graceful fallback for WebGL-less browsers** | Some very old/low-end browsers lack WebGL2 | Feature-detect (`maplibregl.supported()`); fall back to a static 2D image map + text search |
| **Compress/convert the pin SVG to inline, no network request** | One less request on the critical path | Already inlined as a string in the example above |
| **Code-split the geocoding fetch logic away from the globe bundle** | Keeps the initial globe bundle smaller | Put the search/fetch hook in its own module, dynamic-import only when the search box is focused |

---

## 6. How This Plugs Into Your Existing PRD

Your PRD already has a home for this — it doesn't need a new epic, just an upgrade to an existing task:

- **Replaces/upgrades FE‑6** ("Map/location view — Leaflet + OSM tiles") → swap Leaflet for **MapLibre GL JS with globe projection**, same free OSM/MapTiler tile sources already listed in your Section 15 data-source table, no new vendor.
- **Feeds FE‑5** (home dashboard, stale-while-revalidate weather cards) → `onLocationPicked(r)` callback returns `{lat, lon, name}` straight into your existing weather-fetch hook.
- **Feeds FE‑2** (onboarding/geolocation) → same component can be reused for "confirm your detected location on the globe" during onboarding.
- **New micro-task suggestion for Section 8.2:**

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| FE‑6a | 3D globe location picker | MapLibre GL globe projection + MapTiler tiles + debounced geocoding + fly‑to + pin marker | Lazy-loaded (code-split from chat bundle), debounced geocode fetch with `AbortController`, `prefers-reduced-motion` fallback, mobile-tuned WebGL settings |
| FE‑1a | Hero landing globe | Cobe 5KB decorative globe on splash/landing screen | Ships in the initial bundle since it's tiny; pauses rotation off-screen via `IntersectionObserver` |

- **Cost:** stays at ₹0 — MapTiler free tier + MapLibre (open-source) + Cobe (open-source) + Nominatim/MapTiler geocoding free tier, exactly matching Section 15's philosophy.
- **Risk to add to Section 14:** *"MapTiler free-tier tile/geocoding quota may cap out during a pilot demo spike"* → mitigation: cache tiles at the CDN edge (already planned in your architecture) and add Nominatim as a free geocoding fallback if MapTiler's quota is hit.

---

## 7. Quick-Start Checklist

- [ ] `npm i maplibre-gl cobe`
- [ ] Get free MapTiler API key, store as `NEXT_PUBLIC_MAPTILER_KEY`
- [ ] Drop in `HeroGlobe.tsx` on the landing/splash screen
- [ ] Drop in `LocationGlobe.tsx` wherever your PRD's map/location view lives, wired to `onLocationPicked`
- [ ] Add the pulse-pin CSS
- [ ] Lazy-load both with `next/dynamic({ ssr:false })`
- [ ] Add `prefers-reduced-motion` and low-end-device branches
- [ ] Add MapTiler preconnect tag
- [ ] Wire `onLocationPicked` into your weather-fetch hook (BE‑3) and chat context (BE‑4)

That gives you the exact visual language of the reference recording — rotating satellite globe, typed search, smooth fly-down camera, labeled destination — plus the explicit pin-point marker your product actually needs, built entirely on free tools and tuned specifically for the low-end-device, near-zero-latency constraints already baked into your PRD.
