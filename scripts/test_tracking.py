#!/usr/bin/env python3
"""Tests for the tracking tools (specs/modules/tracking.md). Run: scripts/test_tracking.py"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_with(state_edit, backlog_edit=lambda b: b):
    """Run check-tracking.py on a copy of the repo's tracking files with STATE.md edited; return its output."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "scripts").mkdir()
        shutil.copy(ROOT / "scripts/check-tracking.py", tmp / "scripts")
        for name in ("BACKLOG.md", "IDEAS.md", "README.md"):
            shutil.copy(ROOT / name, tmp)
        shutil.copytree(ROOT / "tests/church", tmp / "tests/church", ignore=shutil.ignore_patterns("runs"))
        (tmp / "BACKLOG.md").write_text(backlog_edit((ROOT / "BACKLOG.md").read_text()))
        (tmp / "STATE.md").write_text(state_edit((ROOT / "STATE.md").read_text()))
        done = subprocess.run([sys.executable, tmp / "scripts/check-tracking.py"], capture_output=True, text=True)
        return done.stdout


def trk_01_repo_state_passes():
    assert "tracking ok" in check_with(lambda s: s)


def trk_01_missing_section_fails():
    assert "sections" in check_with(lambda s: s.replace("## Good to know", "## Notes"))


def trk_01_too_many_lines_fail():
    assert "lines" in check_with(lambda s: s + "- filler\n" * 80)


def trk_01_long_line_fails():
    assert "characters" in check_with(lambda s: s + "x" * 121 + "\n")


def trk_01_version_number_fails():
    assert "version" in check_with(lambda s: s + "- out as v9.9.9\n")


def trk_02_done_task_fails():
    assert "HAR-01" in check_with(lambda s: s + "- HAR-01 is done\n")


def trk_02_done_task_in_path_fails():
    assert "HAR-01" in check_with(lambda s: s + "- see `tests/manual/runs/2026-11-16-HAR-01.md`\n")


def trk_02_next_without_open_task_fails():
    edit = lambda s: re.sub(r"## Next\n.*?(?=## Waiting)", "## Next\nNothing.\n\n", s, flags=re.S)
    assert "## Next names no open" in check_with(edit)


def trk_03_gate3_missing_from_waiting_fails():
    row = "| TST-98 | Run it | X | S | gate3: `tests/church/propresenter.md` |\n"
    assert "TST-98" in check_with(lambda s: s, lambda b: b + row)


def trk_03_blocked_missing_fails():
    row = "| TST-99 | Waits | X | S | blocked: waits for someone |\n"
    assert "TST-99 is blocked in BACKLOG but not under ## Blocked" in check_with(lambda s: s, lambda b: b + row)


def trk_03_open_task_under_blocked_fails():
    assert "VS1-01" in check_with(lambda s: s.replace("## Blocked\n", "## Blocked\n- VS1-01 waits\n"))


def trk_09_duplicate_id_fails():
    row = "| VS1-01 | Again | X | S | done |\n"
    assert "VS1-01 is used by 2 rows" in check_with(lambda s: s, lambda b: b + row)


if __name__ == "__main__":
    tests = [(n, f) for n, f in list(globals().items()) if n.startswith("trk_")]
    failed = 0
    for name, test in tests:
        try:
            test()
        except AssertionError as error:
            failed += 1
            print(f"FAILED {name} {error}")
    print(f"{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
