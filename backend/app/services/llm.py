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
    # True only for an explicit ask to compare current/recent conditions
    # against the same time last year (e.g. "how does today compare to
    # last year", "is this normal for this time of year") — triggers a
    # real historical-data fetch (see historical.py), never an LLM guess.
    compare_to_last_year: bool = False
    # True when the message asks to compare a named place against the
    # user's own current location, referred to deictically rather than by
    # name (e.g. "compare this location and Haryana", "is it hotter here
    # than in Delhi"). Without this, a message naming exactly one place
    # ("Haryana") resolves to just that one place — never triggering
    # comparison mode — leaving the model with only one side of the
    # comparison and no way to honestly do what was asked.
    compare_to_current_location: bool = False


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
                "compare_to_last_year": {"type": "boolean"},
                "compare_to_current_location": {"type": "boolean"},
            },
            "required": [
                "is_weather_question", "has_explicit_place", "place_queries", "compare_to_last_year",
                "compare_to_current_location",
            ],
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
                    "them into one string). If no place is named, place_queries must be an empty array.\n\n"
                    "Also set compare_to_last_year to true ONLY if the message explicitly asks how "
                    "current/recent conditions compare to the same time last year, or whether "
                    "conditions are \"normal\" for this time of year (e.g. \"how does this compare "
                    "to last year\", \"is this unusual for September\", \"was it this hot last year "
                    "too\"). This is about comparing to the PAST, not just asking for today's "
                    "weather or a multi-day forecast — those are false.\n\n"
                    "Also set compare_to_current_location to true if the message asks to compare a "
                    "named place against the user's OWN current location, referred to deictically "
                    "rather than by name — e.g. \"compare this location and Haryana\", \"is it hotter "
                    "here than in Delhi\", \"how does my location compare to Mumbai\". False for a "
                    "plain question about a single named place with no such comparison."
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
    # A *suggestion* to show the user as a clickable chip under the reply —
    # unlike `action`, this never triggers anything by itself, it's only
    # rendered when the frontend confirms it's still relevant (e.g. skipped
    # if the user is already subscribed) and requires a real click to do
    # anything. Deliberately the minority case — "none" is the default for
    # ordinary questions, only suggest when it's genuinely warranted.
    suggested_chip: Literal["enable_alerts", "set_role", "none"] = "none"


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
                "suggested_chip": {"type": "string", "enum": ["enable_alerts", "set_role", "none"]},
            },
            "required": ["action", "role_value", "suggested_chip"],
            "additionalProperties": False,
        },
    },
}


async def detect_action(message: str) -> ActionResult:
    """Detects two different things about the message in one call:
    1. An explicit request for WeatherGPT to DO something (`action`) — the
       two real, wired-up actions it can actually perform: enabling push
       alerts, or updating the user's stored role. Deliberately conservative
       (only clear, explicit requests) since a false positive here triggers
       a real side effect (a permission prompt, an overwritten role), not
       just a wrong sentence.
    2. Whether it'd be *helpful to suggest* one of those same two things as
       a clickable chip (`suggested_chip`), even though the user didn't ask
       for it — e.g. a question about an incoming storm suggesting "enable
       alerts". This never fires anything by itself; it's just a UI hint,
       and should stay "none" for ordinary questions — the exception, not
       the default."""
    client = get_groq_client()
    response = await client.chat.completions.create(
        model=settings.groq_extract_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You analyze a user's message to a weather assistant for two separate things:\n\n"
                    "1. `action` — is the message EXPLICITLY asking the assistant to DO one of two "
                    "things, as opposed to just asking a weather question?\n"
                    "- \"subscribe_alerts\": explicitly asking to turn on/enable weather alert "
                    "push notifications for themselves (e.g. \"turn on alerts\", \"notify me of "
                    "warnings\", \"subscribe me to alerts\").\n"
                    "- \"set_role\": explicitly stating or correcting their own role/occupation for "
                    "the assistant to remember (e.g. \"I'm actually a fisherman\", \"treat me as a "
                    "pilot from now on\", \"my role is farmer\"). If this, put their own wording for "
                    "the role in role_value; otherwise role_value must be null.\n"
                    "- \"none\": anything else, including ordinary weather questions — only match "
                    "clear, explicit requests, never infer one from an indirect mention.\n\n"
                    "2. `suggested_chip` — independent of the above, would it genuinely help to "
                    "*proactively suggest* (not perform) one of these two, as a UI button under the "
                    "reply?\n"
                    "- \"enable_alerts\": the question is about hazard-relevant conditions (storm, "
                    "heavy rain, flooding, extreme heat, high wind, cyclone, snow) where getting "
                    "notified of official warnings would genuinely help. Not for routine/mild "
                    "questions like \"what's the temperature\" or \"will it be sunny\".\n"
                    "- \"set_role\": the question is asking for a decision or recommendation (e.g. "
                    "\"should I...\", \"is it safe to...\", \"what should I do about...\") where "
                    "knowing the user's occupation/context would let you give sharper advice.\n"
                    "- \"none\": the correct answer for most messages, including simple factual "
                    "questions — only suggest one when it's clearly warranted, never on every message."
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
