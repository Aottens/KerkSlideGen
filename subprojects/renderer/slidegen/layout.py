"""Slide geometry from assets/background.png and assets/layout.json (REN-01..03)."""
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


class LayoutError(Exception):
    """The assets do not give a usable geometry (e.g. a background narrower than its centre area)."""


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    w: float
    h: float

    def contains(self, other: "Rect") -> bool:
        t = 0.5  # float tolerance in px
        return (
            other.x >= self.x - t
            and other.y >= self.y - t
            and other.x + other.w <= self.x + self.w + t
            and other.y + other.h <= self.y + self.h + t
        )


@dataclass(frozen=True)
class Geometry:
    canvas_w: int
    canvas_h: int
    centre: Rect
    safe: Rect
    font_px: dict  # {"title": 78, "when": 40, "where": 40, "line": 36}
    font_weight: dict  # {"title": 700, "when": 600, "where": 600, "line": 400}
    min_scale: float
    background: Path
    font_file: Path

    @classmethod
    def load(cls, assets: Path) -> "Geometry":
        assets = Path(assets)
        layout = json.loads((assets / "layout.json").read_text())
        background = assets / "background.png"
        with Image.open(background) as im:
            w, h = im.size
        c = layout["centre"]
        if c == "auto":
            cw = round(h * 16 / 9)
            centre = Rect((w - cw) / 2, 0, cw, h)
        else:
            centre = Rect(c["x"], c["y"], c["w"], c["h"])
        if w < centre.w or centre.x < 0 or centre.x + centre.w > w or centre.y + centre.h > h:
            raise LayoutError(
                f"background is {w}\u00d7{h}, too small for the centre area "
                f"{centre.w:g}\u00d7{centre.h:g}"
            )
        m = layout["safe_margin"]
        safe = Rect(centre.x + m * centre.w, centre.y + m * centre.h, centre.w * (1 - 2 * m), centre.h * (1 - 2 * m))
        fonts = layout["font"]
        return cls(
            canvas_w=w,
            canvas_h=h,
            centre=centre,
            safe=safe,
            font_px=layout["font_px"],
            font_weight={k: fonts[k] for k in layout["font_px"]},
            min_scale=layout["min_scale"],
            background=background,
            font_file=assets / "fonts" / "Montserrat-wght.ttf",
        )
