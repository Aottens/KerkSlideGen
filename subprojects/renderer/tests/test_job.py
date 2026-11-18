"""VS1-05: the render job behind `.github/workflows/render.yml` (`subprojects/renderer/job.py`).
INT-04, INT-07, DLV-01, DLV-05, DLV-08, CND-05, CND-06. Offline: `claude -p` replays recorded results (CND-08) and the
callback goes to a local HTTP server.

`job.main(argv, env, run=, render_fn=, today=)`: `env` holds CALLBACK_URL, CALLBACK_SECRET and GITHUB_EVENT_PATH;
`run` stands in for subprocess.run inside condense; `render_fn(slide, assets, out)` for slidegen's render.
The signature travels in the query string (`?sig=<hex>`): an Apps Script web app cannot read request headers.
"""
import base64
import hashlib
import hmac
import json
import re
import sys
import threading
from datetime import date
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from test_condense import KERST_SLIDE, FakeRun, reply

import job
from slidegen.render import DoesNotFit, FontMissing

REPO = Path(__file__).resolve().parents[3]
WORKFLOWS = REPO / ".github" / "workflows"
RENDER_YML = WORKFLOWS / "render.yml"
SECRET = "test-secret-not-real"
TODAY = date(2026, 11, 18)
TEXT = "Kerstnachtdienst om 22.00 uur in de grote zaal, daarna chocolademelk."
CHANGE = "Graag de glühwein ook noemen."
PAYLOAD = {
    "id": "R20261117-K7Q",
    "round": 1,
    "text": TEXT,
    "change": "",
    "event_date": "2026-12-24",
    "show_until": "",
    "image": False,
}
PNG = b"\x89PNG\r\n\x1a\nfake"


class Callback:
    """A local stand-in for the Apps Script web app: records each POST, answers with `status`."""

    def __init__(self):
        self.posts: list[dict] = []
        self.status = 200
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802
                body = self.rfile.read(int(self.headers["Content-Length"]))
                outer.posts.append({"path": self.path, "headers": dict(self.headers), "body": body})
                self.send_response(outer.status)
                self.end_headers()
                self.wfile.write(b'{"ok":true}')

            def log_message(self, *a):
                pass

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}/exec"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def json(self, i: int = -1) -> dict:
        return json.loads(self.posts[i]["body"])


@pytest.fixture
def callback():
    cb = Callback()
    yield cb
    cb.server.shutdown()


def event(tmp_path: Path, **payload) -> Path:
    p = tmp_path / "event.json"
    data = {**PAYLOAD, **payload}
    data = {k: v for k, v in data.items() if v is not None}  # None = leave the field out
    p.write_text(json.dumps({"action": "slide-request", "client_payload": data}), encoding="utf-8")
    return p


def env(cb: Callback, path: Path, **over) -> dict:
    e = {"CALLBACK_URL": cb.url, "CALLBACK_SECRET": SECRET, "GITHUB_EVENT_PATH": str(path), **over}
    return {k: v for k, v in e.items() if v is not None}


class FakeRender:
    """Raises the queued exceptions in turn, then writes a PNG. Records the slides it got."""

    def __init__(self, *errors):
        self.errors = list(errors)
        self.slides = []

    def __call__(self, slide, assets, out, *a, **kw):
        self.slides.append(slide)
        if self.errors:
            raise self.errors.pop(0)
        Path(out).write_bytes(PNG)


def go(cb, tmp_path, run=None, render_fn=None, argv=(), **payload) -> int:
    return job.main(
        list(argv), env(cb, event(tmp_path, **payload)), run=run or FakeRun(reply()),
        render_fn=render_fn or FakeRender(), today=TODAY,
    )


def check_sig(post: dict) -> None:
    sig = parse_qs(urlsplit(post["path"]).query)["sig"][0]
    assert sig == hmac.new(SECRET.encode(), post["body"], hashlib.sha256).hexdigest()


# INT-04 ---------------------------------------------------------------------------------------------------------------

def test_int_04_payload_fields_reach_condense(callback, tmp_path):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, show_until="2027-01-06") == 0
    stdin = run.calls[0]["input"]
    assert TEXT in stdin and "2026-12-24" in stdin
    body = callback.json()
    assert body["id"] == "R20261117-K7Q" and body["round"] == 1 and body["ok"] is True
    assert body["slide"]["show_until"] == "2027-01-06"  # CND-04: the form's last show date


@pytest.mark.parametrize(
    "payload",
    [{"id": "R2026 <script>"}, {"id": ""}, {"id": None}, {"round": 0}, {"round": "1"}, {"round": True}, {"round": 4}],
    ids=["id-chars", "id-empty", "id-missing", "round-0", "round-str", "round-bool", "round-4"],
)
def test_int_04_bad_id_or_round_fails_the_run_without_a_post(callback, tmp_path, capsys, payload):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, **payload) == 1
    assert callback.posts == [] and run.calls == []
    assert "<script>" not in capsys.readouterr().out


@pytest.mark.parametrize(
    "payload, reason",
    [
        ({"text": ""}, "text"),
        ({"text": None}, "text"),
        ({"text": "a" * 5001}, "text"),
        ({"change": 3}, "change"),
        ({"event_date": "24-12-2026"}, "event_date"),
        ({"show_until": "morgen"}, "show_until"),
        ({"image": "yes"}, "image"),
        ({"name": "Marja Jansen"}, "field"),
        ({"email": "marja@example.org"}, "field"),
    ],
    ids=["text-empty", "text-missing", "text-long", "change-type", "event-date", "show-until", "image-type",
         "name", "email"],
)
def test_int_04_payload_outside_the_interface_goes_to_visual_team(callback, tmp_path, payload, reason):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, **payload) == 0
    body = callback.json()
    assert body["ok"] is False and reason in body["reason"]
    assert run.calls == []
    assert "Marja" not in body["reason"] and "marja@" not in body["reason"]


@pytest.mark.parametrize("kind", ["activity", "occurrence", "something"])
def test_int_04_only_kind_request_in_this_build(callback, tmp_path, kind):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, kind=kind) == 0
    assert callback.json()["ok"] is False and run.calls == []


def test_int_04_kind_request_is_a_request(callback, tmp_path):
    assert go(callback, tmp_path, kind="request") == 0
    assert callback.json()["ok"] is True


def test_int_04_workflow_runs_on_slide_request_dispatch():
    text = RENDER_YML.read_text(encoding="utf-8")
    assert re.search(r"repository_dispatch:\s*\n\s*types:\s*\[\s*slide-request\s*\]", text)
    assert "job.py" in text


# INT-07 ---------------------------------------------------------------------------------------------------------------

def test_int_07_no_workflow_prints_or_uploads_payload_fields():
    for wf in WORKFLOWS.glob("*.y*ml"):
        text = wf.read_text(encoding="utf-8")
        for expr in re.findall(r"\$\{\{(.*?)\}\}", text):
            assert "client_payload" not in expr and "github.event.inputs" not in expr, f"{wf.name}: {expr}"
        assert not re.search(r"(echo|cat|printf|tee|jq)\b[^\n]*GITHUB_EVENT_PATH", text), wf.name
    render = RENDER_YML.read_text(encoding="utf-8")
    assert "upload-artifact" not in render
    assert "set -x" not in render and "ACTIONS_STEP_DEBUG" not in render
    # The only expressions in render.yml are secrets handed to a step's environment.
    for line in render.splitlines():
        if "${{" in line:
            assert re.fullmatch(r"\s+[A-Z_]+: \$\{\{ secrets\.[A-Z_]+ \}\}", line), line


def test_int_07_log_shows_only_id_round_and_outcome(callback, tmp_path, capsys):
    run = FakeRun(reply(), reply())
    assert go(callback, tmp_path, run=run, render_fn=FakeRender(DoesNotFit("x")), round=2, change=CHANGE) == 0
    out, err = capsys.readouterr()
    log = out + err
    for secret_text in (TEXT, CHANGE, "glühwein", *KERST_SLIDE.values(), base64.b64encode(PNG).decode(), SECRET):
        assert secret_text not in log
    lines = [line for line in log.splitlines() if line.strip()]
    assert len(lines) == 1 and lines[0].startswith("R20261117-K7Q round 2: ok")


def test_int_07_failure_log_shows_only_id_round_and_reason(callback, tmp_path, capsys):
    run = FakeRun(reply(name="auth-expired", returncode=1))
    assert go(callback, tmp_path, run=run) == 0
    out, err = capsys.readouterr()
    lines = [line for line in (out + err).splitlines() if line.strip()]
    assert len(lines) == 1 and lines[0].startswith("R20261117-K7Q round 1: not ok")
    assert TEXT not in lines[0]


# DLV-01 ---------------------------------------------------------------------------------------------------------------

def test_dlv_01_body_is_signed_with_hmac_sha256(callback, tmp_path):
    assert go(callback, tmp_path) == 0
    post = callback.posts[0]
    check_sig(post)
    assert post["headers"]["Content-Type"].startswith("application/json")
    body = callback.json()
    assert set(body) == {"id", "round", "ok", "slide", "png_base64"}
    assert base64.b64decode(body["png_base64"]) == PNG
    assert body["slide"] == {**KERST_SLIDE, "show_until": "2026-12-24"}


def test_dlv_01_end_to_end_with_the_real_renderer(callback, tmp_path):
    assert job.main([], env(callback, event(tmp_path)), run=FakeRun(reply()), today=TODAY) == 0
    check_sig(callback.posts[0])
    png = base64.b64decode(callback.json()["png_base64"])
    assert png.startswith(b"\x89PNG")


def test_dlv_01_a_failed_post_fails_the_run(callback, tmp_path):
    callback.status = 500
    assert go(callback, tmp_path) == 1
    assert len(callback.posts) == 1


def test_dlv_01_an_unreachable_callback_fails_the_run(callback, tmp_path, capsys):
    url = callback.url
    callback.server.shutdown()
    callback.server.server_close()
    e = env(callback, event(tmp_path), CALLBACK_URL=url)
    assert job.main([], e, run=FakeRun(reply()), render_fn=FakeRender(), today=TODAY) == 1
    assert url not in capsys.readouterr().err  # the URL is a secret


@pytest.mark.parametrize("missing", ["CALLBACK_URL", "CALLBACK_SECRET"])
def test_dlv_01_missing_secret_fails_naming_it(callback, tmp_path, capsys, missing):
    run = FakeRun(reply())
    e = env(callback, event(tmp_path), **{missing: None})
    assert job.main([], e, run=run, render_fn=FakeRender(), today=TODAY) == 1
    err = capsys.readouterr().err
    assert missing in err and SECRET not in err and callback.url not in err
    assert run.calls == [] and callback.posts == []  # no Claude usage before the secrets are there


# CND-05 ---------------------------------------------------------------------------------------------------------------

def test_cnd_05_workflow_installs_a_pinned_claude_code_and_hands_it_the_token():
    text = RENDER_YML.read_text(encoding="utf-8")
    assert re.search(r"@anthropic-ai/claude-code@\d+\.\d+\.\d+\b", text)
    assert "CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}" in text
    assert "ANTHROPIC_API_KEY" not in text
    for uses in re.findall(r"uses:\s*(\S+)", text):
        assert uses.startswith("actions/") or re.search(r"@[0-9a-f]{40}$", uses), uses  # third parties by SHA


# CND-06 ---------------------------------------------------------------------------------------------------------------

def test_cnd_06_a_render_that_does_not_fit_gets_one_more_condense_naming_it(callback, tmp_path):
    run = FakeRun(reply(), reply())
    render = FakeRender(DoesNotFit("does not fit"))
    assert go(callback, tmp_path, run=run, render_fn=render) == 0
    assert len(run.calls) == 2 and len(render.slides) == 2
    second = run.calls[1]["input"]
    assert "does not fit" in second and KERST_SLIDE["line"] in second  # the previous slide goes with it
    assert callback.json()["ok"] is True


def test_cnd_06_still_does_not_fit_goes_to_visual_team(callback, tmp_path):
    run = FakeRun(reply(), reply())
    assert go(callback, tmp_path, run=run, render_fn=FakeRender(DoesNotFit("a"), DoesNotFit("b"))) == 0
    assert len(run.calls) == 2
    body = callback.json()
    assert body["ok"] is False and "does not fit" in body["reason"]


# DLV-05 ---------------------------------------------------------------------------------------------------------------

def test_dlv_05_change_text_goes_with_the_original_request(callback, tmp_path):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, round=2, change=CHANGE) == 0
    stdin = run.calls[0]["input"]
    assert TEXT in stdin and CHANGE in stdin
    assert callback.json()["round"] == 2


# DLV-08 ---------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "run, render_fn, payload, reason",
    [
        (FakeRun(reply(name="auth-expired", returncode=1)), None, {}, "login"),  # CND-07
        (FakeRun(reply({**KERST_SLIDE, "title": "x" * 40}), reply({**KERST_SLIDE, "title": "x" * 40})), None, {},
         "title"),  # CND-06, over budget twice
        (FakeRun(reply(), reply()), FakeRender(DoesNotFit("a"), DoesNotFit("b")), {}, "does not fit"),  # CND-06
        (None, FakeRender(FontMissing("font file not found")), {}, "font"),  # REN-08
        (None, FakeRender(RuntimeError(TEXT)), {}, "RuntimeError"),  # anything else, its message withheld
        (None, None, {"image": True}, "image fetch not built yet"),  # DLV-14 comes with VS2-05
        (None, None, {"kind": "activity"}, "not built yet"),  # agenda comes with VS4
        (None, None, {"text": ""}, "text"),  # INT-04
    ],
    ids=["claude-login", "over-budget", "does-not-fit", "font-missing", "unexpected", "image", "agenda", "payload"],
)
def test_dlv_08_every_failure_posts_id_round_and_reason(callback, tmp_path, run, render_fn, payload, reason):
    assert go(callback, tmp_path, run=run, render_fn=render_fn, **{"round": 3, **payload}) == 0
    post = callback.posts[0]
    check_sig(post)
    body = callback.json()
    assert set(body) == {"id", "round", "ok", "reason"}
    assert body["id"] == "R20261117-K7Q" and body["round"] == 3 and body["ok"] is False
    assert reason in body["reason"] and TEXT not in body["reason"]


@pytest.mark.parametrize("module", ["slidegen.cli", "slidegen.condense", "slidegen.render"])
def test_dlv_08_import_error_is_posted(callback, tmp_path, capsys, monkeypatch, module):
    """FIX-01: a slidegen import that fails (Playwright, a missing wheel) inside the job step still posts a failure."""
    monkeypatch.setitem(sys.modules, module, None)  # the next import of it raises ImportError
    assert go(callback, tmp_path, render_fn=None) == 0
    check_sig(callback.posts[0])
    body = callback.json()
    assert set(body) == {"id", "round", "ok", "reason"} and body["ok"] is False
    assert body["reason"].startswith("internal error: ") and "Error" in body["reason"]
    assert TEXT not in capsys.readouterr().err


def test_dlv_08_setup_failure_posts_a_reason(callback, tmp_path):
    run = FakeRun()
    assert go(callback, tmp_path, run=run, argv=["--setup-failed"]) == 1
    check_sig(callback.posts[0])
    body = callback.json()
    assert body == {"id": "R20261117-K7Q", "round": 1, "ok": False, "reason": "render job setup failed"}
    assert run.calls == []


def test_dlv_08_workflow_posts_when_a_setup_step_fails():
    text = RENDER_YML.read_text(encoding="utf-8")
    assert re.search(r"if: failure\(\) && steps\.job\.outcome == 'skipped'\s*\n\s*run: python3 job\.py --setup-failed",
                     text)
