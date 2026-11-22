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
        self.gets: list[str] = []
        self.status = 200
        self.answer = b'{"ok":true}'
        self.answers: list[bytes] = []  # answered first, one per POST, before `answer`
        self.image: bytes = b'{"error": "no image"}'  # what a GET ?image= answers (DLV-14)
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                outer.gets.append(self.path)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(outer.image)

            def do_POST(self):  # noqa: N802
                body = self.rfile.read(int(self.headers["Content-Length"]))
                outer.posts.append({"path": self.path, "headers": dict(self.headers), "body": body})
                self.send_response(outer.status)
                self.end_headers()
                self.wfile.write(outer.answers.pop(0) if outer.answers else outer.answer)

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


def go(cb, tmp_path, run=None, render_fn=None, argv=(), sleep=lambda s: None, **payload) -> int:
    return job.main(
        list(argv), env(cb, event(tmp_path, **payload)), run=run or FakeRun(reply()),
        render_fn=render_fn or FakeRender(), today=TODAY, sleep=sleep,
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


def test_int_04_an_unknown_kind_goes_to_visual_team(callback, tmp_path):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, kind="something") == 0
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
    assert len(callback.posts) == 4, "posted again 3 times before it gives up"


def test_dlv_01_an_unreachable_callback_fails_the_run(callback, tmp_path, capsys):
    url = callback.url
    callback.server.shutdown()
    callback.server.server_close()
    e = env(callback, event(tmp_path), CALLBACK_URL=url)
    pauses = []
    assert job.main([], e, run=FakeRun(reply()), render_fn=FakeRender(), today=TODAY, sleep=pauses.append) == 1
    assert pauses == [30, 30, 30], "a network error is tried again too"
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
        (None, None, {"image": True}, "image fetch failed"),  # DLV-14: the web app gave no image
        (None, None, {"kind": "occurrence"}, "invalid payload: text"),  # AGD-05: an occurrence carries no text
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


# DLV-14 ---------------------------------------------------------------------------------------------------------------

IMAGE = b"\xff\xd8\xff\xe0fake-jpeg"


class ImageRender(FakeRender):
    """Records the image it got and its bytes while the job still holds it."""

    def __call__(self, slide, assets, out, *a, **kw):
        self.kw = kw
        img = kw.get("image")
        self.image_bytes = Path(img).read_bytes() if img else None
        super().__call__(slide, assets, out, *a, **kw)


def serve_image(cb, ext="jpg", data=IMAGE):
    cb.image = json.dumps({"ext": ext, "base64": base64.b64encode(data).decode()}).encode()


def test_dlv_14_image_is_fetched_with_a_signed_url_valid_15_minutes(callback, tmp_path, monkeypatch):
    serve_image(callback)
    monkeypatch.setattr(job.time, "time", lambda: 1_800_000_000.5)
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, image=True) == 0
    assert len(callback.gets) == 1
    u = urlsplit(callback.gets[0])
    assert u.path == "/exec"
    q = parse_qs(u.query)
    assert q["image"] == ["R20261117-K7Q"]
    exp = int(q["exp"][0])
    assert exp == 1_800_000_000 + 900
    assert q["sig"][0] == hmac.new(SECRET.encode(), f"R20261117-K7Q.{exp}".encode(), hashlib.sha256).hexdigest()


def test_dlv_14_request_with_image_renders_with_it(callback, tmp_path):
    serve_image(callback, ext="heic")
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, image=True) == 0
    assert render.image_bytes == IMAGE
    assert Path(render.kw["image"]).suffix == ".heic"
    assert render.kw["slide_id"] == "R20261117-K7Q"  # REN-12: the id decides the side
    body = callback.json()
    assert body["ok"] is True, body.get("reason")
    assert not Path(render.kw["image"]).exists(), "the image stays only on the runner, only for the run"


def test_dlv_14_request_without_image_fetches_nothing(callback, tmp_path):
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, image=False) == 0
    assert callback.gets == [] and render.kw.get("image") is None


@pytest.mark.parametrize(
    "answer",
    [b'{"error": "wrong signature"}', b"<html>not json</html>", b'{"ext": "pdf", "base64": "AAAA"}',
     b'{"ext": "jpg", "base64": "***"}', b'{"ext": "jpg", "base64": ""}'],
    ids=["error", "not-json", "ext", "not-base64", "empty"],
)
def test_dlv_14_failed_fetch_is_posted_without_rendering(callback, tmp_path, answer):
    callback.image = answer
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, image=True) == 0
    assert render.slides == []
    body = callback.json()
    assert body["ok"] is False and body["reason"] == "image fetch failed"


def test_dlv_14_image_is_never_logged(callback, tmp_path, capsys):
    serve_image(callback, data=b"SECRET-IMAGE-BYTES")
    assert go(callback, tmp_path, render_fn=ImageRender(), image=True) == 0
    out = capsys.readouterr()
    b64 = base64.b64encode(b"SECRET-IMAGE-BYTES").decode()
    for s in (out.out, out.err):
        assert "SECRET-IMAGE-BYTES" not in s and b64 not in s and "sig=" not in s


def test_dlv_01_a_refused_callback_fails_the_run(callback, tmp_path, capsys):
    """The web app answers 200 even when it refuses (INTERFACE.md section 3): the job reads the answer."""
    callback.answer = b'{"ok": false, "error": "handtekening klopt niet"}'
    assert go(callback, tmp_path) == 1
    assert "callback refused" in capsys.readouterr().err
    assert len(callback.posts) == 4


def test_dlv_01_a_refused_callback_is_posted_again_after_a_pause(callback, tmp_path):
    """A refused callback changes nothing (DLV-01), so posting it again is safe: many callbacks at once can make the web
    app's script lock time out (FIX-10)."""
    callback.answers = [b'{"ok": false}'] * 2
    pauses = []
    assert go(callback, tmp_path, sleep=pauses.append) == 0
    assert len(callback.posts) == 3
    assert pauses == [30, 30]
    assert len({p["body"] for p in callback.posts}) == 1, "the same signed body each time"
    for p in callback.posts:
        check_sig(p)


def test_dlv_01_the_job_waits_longer_than_the_web_app_waits_for_its_lock():
    """doPost waits up to 2 minutes for the script lock (FIX-10); the job must not give up on it first."""
    main = (REPO / "subprojects/google/src/main.js").read_text(encoding="utf-8")
    post = main[main.index("function doPost("):]
    post = post[: post.index("\nfunction ")]
    wait = int(re.search(r"waitLock\((\d+)\)", post)[1]) / 1000
    assert wait >= 120
    assert job.TIMEOUT >= wait + 60, "room for the work after the lock"


# AGD-04: the first slide of an agenda activity ------------------------------------------------------------------------

WHEN = "woensdag 25 november, 19.30 uur"
ACTIVITY = {"id": "A1b2c3d4e", "kind": "activity", "text": "Bijbelkring\n\nWe lezen Marcus.",
            "event_date": "2026-11-25", "when": WHEN, "where": "Zaal 2"}


def test_agd_04_activity_keeps_when_and_where_from_the_agenda(callback, tmp_path):
    run = FakeRun(reply())  # the recorded slide says 24 december, 22.00 uur, Grote zaal
    assert go(callback, tmp_path, run=run, **ACTIVITY) == 0
    body = callback.json()
    assert body["ok"] is True and body["id"] == "A1b2c3d4e"
    assert body["slide"]["when"] == WHEN and body["slide"]["where"] == "Zaal 2"
    assert body["slide"]["title"] == KERST_SLIDE["title"] and body["slide"]["line"] == KERST_SLIDE["line"]
    assert len(run.calls) == 1
    assert "We lezen Marcus." in run.calls[0]["input"]


def test_agd_04_activity_with_empty_where_stays_empty(callback, tmp_path):
    assert go(callback, tmp_path, **{**ACTIVITY, "where": ""}) == 0
    assert callback.json()["slide"]["where"] == ""


def test_agd_04_activity_renders_the_agenda_fields(callback, tmp_path):
    render = FakeRender()
    assert go(callback, tmp_path, render_fn=render, **ACTIVITY) == 0
    assert render.slides[0].when == WHEN and render.slides[0].where == "Zaal 2"


def test_agd_04_activity_retry_after_does_not_fit_keeps_the_agenda_fields(callback, tmp_path):
    render = FakeRender(DoesNotFit())
    assert go(callback, tmp_path, run=FakeRun(reply(), reply()), render_fn=render, **ACTIVITY) == 0
    assert [s.when for s in render.slides] == [WHEN, WHEN]


@pytest.mark.parametrize(
    "payload, reason",
    [
        ({"when": "x" * 41}, "when"),
        ({"where": 3}, "where"),
        ({"when": None}, "when"),
    ],
    ids=["when-long", "where-type", "when-missing"],
)
def test_agd_04_activity_with_bad_when_or_where_goes_to_visual_team(callback, tmp_path, payload, reason):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, **{**ACTIVITY, **payload}) == 0
    body = callback.json()
    assert body["ok"] is False and reason in body["reason"] and run.calls == []


def test_agd_04_a_request_carries_no_when_or_where(callback, tmp_path):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, when=WHEN) == 0
    assert callback.json()["ok"] is False and run.calls == []


# AGD-05: one date of an approved activity, rendered without Claude ----------------------------------------------------

SLIDE = {"title": "Bijbelkring", "when": WHEN, "where": "Zaal 2", "line": "Iedereen welkom"}
OCCURRENCE = {"id": "A1b2c3d4e-2026-11-25", "kind": "occurrence", "event_date": "2026-11-25", "slide": SLIDE,
              "text": None, "change": None, "show_until": None, "image": None}


def test_agd_05_limits_match_condense():
    from slidegen.condense import LIMITS
    assert job.SLIDE_LIMITS == LIMITS


def test_agd_05_occurrence_never_calls_claude(callback, tmp_path):
    run = FakeRun()  # any call to claude -p would pop from an empty queue
    assert go(callback, tmp_path, run=run, **OCCURRENCE) == 0
    body = callback.json()
    assert body["ok"] is True and body["id"] == "A1b2c3d4e-2026-11-25" and run.calls == []
    assert {k: body["slide"][k] for k in SLIDE} == SLIDE
    assert base64.b64decode(body["png_base64"]) == PNG


def test_agd_05_occurrence_renders_the_slide_as_sent(callback, tmp_path):
    render = FakeRender()
    assert go(callback, tmp_path, render_fn=render, **OCCURRENCE) == 0
    s = render.slides[0]
    assert (s.title, s.when, s.where, s.line) == tuple(SLIDE.values())


def test_agd_05_occurrence_with_empty_where_renders(callback, tmp_path):
    assert go(callback, tmp_path, run=FakeRun(), **{**OCCURRENCE, "slide": {**SLIDE, "where": ""}}) == 0
    assert callback.json()["ok"] is True and callback.json()["slide"]["where"] == ""


def test_agd_05_occurrence_that_does_not_fit_goes_to_visual_team_without_claude(callback, tmp_path):
    run = FakeRun()
    assert go(callback, tmp_path, run=run, render_fn=FakeRender(DoesNotFit()), **OCCURRENCE) == 0
    body = callback.json()
    assert body["ok"] is False and body["reason"] == "does not fit" and run.calls == []


@pytest.mark.parametrize(
    "payload",
    [
        {"slide": None},
        {"slide": "Bijbelkring"},
        {"slide": {**SLIDE, "title": ""}},
        {"slide": {**SLIDE, "title": "x" * 33}},
        {"slide": {**SLIDE, "when": ""}},
        {"slide": {**SLIDE, "where": "x" * 41}},
        {"slide": {**SLIDE, "line": "x" * 71}},
        {"slide": {**SLIDE, "line": 3}},
        {"slide": {**SLIDE, "extra": "x"}},
        {"text": "Bijbelkring"},
    ],
    ids=["missing", "not-object", "no-title", "title-long", "no-when", "where-long", "line-long", "line-type",
         "extra-field", "has-text"],
)
def test_agd_05_occurrence_with_a_bad_slide_goes_to_visual_team(callback, tmp_path, payload):
    run, render = FakeRun(), FakeRender()
    assert go(callback, tmp_path, run=run, render_fn=render, **{**OCCURRENCE, **payload}) == 0
    body = callback.json()
    assert body["ok"] is False and body["reason"].startswith("invalid payload")
    assert run.calls == [] and render.slides == []


def test_agd_05_a_request_carries_no_slide(callback, tmp_path):
    run = FakeRun(reply())
    assert go(callback, tmp_path, run=run, slide=SLIDE) == 0
    assert callback.json()["ok"] is False and run.calls == []


# AGD-11, AGD-12: an activity's photo (IDEA-14) ----------------------------------------------------------------------


def test_agd_11_activity_with_photo_fetches_it_by_activity_id_and_renders_with_it(callback, tmp_path):
    serve_image(callback)
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, id="A1b2c3d4e", kind="activity", when=WHEN, where="Zaal 2",
              image=True) == 0
    assert parse_qs(urlsplit(callback.gets[0]).query)["image"] == ["A1b2c3d4e"]
    assert render.image_bytes == IMAGE and render.kw["slide_id"] == "A1b2c3d4e"
    assert callback.json()["ok"] is True


def test_agd_12_occurrence_with_photo_fetches_by_activity_id_without_claude(callback, tmp_path):
    serve_image(callback, ext="png")
    run, render = FakeRun(), ImageRender()
    assert go(callback, tmp_path, run=run, render_fn=render, **{**OCCURRENCE, "image": True}) == 0
    assert parse_qs(urlsplit(callback.gets[0]).query)["image"] == ["A1b2c3d4e"]
    assert render.image_bytes == IMAGE and Path(render.kw["image"]).suffix == ".png"
    assert render.kw["slide_id"] == "A1b2c3d4e", "the side follows the activity id, not the occurrence id"
    body = callback.json()
    assert body["ok"] is True and body["id"] == "A1b2c3d4e-2026-11-25" and run.calls == []


def test_agd_12_occurrence_without_photo_fetches_nothing(callback, tmp_path):
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, **{**OCCURRENCE, "image": False}) == 0
    assert callback.gets == [] and render.kw.get("image") is None


def test_agd_12_occurrence_with_a_failed_photo_fetch_goes_to_visual_team(callback, tmp_path):
    render = ImageRender()
    assert go(callback, tmp_path, render_fn=render, **{**OCCURRENCE, "image": True}) == 0
    assert render.slides == [] and callback.json()["reason"] == "image fetch failed"


def test_agd_12_occurrence_with_a_bad_image_flag_goes_to_visual_team(callback, tmp_path):
    assert go(callback, tmp_path, **{**OCCURRENCE, "image": "yes"}) == 0
    assert callback.json()["reason"] == "invalid payload: image"


def test_agd_12_first_slide_and_every_date_get_the_same_side(callback, tmp_path):
    """REN-14 on the activity id: find an activity whose occurrence ids would pick the other side."""
    from slidegen.render import image_side

    aid = next(f"A{i:08x}" for i in range(1000) if image_side(f"A{i:08x}") != image_side(f"A{i:08x}-2026-11-25"))
    serve_image(callback)
    first, date_ = ImageRender(), ImageRender()
    assert go(callback, tmp_path, render_fn=first, id=aid, kind="activity", when=WHEN, where="", image=True) == 0
    assert go(callback, tmp_path, render_fn=date_, **{**OCCURRENCE, "id": f"{aid}-2026-11-25", "image": True}) == 0
    assert image_side(first.kw["slide_id"]) == image_side(date_.kw["slide_id"])
