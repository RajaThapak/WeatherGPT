# Product Requirements Document (PRD)
## WeatherGPT — Conversational AI for Weather Forecasting, Alerts & Climate Information

**Prepared for:** Ministry of Earth Sciences (MoES) / India Meteorological Department (IMD)
**Domain:** Software — Disaster Management
**Platform:** Web Application (responsive, PWA-enabled)
**Cost Approach:** Free/open-source software and free-tier cloud resources wherever possible, with one deliberate paid exception (voice TTS — see Section 11)
**Performance Approach:** Near-instant, perceptibly-zero-latency interaction wherever technically achievable
**Version:** 1.4
**Date:** September 2026

> **A note on "zero latency":** Network round-trips and computation always take some non-zero time — true zero latency is not physically possible on any system. What this PRD instead targets is **imperceptible latency**: interactions that *feel* instant to the user (sub-100ms UI feedback, streamed answers, precomputed/cached data) even though a few milliseconds of real transmission time always exist underneath. Every section below is built around minimizing that real latency as close to zero as engineering allows.

### Changelog — v1.3 → v1.4

| Change | Rationale |
|---|---|
| Database engine confirmed as **PostgreSQL** (MongoDB evaluated, rejected) | This domain is geospatial-heavy (district-polygon alert matching) and time-series-heavy (climate rollups) — PostGIS + TimescaleDB fit both precisely; MongoDB's 2dsphere/time-series collections would approximate both less precisely |
| **RAG layer (was BE-5) deferred out of MVP**, `pgvector` no longer provisioned in MVP | Every query type that must be *correct* (current weather, forecast, trends, alerts) already bypasses the LLM via the structured Weather Data service — RAG would only serve a narrow slice of open-ended explanatory questions, not worth the ingestion/indexing build for a 12-week MVP |
| Map/location UI: **Leaflet + OSM → Cobe (hero globe) + MapLibre GL JS (globe projection, fly-to)** | Delivers the requested "rotating globe → search → fly-to → pin" experience at a fraction of CesiumJS's weight, without breaking the TTI-on-3G budget |
| Voice TTS: **Coqui TTS/eSpeak-NG → Rime (paid API)**, primary; Whisper unchanged for STT | Deliberate quality/latency trade — the one paid exception to the free-tier stack, scoped narrowly and rate-limited per user; free TTS kept as a degrade-gracefully fallback |
| Chat is now the **single entry point** for both weather Q&A and the globe fly-to | Typing/speaking a place name in chat drives the globe directly — no separate search UI competing with chat |
| New: **Globe Fly-To Orchestrator** (backend), **chat trigger button** (frontend) | Needed to wire chat intent → location resolution → globe animation + weather answer in one round trip |
| New risks/open questions added re: Rime cost exposure and the Web Push alert-fallback gap for low-connectivity personas | Surfaced during architecture review — not yet resolved |

---

## 1. Executive Summary

WeatherGPT is a **web-based** conversational AI platform that lets citizens, farmers, disaster managers, aviation/marine operators, and researchers query weather, climate, and disaster-warning information in natural language (text + voice), in multiple Indian languages, from any browser — no app install required. It integrates live meteorological data (IMD open data, GFS/WRF model output, satellite feeds) behind an LLM-based query engine, and pushes proactive alerts for extreme weather events via free web push notifications. A chat-driven 3D globe lets users type or speak a place name and watch the view fly to and pin that location while the answer streams in, both as text and as spoken voice.

Two design principles anchor this PRD:
1. **Cost-zero buildability wherever possible** — nearly every component runs on free/open-source software and free-tier infrastructure; the one deliberate exception (paid voice TTS) is scoped narrowly and rate-limited.
2. **Near-zero perceived latency** — every layer (network, backend, database, LLM, frontend, voice) is engineered to respond as close to instantly as possible, using caching, precomputation, streaming, and edge delivery.

This PRD defines the product scope, architecture, and a **task-wise implementation plan** across four workstreams — **Backend, Frontend (Web), Database (PostgreSQL), and Deployment (AWS + Local)**.

---

## 2. Problem Statement

Weather information today is fragmented across IMD portals, bulletins, satellite imagery products, and NWP model dashboards, and existing tools are often slow to load and query. Non-technical users (farmers, fisherfolk, disaster response teams) need answers **fast**, sometimes in emergency situations where every second matters (e.g., an approaching cyclone). A conversational platform for this use case must therefore treat **speed as a safety feature**, not just a UX nicety — on top of unifying the data itself, avoiding licensing costs, and supporting local languages.

## 3. Goals & Objectives

| Goal | Description |
|---|---|
| G1 | Provide real-time, location-aware weather answers via natural language chat/voice, responding as close to instantly as possible |
| G2 | Integrate NWP models (GFS/WRF) and IMD data feeds for forecast accuracy, using free/open data sources |
| G3 | Disseminate extreme weather alerts (cyclone, flood, heatwave) with the lowest achievable latency via free web push |
| G4 | Support multiple Indian languages (text + voice) for rural accessibility using free translation/ASR models, plus streamed voice output |
| G5 | Provide sector-specific advisories: agriculture, aviation, marine, urban planning |
| G6 | Offer historical/climate trend analytics for researchers using free open climate datasets |
| G7 | Ensure the platform works well on low-end devices/browsers with poor connectivity (PWA, offline caching, degrade gracefully rather than freeze) |
| G8 | Build and deploy the entire system using free/open-source software and free-tier infrastructure, with any paid exception deliberately scoped and cost-guarded |
| G9 | Minimize end-to-end latency at every layer so the app feels instant even under load or on weak networks |

## 4. Target Users / Personas

1. **Farmer (Ramesh, Meerut)** — needs crop-specific weather advisory in Hindi, voice input and voice answers, on a low-cost phone with patchy network; the app must respond instantly from cache even if the network is momentarily slow.
2. **Fisherman (coastal Odisha)** — needs cyclone/marine alerts pushed the instant a bulletin is issued — delay here is a safety risk. *(Note: this persona's connectivity profile is in tension with a Web-Push-only alert channel — see Section 14.)*
3. **Pilot / ATC staff** — needs METAR/TAF-style briefings with zero perceptible lag on a desktop dashboard.
4. **District Disaster Management Officer** — needs to publish an alert and have it reach subscribed citizens within seconds.
5. **Researcher / Student** — needs historical climate trend queries to render instantly from precomputed aggregates rather than live recomputation.
6. **Urban citizen** — needs daily forecast, air quality, commute-relevant alerts, expecting an app-like instant feel.

## 5. Scope

### In Scope (MVP → V1)
- **Responsive web application** (desktop + mobile browser), installable as a **Progressive Web App (PWA)**, with app-shell precaching for instant load.
- Text/voice query understanding via a **hosted free-tier LLM API** (no local/self-hosted model), with **streamed token-by-token responses** so the user sees output within milliseconds rather than waiting for a full answer.
- **Chat is the single entry point** for both weather Q&A and location navigation — typing or speaking a place name drives both the answer and the globe view.
- **3D globe location visualization**: decorative idle globe (Cobe) plus a functional search → fly-to → pin-point globe (MapLibre GL JS globe projection), replacing a flat 2D map.
- Voice interaction, both directions: streamed speech-to-text input (Whisper) and streamed spoken answers (Rime TTS, with a free-TTS fallback for degrade-gracefully behavior).
- Real-time current weather + 7-day forecast via **free/open weather APIs**, served from a **hot cache** for near-instant repeat queries.
- Web push notifications for severe weather alerts, dispatched via a **low-latency pub-sub pipeline**.
- Multilingual support: Hindi, English + 3 regional languages in MVP.
- Location-based advisory (browser geolocation, cached per-session to avoid repeat permission/lookup delay).
- Basic climate trend charts, backed by **precomputed aggregate tables** (not on-the-fly heavy queries, not RAG).
- Admin web dashboard for alert publishing.

### Out of Scope (Future Phases)
- Full WRF model execution/hosting (compute-heavy, inherently high-latency) — MVP consumes pre-generated model output.
- **RAG-grounded climate Q&A** (deferred — see Changelog) — revisit only if usage data post-launch shows frequent open-ended explanatory questions the base LLM answers poorly.
- Full WIS 2.0 node implementation.
- Native Android/iOS apps (Phase 2).
- Full 22-language coverage (phased rollout).
- Paid, high-volume SMS/voice-call gateways — **flagged as a possible MVP gap, not a confirmed exclusion**, given the alert-reach concern in Section 14.

## 6. Key Features (Mapped to Requirements)

| # | Feature | Priority | Free-resource note | Latency approach |
|---|---|---|---|---|
| 1 | Real-time weather retrieval | P0 | Open-Meteo / IMD open data | Redis cache (sub-5ms reads) with short TTL refreshed in background |
| 2 | NL query understanding (web chat) | P0 | Hosted free-tier LLM API (no local LLM) | Streaming responses (Server-Sent Events/WebSocket) so first token appears almost immediately |
| 3 | NWP model data integration (GFS/WRF output) | P1 | NOAA/NOMADS, NCMRWF | Pre-parsed into Postgres on ingestion, never parsed live per-request |
| 4 | Extreme weather alerts & web push notifications | P0 | Web Push is free | Event-driven push (no polling delay) — alert dispatched the instant it's ingested |
| 5 | Location-based forecast/advisory | P0 | Browser Geolocation API | Cached client-side per session; geo-index (PostGIS GiST index) for instant lookup |
| 6 | Multilingual (Indian languages) | P0 | Bhashini, IndicTrans2, LibreTranslate | Pre-translate common phrases/UI strings at build time; only free-form text goes through live translation |
| 7 | Climate trend/historical analysis | P1 | NASA POWER, IMD, ERA5 | Precomputed materialized views/aggregates refreshed on a schedule, not computed per query, not RAG |
| 8 | Voice interaction (bidirectional) | P1 | Whisper (free, STT) + **Rime (paid, TTS)** | Streamed STT (partial transcript as user speaks) and streamed TTS playback; Rime calls rate-limited per user/session |
| 9 | Installable PWA / offline-lite mode | P1 | Free browser standard | Service-worker app-shell caching for instant repeat loads, even offline |
| 10 | **3D globe search + fly-to + pin** | P0 | Cobe (MIT, free) + MapLibre GL JS (BSD-3, free) + MapTiler/OSM tiles (free tier) | Cobe loads eagerly (5KB) for the idle state; MapLibre lazy-loaded only on first search/chat use so it never taxes first paint |

---

## 7. System Architecture (High Level, Latency-Optimized)

```
┌───────────────────────────────────────────────────────────────────┐
│  CLIENT — Next.js PWA (dark dashboard UI)                           │
│  ★ Service-worker app-shell precache → instant repeat load          │
│  ★ Cobe hero globe (5KB, eager) — idle auto-rotate                  │
│  ★ MapLibre GL JS globe (lazy-loaded on first search/chat use)      │
│  ★ Stale-while-revalidate weather cards (last-cached shown instantly)│
│  ★ Floating chat pill button + hint bubble → opens chat panel        │
│  ★ Chat: streamed text tokens (typewriter) + streamed voice          │
│  ★ Mic input streamed in chunks; TTS audio played as chunks arrive   │
└──────────────────────────────┬──────────────────────────────────────┘
                                │ HTTP/2 or HTTP/3 (QUIC), WebSocket/SSE
┌──────────────────────────────▼──────────────────────────────────────┐
│  CDN / EDGE — static assets + cacheable API responses at edge nodes  │
└──────────────────────────────┬──────────────────────────────────────┘
┌──────────────────────────────▼──────────────────────────────────────┐
│  API GATEWAY — FastAPI (async)                                      │
│  Auth (stateless JWT, Redis session) | Rate limiting | i18n          │
│  ★ Rime calls specifically rate-limited per user/session (cost guard)│
└───────────┬───────────────────┬───────────────────┬─────────────────┘
            │                   │                   │
┌───────────▼─────────┐ ┌───────▼──────────┐ ┌──────▼──────────────┐
│ NLU / LLM Service     │ │ Weather Data      │ │ Voice Pipeline        │
│ ★ hosted free-tier    │ │ Aggregator         │ │ ★ Whisper STT (free,   │
│   LLM (Groq primary,  │ │ ★ Redis hot cache  │ │   streamed, partial    │
│   Gemini fallback)    │ │   (5–10min TTL)    │ │   transcripts)         │
│ ★ streamed tokens     │ │ ★ background        │ │ ★ Rime TTS (paid,      │
│ ★ NO RAG — numeric/   │ │   refresh before    │ │   streamed audio,      │
│   factual answers     │ │   TTL expiry        │ │   rate-limited; free   │
│   routed to Weather   │ │                     │ │   TTS fallback if      │
│   Data service, not   │ │                     │ │   Rime unavailable)    │
│   generated by LLM    │ │                     │ │                        │
└───────────┬───────────┘ └───────┬─────────────┘ └────────────────────────┘
            │                     │
            │       ┌─────────────▼─────────────┐
            │       │ Free/Open Data APIs         │
            │       │ Open-Meteo / IMD / NOMADS    │
            │       └─────────────┬─────────────┘
            │                     │
┌───────────▼─────────────────────▼──────────────────────────────────┐
│  Globe Fly-To Orchestrator                                           │
│  Resolves location entity from LLM intent → geocode → {lat,lon,zoom} │
│  ★ returned in the SAME response as the structured weather payload,   │
│    so the globe animates and the weather answer land in one round trip│
└──────────────────────────────┬───────────────────────────────────────┘
┌──────────────────────────────▼───────────────────────────────────────┐
│  Alert Dissemination Service                                          │
│  ★ event-driven pub/sub (MQTT) → Web Push, <5s ingest→dispatch target │
│  ⚠ open gap: Web Push doesn't reach users without an installed/        │
│    subscribed PWA — SMS/USSD fallback not yet in MVP scope             │
└──────────────────────────────┬───────────────────────────────────────┘
┌──────────────────────────────▼───────────────────────────────────────┐
│  PostgreSQL + PostGIS + TimescaleDB                                   │
│  ★ PostGIS: district/state polygons, GiST index — point-in-polygon    │
│    lookups for alert geo-matching and location resolution             │
│  ★ TimescaleDB: hypertables + continuous aggregates for climate       │
│    trend dashboard (precomputed, never computed live)                 │
│  ★ pgvector: NOT provisioned in MVP (RAG deferred) — revisit only if   │
│    Phase 2 usage data shows demand for grounded explanatory Q&A       │
│  ★ Redis: read-through cache, hot paths (current weather, active      │
│    alerts, sessions) — sub-ms reads                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Latency design principles embedded above (★ marks):**
- **Cache first, compute second** — nearly every read path checks Redis/edge cache before hitting the database or an external API.
- **Stream, don't wait** — LLM tokens, STT transcripts, and TTS audio are all streamed incrementally rather than returned as one blocking response.
- **Precompute, don't recompute** — heavy aggregates (climate trends, GFS/WRF parsing) are done once on ingestion, not per user request; no live RAG retrieval in the hot path.
- **Push, don't poll** — alerts move through an event-driven pipeline (MQTT/WebSocket/Web Push) so there is no polling interval adding delay.
- **Edge delivery** — static assets and cacheable API responses are served from CDN edge nodes physically closer to the user.
- **Optimistic UI** — the frontend shows an immediate response (e.g., "Fetching latest data…" skeleton, last cached value) while the real answer streams in, so the user never sees a blank/frozen screen.
- **One round trip for chat-driven navigation** — location resolution and weather fetch happen server-side in parallel; the client gets `{lat, lon, zoom}` and the weather payload together, not as two sequential calls.

---

## 8. Task-Wise Breakdown

### 8.1 Backend (Python / FastAPI — free/open-source except where noted, latency-optimized)

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| BE-1 | Project scaffolding | FastAPI (async), Uvicorn/Gunicorn with multiple workers | Fully async request handling; connection pooling (asyncpg) to avoid blocking I/O |
| BE-2 | Auth service | JWT-based auth, OTP/email login | Stateless JWT verification (no DB round-trip per request); session data cached in Redis |
| BE-3 | Weather data aggregator | Open-Meteo/IMD/NOMADS connectors | **Redis cache** (TTL 5–10 min) in front of every external call; background refresh job updates cache before it expires so users never wait on a live external API call |
| BE-4 | NLU/LLM query engine | Intent + entity extraction, streamed answer | Hosted free-tier LLM API (Groq primary, Gemini fallback) for intent classification and generation, streaming token-by-token via SSE/WebSocket. **Factual/numeric answers (weather values, forecasts) are always routed to BE-3's structured data, never generated freeform by the LLM** — this is the primary hallucination mitigation and the reason a RAG layer isn't needed for the queries that matter |
| BE-5 | ~~RAG layer for climate Q&A~~ **DEFERRED — Phase 2 candidate only** | Originally planned pgvector similarity search for open-ended climate Q&A grounding. Deferred from MVP: the queries that need to be correct already bypass the LLM via BE-3/BE-10; RAG would only help a narrow slice of explanatory questions, not worth the ingestion/indexing pipeline for a 12-week build. Revisit only if post-launch usage data shows frequent explanatory questions the base LLM handles poorly | N/A in MVP |
| BE-6 | Alerts service | Geo-match + push | Event-driven architecture (pub/sub via MQTT) triggers push the moment a bulletin lands — no polling loop delay |
| BE-7 | Multilingual layer | Translation | Pre-translate static UI strings at build time (zero runtime cost); only dynamic chat text is translated live, cached by phrase-hash to avoid re-translating repeats |
| BE-8 | Voice pipeline | STT/TTS | **STT:** streaming Whisper (self-hosted, free), partial transcripts as the user speaks. **TTS:** Rime API (paid), streamed audio chunks sent as generated, not after full synthesis; rate-limited per user/session at the gateway; falls back to free self-hosted TTS (Coqui/eSpeak-NG) if Rime is unavailable or a user hits their cap, so voice degrades rather than breaking |
| BE-9 | Advisory generation | Rule engine + LLM | Cache generated advisories per location+date key; only regenerate when underlying data changes |
| BE-10 | Climate analytics API | Historical trend queries | Served from **precomputed materialized views** refreshed nightly, not computed live from raw observations |
| BE-11 | Admin API | Alert publishing | Direct write-through to cache + DB in the same transaction so subsequent reads are instantly consistent |
| BE-12 | API docs & testing | OpenAPI/Swagger, Pytest, Locust | Locust load tests specifically measure P50/P95/P99 latency under concurrent load, with a `<300ms API` and `<3s first-token LLM` target |
| BE-13 | **Globe Fly-To Orchestrator** (new) | Resolves the location entity extracted by BE-4's intent parser, geocodes it, and returns `{lat, lon, zoom}` | Runs in parallel with BE-3's weather fetch for the same location and returns both in a single response payload, so the client can animate the globe and render the answer from one round trip instead of two sequential calls |

### 8.2 Frontend (Web Application — React.js / Next.js, latency-optimized)

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| FE-1 | App scaffolding | Next.js, Tailwind CSS | Static generation (SSG) for non-personalized pages; code-splitting so only needed JS loads per route |
| FE-2 | Onboarding & auth pages | Login/OTP, language, geolocation | Geolocation result cached in browser storage per session to avoid repeat permission-prompt delay |
| FE-3 | Chat interface | Chat UI, streaming display; **single entry point for both weather Q&A and location navigation** | Renders LLM tokens as they arrive (typewriter effect); a location typed or spoken in chat drives the globe fly-to (FE-6) and the answer together, instead of waiting for the full response |
| FE-4 | Voice interaction UI | Mic capture, voice playback | Streams audio chunks to backend as spoken (Whisper), rather than waiting for the user to finish; plays Rime TTS audio as chunks arrive rather than waiting for full synthesis |
| FE-5 | Home dashboard | Weather cards, forecast strip | Shows last-cached data instantly on load, then silently refreshes in the background ("stale-while-revalidate" pattern) |
| FE-6 | **3D globe / location view** | **Cobe** (decorative idle globe, ~5KB) + **MapLibre GL JS** with `globe` projection (functional search → fly-to → pin), replacing the earlier Leaflet plan | Cobe loads eagerly on first paint (cheap enough not to matter); MapLibre + tiles are lazy-loaded only once the user actually searches or opens chat, protecting Time-to-Interactive; degrades to a flat 2D map at low zoom/on low-end devices |
| FE-7 | Climate analytics dashboard | Charts | Chart data fetched from precomputed aggregate endpoints, not raw time-series, for instant rendering |
| FE-8 | Alerts & notifications | Web Push | Service worker pushes notification the instant the payload arrives — no in-app polling |
| FE-9 | Sector advisory pages | Advisory views | Cached per location, revalidated in background |
| FE-10 | PWA & offline support | Service worker | App-shell (HTML/CSS/JS) precached so the app loads instantly on repeat visits, even before network responds |
| FE-11 | Accessibility | WCAG 2.1 AA | Lighthouse performance budget enforced (e.g., Time-to-Interactive target < 2s on 3G) alongside accessibility checks |
| FE-12 | Admin dashboard | Alert publishing UI | Optimistic UI update (alert shown as "sent" immediately, reconciled with server confirmation) |
| FE-13 | QA & release | Cross-browser + performance testing | **Lighthouse CI** performance budget gates in the CI/CD pipeline — a build that regresses latency beyond budget fails the build |
| FE-14 | **Chat trigger button** (new) | Floating pill button + short hint bubble (e.g., "Ask about the weather") that opens the unified text+voice chat panel | Rendered as part of the precached app shell so it's visible before any network response; opening the panel is a pure client-side transition (no network wait) |

### 8.3 Database (PostgreSQL — confirmed over MongoDB, latency-optimized)

> **Engine decision:** PostgreSQL was evaluated against MongoDB and retained. This domain is geospatial-heavy (district-polygon matching for alert dispatch) and time-series-heavy (climate trend rollups) — PostGIS gives precise polygon operations and TimescaleDB automates continuous aggregates, both of which MongoDB's 2dsphere index and time-series collections would only approximate with more manual rollup logic.

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| DB-1 | Schema design | Core tables | Designed with query access patterns in mind up front (avoid N+1 queries) |
| DB-2 | Extensions setup | `postgis`, `timescaledb` (**`pgvector` not provisioned in MVP** — RAG deferred, see BE-5) | TimescaleDB automatically optimizes time-range queries via chunk exclusion |
| DB-3 | Geospatial data | District/state polygons | GiST spatial index on `geom` columns for millisecond-scale "which district is this point in" queries |
| DB-4 | Time-series tables | Hypertables | Continuous aggregates (TimescaleDB feature) precompute rollups (hourly/daily) so dashboard queries hit a small precomputed table, not billions of raw rows |
| DB-5 | Caching layer | Redis | Read-through cache for all hot-path queries (current weather, active alerts); sub-millisecond reads |
| DB-6 | Data retention & archival | Rolling window | Keeps hot tables small (and therefore fast) by archiving old raw data out of the primary query path |
| DB-7 | Migrations | Alembic | No runtime latency impact; ensures indexes are created alongside schema changes, not forgotten |
| DB-8 | Backup & DR | pg_dump/WAL | Backups run on a replica or during low-traffic windows so they never compete with live query latency |

### 8.4 Deployment (AWS + Local + Free-Tier — latency-optimized)

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| DEP-1 | Local dev environment | Docker Compose | Mirrors production topology so latency issues are caught early, not just in production |
| DEP-2 | Containerization | Dockerfiles | Slim/multi-stage images for faster cold starts on free-tier hosts |
| DEP-3 | Cloud architecture | Frontend on CDN edge (Vercel/CloudFront), backend near database region | Co-locate backend and database in the **same cloud region** to minimize DB round-trip time; use a CDN so static/cacheable content is served from the edge node nearest the user |
| DEP-4 | CI/CD | GitHub Actions | Automated Lighthouse CI + Locust latency checks gate every deploy |
| DEP-5 | Secrets & config | Env-based config | No impact on runtime latency (build-time only); includes Rime API key and per-user voice quota config |
| DEP-6 | Monitoring & logging | Grafana + Prometheus | Real-time latency dashboards (P50/P95/P99) with alerting if response times exceed target thresholds, including Rime spend/usage tracking |
| DEP-7 | Alert pub-sub infra | Mosquitto/Web Push | Kept close to the alert-ingestion service (same region) to minimize the ingest→dispatch hop |
| DEP-8 | Auto-scaling & load balancing | ALB/Nginx | Auto-scaling triggers on latency degradation (not just CPU), so extra capacity spins up before users feel a slowdown |
| DEP-9 | Disaster recovery | Backups/failover | Failover tested to ensure switchover itself doesn't introduce a long latency spike |
| DEP-10 | Domain & HTTPS | Let's Encrypt, HTTP/2 or HTTP/3 | HTTP/3 (QUIC) where supported reduces connection-setup latency, especially on lossy mobile networks |
| DEP-11 | Kubernetes option (optional) | Helm/EKS | Only if free-tier single-instance latency becomes a real bottleneck under measured load |

**Local Docker Compose (unchanged core, still latency-mirroring production):**
```yaml
version: "3.9"
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on: [backend]
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db, redis]
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: weathergpt
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
  mqtt:
    image: eclipse-mosquitto:2
    ports: ["1883:1883"]
volumes:
  pgdata:
```

---

## 9. Free-Resource-First Hosting Options (Latency-Aware)

| Component | Free-forever option | Latency note |
|---|---|---|
| Frontend hosting | **Vercel** / **Netlify** (free tier) | Both serve static/SSR content via global CDN edge networks — low latency worldwide by default |
| Backend hosting | **Render**, **Railway**, **Fly.io** free tiers | Choose a region close to your primary user base (e.g., Mumbai/Singapore for India) to minimize round-trip time; note some free tiers "sleep" on inactivity, adding a one-time cold-start delay — mitigate with a free uptime-pinger |
| Database | **Supabase** / **Neon** free tier | Pick the same region as your backend host to avoid cross-region DB latency |
| Cache | **Upstash Redis** free tier | Choose a region co-located with backend for sub-10ms cache round-trips |
| LLM inference | **Groq free tier** (very low-latency inference on custom hardware, open models like Llama 3/Mixtral), **Google AI Studio (Gemini) free tier**, or **Hugging Face free Inference API** — no local/self-hosted LLM | Groq in particular is noted for exceptionally fast token-generation speed among free hosted options, avoiding the need to run and maintain your own model server |
| Maps | **MapLibre GL JS** + **MapTiler free tier** (or `demotiles.maplibre.org` for zero-key dev) + **Cobe** for the decorative hero globe | Vector tiles streamed on demand; Cobe is a pure canvas/WebGL render with no tile dependency at all |
| Weather data | **Open-Meteo**, **IMD open data**, **NOAA NOMADS** | Always cache responses — these are third-party services outside your control for latency |
| Notifications | **Web Push (VAPID)** | Delivery latency depends on the browser's push service (Google/Mozilla/Apple push servers) — typically near-instant (sub-second) once dispatched |
| Voice — STT | **Whisper** (self-hosted, free) | No network round-trip to a third-party STT service; streams partial transcripts |
| Voice — TTS | **Rime API** — **the one paid component in this stack** | Streamed audio for low perceived latency; must be rate-limited per user/session to bound cost. Free self-hosted fallback (Coqui TTS/eSpeak-NG) kept for degrade-gracefully behavior if Rime is unavailable or a user's quota is exhausted |

---

## 10. Non-Functional Requirements (Latency Targets)

| Category | Requirement / Target |
|---|---|
| Perceived UI response | < 100ms for any button press/tap feedback (instant visual acknowledgment, even before server responds) |
| First token of chat response | < 1–2s (streamed), rather than waiting for a complete answer |
| Cached weather query | < 50ms server-side (Redis hit) |
| Uncached weather query (cache miss) | < 1s (external API + cache population) |
| Chat-driven globe fly-to (location resolved → animation starts) | < 1s from entity resolution to client receiving `{lat, lon, zoom}` |
| Voice STT first partial transcript | < 500ms from start of speech |
| Voice TTS first audio chunk | < 1–2s from text ready (mirrors the first-token chat target) |
| Alert dispatch (ingest → user push) | < 5s end-to-end target |
| Page load (repeat visit, PWA cached) | < 1s Time-to-Interactive |
| Page load (first visit, 3G) | < 3s Time-to-Interactive (Lighthouse budget-enforced) |
| Database query (indexed lookup) | < 20ms |
| Scalability | Latency targets above must hold up to the documented concurrent-user load; auto-scaling triggers before targets are breached |
| Availability | 99.5% uptime target; best-effort on free tiers for pilot phase |
| Security | HTTPS everywhere, encryption at rest, RBAC, OWASP compliance — implemented without adding unnecessary round-trips (e.g., stateless JWT over per-request DB session lookups) |
| Accessibility | WCAG 2.1 AA, voice-first flows, offline caching for poor connectivity |
| Cost | Zero licensing cost target for MVP, except the deliberately scoped/rate-limited Rime TTS spend |

> **Honesty note:** These are *targets*, not guarantees of literal zero latency. Real-world factors (user's own network quality, device performance, third-party API outages) can affect actual numbers. The architecture above is designed to make WeatherGPT's own overhead as close to zero as possible, so that whatever delay remains is dominated by the user's network conditions — not by the app itself.

---

## 11. Technology Stack — Free/Open-Source First, Latency-Optimized

| Layer | Primary Technology | Latency role | Paid Alternative (only if scaling demands it) |
|---|---|---|---|
| Web Frontend | React.js / Next.js, Tailwind CSS, PWA | SSG/ISR, service-worker precache, streaming UI | — |
| Backend API | Python, FastAPI (async) | Non-blocking I/O, connection pooling | — |
| LLM | **Groq free tier** (Llama 3/Mixtral) or **Google AI Studio (Gemini) free tier** — hosted, no local/self-hosted LLM | Streamed token generation; Groq notably fast inference hardware | OpenAI GPT-4-class API (paid, but not necessarily faster) |
| Globe / Maps | **Cobe** (decorative hero globe, free) + **MapLibre GL JS** with `globe` projection (functional search/fly-to/pin, free) + MapTiler/OSM tiles | Cobe eager-loaded (5KB); MapLibre lazy-loaded on first use; tile prefetching, vector tiles for fast rendering | Mapbox GL JS / Google Maps (not needed — MapLibre covers this at zero cost) |
| Weather data | Open-Meteo, IMD open data, NOAA NOMADS | Cached aggressively behind Redis | Paid low-latency commercial weather APIs |
| Translation | Bhashini, IndicTrans2, LibreTranslate | Build-time pre-translation for static strings | Google Cloud Translation API |
| Voice STT | **Whisper** (self-hosted, free) | Streaming partial transcripts | Paid cloud STT |
| Voice TTS | **Rime API (paid — deliberate, rate-limited)**, free self-hosted **Coqui TTS/eSpeak-NG** as fallback | Streamed audio chunks for low perceived latency | N/A — Rime already is the "premium" choice here |
| Real-time messaging | Mosquitto (MQTT), WebSocket, Web Push | Event-driven, no polling delay | AWS IoT Core |
| Database | PostgreSQL + PostGIS + TimescaleDB (pgvector deferred — see Section 8.3) | Indexes, continuous aggregates | Managed RDS/Aurora with read replicas |
| Cache | Redis (self-hosted) or Upstash free tier | Sub-millisecond hot-path reads | ElastiCache |
| CDN/Edge | Vercel/Netlify/Cloudflare free tier | Edge-served static + cacheable API responses | CloudFront (paid at scale) |
| Backend hosting | Render / Railway / Fly.io free tier | Co-located region with DB | AWS ECS Fargate / EKS |
| Containerization | Docker, Docker Compose | Fast, consistent cold-start images | — |
| CI/CD | GitHub Actions | Lighthouse/Locust latency gates | — |
| Monitoring | Grafana + Prometheus | Real-time P50/P95/P99 latency dashboards, plus Rime usage/spend tracking | Datadog / New Relic |
| TLS/SSL | Let's Encrypt (HTTP/2 or HTTP/3) | Faster connection setup, especially HTTP/3/QUIC | — |

---

## 12. Milestones & Timeline (Indicative — 12 Weeks)

| Phase | Weeks | Deliverables |
|---|---|---|
| Phase 0 — Setup | W1 | Repo, architecture finalized (with caching/streaming design decided upfront), Docker Compose local env, DB schema v1 with indexes planned |
| Phase 1 — Core Backend | W2–4 | Auth, cached weather-data aggregator, streaming chat/NLU endpoint using a hosted free-tier LLM API (Groq/Gemini) |
| Phase 2 — Core Web Frontend | W3–5 | Next.js app scaffolding with SSG/service-worker precache; streaming chat UI with chat trigger button; home dashboard with stale-while-revalidate pattern; Cobe hero globe |
| Phase 3 — Globe, Alerts & Multilingual | W6–8 | MapLibre GL JS functional fly-to globe + Globe Fly-To Orchestrator wired to chat; event-driven Web Push alert pipeline (< 5s target); multilingual layer with build-time pre-translation; streaming voice pipeline (Whisper STT + Rime TTS with free fallback) |
| Phase 4 — Advisory & Analytics | W8–9 | Sector advisory pages (cached), climate trend dashboard on precomputed aggregates |
| Phase 5 — Performance Hardening | W10–11 | Load testing (Locust) against latency targets, Lighthouse CI performance budgets, CDN/region co-location tuning, Rime usage/cost monitoring in place, deploy on free-tier stack |
| Phase 6 — Pilot & Demo | W12 | UAT with sample users, latency benchmark report (P50/P95/P99 across features including voice), documentation |

---

## 13. Evaluation Metrics (Mapped to Given Parameters)

| Parameter | Metric |
|---|---|
| Accuracy & relevance | % of correctly resolved intents; forecast accuracy vs IMD ground truth |
| Response latency | **P50/P95/P99 latency measured per feature** — chat first-token, cached weather query, globe fly-to time, voice STT/TTS latency, alert dispatch time, page load time — each against the targets in Section 10 |
| Multilingual capability | # languages supported; translation accuracy (BLEU/human eval) |
| User interface & accessibility | Lighthouse score (Performance/Accessibility/PWA) with an enforced performance budget |
| Scalability | Load test results showing latency targets hold under increasing concurrent users, up to a documented breaking point |
| Integration | # of live meteorological sources integrated, all free/open |
| Cost efficiency | Total infra spend during pilot phase (target: ₹0 except metered/capped Rime TTS usage) |

---

## 14. Risks & Mitigations (Including Latency-Specific Risks)

| Risk | Mitigation |
|---|---|
| Free-tier backend "sleeps" on inactivity, causing a slow first request | Free uptime-ping service (e.g., cron-job.org) to keep the instance warm; clearly communicate expected cold-start delay during demos |
| Free-tier LLM inference may queue requests under load, adding latency | Use a fast hosted free-tier provider (e.g., Groq, built for low-latency inference) for time-critical intent classification; reserve slower/larger hosted models for non-urgent, detailed answers; add a second free-tier provider as fallback if one is rate-limited |
| Third-party weather API latency/outage is outside your control | Always serve from Redis cache first; degrade gracefully to "last known data" banner rather than blocking the UI |
| Free weather/climate data sources may have coarser update frequency | Combine multiple free sources for cross-validation; document latency/freshness limits transparently to users |
| Cross-region hosting (frontend on Vercel, backend elsewhere) adds hops | Deploy backend and database in the same region; use CDN only for static/cacheable content, not for personalized dynamic queries |
| AWS Free Tier expires after 12 months / has usage caps | Prefer free-forever platforms (Vercel, Render, Supabase, Upstash) for long-running pilots |
| Running WRF is compute-intensive and inherently high-latency | MVP consumes pre-computed model output rather than running WRF in-app |
| LLM hallucination on forecast numbers | Route factual/numeric answers through the structured, cached data service — this is also faster than generating numbers via LLM, and is why RAG is not needed for these queries |
| **Web Push may not reach the users who need alerts most** — the farmer/fisherman personas are specifically low-connectivity, and Web Push requires an installed, subscribed PWA with an active network connection at dispatch time | **Unresolved as of v1.4** — in-app banner + free-tier transactional email are a partial fallback, but neither is a reliable disaster-response channel for this persona set. Recommend evaluating a low-cost SMS/USSD channel specifically for P0 (cyclone/flood/heatwave) alerts before Phase 3 sign-off, even though general SMS gateways remain out of scope |
| **Rime (paid TTS) usage could exceed budget if unmetered** | Per-user/session rate limit enforced at the API gateway (BE-8, DEP-5/6); free self-hosted TTS fallback when a user's quota is hit or Rime is unavailable, so voice degrades rather than breaking or silently overspending |
| Over-aggressive caching serves stale data during a fast-changing emergency | Use very short TTLs (or immediate invalidation) specifically for alert/warning data, while longer TTLs remain fine for routine forecasts |
| Web Push not supported on all browsers (e.g., older iOS Safari) | In-app alert banner + free-tier transactional email fallback |

---

## 15. Detailed Free Data Source & API Reference

| Purpose | Free Resource | Access notes |
|---|---|---|
| Current weather & forecast | **Open-Meteo** (open-meteo.com) | No API key required; cache responses to avoid depending on their live latency for every request |
| Indian met data | **IMD Open Data / data.gov.in** | Free government open-data portal |
| Global NWP model output (GFS) | **NOAA NOMADS** | Free public GRIB2/NetCDF downloads; parse once on ingestion, store parsed results |
| Reanalysis/historical climate | **Copernicus ERA5** | Free with a Copernicus Climate Data Store account |
| Historical solar/climate parameters | **NASA POWER** | Free API, no key required |
| Disaster/alert bulletins | **NDMA / IMD warning bulletins** | Public government advisories; treated as highest-priority, lowest-cache-TTL data |
| Globe/map tiles | **MapTiler Cloud free tier**, or **OpenStreetMap** via **MapLibre GL JS** (`demotiles.maplibre.org` for no-key dev) | Free tile usage; vector tiles streamed on demand; prefetch likely tiles for smoother panning |
| Machine translation (Indian languages) | **Bhashini** (bhashini.gov.in) | Free Government of India API |
| Open-source translation fallback | **LibreTranslate**, **IndicTrans2** | Fully free, self-hostable, avoids external API latency entirely when self-hosted |
| Speech-to-text | **OpenAI Whisper** (open-source weights) | Free, self-hosted — avoids network round-trip to a third-party STT service |
| Text-to-speech | **Rime** (paid API, primary — chosen for voice quality/latency) with **Coqui TTS / eSpeak-NG** (free, self-hosted) as fallback | Rime is the one deliberately paid dependency in this PRD; usage must be rate-limited per user. Free fallback keeps voice output alive if Rime is unavailable or a quota is hit |
| LLM inference | **Groq free tier**, **Google AI Studio (Gemini) free tier**, **Hugging Face free Inference API** — hosted only, no local/self-hosted LLM | Groq is notable among hosted free options for very fast, low-latency inference without needing to run or maintain your own model server |

---

## 16. Open Questions / Assumptions

- Assumed the project will rely entirely on hosted free-tier LLM APIs (Groq, Google AI Studio/Gemini, Hugging Face Inference API) rather than running any local/self-hosted model — to confirm which provider's free-tier rate limits best fit expected pilot traffic, and **the two-provider fallback (Groq primary/Gemini fallback) is still an assumption, not yet a built task** — needs to actually land in the BE-4 implementation, not stay a plan.
- Assumed free-tier hosting regions can be chosen close to the primary user base (India) to minimize network latency; to confirm which free-tier providers offer an India/Asia region.
- Assumed a short-TTL or invalidate-on-write caching strategy is acceptable for alert data (prioritizing freshness) while longer TTLs are fine for routine forecast data (prioritizing speed).
- Confirm target concurrent user load and acceptable cold-start latency for demo purposes, to decide whether a paid "always-on" tier is worth it just for the demo window.
- Confirm whether MeghRaj (Government of India's NIC cloud) offers an India-region free hosting option, which would likely offer the lowest latency for an India-focused user base, and whether it's a data-residency requirement rather than just a latency optimization for a MoES-facing product.
- **RAG deferred from MVP (see Changelog/BE-5)** — confirm there's no near-term requirement for grounded, citable explanatory climate Q&A before ruling it out entirely for Phase 2; if IMD needs answers traceable to specific bulletins/documents, that would bring RAG back into scope sooner.
- **Rime's actual free-trial/credit limits and per-request cost are unconfirmed** — need real numbers before setting the per-user daily voice quota (BE-8/DEP-5) so the cap is meaningful rather than arbitrary.
- **SMS/USSD fallback for P0 disaster alerts is not yet scoped** — given the farmer/fisherman personas' connectivity profile and that Web Push requires an installed, online PWA, confirm whether a narrowly-scoped (P0-alerts-only) low-cost SMS channel should re-enter MVP scope rather than staying fully out-of-scope.
- **No formal data-privacy/compliance section exists yet** for a product handling citizen geolocation and auth data on behalf of a government ministry — confirm whether India's DPDP Act 2023 or MoES-specific data-residency requirements impose constraints beyond what's currently in Section 10's "Security" row.

---

*This PRD is built around two principles: **cost discipline** — free/open-source wherever it suffices, with paid exceptions deliberately scoped and cost-guarded (Rime TTS) — and **as-close-to-zero-latency-as-physically-possible** through caching, streaming, precomputation, and edge delivery at every layer. Absolute zero latency is not achievable on any real system, but the architecture above is designed so remaining delay is dominated by the user's own network — not by WeatherGPT's own processing.*
