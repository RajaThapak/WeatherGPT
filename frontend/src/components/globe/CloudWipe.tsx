"use client";

// The reveal step of GlobePanel's search transition: a solid cloud sheet
// (guarantees full, gap-free coverage while `active`) with a bank of soft
// blurred puffs layered on top for texture — pure CSS, no image asset, no
// WebGL. Turning `active` off fades the sheet and drifts+dissipates the
// puffs on staggered delays, so the reveal reads as organic parting clouds
// rather than a flat cross-fade, while both layers finish clearing at
// roughly the same time (no risk of a bare gap between them).

type Puff = { top: string; left: string; size: number; delay: number; driftX: number; driftY: number };

const PUFFS: Puff[] = [
  { top: "5%", left: "-10%", size: 280, delay: 0, driftX: -170, driftY: -60 },
  { top: "-20%", left: "14%", size: 340, delay: 50, driftX: 20, driftY: -190 },
  { top: "-10%", left: "42%", size: 320, delay: 100, driftX: -30, driftY: -170 },
  { top: "0%", left: "68%", size: 340, delay: 60, driftX: 120, driftY: -150 },
  { top: "10%", left: "92%", size: 300, delay: 130, driftX: 200, driftY: -40 },
  { top: "45%", left: "-10%", size: 300, delay: 90, driftX: -190, driftY: 60 },
  { top: "50%", left: "22%", size: 340, delay: 20, driftX: 10, driftY: 170 },
  { top: "48%", left: "50%", size: 320, delay: 140, driftX: 60, driftY: 150 },
  { top: "44%", left: "76%", size: 320, delay: 70, driftX: 180, driftY: 80 },
  { top: "50%", left: "98%", size: 280, delay: 160, driftX: 190, driftY: 100 },
];

export function CloudWipe({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[11] overflow-hidden">
      {/* Solid base sheet — guarantees full, gap-free coverage while active
          (the puffs below are soft/blurred and sparse, so alone they'd let
          the map peek through between them). Fades out slightly slower and
          later than the puffs so it never disappears before they do. */}
      <div
        className="absolute inset-0 transition-opacity ease-in"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.99), rgba(230,233,239,0.97) 55%, rgba(206,211,219,0.96) 100%)",
          transitionDuration: active ? "220ms" : "950ms",
          transitionDelay: active ? "0ms" : "160ms",
          opacity: active ? 1 : 0,
        }}
      />
      {PUFFS.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full transition-[transform,opacity] ease-in"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(225,228,233,0.92) 45%, rgba(225,228,233,0) 72%)",
            filter: "blur(6px)",
            transitionDuration: active ? "260ms" : "850ms",
            transitionDelay: active ? "0ms" : `${p.delay}ms`,
            transform: active ? "translate(0, 0) scale(1)" : `translate(${p.driftX}px, ${p.driftY}px) scale(1.4)`,
            opacity: active ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}
