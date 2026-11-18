"""VS1-02: REN-06, REN-07, REN-09, REN-10 (specs/modules/render.md)."""
import json
import sys
import time
from pathlib import Path

import pytest
from PIL import Image, ImageChops

from slidegen import cli
from slidegen.layout import Geometry
from slidegen.render import DoesNotFit, build_html, render
from slidegen.slide import SlideText

# One golden per platform: macOS and Linux Chromium rasterise glyph edges differently (REN-09 "between Chromium
# builds"). Make them with `slidegen render tests/fixtures/kerstnacht.json -o <golden>`; the Linux one comes from
# .github/workflows/golden.yml.
GOLDEN = Path(__file__).parent / "golden" / f"kerstnacht-{sys.platform}.png"

# The longest slide condense may return (CND-01: title 32, when 40, where 40, line 70 characters).
MAX = SlideText(
    title="Gemeentevergadering nieuwbouwplan",  # 33 → cut below
    when="Donderdag 22 januari 2027, 19.30-22.00",
    where="Grote zaal en bovenzaal, ingang zijdeur",
    line="Iedereen is welkom om mee te denken over de plannen voor ons kerkgebouw",
)
MAX = SlideText(title=MAX.title[:32], when=MAX.when[:40], where=MAX.where[:40], line=MAX.line[:70])


def test_ren_06_short_text_keeps_design_size(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png")
    geo = Geometry.load(assets)
    assert result.scale == 1.0
    for b in result.blocks:
        assert b.font_px == pytest.approx(geo.font_px[b.name], abs=0.5)


def test_ren_06_longest_text_shrinks_and_stays_inside(assets, tmp_path):
    big = SlideText(title=MAX.title * 3, when=MAX.when, where=MAX.where, line=MAX.line * 2)
    result = render(big, assets, tmp_path / "s.png")
    geo = Geometry.load(assets)
    assert geo.min_scale <= result.scale < 1.0
    for b in result.blocks:
        assert geo.safe.contains(b.rect), b
        assert b.font_px == pytest.approx(geo.font_px[b.name] * result.scale, abs=0.5)


def test_ren_06_max_length_slide_fits(assets, tmp_path):
    result = render(MAX, assets, tmp_path / "s.png")
    safe = Geometry.load(assets).safe
    assert all(safe.contains(b.rect) for b in result.blocks)


def test_ren_06_dutch_hyphenation_only(assets, kerst):
    html = build_html(kerst, Geometry.load(assets), 1.0)
    assert 'lang="nl"' in html
    assert "hyphens: auto" in html or "hyphens:auto" in html
    assert "break-all" not in html and "anywhere" not in html


def test_ren_07_does_not_fit_raises(assets, tmp_path):
    huge = SlideText(title="Kerstnachtdienst " * 20, line="Neem gerust iemand mee. " * 40)
    with pytest.raises(DoesNotFit):
        render(huge, assets, tmp_path / "s.png")
    assert not (tmp_path / "s.png").exists()


def test_ren_07_cli_exits_3(assets, tmp_path, capsys):
    src = tmp_path / "s.json"
    src.write_text(json.dumps({"title": "Kerstnachtdienst " * 20, "line": "Neem gerust iemand mee. " * 40}))
    assert cli.main(["render", str(src), "-o", str(tmp_path / "s.png"), "--assets", str(assets)]) == 3
    assert "does not fit" in capsys.readouterr().err


def test_ren_09_golden_image(assets, kerst, tmp_path):
    out = tmp_path / "s.png"
    render(kerst, assets, out)
    a, b = Image.open(out).convert("RGB"), Image.open(GOLDEN).convert("RGB")
    assert a.size == b.size
    diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 24 else 0)
    differing = diff.histogram()[255]
    assert differing / (a.width * a.height) <= 0.005, differing


def test_ren_10_one_render_within_10_seconds(assets, kerst, tmp_path):
    start = time.monotonic()
    render(kerst, assets, tmp_path / "s.png")
    assert time.monotonic() - start < 10
