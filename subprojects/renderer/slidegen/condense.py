"""Request text to SlideText with one structured call to Claude Code (`claude -p`, the owner's subscription;
CND-01, CND-04..07, CND-09). The token comes from CLAUDE_CODE_OAUTH_TOKEN in the environment; it is never passed
or printed."""
import json
import re
import subprocess
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

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


class WeekdayMismatch(CondenseError):
    """CND-09: the visual team decides which of weekday and date is wrong; no retry."""


_DAYS = ("maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag")
_MONTHS = ("januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober",
           "november", "december")
_MONTH = {m: i + 1 for i, m in enumerate(_MONTHS)} | {m[:3]: i + 1 for i, m in enumerate(_MONTHS)}
_MONTH |= {"sept": 9, "mrt": 3}
_WEEKDAY = re.compile(
    r"\b(" + "|".join(_DAYS + tuple(d[:2] for d in _DAYS)) + r")(?:ochtend|morgen|middag|avond|nacht)?\b\.?"
)
_DATE = re.compile(
    r"(?<![\w.:])(\d{1,2})(?:\s*[-/]\s*(\d{1,2})\b|\.?\s+("
    + "|".join(sorted(_MONTH, key=len, reverse=True)) + r")\b\.?)"
)


def weekday_mismatch(when: str, event_date: str, today: date) -> bool:
    """CND-09: every weekday in `when` must be the weekday of the date it stands with (else the event date)."""
    try:
        event = date.fromisoformat(event_date)
    except ValueError:
        event = None
    when = when.lower()
    dates = list(_DATE.finditer(when))
    for w in _WEEKDAY.finditer(when):
        weekday = [d[:2] for d in _DAYS].index(w.group(1)[:2])
        if not dates:
            if event is not None and event.weekday() != weekday:
                return True
            continue
        # ponytail: a bare day without month (`vrijdag 11 t/m zondag 13 december`) pairs with the nearest full date
        # and goes to the visual team.
        d = min(dates, key=lambda d: (max(0, d.start() - w.end(), w.start() - d.end()), d.start() < w.start()))
        if _wrong(d, weekday, event, today):
            return True
    return False


def _wrong(m: re.Match, weekday: int, event: date | None, today: date) -> bool:
    day, month = int(m.group(1)), int(m.group(2) or _MONTH[m.group(3)])
    for year in [event.year] if event else range(today.year, today.year + 9):
        try:
            d = date(year, month, day)
        except ValueError:
            continue
        if event or d >= today:
            return d.weekday() != weekday
    return True


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


def _call(run, content: str) -> dict:
    """Errors carry fixed phrases, field names and codes only: never Claude's or the request's text (INT-07)."""
    args = [
        "claude", "-p", "--model", config.MODEL, "--effort", config.EFFORT, "--output-format", "json",
        "--json-schema", json.dumps(SCHEMA), "--system-prompt", PROMPT.read_text(encoding="utf-8"),
        "--tools", "", "--setting-sources", "", "--strict-mcp-config", "--no-session-persistence",
    ]
    try:
        with tempfile.TemporaryDirectory() as cwd:  # away from the repo, so its CLAUDE.md is not read
            proc = run(args, input=content, capture_output=True, text=True, timeout=300, cwd=cwd)
    except subprocess.TimeoutExpired as e:
        raise CondenseError("no answer from Claude Code within 300 s") from e
    except FileNotFoundError as e:
        raise CondenseError("Claude Code (claude) is not installed") from e
    try:
        out = json.loads(proc.stdout)
    except (TypeError, ValueError):
        out = None
    if not isinstance(out, dict):
        raise CondenseError(f"Claude Code gave no result (exit {proc.returncode})")
    if out.get("is_error") or proc.returncode != 0:
        if "authenticat" in str(out.get("result", "")).lower():
            raise CondenseError("Claude login failed: the CLAUDE_CODE_OAUTH_TOKEN is missing or expired")
        raise CondenseError(f"Claude Code error: {out.get('terminal_reason') or f'exit {proc.returncode}'}")
    if out.get("stop_reason") == "refusal":
        raise CondenseError("Claude refused the request")
    data = out.get("structured_output")
    if not isinstance(data, dict) or not all(k in data for k in LIMITS):
        raise CondenseError("Claude Code gave no structured output")
    return {k: str(data[k]) for k in LIMITS}


def condense(
    req: Request,
    today: date,
    run=None,
    previous: SlideText | None = None,
    feedback: Sequence[str] = (),
    fixed: dict | None = None,
) -> SlideText:
    """One call; one more with the problems named if a limit is broken (CND-06). `feedback` counts as that retry."""
    run = run or subprocess.run
    text = req.text.replace("<", "&lt;").replace(">", "&gt;")
    content = f"<event_date>{req.event_date}</event_date>\n<request>\n{text}\n</request>"

    def retry_content(prev: dict, problems: Sequence[str]) -> str:
        return (
            f"{content}\n<previous>{json.dumps(prev, ensure_ascii=False)}</previous>\n"
            "<problems>\n" + "\n".join(problems) + "\n</problems>\nWrite a corrected, shorter version."
        )

    def call(c: str) -> dict:
        d = _call(run, c)
        if fixed:  # AGD-04: the agenda's when/where replace whatever Claude wrote
            d.update(when=fixed["when"], where=fixed["where"])
        return d

    if previous or feedback:
        prev = {k: getattr(previous, k, "") for k in LIMITS}
        data = call(retry_content(prev, feedback))
        retried = True
    else:
        data = call(content)
        retried = False
    bad = violations(data)
    if bad and not retried:
        data = call(retry_content(data, bad))
        bad = violations(data)
    if bad:
        raise CondenseError("; ".join(bad))
    if weekday_mismatch(data["when"], req.event_date, today):
        raise WeekdayMismatch("weekday does not match the date")
    show_until = req.show_until or req.event_date or (today + timedelta(days=14)).isoformat()
    return SlideText(**{k: v.strip() for k, v in data.items()}, show_until=show_until)

