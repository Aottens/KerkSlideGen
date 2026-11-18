"""Request text to SlideText with one structured Claude call (CND-01, CND-04..07)."""
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import anthropic

from . import config
from .slide import SlideText

PROMPT = Path(__file__).resolve().parents[1] / "prompts" / "condense.md"
LIMITS = {"title": 32, "when": 40, "where": 40, "line": 70}
SCHEMA = {
    "type": "object",
    "properties": {k: {"type": "string"} for k in LIMITS},
    "required": list(LIMITS),
    "additionalProperties": False,
}


class CondenseError(Exception):
    """The reason the visual team is mailed (DLV-08). Never holds request or slide text (INT-07)."""


@dataclass(frozen=True)
class Request:
    text: str
    event_date: str = ""
    show_until: str = ""

    @classmethod
    def parse(cls, raw: str) -> "Request":
        """Header lines `event_date:` / `show_until:`, a `---` line, then the request text."""
        head, _, body = raw.partition("\n---\n")
        fields = dict(line.split(":", 1) for line in head.splitlines() if ":" in line)
        return cls(body.strip(), fields.get("event_date", "").strip(), fields.get("show_until", "").strip())


def violations(data: dict) -> list[str]:
    """CND-06: the limits, checked in code. Names fields and numbers only."""
    out = [f"{k} is {len(data[k])} characters, at most {n}" for k, n in LIMITS.items() if len(data[k]) > n]
    return (["title is empty"] if not data["title"].strip() else []) + out


def _call(client, content: str) -> dict:
    try:
        msg = client.messages.create(
            model=config.MODEL,
            max_tokens=16000,
            system=PROMPT.read_text(encoding="utf-8"),
            output_config={"effort": config.EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.APIError as e:
        raise CondenseError(f"API error: {type(e).__name__}") from e
    if msg.stop_reason == "refusal":
        category = getattr(msg.stop_details, "category", None)
        raise CondenseError("Claude refused the request" + (f" ({category})" if category else ""))
    if msg.stop_reason != "end_turn":
        raise CondenseError(f"Claude stopped early: {msg.stop_reason}")
    text = next((b.text for b in msg.content if b.type == "text"), None)
    try:
        data = json.loads(text)
        return {k: str(data[k]) for k in LIMITS}
    except (TypeError, ValueError, KeyError) as e:
        raise CondenseError("reply was not the expected JSON") from e


def condense(
    req: Request,
    today: date,
    client=None,
    previous: SlideText | None = None,
    feedback: Sequence[str] = (),
) -> SlideText:
    """One call; one more with the problems named if a limit is broken (CND-06). `feedback` counts as that retry."""
    client = client or anthropic.Anthropic()
    text = req.text.replace("<", "&lt;").replace(">", "&gt;")
    content = f"<event_date>{req.event_date}</event_date>\n<request>\n{text}\n</request>"

    def retry_content(prev: dict, problems: Sequence[str]) -> str:
        return (
            f"{content}\n<previous>{json.dumps(prev, ensure_ascii=False)}</previous>\n"
            "<problems>\n" + "\n".join(problems) + "\n</problems>\nWrite a corrected, shorter version."
        )

    if previous or feedback:
        prev = {k: getattr(previous, k, "") for k in LIMITS}
        data = _call(client, retry_content(prev, feedback))
        retried = True
    else:
        data = _call(client, content)
        retried = False
    bad = violations(data)
    if bad and not retried:
        data = _call(client, retry_content(data, bad))
        bad = violations(data)
    if bad:
        raise CondenseError("; ".join(bad))
    show_until = req.show_until or req.event_date or (today + timedelta(days=14)).isoformat()
    return SlideText(**{k: v.strip() for k, v in data.items()}, show_until=show_until)

