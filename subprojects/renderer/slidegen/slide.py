"""The SlideText of subprojects/renderer/INTERFACE.md."""
from dataclasses import dataclass

FIELDS = ("title", "when", "where", "line")


@dataclass(frozen=True)
class SlideText:
    title: str
    when: str = ""
    where: str = ""
    line: str = ""
    show_until: str = ""

    @classmethod
    def from_json(cls, data: dict) -> "SlideText":
        """Build from the INTERFACE.md JSON object. A missing or blank title is a ValueError."""
        title = str(data.get("title") or "").strip()
        if not title:
            raise ValueError("title is required")
        return cls(title=title, **{k: str(data.get(k) or "").strip() for k in ("when", "where", "line", "show_until")})
