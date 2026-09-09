import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.cache import get_redis
from app.config import settings
from app.db import get_pool
from app.http_client import close_http_client
from app.routers import air_quality, alerts, chat, voice, weather
from app.services.alerts import dispatch_new_alerts, fetch_and_ingest_alerts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("weathergpt")


async def _alert_poll_loop() -> None:
    while True:
        try:
            ingested = await fetch_and_ingest_alerts()
            sent = await dispatch_new_alerts()
            if ingested or sent:
                logger.info("Alert poll: ingested=%d, pushes sent=%d", ingested, sent)
        except Exception as exc:
            logger.warning("Alert poll cycle failed: %s", exc)
        await asyncio.sleep(settings.alert_poll_interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    poll_task = asyncio.create_task(_alert_poll_loop())
    yield
    poll_task.cancel()
    await close_http_client()


app = FastAPI(title="WeatherGPT API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weather.router)
app.include_router(chat.router)
app.include_router(air_quality.router)
app.include_router(voice.router)
app.include_router(alerts.router)


@app.get("/")
async def root():
    return {"service": "weathergpt-backend", "status": "running"}


@app.get("/health")
async def health():
    result = {"status": "ok", "postgres": "unknown", "redis": "unknown"}

    try:
        pool = await get_pool(settings.database_url)
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        result["postgres"] = "up"
    except Exception as exc:
        logger.warning("Postgres health check failed: %s", exc)
        result["postgres"] = "down"
        result["status"] = "degraded"

    try:
        client = get_redis(settings.redis_url)
        pong = await client.ping()
        result["redis"] = "up" if pong else "down"
        if not pong:
            result["status"] = "degraded"
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)
        result["redis"] = "down"
        result["status"] = "degraded"

    return result
