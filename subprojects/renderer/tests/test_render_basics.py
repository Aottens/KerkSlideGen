"""VS1-01: REN-01..05 and REN-08 (specs/modules/render.md)."""
import json

import pytest
from PIL import Image

from slidegen import cli
from slidegen.layout import Geometry, LayoutError, Rect
from slidegen.render import FontMissing, build_html, render
from slidegen.slide import SlideText


def test_slide_text_needs_a_title():
    with pytest.raises(ValueError):
        SlideText.from_json({"title": "  ", "when": "zondag"})
    assert SlideText.from_json({"title": "Alpha"}) == SlideText(title="Alpha")


def test_ren_01_output_has_the_background_size(assets, kerst, tmp_path):
    out = tmp_path / "s.png"
    render(kerst, assets, out)
    assert Image.open(out).size == Image.open(assets / "background.png").size == (3615, 768)


def test_ren_02_centre_is_16_9_full_height_centred(assets):
    geo = Geometry.load(assets)
    assert (geo.canvas_w, geo.canvas_h) == (3615, 768)
    assert geo.centre.h == 768 and geo.centre.y == 0
    assert geo.centre.w == pytest.approx(768 * 16 / 9, abs=1)
    assert geo.centre.x + geo.centre.w / 2 == pytest.approx(3615 / 2, abs=1)


def test_ren_02_explicit_centre_from_layout(assets_copy):
    layout = json.loads((assets_copy / "layout.json").read_text())
    layout["centre"] = {"x": 1000, "y": 0, "w": 1365, "h": 768}
    (assets_copy / "layout.json").write_text(json.dumps(layout))
    assert Geometry.load(assets_copy).centre == Rect(1000, 0, 1365, 768)


def test_ren_02_background_narrower_than_centre_is_refused(assets_copy):
    Image.new("RGB", (1000, 768), (10, 20, 60)).save(assets_copy / "background.png")
    with pytest.raises(LayoutError, match="1000"):
        Geometry.load(assets_copy)


def test_ren_03_safe_area_is_centre_inset_by_margin(assets):
    geo = Geometry.load(assets)
    c = geo.centre
    assert geo.safe.x == pytest.approx(c.x + 0.1 * c.w, abs=1)
    assert geo.safe.y == pytest.approx(0.1 * c.h, abs=1)
    assert geo.safe.w == pytest.approx(0.8 * c.w, abs=1)
    assert geo.safe.h == pytest.approx(0.8 * c.h, abs=1)


def test_ren_03_text_inside_safe_area(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png")
    safe = Geometry.load(assets).safe
    assert result.blocks
    for block in result.blocks:
        assert safe.contains(block.rect), block


def test_ren_04_guides_only_with_flag(assets, kerst, tmp_path):
    geo = Geometry.load(assets)
    plain, guided = tmp_path / "plain.png", tmp_path / "guided.png"
    render(kerst, assets, plain)
    render(kerst, assets, guided, guides=True)
    bg = Image.open(assets / "background.png").convert("RGB")
    # A point on the centre area's left edge and one on the safe area's top edge, away from any text.
    points = [(int(geo.centre.x) + 1, int(geo.canvas_h * 0.9)), (int(geo.safe.x) + 20, int(geo.safe.y) + 1)]
    for p in points:
        assert _close(Image.open(plain).convert("RGB").getpixel(p), bg.getpixel(p)), p
        assert not _close(Image.open(guided).convert("RGB").getpixel(p), bg.getpixel(p)), p


def test_ren_05_blocks_in_order(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png")
    assert [b.name for b in result.blocks] == ["title", "when", "where", "line"]
    tops = [b.rect.y for b in result.blocks]
    assert tops == sorted(tops)


def test_ren_05_empty_fields_leave_no_block(assets, tmp_path):
    slide = SlideText(title="Taartverkoop", when="", where="De hal", line="")
    result = render(slide, assets, tmp_path / "s.png")
    assert [b.name for b in result.blocks] == ["title", "where"]
    html = build_html(slide, Geometry.load(assets), 1.0)
    assert 'data-block="when"' not in html and 'data-block="line"' not in html


def test_ren_08_montserrat_weights_from_assets_only(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png")
    assert {b.name: b.font_weight for b in result.blocks} == {"title": 700, "when": 600, "where": 600, "line": 400}
    html = build_html(kerst, Geometry.load(assets), 1.0)
    assert "http://" not in html and "https://" not in html
    assert (assets / "fonts" / "Montserrat-wght.ttf").as_uri() in html
    assert "local(" not in html


def test_ren_08_missing_font_is_an_error(assets_copy, kerst, tmp_path):
    (assets_copy / "fonts" / "Montserrat-wght.ttf").unlink()
    with pytest.raises(FontMissing):
        render(kerst, assets_copy, tmp_path / "s.png")


def test_cli_render_writes_png(assets, tmp_path):
    src, out = tmp_path / "s.json", tmp_path / "s.png"
    src.write_text(json.dumps({"title": "Alpha-avond", "when": "Maandag 18 januari"}))
    assert cli.main(["render", str(src), "-o", str(out), "--assets", str(assets)]) == 0
    assert Image.open(out).size == (3615, 768)


def _close(a, b, tol=6):
    return all(abs(x - y) <= tol for x, y in zip(a, b, strict=True))
