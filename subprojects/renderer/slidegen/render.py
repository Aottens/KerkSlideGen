"""Slide text to PNG with headless Chromium (REN-01..10)."""
import hashlib
import tempfile
from dataclasses import dataclass
from html import escape
from pathlib import Path

import pillow_heif
from PIL import Image, ImageOps
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
    side: str | None = None  # "left" | "right": where the image sits; None without image
    image: Rect | None = None


def image_side(slide_id: str) -> str:
    """REN-14: left when the first byte of SHA-256 of the id is even, else right."""
    return "left" if hashlib.sha256(slide_id.encode()).digest()[0] % 2 == 0 else "right"


def _outline(r: Rect, colour: str) -> str:
    return (
        f'<div style="position:absolute;box-sizing:border-box;border:3px solid {colour};'
        f'left:{r.x}px;top:{r.y}px;width:{r.w}px;height:{r.h}px"></div>'
    )


def build_html(
    slide: SlideText, geo: Geometry, scale: float, guides: bool = False, image: Path | None = None, side: str = "left",
    hyphenate: bool = True,
) -> str:
    blocks = "".join(
        f'<div data-block="{n}" style="font-size:{geo.font_px[n] * scale}px;font-weight:{geo.font_weight[n]}">'
        f"{escape(getattr(slide, n))}</div>"
        for n in FIELDS
        if getattr(slide, n)
    )
    g = _outline(geo.centre, "red") + _outline(geo.safe, "yellow") if guides else ""
    layout = "with_image" if image else "text"
    t = geo.box(layout, "text", mirror=side == "right")
    align = ("left", "flex-start") if side == "left" else ("right", "flex-end")
    if not image:
        align = ("center", "center")
    img = ""
    if image:
        ib = geo.box(layout, "image", mirror=side == "right")
        radius = geo.layouts[layout]["image"]["radius_px"]
        img = (
            f'<img data-image src="{image.resolve().as_uri()}" style="position:absolute;left:{ib.x}px;top:{ib.y}px;'
            f'width:{ib.w}px;height:{ib.h}px;border-radius:{radius}px">'
        )
    return f"""<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><style>
@font-face {{ font-family: 'Montserrat'; src: url({geo.font_file.resolve().as_uri()}); font-weight: 100 900; }}
html, body {{ margin: 0; padding: 0; }}
body {{ width: {geo.canvas_w}px; height: {geo.canvas_h}px; position: relative; overflow: hidden;
  background: url({geo.background.resolve().as_uri()}) 0 0 / {geo.canvas_w}px {geo.canvas_h}px no-repeat; }}
#text {{ position: absolute; left: {t.x}px; top: {t.y}px; width: {t.w}px; height: {t.h}px;
  display: flex; flex-direction: column; justify-content: center; align-items: {align[1]}; text-align: {align[0]};
  font-family: 'Montserrat'; color: #fff; hyphens: {'auto' if hyphenate else 'manual'};
  text-shadow: 0 2px 8px rgba(0,0,0,.6); }}
#text div {{ margin: 0.2em 0; }}
</style></head><body>{img}<div id="text">{blocks}</div>{g}</body></html>"""


_MEASURE = """() => [...document.querySelectorAll('[data-block]')].map(el => {
  const r = document.createRange(); r.selectNodeContents(el);
  const b = r.getBoundingClientRect(), cs = getComputedStyle(el);
  return {name: el.dataset.block, x: b.x, y: b.y, w: b.width, h: b.height,
          px: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight)};
})"""


def _scales(min_scale: float) -> list[float]:
    steps, i = [], 0
    while (v := round(1 - i * 0.05, 2)) >= min_scale:
        steps.append(v)
        i += 1
    return steps


def _prepare_image(src: Path, box: Rect, dest: Path) -> None:
    """REN-12: upright, filling the box, cropped around the centre, never stretched; PNG for the browser."""
    pillow_heif.register_heif_opener()
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        ImageOps.fit(im, (round(box.w), round(box.h))).save(dest, "PNG")


def render(
    slide: SlideText, assets: Path, out: Path, guides: bool = False, image: Path | None = None, slide_id: str = ""
) -> RenderResult:
    if image and not slide_id:
        raise ValueError("an image needs a slide id (it decides the side)")
    geo = Geometry.load(assets)
    side = image_side(slide_id) if image else None
    if not geo.font_file.is_file():
        raise FontMissing(f"font file not found: {geo.font_file}")
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
        page_file = Path(tmp) / "slide.html"
        prepared = None
        if image:
            prepared = Path(tmp) / "image.png"
            _prepare_image(image, geo.box("with_image", "image"), prepared)
        text_box = geo.box("with_image" if image else "text", "text", mirror=side == "right")
        browser = pw.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": geo.canvas_w, "height": geo.canvas_h}, device_scale_factor=1)
            checked = False
            # REN-06: shrink first; hyphenate (Dutch) only when nothing fits unhyphenated
            for hyphenate, scale in ((h, sc) for h in (False, True) for sc in _scales(geo.min_scale)):
                html = build_html(slide, geo, scale, guides, prepared, side or "left", hyphenate)
                page_file.write_text(html, encoding="utf-8")
                page.goto(page_file.as_uri())
                page.evaluate("document.fonts.ready")
                if not checked:
                    ok = page.evaluate(
                        "document.fonts.check('700 40px Montserrat') && "
                        "[...document.fonts].some(f => f.family.includes('Montserrat') && f.status === 'loaded')"
                    )
                    if not ok:
                        raise FontMissing(f"font did not load: {geo.font_file}")
                    checked = True
                blocks = [
                    Block(m["name"], Rect(m["x"], m["y"], m["w"], m["h"]), m["px"], m["weight"])
                    for m in page.evaluate(_MEASURE)
                ]
                overflow = page.evaluate(
                    "(() => { const t = document.getElementById('text');"
                    " return t.scrollHeight > t.clientHeight || t.scrollWidth > t.clientWidth; })()"
                )
                if not overflow and all(geo.safe.contains(b.rect) and text_box.contains(b.rect) for b in blocks):
                    m = page.evaluate(
                        "(() => { const e = document.querySelector('[data-image]'); if (!e) return null;"
                        " const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })()"
                    )
                    page.screenshot(path=str(out), type="png")
                    return RenderResult(scale, blocks, side, Rect(*m) if m else None)
        finally:
            browser.close()
    raise DoesNotFit(f"does not fit the safe area at the minimum scale {geo.min_scale}")
