import json
import shutil
from pathlib import Path

import pytest

from slidegen.slide import SlideText

REPO = Path(__file__).resolve().parents[3]
ASSETS = REPO / "assets"
FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def assets() -> Path:
    return ASSETS


@pytest.fixture
def assets_copy(tmp_path) -> Path:
    """A writable copy of the church's assets, for tests that break them."""
    dst = tmp_path / "assets"
    shutil.copytree(ASSETS, dst)
    return dst


@pytest.fixture
def kerst() -> SlideText:
    return SlideText.from_json(json.loads((FIXTURES / "kerstnacht.json").read_text()))
