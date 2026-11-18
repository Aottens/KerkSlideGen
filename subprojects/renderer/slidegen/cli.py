"""`slidegen render SLIDE.json -o OUT.png [--guides] [--assets DIR] [--image PATH] [--id ID]`,
`slidegen condense REQUEST.txt [-o slide.json]` and `slidegen eval [DIR]` (CND-08; both call Claude Code,
the owner's subscription, and cost subscription usage).

Exit codes: 0 ok, 1 error, 2 usage, 3 does not fit (REN-07).
"""
import argparse
import json
import re
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

from .condense import LIMITS, CondenseError, Request, condense
from .layout import LayoutError
from .render import DoesNotFit, RenderError, render
from .slide import SlideText

ASSETS = Path(__file__).resolve().parents[3] / "assets"
REQUESTS = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "requests"
EMOJI = re.compile("[\U0001F000-\U0001FFFF\u2600-\u27BF]")


TIME = re.compile(r"\d{1,2}[.:]\d{2}|\buur\b", re.I)


def _header(raw: str, key: str) -> str | None:
    """The value of a `key:` header line of an eval case, or None."""
    for row in raw.partition("\n---\n")[0].splitlines():
        if row.startswith(key + ":"):
            return row[len(key) + 1:].strip()
    return None


def _empty_fields(raw: str) -> set[str]:
    """The `empty:` header of an eval case: fields the request gives nothing for (where, line, time)."""
    return {f.strip() for f in (_header(raw, "empty") or "").split(",") if f.strip()}


def _checks(slide: SlideText, req: Request, empty: set[str] = frozenset()) -> list[str]:
    """CND-01..04 as printed lines for `slidegen eval`."""
    d = asdict(slide)
    text = " ".join(d[k] for k in LIMITS)
    bad = [f"{k} is {len(d[k])}, at most {n}" for k, n in LIMITS.items() if len(d[k]) > n]
    bad += [] if d["title"] else ["title is empty"]
    tone = (["exclamation mark"] if "!" in text else []) + (["emoji"] if EMOJI.search(text) else [])
    tone += ["capitals"] if any(w.isupper() for w in re.findall(r"[^\W\d_]{3,}", text)) else []
    source = {int(n) for n in re.findall(r"\d+", f"{req.text} {req.event_date} {req.show_until}")}
    invented = sorted({n for n in map(int, re.findall(r"\d+", text)) if n not in source})
    filled = [f"{f} not empty" for f in ("where", "line") if f in empty and d[f]]
    filled += ["time in when"] if "time" in empty and TIME.search(d["when"]) else []
    ok = lambda name, why: f"{name} FAIL: {why}" if why else f"{name} ok"  # noqa: E731
    return [
        ok("CND-01", ", ".join(bad)),
        ok("CND-02", ", ".join(tone)),
        ok("CND-03", ", ".join(filled + ([f"numbers not in the request: {invented}"] if invented else []))),
        f"CND-04 ok show_until={slide.show_until}",
    ]


def _eval(directory: Path) -> int:
    failed = False
    for path in sorted(directory.glob("*.txt")):
        print(f"== {path.stem}")
        raw = path.read_text(encoding="utf-8")
        req = Request.parse(raw)
        try:
            slide = condense(req, date.today())
        except CondenseError as e:
            print(f"CND-01 FAIL: {e}")
            failed = True
            continue
        print(json.dumps(asdict(slide), ensure_ascii=False))
        lines = _checks(slide, req, _empty_fields(raw))
        keep = _header(raw, "keep")
        if keep:  # CND-10: no slide or request text in the output (INT-07)
            lines.append("CND-10 ok" if keep in slide.title else "CND-10 FAIL: title does not hold the name as written")
        print("\n".join(lines))
        failed |= any("FAIL" in line for line in lines)
    print("Tone (CND-02) and nothing invented (CND-03: no place or time the request lacks) are judged by reading.")
    return 1 if failed else 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="slidegen")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("render")
    r.add_argument("slide", type=Path)
    r.add_argument("-o", "--out", type=Path, required=True)
    r.add_argument("--guides", action="store_true")
    r.add_argument("--assets", type=Path, default=ASSETS)
    r.add_argument("--image", type=Path)
    r.add_argument("--id", default="")
    c = sub.add_parser("condense", help="request text to slide JSON (calls Claude Code, owner's subscription)")
    c.add_argument("request", type=Path)
    c.add_argument("-o", "--out", type=Path)
    e = sub.add_parser("eval", help="run the eval set via Claude Code (costs subscription usage)")
    e.add_argument("dir", type=Path, nargs="?", default=REQUESTS)
    a = ap.parse_args(argv)
    if a.cmd == "eval":
        return _eval(a.dir)
    if a.cmd == "condense":
        try:
            req = Request.parse(a.request.read_text(encoding="utf-8"))
            out = json.dumps(asdict(condense(req, date.today())), ensure_ascii=False)
            a.out.write_text(out, encoding="utf-8") if a.out else print(out)
        except (CondenseError, ValueError, OSError) as err:
            print(err, file=sys.stderr)
            return 1
        return 0
    try:
        slide = SlideText.from_json(json.loads(a.slide.read_text(encoding="utf-8")))
        render(slide, a.assets, a.out, a.guides, a.image, a.id)
    except DoesNotFit:
        print("does not fit", file=sys.stderr)
        return 3
    except (RenderError, LayoutError, ValueError, OSError) as e:
        print(e, file=sys.stderr)
        return 1
    return 0


def entry() -> None:
    sys.exit(main(sys.argv[1:]))
