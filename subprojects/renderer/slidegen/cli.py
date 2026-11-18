"""`slidegen render SLIDE.json -o OUT.png [--guides] [--assets DIR] [--image PATH] [--id ID]`,
`slidegen condense REQUEST.txt [-o slide.json]` and `slidegen eval [DIR]` (CND-08; both call the live API).

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


def _checks(slide: SlideText, req: Request) -> list[str]:
    """CND-01..04 as printed lines for `slidegen eval`."""
    d = asdict(slide)
    text = " ".join(d[k] for k in LIMITS)
    bad = [f"{k} is {len(d[k])}, at most {n}" for k, n in LIMITS.items() if len(d[k]) > n]
    bad += [] if d["title"] else ["title is empty"]
    tone = (["exclamation mark"] if "!" in text else []) + (["emoji"] if EMOJI.search(text) else [])
    tone += ["capitals"] if any(w.isupper() for w in re.findall(r"[^\W\d_]{3,}", text)) else []
    source = {int(n) for n in re.findall(r"\d+", f"{req.text} {req.event_date} {req.show_until}")}
    invented = sorted({n for n in map(int, re.findall(r"\d+", text)) if n not in source})
    ok = lambda name, why: f"{name} FAIL: {why}" if why else f"{name} ok"  # noqa: E731
    return [
        ok("CND-01", ", ".join(bad)),
        ok("CND-02", ", ".join(tone)),
        ok("CND-03", f"numbers not in the request: {invented}" if invented else ""),
        f"CND-04 ok show_until={slide.show_until}",
    ]


def _eval(directory: Path) -> int:
    failed = False
    for path in sorted(directory.glob("*.txt")):
        print(f"== {path.stem}")
        req = Request.parse(path.read_text(encoding="utf-8"))
        try:
            slide = condense(req, date.today())
        except CondenseError as e:
            print(f"CND-01 FAIL: {e}")
            failed = True
            continue
        print(json.dumps(asdict(slide), ensure_ascii=False))
        lines = _checks(slide, req)
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
    c = sub.add_parser("condense", help="request text to slide JSON (calls the live Claude API)")
    c.add_argument("request", type=Path)
    c.add_argument("-o", "--out", type=Path)
    e = sub.add_parser("eval", help="run the eval set against the live Claude API (costs money)")
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
