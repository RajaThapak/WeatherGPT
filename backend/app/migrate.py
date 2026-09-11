import logging
from pathlib import Path

from app.config import settings
from app.db import get_pool

logger = logging.getLogger("weathergpt.migrate")

# Deployed environments (e.g. Render) don't get the docker-entrypoint-initdb.d
# auto-run behavior local Docker Compose gets for free — this replays the
# same SQL files on every startup instead, but only the ones not yet
# recorded as applied. A plain "just re-run every file every time" approach
# doesn't work here: 005_email_alerts.sql does an ALTER TABLE ... RENAME
# COLUMN, which isn't safely repeatable — running it twice would either
# error or (worse, combined with 004's "ADD COLUMN IF NOT EXISTS") silently
# recreate a stale duplicate column. Tracking applied migrations avoids that.
INIT_DIR = Path(__file__).resolve().parent.parent.parent / "infra" / "postgres" / "init"


async def run_migrations() -> None:
    if not INIT_DIR.is_dir():
        logger.info("No infra/postgres/init directory found — skipping migrations (expected in some deploy setups).")
        return

    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        applied = {row["filename"] for row in await conn.fetch("SELECT filename FROM schema_migrations")}

    for path in sorted(INIT_DIR.glob("*.sql")):
        if path.name in applied:
            continue
        sql = path.read_text(encoding="utf-8")
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1)", path.name
                )
        logger.info("Migration applied: %s", path.name)
