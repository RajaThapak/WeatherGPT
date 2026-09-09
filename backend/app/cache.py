from typing import Optional

import redis.asyncio as redis

_client: Optional[redis.Redis] = None


def get_redis(url: str) -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(url, decode_responses=True, socket_connect_timeout=3, socket_timeout=3)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
