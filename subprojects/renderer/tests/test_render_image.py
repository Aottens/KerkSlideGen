"""VS1-06: REN-11..14, the *with image* layout (specs/modules/render.md)."""
import hashlib
import json

import pillow_heif
import pytest
from PIL import Image

from slidegen import cli
from slidegen.layout import Geometry, LayoutError
from slidegen.render import image_side, render

LEFT_ID, RIGHT_ID = "R20261118-T01", "R20261118-T00"  # first SHA-256 byte even / odd
RED, BLUE, GREEN = (220, 30, 30), (30, 30, 220), (30, 200, 30)


def _photo(path, size=(1600, 400)):
    """Blue left quarter, red middle half, green right quarter: a centred crop to a tall box is all red."""
    w, h = size
    im = Image.new("RGB", size, RED)
    im.paste(BLUE, (0, 0, w // 4, h))
    im.paste(GREEN, (3 * w // 4, 0, w, h))
    im.save(path)
    return path


def _near(px, colour, tol=40):
    return all(abs(a - b) <= tol for a, b in zip(px[:3], colour, strict=True))


def _inner_points(r, n=5):
    """Points inside the box, away from its rounded corners."""
    steps = [(i + 1) / (n + 1) for i in range(n)]
    return [(int(r.x + r.w * a), int(r.y + r.h * b)) for a in steps for b in steps]


def test_ren_14_side_is_the_parity_of_the_ids_first_sha256_byte():
    for sid in (LEFT_ID, RIGHT_ID, "A1b2c3-2026-12-24", ""):
        expected = "left" if hashlib.sha256(sid.encode()).digest()[0] % 2 == 0 else "right"
        assert image_side(sid) == expected
    assert image_side(LEFT_ID) == "left" and image_side(RIGHT_ID) == "right"


def test_ren_11_without_image_the_text_layout(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png", slide_id=LEFT_ID)
    assert result.image is None and result.side is None


def test_ren_11_image_left_text_right_inside_safe_area(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png", image=_photo(tmp_path / "p.png"), slide_id=LEFT_ID)
    safe = Geometry.load(assets).safe
    assert result.side == "left"
    assert result.image.x == pytest.approx(safe.x, abs=1)
    assert result.image.w == pytest.approx(0.42 * safe.w, abs=1)
    assert result.image.h == pytest.approx(safe.h, abs=1)
    assert safe.contains(result.image)
    for b in result.blocks:
        assert safe.contains(b.rect), b
        assert b.rect.x >= safe.x + 0.47 * safe.w - 1, b


def test_ren_14_image_right_text_left_mirrored(assets, kerst, tmp_path):
    result = render(kerst, assets, tmp_path / "s.png", image=_photo(tmp_path / "p.png"), slide_id=RIGHT_ID)
    safe = Geometry.load(assets).safe
    assert result.side == "right"
    assert result.image.x + result.image.w == pytest.approx(safe.x + safe.w, abs=1)
    for b in result.blocks:
        assert safe.contains(b.rect), b
        assert b.rect.x + b.rect.w <= safe.x + 0.53 * safe.w + 1, b


def test_ren_14_text_aligned_towards_the_image(assets, kerst, tmp_path):
    photo = _photo(tmp_path / "p.png")
    left = render(kerst, assets, tmp_path / "l.png", image=photo, slide_id=LEFT_ID)
    right = render(kerst, assets, tmp_path / "r.png", image=photo, slide_id=RIGHT_ID)
    # Image left: every block starts at the same x (left-aligned). Image right: every block ends at the same x.
    assert len({round(b.rect.x) for b in left.blocks}) == 1
    assert len({round(b.rect.x + b.rect.w) for b in right.blocks}) == 1


def test_ren_11_layout_box_outside_safe_area_is_refused(assets_copy):
    layout = json.loads((assets_copy / "layout.json").read_text())
    layout["layouts"]["with_image"]["image"]["w"] = 1.2
    (assets_copy / "layout.json").write_text(json.dumps(layout))
    with pytest.raises(LayoutError):
        Geometry.load(assets_copy)


def test_ren_12_image_fills_its_box_cropped_around_the_centre(assets, kerst, tmp_path):
    out = tmp_path / "s.png"
    result = render(kerst, assets, out, image=_photo(tmp_path / "p.png"), slide_id=LEFT_ID)
    png = Image.open(out).convert("RGB")
    for p in _inner_points(result.image):
        assert _near(png.getpixel(p), RED), (p, png.getpixel(p))


def test_ren_12_exif_orientation_is_applied(assets, kerst, tmp_path):
    # Stored sideways: left half red, right half blue, EXIF orientation 6 (display rotated 90° clockwise),
    # so upright it is red on top and blue below.
    im = Image.new("RGB", (800, 600), RED)
    im.paste(BLUE, (400, 0, 800, 600))
    exif = Image.Exif()
    exif[0x0112] = 6
    path = tmp_path / "p.jpg"
    im.save(path, exif=exif, quality=95)
    out = tmp_path / "s.png"
    result = render(kerst, assets, out, image=path, slide_id=LEFT_ID)
    png, r = Image.open(out).convert("RGB"), result.image
    assert _near(png.getpixel((int(r.x + r.w / 2), int(r.y + r.h * 0.2))), RED)
    assert _near(png.getpixel((int(r.x + r.w / 2), int(r.y + r.h * 0.8))), BLUE)


@pytest.mark.parametrize("suffix", [".heic", ".webp", ".jpg"])
def test_ren_12_phone_and_web_formats_are_read(assets, kerst, tmp_path, suffix):
    pillow_heif.register_heif_opener()
    path = tmp_path / f"p{suffix}"
    Image.new("RGB", (900, 1200), RED).save(path)
    out = tmp_path / "s.png"
    result = render(kerst, assets, out, image=path, slide_id=LEFT_ID)
    png = Image.open(out).convert("RGB")
    r = result.image
    assert _near(png.getpixel((int(r.x + r.w / 2), int(r.y + r.h / 2))), RED)


def test_ren_13_image_needs_an_id(assets, kerst, tmp_path):
    with pytest.raises(ValueError):
        render(kerst, assets, tmp_path / "s.png", image=_photo(tmp_path / "p.png"))


def test_ren_13_cli_image_and_id(assets, tmp_path):
    src, out = tmp_path / "s.json", tmp_path / "s.png"
    src.write_text(json.dumps({"title": "Taartverkoop", "where": "De hal"}))
    args = ["render", str(src), "-o", str(out), "--assets", str(assets), "--image", str(_photo(tmp_path / "p.png"))]
    assert cli.main([*args, "--id", RIGHT_ID]) == 0
    assert Image.open(out).size == (3615, 768)
    assert cli.main(args) == 1  # an image without an id


def test_ren_06_title_beside_image_shrinks_before_it_is_hyphenated(assets, kerst, tmp_path):
    """Owner, 2026-11-18: "eerst kleiner maken". "Kerstnachtdienst" beside an image stays one word on one line."""
    result = render(kerst, assets, tmp_path / "s.png", image=_photo(tmp_path / "p.png"), slide_id=LEFT_ID)
    title = next(b for b in result.blocks if b.name == "title")
    assert result.scale < 1.0
    assert title.rect.h < 1.6 * title.font_px, title  # one line: not broken as "Kerstnacht-/dienst"


def test_ren_06_first_pass_does_not_hyphenate(assets, kerst):
    geo = Geometry.load(assets)
    from slidegen.render import build_html

    assert "hyphens: auto" not in build_html(kerst, geo, 1.0, hyphenate=False)
    assert "hyphens: auto" in build_html(kerst, geo, 1.0, hyphenate=True)
