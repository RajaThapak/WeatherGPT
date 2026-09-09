import logging
from collections.abc import AsyncIterator
from typing import Optional

from groq import AsyncGroq
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger("weathergpt.llm")

_client: Optional[AsyncGroq] = None


def get_groq_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


class ExtractResult(BaseModel):
    is_weather_question: bool
    has_explicit_place: bool
    place_query: Optional[str] = None


EXTRACT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "place_extraction",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "is_weather_question": {"type": "boolean"},
                "has_explicit_place": {"type": "boolean"},
                "place_query": {"type": ["string", "null"]},
            },
            "required": ["is_weather_question", "has_explicit_place", "place_query"],
            "additionalProperties": False,
        },
    },
}


async def extract_place(message: str) -> ExtractResult:
    client = get_groq_client()
    response = await client.chat.completions.create(
        model=settings.groq_extract_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You extract structured info from a user's message to a weather assistant. "
                    "Determine if the message is asking about weather/climate, and if it names a "
                    "specific place (city, region, country, landmark). If no place is named, "
                    "place_query must be null."
                ),
            },
            {"role": "user", "content": message},
        ],
        response_format=EXTRACT_SCHEMA,
        temperature=0,
    )
    raw = response.choices[0].message.content
    return ExtractResult.model_validate_json(raw)


async def stream_chat_answer(
    system_prompt: str,
    history: list[dict],
    user_message: str,
) -> AsyncIterator[str]:
    client = get_groq_client()
    messages = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": user_message},
    ]

    stream = await client.chat.completions.create(
        model=settings.groq_chat_model,
        messages=messages,
        stream=True,
        temperature=0.4,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
