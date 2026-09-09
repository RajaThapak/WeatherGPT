# Product Requirements Document (PRD)
## WeatherGPT — Conversational AI for Weather Forecasting, Alerts & Climate Information

**Prepared for:** Ministry of Earth Sciences (MoES) / India Meteorological Department (IMD)
**Domain:** Software — Disaster Management
**Platform:** Web Application (responsive, PWA-enabled)
**Cost Approach:** 100% free/open-source software; free-tier cloud resources wherever possible
**Performance Approach:** Near-instant, perceptibly-zero-latency interaction wherever technically achievable
**Version:** 1.3
**Date:** September 2026

> **A note on "zero latency":** Network round-trips and computation always take some non-zero time — true zero latency is not physically possible on any system. What this PRD instead targets is **imperceptible latency**: interactions that *feel* instant to the user (sub-100ms UI feedback, streamed answers, precomputed/cached data) even though a few milliseconds of real transmission time always exist underneath. Every section below is built around minimizing that real latency as close to zero as engineering allows.

---

## 1. Executive Summary

WeatherGPT is a **web-based** conversational AI platform that lets citizens, farmers, disaster managers, aviation/marine operators, and researchers query weather, climate, and disaster-warning information in natural language (text + voice), in multiple Indian languages, from any browser — no app install required. It integrates live meteorological data (IMD open data, GFS/WRF model output, satellite feeds) behind an LLM-based query engine, and pushes proactive alerts for extreme weather events via free web push notifications.

Two design principles anchor this PRD:
1. **Cost-zero buildability** — every component can be built and run on free/open-source software and free-tier infrastructure.
2. **Near-zero perceived latency** — every layer (network, backend, database, LLM, frontend) is engineered to respond as close to instantly as possible, using caching, precomputation, streaming, and edge delivery.

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
| G4 | Support multiple Indian languages (text + voice) for rural accessibility using free translation/ASR/TTS models |
| G5 | Provide sector-specific advisories: agriculture, aviation, marine, urban planning |
| G6 | Offer historical/climate trend analytics for researchers using free open climate datasets |
| G7 | Ensure the platform works well on low-end devices/browsers with poor connectivity (PWA, offline caching, degrade gracefully rather than freeze) |
| G8 | Build and deploy the entire system using free/open-source software and free-tier infrastructure |
| G9 | Minimize end-to-end latency at every layer so the app feels instant even under load or on weak networks |

## 4. Target Users / Personas

1. **Farmer (Ramesh, Meerut)** — needs crop-specific weather advisory in Hindi, voice input, on a low-cost phone with patchy network; the app must respond instantly from cache even if the network is momentarily slow.
2. **Fisherman (coastal Odisha)** — needs cyclone/marine alerts pushed the instant a bulletin is issued — delay here is a safety risk.
3. **Pilot / ATC staff** — needs METAR/TAF-style briefings with zero perceptible lag on a desktop dashboard.
4. **District Disaster Management Officer** — needs to publish an alert and have it reach subscribed citizens within seconds.
5. **Researcher / Student** — needs historical climate trend queries to render instantly from precomputed aggregates rather than live recomputation.
6. **Urban citizen** — needs daily forecast, air quality, commute-relevant alerts, expecting an app-like instant feel.

## 5. Scope

### In Scope (MVP → V1)
- **Responsive web application** (desktop + mobile browser), installable as a **Progressive Web App (PWA)**, with app-shell precaching for instant load.
- Text/voice query understanding via a **hosted free-tier LLM API** (no local/self-hosted model), with **streamed token-by-token responses** so the user sees output within milliseconds rather than waiting for a full answer.
- Real-time current weather + 7-day forecast via **free/open weather APIs**, served from a **hot cache** for near-instant repeat queries.
- Web push notifications for severe weather alerts, dispatched via a **low-latency pub-sub pipeline**.
- Multilingual support: Hindi, English + 3 regional languages in MVP.
- Location-based advisory (browser geolocation, cached per-session to avoid repeat permission/lookup delay).
- Basic climate trend charts, backed by **precomputed aggregate tables** (not on-the-fly heavy queries).
- Admin web dashboard for alert publishing.

### Out of Scope (Future Phases)
- Full WRF model execution/hosting (compute-heavy, inherently high-latency) — MVP consumes pre-generated model output.
- Full WIS 2.0 node implementation.
- Native Android/iOS apps (Phase 2).
- Full 22-language coverage (phased rollout).
- Paid, high-volume SMS/voice-call gateways.

## 6. Key Features (Mapped to Requirements)

| # | Feature | Priority | Free-resource note | Latency approach |
|---|---|---|---|---|
| 1 | Real-time weather retrieval | P0 | Open-Meteo / IMD open data | Redis cache (sub-5ms reads) with short TTL refreshed in background |
| 2 | NL query understanding (web chat) | P0 | Hosted free-tier LLM API (no local LLM) | Streaming responses (Server-Sent Events/WebSocket) so first token appears almost immediately |
| 3 | NWP model data integration (GFS/WRF output) | P1 | NOAA/NOMADS, NCMRWF | Pre-parsed into Postgres on ingestion, never parsed live per-request |
| 4 | Extreme weather alerts & web push notifications | P0 | Web Push is free | Event-driven push (no polling delay) — alert dispatched the instant it's ingested |
| 5 | Location-based forecast/advisory | P0 | Browser Geolocation API | Cached client-side per session; geo-index (PostGIS GiST index) for instant lookup |
| 6 | Multilingual (Indian languages) | P0 | Bhashini, IndicTrans2, LibreTranslate | Pre-translate common phrases/UI strings at build time; only free-form text goes through live translation |
| 7 | Climate trend/historical analysis | P1 | NASA POWER, IMD, ERA5 | Precomputed materialized views/aggregates refreshed on a schedule, not computed per query |
| 8 | Voice interaction | P1 | Whisper, Coqui TTS | Streamed STT (partial transcript as user speaks) and streamed TTS playback |
| 9 | Installable PWA / offline-lite mode | P1 | Free browser standard | Service-worker app-shell caching for instant repeat loads, even offline |

---

## 7. System Architecture (High Level, Latency-Optimized)

```
                        ┌─────────────────────────────┐
                        │   Web Application (React/    │
                        │   Next.js) — PWA, Responsive  │
                        │  Chat UI | Voice | Maps       │
                        │  ★ Service Worker precache     │
                        │  ★ Optimistic UI + skeletons   │
                        └──────────────┬───────────────┘
                                       │ HTTP/2 or HTTP/3 (QUIC), WebSocket/SSE for streaming
                        ┌──────────────▼───────────────┐
                        │      CDN / Edge Cache          │
                        │  (static assets, cached API    │
                        │   responses at edge locations)  │
                        └──────────────┬───────────────┘
                        ┌──────────────▼───────────────┐
                        │    API Gateway (FastAPI)      │
                        │  Auth | Rate limit | i18n      │
                        │  ★ Async I/O, connection pool  │
                        └──────────────┬───────────────┘
              ┌────────────────────────┼────────────────────────┐
   ┌──────────▼─────────┐  ┌──────────▼─────────┐    ┌──────────▼─────────┐
   │ NLU/LLM Service     │  │ Weather Data        │    │ Alert Dissemination │
   │ ★ token streaming    │  │ Aggregator Service  │    │ Service              │
   │ ★ fast hosted free-  │  │ ★ Redis hot cache    │    │ ★ event-driven push  │
   │   tier LLM API        │  │ ★ background refresh │    │   (no polling delay) │
   └──────────┬──────────┘  └──────────┬──────────┘    └──────────┬─────────┘
              │                        │                          │
              │              ┌─────────▼─────────┐                │
              │              │ Free/Open Data APIs │                │
              │              │ IMD / GFS (NOMADS) / │                │
              │              │ Open-Meteo / ERA5     │                │
              │              └─────────┬─────────┘                │
              │                        │                          │
       ┌──────▼────────────────────────▼──────────────────────────▼───────┐
       │     PostgreSQL + PostGIS + TimescaleDB + pgvector                │
       │  ★ indexed geo/time lookups  ★ materialized views for analytics  │
       │  ★ read replicas for hot read paths (scale-up option)            │
       └───────────────────────────────────────────────────────────────┘
```

**Latency design principles embedded above (★ marks):**
- **Cache first, compute second** — nearly every read path checks Redis/edge cache before hitting the database or an external API.
- **Stream, don't wait** — LLM tokens, STT transcripts, and TTS audio are all streamed incrementally rather than returned as one blocking response.
- **Precompute, don't recompute** — heavy aggregates (climate trends, GFS/WRF parsing) are done once on ingestion, not per user request.
- **Push, don't poll** — alerts move through an event-driven pipeline (MQTT/WebSocket/Web Push) so there is no polling interval adding delay.
- **Edge delivery** — static assets and cacheable API responses are served from CDN edge nodes physically closer to the user.
- **Optimistic UI** — the frontend shows an immediate response (e.g., "Fetching latest data…" skeleton, last cached value) while the real answer streams in, so the user never sees a blank/frozen screen.

---

## 8. Task-Wise Breakdown

### 8.1 Backend (Python / FastAPI — free/open-source, latency-optimized)

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| BE-1 | Project scaffolding | FastAPI (async), Uvicorn/Gunicorn with multiple workers | Fully async request handling; connection pooling (asyncpg) to avoid blocking I/O |
| BE-2 | Auth service | JWT-based auth, OTP/email login | Stateless JWT verification (no DB round-trip per request); session data cached in Redis |
| BE-3 | Weather data aggregator | Open-Meteo/IMD/NOMADS connectors | **Redis cache** (TTL 5–10 min) in front of every external call; background refresh job updates cache before it expires so users never wait on a live external API call |
| BE-4 | NLU/LLM query engine | Intent + entity extraction, streamed answer | No local/self-hosted LLM — use a **fast hosted free-tier LLM API** (e.g., **Groq free tier**, which runs open models like Llama 3/Mixtral on custom low-latency inference hardware, or **Google AI Studio Gemini free tier**) for both intent classification and generation, streaming the response token-by-token via SSE/WebSocket so the user starts reading immediately |
| BE-5 | RAG layer for climate Q&A | pgvector similarity search | HNSW/IVF-Flat index on pgvector for millisecond-scale nearest-neighbor search instead of full table scans |
| BE-6 | Alerts service | Geo-match + push | Event-driven architecture (pub/sub via MQTT) triggers push the moment a bulletin lands — no polling loop delay |
| BE-7 | Multilingual layer | Translation | Pre-translate static UI strings at build time (zero runtime cost); only dynamic chat text is translated live, cached by phrase-hash to avoid re-translating repeats |
| BE-8 | Voice pipeline | STT/TTS | Streaming Whisper inference (partial transcripts) and streaming TTS chunks sent as they're generated, not after full synthesis |
| BE-9 | Advisory generation | Rule engine + LLM | Cache generated advisories per location+date key; only regenerate when underlying data changes |
| BE-10 | Climate analytics API | Historical trend queries | Served from **precomputed materialized views** refreshed nightly, not computed live from raw observations |
| BE-11 | Admin API | Alert publishing | Direct write-through to cache + DB in the same transaction so subsequent reads are instantly consistent |
| BE-12 | API docs & testing | OpenAPI/Swagger, Pytest, Locust | Locust load tests specifically measure P50/P95/P99 latency under concurrent load, with a `<300ms API` and `<3s first-token LLM` target |

### 8.2 Frontend (Web Application — React.js / Next.js, latency-optimized)

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| FE-1 | App scaffolding | Next.js, Tailwind CSS | Static generation (SSG) for non-personalized pages; code-splitting so only needed JS loads per route |
| FE-2 | Onboarding & auth pages | Login/OTP, language, geolocation | Geolocation result cached in browser storage per session to avoid repeat permission-prompt delay |
| FE-3 | Chat interface | Chat UI, streaming display | Renders LLM tokens as they arrive (typewriter effect) instead of waiting for the full response |
| FE-4 | Voice interaction UI | Mic capture | Streams audio chunks to backend as spoken, rather than waiting for the user to finish before upload |
| FE-5 | Home dashboard | Weather cards, forecast strip | Shows last-cached data instantly on load, then silently refreshes in the background ("stale-while-revalidate" pattern) |
| FE-6 | Map/location view | Leaflet + OSM tiles | Tile prefetching for likely-viewed areas; vector tiles where possible for faster rendering than raster |
| FE-7 | Climate analytics dashboard | Charts | Chart data fetched from precomputed aggregate endpoints, not raw time-series, for instant rendering |
| FE-8 | Alerts & notifications | Web Push | Service worker pushes notification the instant the payload arrives — no in-app polling |
| FE-9 | Sector advisory pages | Advisory views | Cached per location, revalidated in background |
| FE-10 | PWA & offline support | Service worker | App-shell (HTML/CSS/JS) precached so the app loads instantly on repeat visits, even before network responds |
| FE-11 | Accessibility | WCAG 2.1 AA | Lighthouse performance budget enforced (e.g., Time-to-Interactive target < 2s on 3G) alongside accessibility checks |
| FE-12 | Admin dashboard | Alert publishing UI | Optimistic UI update (alert shown as "sent" immediately, reconciled with server confirmation) |
| FE-13 | QA & release | Cross-browser + performance testing | **Lighthouse CI** performance budget gates in the CI/CD pipeline — a build that regresses latency beyond budget fails the build |

### 8.3 Database (PostgreSQL — latency-optimized)

| Task ID | Task | Details | Latency technique |
|---|---|---|---|
| DB-1 | Schema design | Core tables | Designed with query access patterns in mind up front (avoid N+1 queries) |
| DB-2 | Extensions setup | postgis, timescaledb, pgvector | TimescaleDB automatically optimizes time-range queries via chunk exclusion; pgvector HNSW index for fast similarity search |
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
| DEP-5 | Secrets & config | Env-based config | No impact on runtime latency (build-time only) |
| DEP-6 | Monitoring & logging | Grafana + Prometheus | Real-time latency dashboards (P50/P95/P99) with alerting if response times exceed target thresholds |
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
| Maps | **OpenStreetMap + Leaflet.js** | Use a nearby free tile CDN mirror where available |
| Weather data | **Open-Meteo**, **IMD open data**, **NOAA NOMADS** | Always cache responses — these are third-party services outside your control for latency |
| Notifications | **Web Push (VAPID)** | Delivery latency depends on the browser's push service (Google/Mozilla/Apple push servers) — typically near-instant (sub-second) once dispatched |

---

## 10. Non-Functional Requirements (Latency Targets)

| Category | Requirement / Target |
|---|---|
| Perceived UI response | < 100ms for any button press/tap feedback (instant visual acknowledgment, even before server responds) |
| First token of chat response | < 1–2s (streamed), rather than waiting for a complete answer |
| Cached weather query | < 50ms server-side (Redis hit) |
| Uncached weather query (cache miss) | < 1s (external API + cache population) |
| Alert dispatch (ingest → user push) | < 5s end-to-end target |
| Page load (repeat visit, PWA cached) | < 1s Time-to-Interactive |
| Page load (first visit, 3G) | < 3s Time-to-Interactive (Lighthouse budget-enforced) |
| Database query (indexed lookup) | < 20ms |
| Scalability | Latency targets above must hold up to the documented concurrent-user load; auto-scaling triggers before targets are breached |
| Availability | 99.5% uptime target; best-effort on free tiers for pilot phase |
| Security | HTTPS everywhere, encryption at rest, RBAC, OWASP compliance — implemented without adding unnecessary round-trips (e.g., stateless JWT over per-request DB session lookups) |
| Accessibility | WCAG 2.1 AA, voice-first flows, offline caching for poor connectivity |
| Cost | Zero licensing cost target for MVP |

> **Honesty note:** These are *targets*, not guarantees of literal zero latency. Real-world factors (user's own network quality, device performance, third-party API outages) can affect actual numbers. The architecture above is designed to make WeatherGPT's own overhead as close to zero as possible, so that whatever delay remains is dominated by the user's network conditions — not by the app itself.

---

## 11. Technology Stack — Free/Open-Source First, Latency-Optimized

| Layer | Primary (Free) Technology | Latency role | Paid Alternative (only if scaling demands it) |
|---|---|---|---|
| Web Frontend | React.js / Next.js, Tailwind CSS, PWA | SSG/ISR, service-worker precache, streaming UI | — |
| Backend API | Python, FastAPI (async) | Non-blocking I/O, connection pooling | — |
| LLM | **Groq free tier** (Llama 3/Mixtral on fast hosted inference hardware) or **Google AI Studio (Gemini) free tier** — hosted, no local/self-hosted LLM | Streamed token generation; Groq notably fast inference hardware | OpenAI GPT-4-class API (paid, but not necessarily faster) |
| Maps | Leaflet.js + OpenStreetMap | Tile prefetching, vector tiles | Mapbox / Google Maps |
| Weather data | Open-Meteo, IMD open data, NOAA NOMADS | Cached aggressively behind Redis | Paid low-latency commercial weather APIs |
| Translation | Bhashini, IndicTrans2, LibreTranslate | Build-time pre-translation for static strings | Google Cloud Translation API |
| Voice STT/TTS | Whisper, Coqui TTS, eSpeak-NG | Streaming partial transcripts/audio | Paid cloud STT/TTS |
| Real-time messaging | Mosquitto (MQTT), WebSocket, Web Push | Event-driven, no polling delay | AWS IoT Core |
| Database | PostgreSQL + PostGIS + TimescaleDB + pgvector | Indexes, continuous aggregates, HNSW vector index | Managed RDS/Aurora with read replicas |
| Cache | Redis (self-hosted) or Upstash free tier | Sub-millisecond hot-path reads | ElastiCache |
| CDN/Edge | Vercel/Netlify/Cloudflare free tier | Edge-served static + cacheable API responses | CloudFront (paid at scale) |
| Backend hosting | Render / Railway / Fly.io free tier | Co-located region with DB | AWS ECS Fargate / EKS |
| Containerization | Docker, Docker Compose | Fast, consistent cold-start images | — |
| CI/CD | GitHub Actions | Lighthouse/Locust latency gates | — |
| Monitoring | Grafana + Prometheus | Real-time P50/P95/P99 latency dashboards | Datadog / New Relic |
| TLS/SSL | Let's Encrypt (HTTP/2 or HTTP/3) | Faster connection setup, especially HTTP/3/QUIC | — |

---

## 12. Milestones & Timeline (Indicative — 12 Weeks)

| Phase | Weeks | Deliverables |
|---|---|---|
| Phase 0 — Setup | W1 | Repo, architecture finalized (with caching/streaming design decided upfront), Docker Compose local env, DB schema v1 with indexes planned |
| Phase 1 — Core Backend | W2–4 | Auth, cached weather-data aggregator, streaming chat/NLU endpoint using a hosted free-tier LLM API (Groq/Gemini) |
| Phase 2 — Core Web Frontend | W3–5 | Next.js app scaffolding with SSG/service-worker precache, streaming chat UI, home dashboard with stale-while-revalidate pattern |
| Phase 3 — Alerts & Multilingual | W6–8 | Event-driven Web Push alert pipeline (< 5s target), multilingual layer with build-time pre-translation, streaming voice pipeline |
| Phase 4 — Advisory & Analytics | W8–9 | Sector advisory pages (cached), climate trend dashboard on precomputed aggregates |
| Phase 5 — Performance Hardening | W10–11 | Load testing (Locust) against latency targets, Lighthouse CI performance budgets, CDN/region co-location tuning, deploy on free-tier stack |
| Phase 6 — Pilot & Demo | W12 | UAT with sample users, latency benchmark report (P50/P95/P99 across features), documentation |

---

## 13. Evaluation Metrics (Mapped to Given Parameters)

| Parameter | Metric |
|---|---|
| Accuracy & relevance | % of correctly resolved intents; forecast accuracy vs IMD ground truth |
| Response latency | **P50/P95/P99 latency measured per feature** — chat first-token, cached weather query, alert dispatch time, page load time — each against the targets in Section 10 |
| Multilingual capability | # languages supported; translation accuracy (BLEU/human eval) |
| User interface & accessibility | Lighthouse score (Performance/Accessibility/PWA) with an enforced performance budget |
| Scalability | Load test results showing latency targets hold under increasing concurrent users, up to a documented breaking point |
| Integration | # of live meteorological sources integrated, all free/open |
| Cost efficiency | Total infra spend during pilot phase (target: ₹0, using only free tiers) |

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
| LLM hallucination on forecast numbers | Route factual/numeric answers through the structured, cached data service — this is also faster than generating numbers via LLM |
| Web Push not supported on all browsers (e.g., older iOS Safari) | In-app alert banner + free-tier transactional email fallback |
| Over-aggressive caching serves stale data during a fast-changing emergency | Use very short TTLs (or immediate invalidation) specifically for alert/warning data, while longer TTLs remain fine for routine forecasts |

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
| Maps & tiles | **OpenStreetMap** via **Leaflet.js** | Free tile usage; prefetch likely tiles for smoother panning |
| Machine translation (Indian languages) | **Bhashini** (bhashini.gov.in) | Free Government of India API |
| Open-source translation fallback | **LibreTranslate**, **IndicTrans2** | Fully free, self-hostable, avoids external API latency entirely when self-hosted |
| Speech-to-text | **OpenAI Whisper** (open-source weights) | Free, self-hosted — avoids network round-trip to a third-party STT service |
| Text-to-speech | **Coqui TTS**, **eSpeak-NG** | Free, self-hosted |
| LLM inference | **Groq free tier**, **Google AI Studio (Gemini) free tier**, **Hugging Face free Inference API** — hosted only, no local/self-hosted LLM | Groq is notable among hosted free options for very fast, low-latency inference without needing to run or maintain your own model server |

---

## 16. Open Questions / Assumptions

- Assumed the project will rely entirely on hosted free-tier LLM APIs (Groq, Google AI Studio/Gemini, Hugging Face Inference API) rather than running any local/self-hosted model — to confirm which provider's free-tier rate limits best fit expected pilot traffic, and whether a second provider should be wired in as an automatic fallback.
- Assumed free-tier hosting regions can be chosen close to the primary user base (India) to minimize network latency; to confirm which free-tier providers offer an India/Asia region.
- Assumed a short-TTL or invalidate-on-write caching strategy is acceptable for alert data (prioritizing freshness) while longer TTLs are fine for routine forecast data (prioritizing speed).
- Confirm target concurrent user load and acceptable cold-start latency for demo purposes, to decide whether a paid "always-on" tier is worth it just for the demo window.
- Confirm whether MeghRaj (Government of India's NIC cloud) offers an India-region free hosting option, which would likely offer the lowest latency for an India-focused user base.

---

*This PRD is built around two principles: **zero-cost** wherever free/open-source tools suffice, and **as-close-to-zero-latency-as-physically-possible** through caching, streaming, precomputation, and edge delivery at every layer. Absolute zero latency is not achievable on any real system, but the architecture above is designed so remaining delay is dominated by the user's own network — not by WeatherGPT's own processing.*
