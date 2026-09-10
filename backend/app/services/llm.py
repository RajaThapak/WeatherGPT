import logging
from collections.abc import AsyncIterator
from typing import Literal, Optional

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
    # A list, not a single optional string — a message can name more than
    # one place ("compare Mumbai and Delhi"), and cramming two place names
    # into one geocode query produces garbage (e.g. "Mathura and Chennai"
    # resolving to a street literally named "Mathura" in Chennai). Empty
    # list means no place was named.
    place_queries: list[str] = []


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
                "place_queries": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["is_weather_question", "has_explicit_place", "place_queries"],
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
                    "Determine if the message is asking about weather/climate, and list every "
                    "distinct specific place (city, region, country, landmark) named in it as "
                    "separate entries — there can be zero, one, or several (e.g. \"compare Mumbai "
                    "and Delhi\" names two separate places: \"Mumbai\" and \"Delhi\", never combine "
                    "them into one string). If no place is named, place_queries must be an empty array."
                ),
            },
            {"role": "user", "content": message},
        ],
        response_format=EXTRACT_SCHEMA,
        temperature=0,
    )
    raw = response.choices[0].message.content
    return ExtractResult.model_validate_json(raw)


class ActionResult(BaseModel):
    action: Literal["subscribe_alerts", "set_role", "none"]
    role_value: Optional[str] = None


ACTION_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "action_detection",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["subscribe_alerts", "set_role", "none"]},
                "role_value": {"type": ["string", "null"]},
            },
            "required": ["action", "role_value"],
            "additionalProperties": False,
        },
    },
}


async def detect_action(message: str) -> ActionResult:
    """Detects whether the message is an explicit request for WeatherGPT to
    DO something (not just answer a question) — the two real, wired-up
    actions it can actually perform: enabling push alerts, or updating the
    user's stored role. Deliberately conservative (only clear, explicit
    requests) since a false positive here triggers a real side effect
    (a permission prompt, an overwritten role), not just a wrong sentence."""
    client = get_groq_client()
    response = await client.chat.completions.create(
        model=settings.groq_extract_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You detect whether a user's message to a weather assistant is explicitly "
                    "asking it to DO one of two things, as opposed to just asking a weather question:\n"
                    "- \"subscribe_alerts\": explicitly asking to turn on/enable weather alert "
                    "push notifications for themselves (e.g. \"turn on alerts\", \"notify me of "
                    "warnings\", \"subscribe me to alerts\").\n"
                    "- \"set_role\": explicitly stating or correcting their own role/occupation for "
                    "the assistant to remember (e.g. \"I'm actually a fisherman\", \"treat me as a "
                    "pilot from now on\", \"my role is farmer\"). If this, put their own wording for "
                    "the role in role_value; otherwise role_value must be null.\n"
                    "- \"none\": anything else, including ordinary weather questions — only match "
                    "clear, explicit requests, never infer one from an indirect mention."
                ),
            },
            {"role": "user", "content": message},
        ],
        response_format=ACTION_SCHEMA,
        temperature=0,
    )
    raw = response.choices[0].message.content
    return ActionResult.model_validate_json(raw)


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
