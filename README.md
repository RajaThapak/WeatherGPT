# WeatherGPT

A conversational weather assistant for India — ask about the weather in plain language (typed or spoken, in English or Hindi), get real forecasts, real severe-weather alerts from IMD, and voice replies, all backed by live data rather than canned responses.

## What it does

- **Conversational weather Q&A** — ask about any place by name ("what's the weather in Chennai"), compare multiple cities in one question ("compare Mumbai and Delhi", "compare this location and Haryana"), or ask how current conditions compare to the same time last year, all answered from real fetched data, never invented numbers.
- **Voice in and out** — speak your question and hear the answer read back, with speech synthesis starting on the first sentence as soon as it's ready rather than waiting for the whole reply, and the displayed text staying in sync with what's actually being spoken.
- **Real severe-weather alerts** — polls IMD's official public CAP alert feed, matches each alert's real geographic polygon against a user's exact location via PostGIS (not just district-level), and delivers by Web Push and email.
- **Role-aware advice** — tell the assistant your role (farmer, pilot, fisherman, commuter, etc.) and alerts/answers get a short, relevant action cue added on top of IMD's own wording.
- **7-day forecast, hourly breakdowns, air quality, and an interactive map/globe** with location search.
- **PWA-ready** for a native-feeling mobile experience.

## Architecture

```
frontend/   Next.js 16 (App Router) + TypeScript + Tailwind
backend/    FastAPI (Python), async throughout
infra/      Postgres (with PostGIS) init scripts, Mosquitto config
```

**Backend services it talks to:**
- **Groq** — LLM for chat answers and lightweight intent/place classification
- **Sarvam AI** — speech-to-text and text-to-speech for Indian languages
- **Open-Meteo**, with **met.no** as an automatic fallback — live forecast data
- **MapTiler** — geocoding, reverse geocoding, and map tiles
- **IMD's public CAP feed** — real severe weather alerts (no key required)
- **Brevo** — transactional email for severe-alert notifications
- **Web Push (VAPID)** — browser push notifications

**Data layer:** PostgreSQL with PostGIS (real point-in-polygon alert matching, not just district-level), Redis (weather response caching).

The backend self-applies its own SQL migrations on startup (`app/migrate.py`) rather than requiring a separate migration step — each file in `infra/postgres/init/` runs at most once, tracked in a `schema_migrations` table.

## Running locally

**Prerequisites:** Docker Desktop, Python 3.12+, Node.js 20+.

1. Start Postgres, Redis, and Mosquitto:
   ```
   docker compose up -d db redis mqtt
   ```
2. Backend:
   ```
   cd backend
   python -m venv venv && source venv/Scripts/activate   # or venv/bin/activate on macOS/Linux
   pip install -r requirements.txt
   cp .env.example .env   # fill in real API keys — see below
   python -m uvicorn app.main:app --reload --port 8001
   ```
3. Frontend:
   ```
   cd frontend
   npm install
   cp .env.local.example .env   # set NEXT_PUBLIC_API_URL to the backend above
   npm run dev
   ```

### Environment variables

At minimum, the backend needs real keys for `GROQ_API_KEY`, `SARVAM_API_KEY`, and `MAPTILER_API_KEY` to power chat, voice, and location search — everything else (alerts, email, push) degrades gracefully if left unset. See `backend/.env.example` and `frontend/.env.local.example` for the full list.

## Deployment

Deployed on Render's free tier — a Postgres instance, a Redis instance, and separate web services for the FastAPI backend and the Next.js frontend, each auto-deploying from `main`. A scheduled GitHub Actions workflow (`.github/workflows/keep-alive.yml`) pings both services periodically to reduce free-tier cold starts.

## Design principles

- **Never invent data.** Every number shown or spoken comes from a real upstream source; if data isn't available, the app says so instead of guessing. Loading states use neutral placeholders, never plausible-looking fake numbers.
- **Real sources, correctly attributed.** Alerts are IMD's own wording; forecasts cite Open-Meteo; nothing is presented as more authoritative than it actually is.
