from typing import Optional

import httpx

_client: Optional[httpx.AsyncClient] = None
# A separate client for background polling loops (CAP alert ingestion, the
# email digest watch cycle) — kept apart from the client live user requests
# use so a slow/bursty poll cycle (many outbound fetches at once) can never
# compete with a real chat request for the same connection pool. Observed
# locally: a single shared client turned one chat request's ~2s of real
# work into 15+s while a 9-link CAP poll cycle was in flight on it.
_background_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10.0)
    return _client


def get_background_http_client() -> httpx.AsyncClient:
    global _background_client
    if _background_client is None:
        _background_client = httpx.AsyncClient(timeout=10.0)
    return _background_client


async def close_http_client() -> None:
    global _client, _background_client
    if _client is not None:
        await _client.aclose()
        _client = None
    if _background_client is not None:
        await _background_client.aclose()
        _background_client = None
