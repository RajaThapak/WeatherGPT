# WeatherGPT — Build Status

**Last updated:** 2026-09-09

This tracks what's actually been built and verified working in the codebase, as of this session, separate from the aspirational scope in `WeatherGPT_PRD.md`. Where something in the PRD hasn't been touched, it's not repeated here — see the PRD for the full plan.

## Status at a glance

| Feature | Status |
|---|---|
| Backend scaffold (FastAPI + Postgres/PostGIS/TimescaleDB + Redis + Mosquitto) | ✅ Working |
| Real weather data (Open-Meteo, cached) | ✅ Working |
| Air quality (Open-Meteo Air Quality API) | ✅ Working |
| Today / Tomorrow / Next-7-days tabs | ✅ Working, genuinely changes content per tab |
| Light/dark theme toggle | ✅ Working, persists across reloads |
| Chat (Groq LLM, streaming, location-aware, concise) | ✅ Working |
| Voice — speech-to-text (Sarvam Saaras v3) | ✅ Working |
| Voice — text-to-speech (Sarvam Bulbul v3) | ✅ Working |
| Chat-driven globe fly-to + dashboard sync | ✅ Working (logic-wise) |
| 3D globe visual rendering (MapLibre GL JS) | ⚠️ **Blocked** — see "Known issue" below |
| Dashboard UI (navbar, forecast cards, rain chart, city list) | ✅ Working |

## Backend (`backend/`)

FastAPI app, Python 3.14, async throughout. Key routers under `app/routers/`, business logic under `app/services/`.

- **`/health`** — Postgres + Redis liveness check.
- **`/api/weather?lat=&lon=`** — Open-Meteo current + 7-day forecast + hourly precip/temp, Redis-cached (10min TTL). WMO weather codes mapped to the UI's icon categories.
- **`/api/air-quality?lat=&lon=`** — Open-Meteo Air Quality API (US AQI + category + PM2.5/PM10/ozone/CO/NO₂), same caching pattern.
- **`/api/chat/stream`** — SSE endpoint. Flow: extract a place from the message (Groq, strict JSON schema) → geocode it (MapTiler) → fetch real weather for it → stream `location` → `weather` → `token`* → `done` events. The LLM only narrates already-fetched real numbers (never invents them), and is prompted to answer in 1–3 short plain-conversational sentences, no markdown — since the same text gets spoken aloud.
- **`/api/voice/transcribe`** — accepts an uploaded audio file, returns `{text}` via Sarvam's `saaras:v3` STT.
- **`/api/voice/speak`** — accepts `{text}`, returns MP3 bytes via Sarvam's `bulbul:v3` TTS.

**LLM model note:** currently `openai/gpt-oss-120b` on Groq for the main chat answer, `openai/gpt-oss-20b` for the fast place-extraction sub-call. (`llama-3.3-70b-versatile`, used earlier in the session, was silently deprecated by Groq mid-session and had to be swapped out — worth re-checking Groq's live model list if chat ever starts erroring again.)

**Voice provider:** Sarvam AI, not OpenAI — switched after OpenAI's API kept rejecting every generated key (traced to the OpenAI platform account itself, not a code issue) and because Sarvam is purpose-built for Indian languages, a better fit for this project than OpenAI's English-optimized voices anyway. Rime and self-hosted Whisper (the PRD's original plan) were also superseded by this.

## Frontend (`frontend/`)

Next.js 16 (App Router), React 19, Tailwind v4 (CSS-first tokens in `globals.css`).

- **Dashboard** (`app/page.tsx` + `components/dashboard/`): navbar, Today/Tomorrow/Next-7-days tabs, hero forecast card + day strip, rain chance chart, air quality view, "other cities" list, globe panel — all driven by real backend data via `LocationProvider`/`ViewProvider` React contexts (`lib/location-context.tsx`, `lib/view-context.tsx`).
- **Theme**: `lib/theme-context.tsx` + a `[data-theme="light"]` CSS override block in `globals.css`. Only neutral surface/text tokens flip between themes — accent colors and the hero card's `text-inverse` deliberately stay constant (see comment in `globals.css` for why).
- **Chat**: `components/chat/` — floating trigger button, slide-in panel, mic button (browser `MediaRecorder`), per-message speaker icon, auto-play only for voice-initiated turns. `lib/use-chat-stream.ts` hand-parses the SSE stream (POST body rules out native `EventSource`).
- **Globe**: `components/globe/MapLibreGlobe.tsx`, mounted via `next/dynamic(..., {ssr:false})` in `GlobePanel.tsx`. Built correctly and passes every code-level check (see "Known issue" below for why it's still not visually confirmed).

## Known issue: globe doesn't render on this dev machine

The MapLibre globe is code-complete — search, fly-to, pin, idle rotation, chat integration all wired — but the actual WebGL canvas renders blank on the machine used for testing this session, in **both** Chrome and Edge. Root-caused via the browser's own GPU diagnostics page (`edge://gpu`) to a real driver bug:

```
ERROR:ui\gl\egl_util.cc:92 : EGL Driver message (Error) eglCreateContext: Requested version is not supported
```

This is the AMD Radeon integrated GPU's driver (v32.0.21036.1002) refusing the WebGL context version the browser requests — a driver-level failure below JavaScript, not a catchable app error, and confirmed to fail identically across two different browser engines (rules out an Edge-specific fix). Two real, separate app bugs were found and fixed along the way (Turbopack dropping MapLibre's worker in dev — fixed by pinning `next dev --webpack`; a MapLibre `easeTo()` crash loop in the idle-rotation code — fixed by driving rotation with a plain `requestAnimationFrame` + `jumpTo()` loop instead) but neither was the final blocker.

**Not yet decided: how to proceed.** Options discussed:
1. Update the AMD driver (may or may not fix it, untested).
2. Switch the functional map to **Leaflet.js** (no WebGL dependency at all — this was the *original* PRD's own choice before this session's pivot to MapLibre; would sidestep this whole class of bug and match the PRD's "degrade gracefully on low-end devices" goal). Optionally pair with a CSS-only decorative rotating-globe illustration for visual flair.

## Explicitly deferred / not built

Auth, DB-persisted chat history, Web Push alerts (BE-6), full multilingual/Bhashini, SMS/USSD alert fallback, RAG (`pgvector` not provisioned — deferred early on, see PRD changelog).

## Env vars currently in use (`backend/.env`, `frontend/.env`)

`GROQ_API_KEY`, `MAPTILER_API_KEY` / `NEXT_PUBLIC_MAPTILER_API_KEY`, `SARVAM_API_KEY` (+ `SARVAM_STT_MODEL`, `SARVAM_TTS_MODEL`, `SARVAM_TTS_SPEAKER`, `SARVAM_TTS_LANGUAGE`), `DATABASE_URL`, `REDIS_URL`. `OPENAI_API_KEY`, `RIME_API_KEY`, `GEMINI_API_KEY`, `HUGGINGFACE_API_KEY`, `BHASHINI_*`, `CDS_API_KEY` are present in `.env` but currently unused by any code path.

## Running it locally

```
docker compose up -d db redis mqtt        # from repo root
cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
cd frontend && npm run dev                 # runs on --webpack, required — see globe note above
```
Frontend: `http://localhost:3000`. Backend: `http://localhost:8001` (port 8000 has a stale-socket quirk on this machine, unrelated to the app).
