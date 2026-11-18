"""Slide text to PNG with headless Chromium (REN-01..10)."""
import tempfile
from dataclasses import dataclass
from html import escape
from pathlib import Path

from playwright.sync_api import sync_playwright

from .layout import Geometry, Rect
from .slide import FIELDS, SlideText


class RenderError(Exception):
    """Rendering failed for a reason the visual team must hear about."""


class FontMissing(RenderError):
    """The font in assets/fonts is missing or did not load (REN-08)."""


class DoesNotFit(RenderError):
    """The text does not fit the title-safe area at the minimum scale (REN-07)."""


@dataclass(frozen=True)
class Block:
    name: str  # "title" | "when" | "where" | "line"
    rect: Rect  # bounding box of the block's text, in canvas pixels, as the browser reports it
    font_px: float
    font_weight: int


@dataclass(frozen=True)
class RenderResult:
    scale: float
    blocks: list[Block]


def _outline(r: Rect, colour: str) -> str:
    return (
        f'<div style="position:absolute;box-sizing:border-box;border:3px solid {colour};'
        f'left:{r.x}px;top:{r.y}px;width:{r.w}px;height:{r.h}px"></div>'
    )


def build_html(slide: SlideText, geo: Geometry, scale: float, guides: bool = False) -> str:
    blocks = "".join(
        f'<div data-block="{n}" style="font-size:{geo.font_px[n] * scale}px;font-weight:{geo.font_weight[n]}">'
        f"{escape(getattr(slide, n))}</div>"
        for n in FIELDS
        if getattr(slide, n)
    )
    g = _outline(geo.centre, "red") + _outline(geo.safe, "yellow") if guides else ""
    s = geo.safe
    return f"""<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><style>
@font-face {{ font-family: 'Montserrat'; src: url({geo.font_file.resolve().as_uri()}); font-weight: 100 900; }}
html, body {{ margin: 0; padding: 0; }}
body {{ width: {geo.canvas_w}px; height: {geo.canvas_h}px; position: relative; overflow: hidden;
  background: url({geo.background.resolve().as_uri()}) 0 0 / {geo.canvas_w}px {geo.canvas_h}px no-repeat; }}
#text {{ position: absolute; left: {s.x}px; top: {s.y}px; width: {s.w}px; height: {s.h}px;
  display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
  font-family: 'Montserrat'; color: #fff; hyphens: auto; text-shadow: 0 2px 8px rgba(0,0,0,.6); }}
#text div {{ margin: 0.2em 0; }}
</style></head><body><div id="text">{blocks}</div>{g}</body></html>"""


_MEASURE = """() => [...document.querySelectorAll('[data-block]')].map(el => {
  const r = document.createRange(); r.selectNodeContents(el);
  const b = r.getBoundingClientRect(), cs = getComputedStyle(el);
  return {name: el.dataset.block, x: b.x, y: b.y, w: b.width, h: b.height,
          px: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight)};
})"""


def render(slide: SlideText, assets: Path, out: Path, guides: bool = False) -> RenderResult:
    geo = Geometry.load(assets)
    if not geo.font_file.is_file():
        raise FontMissing(f"font file not found: {geo.font_file}")
    scale = 1.0
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
        page_file = Path(tmp) / "slide.html"
        page_file.write_text(build_html(slide, geo, scale, guides), encoding="utf-8")
        browser = pw.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": geo.canvas_w, "height": geo.canvas_h}, device_scale_factor=1)
            page.goto(page_file.as_uri())
            page.evaluate("document.fonts.ready")
            ok = page.evaluate(
                "document.fonts.check('700 40px Montserrat') && "
                "[...document.fonts].some(f => f.family.includes('Montserrat') && f.status === 'loaded')"
            )
            if not ok:
                raise FontMissing(f"font did not load: {geo.font_file}")
            blocks = [
                Block(m["name"], Rect(m["x"], m["y"], m["w"], m["h"]), m["px"], m["weight"])
                for m in page.evaluate(_MEASURE)
            ]
            page.screenshot(path=str(out), type="png")
        finally:
            browser.close()
    return RenderResult(scale=scale, blocks=blocks)
