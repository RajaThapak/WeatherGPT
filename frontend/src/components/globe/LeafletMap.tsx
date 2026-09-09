"use client";

// Replaces the old MapLibre GL (WebGL) globe. That approach hit a class of
// bugs that were ultimately traced to the browser/GPU stack rather than app
// code: a driver-level WebGL context-creation failure, a vector-tile web
// worker that silently died on this dev setup (leaving place-name labels
// missing even once raster imagery rendered), and WebGL context loss when
// the tab was minimized. Leaflet renders plain raster image tiles via the
// DOM — no WebGL, no GPU driver dependency, no worker pipeline to break, and
// no context to lose on minimize/refresh.
//
// The old MapLibre globe's 3D pitch/rotation is now replaced by GlobePanel's
// own DecorativeGlobe + clip-path reveal (see GlobePanel.tsx) — this
// component itself stays plain: a normal, fully-browsable flat map with no
// competing transforms of its own, so manual zoom/pan is never fighting an
// animation here.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapHandle = {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  flyTo: (lat: number, lon: number, name?: string) => void;
  toggleLayer: () => void;
};

// next/dynamic (used to load this map, ssr:false, from GlobePanel) does not
// forward refs to the loaded component, so control is exposed via an
// onReady(handle) callback instead of forwardRef/useImperativeHandle.
type Props = { onReady?: (handle: MapHandle) => void };

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? "";
const DEFAULT_CENTER: L.LatLngTuple = [22.5937, 78.9629]; // India-centered
const DEFAULT_ZOOM = 3;
const FLY_ZOOM = 10;
const MIN_ZOOM = 2;

function tileUrl(kind: "hybrid" | "streets"): string {
  if (!MAPTILER_KEY) {
    // No-key fallback (OpenStreetMap, no API key required) so the map still
    // works before a MapTiler key exists.
    return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  // MapTiler's styled-raster endpoint — renders a full style (imagery +
  // labels + borders) server-side into one image per tile, so there's no
  // separate vector/label pipeline in the browser to fail.
  return `https://api.maptiler.com/maps/${kind}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
}

const PIN_SVG = `
<svg width="30" height="40" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="17" cy="40" rx="8" ry="3" fill="black" opacity="0.25"/>
  <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="#5B9BD5"/>
  <circle cx="17" cy="17" r="6.5" fill="white"/>
</svg>`;

const pinIcon = L.divIcon({
  html: PIN_SVG,
  className: "",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

export default function LeafletMap({ onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const styleKindRef = useRef<"hybrid" | "streets">("hybrid");

  useEffect(() => {
    if (!containerRef.current) return;

    // Web Mercator has no valid tile imagery past ~85° latitude, so
    // zooming/panning beyond that reveals blank gray space above/below the
    // map. minZoom keeps the whole world always at least filling the
    // container; maxBounds + maxBoundsViscosity hard-stops panning/zooming
    // past real map data in every direction.
    const worldBounds = L.latLngBounds([-85, -180], [85, 180]);

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      zoomControl: false,
      attributionControl: true,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1.0,
      // Tiles snap in instantly instead of cross-fading — eliminates the
      // visible "old tiles still fading out under new ones" seam that shows
      // up as a patchwork rectangle whenever anything prompts Leaflet to
      // redraw its tile grid (e.g. a layout reflow elsewhere on the page).
      fadeAnimation: false,
    });

    // MapTiler's styled tiles are 512px ("retina") tiles, so pair with
    // zoomOffset: -1 — the standard Leaflet recipe for 512px tile sets.
    const tileLayer = L.tileLayer(tileUrl("hybrid"), {
      tileSize: 512,
      zoomOffset: -1,
      minZoom: MIN_ZOOM,
      maxZoom: 19,
      bounds: worldBounds,
      attribution: MAPTILER_KEY
        ? '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © OpenStreetMap contributors'
        : "© OpenStreetMap contributors",
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    mapRef.current = map;

    // Leaflet only recalculates its tile grid when it's told the container
    // resized — it doesn't detect this on its own. A ResizeObserver catches
    // every case (breakpoint changes, sidebar layout shifts, etc.), not just
    // the one that prompted this fix, so tiles never end up misaligned with
    // the actual container size.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(containerRef.current);

    onReady?.({
      reset: () => {
        map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1.2 });
      },
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      flyTo: (lat, lon) => {
        map.flyTo([lat, lon], FLY_ZOOM, { duration: 1.2 });
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
        } else {
          markerRef.current.setLatLng([lat, lon]);
        }
      },
      toggleLayer: () => {
        styleKindRef.current = styleKindRef.current === "hybrid" ? "streets" : "hybrid";
        tileLayerRef.current?.setUrl(tileUrl(styleKindRef.current));
      },
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // z-0 (not the default z-index:auto) matters here: it makes this element
  // establish its own stacking context, so Leaflet's internal panes (marker
  // pane alone uses z-index:600+) stay contained within it instead of
  // leaking out and rendering above GlobePanel's own overlays (the globe,
  // the cloud wipe, the floating buttons), which otherwise use much lower
  // z-index values (10-20) that Leaflet's internal panes would blow past.
  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
