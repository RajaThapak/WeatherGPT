# WeatherGPT — Build Status

Last updated: 2026-09-11

## Overview

WeatherGPT is a conversational weather app for MoES/IMD (India), built with Next.js 16 (frontend) and FastAPI (backend), backed by PostgreSQL + PostGIS + TimescaleDB. Core principle enforced throughout: **every number shown is real, fetched data — nothing invented.** This doc tracks what's actually built and verified, not what's planned.

---

## 1. Chat / Conversational AI

- **Grounded answers** — the chat system prompt is built entirely from real fetched weather/alert data; the model is instructed to never invent numbers not present in it.
- **Role/persona system** — free-text role (e.g. "Farmer", "Pilot", not a fixed dropdown), captured via a one-time onboarding modal or editable later from the Navbar menu. Feeds into chat framing, the persona advisory card, and role-aware push notifications.
- **Multi-city comparison** — fixed a real bug where "compare Mathura and Chennai" resolved to a single garbage geocode ("Mathura Street, Chennai"). `extract_place()` now returns a list of places; the backend geocodes and fetches weather for each independently and builds a genuine side-by-side comparison prompt. Comparison queries deliberately don't move the map (no single "winning" city).
- **Agentic actions** — the chat can trigger real app state changes, not just describe them:
  - "turn on alerts for me" → actually subscribes to push notifications.
  - "I'm actually a pilot" → actually updates the stored role app-wide.
  - Detected via a dedicated Groq structured-output call (`detect_action` in `llm.py`), deliberately conservative to avoid false-positive side effects.
- **Voice** — Sarvam STT/TTS (Indian languages). Every reply auto-plays via TTS unless muted. Voice changed from `priya` to `neha` (Sarvam bulbul:v3).
- **Mute toggle** — in the chat header; stops auto-play (manual per-message play still works), persists across reloads, stored in `ChatProvider`.
- **Multi-session history** — past conversations saved/switchable, auto-expire after 3 days of inactivity. Session-save only fires once a reply finishes streaming (fixed a "Maximum update depth exceeded" bug caused by saving on every streamed token).
- **Mobile UI** — chat is inline in the page (not a floating overlay): collapsed to a tappable mascot prompt, expands in place pushing the dashboard down, never intercepts page scroll while collapsed.
- **Desktop UI** — a floating mascot button (bottom-right) toggles a click-to-open chat panel (reverted from an earlier permanent-sidebar design per explicit request). Trigger hides while the panel is open.
- **Mascot companion** — a sitting-pose mascot (`chat-mascot-perch.png`) perches at the chat panel's top-right corner while open, on both mobile and desktop, with a drop-in bounce animation. Positioning is anchored to the panel's own box (not guessed fixed pixels) so it never clips at different window sizes.

## 2. Alerts

- **Real pipeline** — polls IMD's actual public CAP feed (`cap-sources.s3.amazonaws.com/in-imd-en/rss.xml`) every 2 minutes, parses CAP XML, upserts into `weather_alerts` (PostGIS polygon geometry).
- **Geo-matching** — `ST_Contains` matches a subscriber's lat/lon against real alert polygons.
- **Web Push** — VAPID-based browser push, real subscriptions stored in `push_subscriptions`.
- **Role-aware tailoring** — push notification body and in-app framing are prefixed with a role-specific action cue (e.g. "Avoid going out to sea — [real IMD headline]") based on (alert event type × role bucket); falls back to the plain headline for unrecognized combinations — never invents wording for a role it doesn't understand.
- **Full-screen severe-alert takeover** — only for Extreme/Severe alerts: full-screen blur, ringing bell with red ambient glow, real headline/description/instruction, source/timestamp badge. Auto-fires once per new alert; re-triggerable by clicking the actual push notification (service worker message or `?alert=` URL param for a cold-started tab).
- **Source/timestamp transparency** — alerts show "Source: IMD CAP feed · issued X ago" everywhere they appear (banner, bell dropdown, takeover).
- **Notification dropdown (bell icon)** — shows real active IMD alerts for the current location ("Weather alerts" section) plus real health risks ("Health risk" section, see below). Badge dot lights up for either.
- **Known IMD feed behavior** — the RSS feed keeps listing old CAP alert links well after they've expired; the pipeline correctly filters these out via `expires > now()`, confirmed by manual testing against the live feed.

## 3. Personalization

- **Persona advisory card** — rule-based (not LLM), keyword-matches the free-text role into a bucket (farmer/pilot/fisherman/commuter/construction) and applies honest threshold rules against real fetched weather fields (wind/rain/humidity/temp). Shows nothing for unrecognized roles — never a generic filler tip.
- **Health risk alerts** — same honest-threshold pattern, now living in the bell dropdown (moved out of a standalone dashboard card per request):
  - **Heat risk** — bands on real `apparent_temp_c` (35°C/40°C/45°C).
  - **Air quality risk** — reuses the existing real AQI service (Open-Meteo Air Quality API, US AQI scale), reframed as a health advisory.
  - **Mosquito/vector risk** — a weather-correlate heads-up (warm + humid + rain-likely), explicitly framed as a condition flag, not a medical/epidemiological claim.
  - Renders nothing on a calm day.
  - Explicitly **not built**: pollen/allergy risk (no real data source available) and literal crop-yield prediction (would require real agronomic models/historical data we don't have — faking it would break the project's core honesty principle).

## 4. Dashboard / UI

- **Hourly forecast line graph** (mobile, Today/Tomorrow tabs) — hand-rolled SVG smooth curve through real hourly temps, replacing boxed cards on mobile only; desktop unchanged. Default landing tab changed to "Today" so it's visible without tapping.
- **Weather Metrics panel** — replaced the fully-fake "Other large cities" widget (hardcoded mock cities like Jerusalem/Beijing/California that never changed) with real Humidity, Pressure, and Daylight (sunrise/sunset + computed duration + day-progress bar) cards.
- **De-duplicated hero card** — removed Pressure/Humidity/Sunrise/Sunset text lines from the hero forecast card now that they live in the Weather Metrics panel; kept Wind (no dedicated widget yet).
- **Theme-aware, source-labeled** throughout — every real-data section shows where its numbers came from and when they were last updated.

## 5. Backend/infra notes

- No ORM/migrations — raw `asyncpg`, matching the existing codebase style.
- `push_subscriptions` gained a nullable `role` column (migrated on the live dev DB + `002_alerts.sql` updated for fresh installs).
- Recurring environment quirk (not a code bug): the backend dev server occasionally needs a manual restart — `.env` changes and some `.py` edits aren't always picked up by `--reload` reliably in this environment.

## 6. Researched but not built (with reasons)

- **`api.imd.gov.in` direct API** — confirmed real and live, but registration is gated to institutional email domains (`gov.in`, `nic.in`, etc.) — not accessible without one.
- **`data.gov.in`** — genuinely open to public registration (unlike the above), hosts IMD-sourced datasets, but exact dataset coverage/format not yet verified — pending the user obtaining an API key.
- **SMS reminders (India)** — ruled out for now: requires TRAI DLT registration (real business KYC via an Indian telecom operator), harder to stand up than WhatsApp for a hackathon team.
- **WhatsApp reminders** — feasible via Twilio Sandbox (steps documented, fastest path) or Meta Cloud API direct (more setup, no 3-day session expiry). Proactive messages need an approved template. Not yet built — pending the user setting up a Twilio account/sandbox.
- **PWA installability** — service worker exists (built for push), but no `manifest.json`/icons yet, so "Add to Home Screen" doesn't actually work yet. Discussed as the realistic path to a "mobile app" deliverable; not yet implemented.

## 7. Open next steps (not started)

- Visibility widget — needs a new Open-Meteo field wired into the backend (`weather.py`).
- Pressure trend (rising/falling) — needs hourly pressure history, not just a snapshot.
- PWA manifest + real icon set.
- WhatsApp sending code — ready to build once Twilio/Meta credentials exist.
