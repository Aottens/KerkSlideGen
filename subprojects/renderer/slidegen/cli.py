"""`slidegen render SLIDE.json -o OUT.png [--guides] [--assets DIR] [--image PATH] [--id ID]`.

Exit codes: 0 ok, 1 error, 2 usage, 3 does not fit (REN-07).
"""
import argparse
import json
import sys
from pathlib import Path

from .layout import LayoutError
from .render import DoesNotFit, RenderError, render
from .slide import SlideText

ASSETS = Path(__file__).resolve().parents[3] / "assets"


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
    a = ap.parse_args(argv)
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
