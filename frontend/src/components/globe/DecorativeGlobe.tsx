"use client";

// Pure CSS rotating-globe accent — no WebGL, no external library, so it
// carries none of the GPU-driver/worker/context-loss risk the old MapLibre
// globe had. Shown as GlobePanel's idle state and during its zoom-in
// transition into the real (Leaflet) map on every location change.

export function DecorativeGlobe({ transitioning }: { transitioning: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-10 flex items-center justify-center bg-black transition-all duration-[900ms] ease-in ${
        transitioning ? "pointer-events-none scale-[2.6] opacity-0" : "scale-100 opacity-100"
      }`}
    >
      <div className="relative aspect-square h-[70%] max-h-[220px] rounded-full shadow-[0_0_60px_rgba(91,155,213,0.25)]">
        <div className="globe-texture absolute inset-0 rounded-full" />
        {/* Spherical shading: a bright highlight (light source) plus a dark
            terminator shadow — this is what sells the flat, sliding texture
            as a lit 3D sphere. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35), rgba(255,255,255,0) 35%), radial-gradient(circle at 72% 78%, rgba(0,0,0,0.6), rgba(0,0,0,0) 60%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
      </div>
    </div>
  );
}
