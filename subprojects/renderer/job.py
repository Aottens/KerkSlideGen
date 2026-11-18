"""The render job behind .github/workflows/render.yml: read the dispatch payload, condense, render, POST the result.

INT-04 (only the fields in INTERFACE.md), INT-07 (one log line: id, round, outcome; the repo is public),
DLV-01 (HMAC-signed callback), DLV-08 (every failure is posted), CND-06 (one more condense when it does not fit).
"""
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import asdict
from datetime import date
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ALLOWED = {"id", "round", "kind", "text", "change", "event_date", "show_until", "image"}
NOT_FIT = "the slide does not fit the safe area at the smallest text size: make it shorter (does not fit)"


def post(url: str, secret: str, body: dict) -> bool:
    data = json.dumps(body).encode()
    sig = hmac.new(secret.encode(), data, hashlib.sha256).hexdigest()
    u = urlsplit(url)
    url = urlunsplit(u._replace(query=urlencode([*parse_qsl(u.query), ("sig", sig)])))
    req = urllib.request.Request(url, data, {"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=60).close()
    except urllib.error.HTTPError as e:
        print(f"callback failed: HTTP {e.code}", file=sys.stderr)
    except (urllib.error.URLError, OSError) as e:  # the URL is a secret: name the class only
        print(f"callback failed: {type(e).__name__}", file=sys.stderr)
    else:
        return True
    return False


def parse(p: dict) -> tuple[dict | None, str]:
    """(fields, "") or (None, reason). Reasons never hold payload values (INT-04)."""
    if set(p) - ALLOWED:
        return None, "payload has a field outside INTERFACE.md"
    text, change = p.get("text"), p.get("change", "")
    if not isinstance(text, str) or not 0 < len(text) <= 5000:
        return None, "invalid payload: text"
    if not isinstance(change, str) or len(change) > 5000:
        return None, "invalid payload: change"
    for k in ("event_date", "show_until"):
        v = p.get(k, "")
        try:
            if not isinstance(v, str) or (v and date.fromisoformat(v).isoformat() != v):
                raise ValueError
        except ValueError:
            return None, f"invalid payload: {k}"
    if not isinstance(p.get("image", False), bool):
        return None, "invalid payload: image"
    kind = p.get("kind", "request")
    if kind in ("activity", "occurrence"):
        return None, "agenda kinds not built yet"
    if kind != "request":
        return None, "unknown kind (not built yet)"
    if p.get("image"):
        return None, "image fetch not built yet"
    return {"text": text, "change": change, "event_date": p.get("event_date", ""),
            "show_until": p.get("show_until", "")}, ""


def work(f: dict, run, render_fn, today: date) -> dict:
    """The success body, or {"reason": ...}. Lazy slidegen import: --setup-failed runs without it."""
    from slidegen.cli import ASSETS
    from slidegen.condense import CondenseError, Request, condense
    from slidegen.layout import LayoutError
    from slidegen.render import DoesNotFit, RenderError
    from slidegen.render import render as default_render

    try:
        render_fn = render_fn or default_render
        text = f["text"]
        if f["change"]:  # DLV-05
            text += f"\n\nAanpassing van de aanvrager:\n{f['change']}"
        req = Request(text, f["event_date"], f["show_until"])
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "slide.png"
            slide = condense(req, today, run=run)
            try:
                render_fn(slide, ASSETS, out)
            except DoesNotFit:  # CND-06
                slide = condense(req, today, run=run, previous=slide, feedback=[NOT_FIT])
                try:
                    render_fn(slide, ASSETS, out)
                except DoesNotFit:
                    return {"reason": "does not fit"}
            png = base64.b64encode(out.read_bytes()).decode()
        return {"slide": asdict(slide), "png_base64": png}
    except CondenseError as e:
        return {"reason": str(e)}
    except (RenderError, LayoutError) as e:
        return {"reason": f"render failed: {e}"}
    except Exception as e:  # noqa: BLE001 - its message may hold request text
        return {"reason": f"internal error: {type(e).__name__}"}


def main(argv, env, run=None, render_fn=None, today=None) -> int:
    for name in ("CALLBACK_URL", "CALLBACK_SECRET"):
        if not env.get(name):
            print(f"missing secret: {name}", file=sys.stderr)
            return 1
    p = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8")).get("client_payload", {})
    rid, rnd = p.get("id"), p.get("round")
    if not isinstance(rid, str) or not re.fullmatch(r"[A-Za-z0-9-]{1,64}", rid):
        print("invalid payload: id", file=sys.stderr)
        return 1
    if type(rnd) is not int or not 1 <= rnd <= 3:
        print("invalid payload: round", file=sys.stderr)
        return 1
    head = {"id": rid, "round": rnd}
    send = lambda body: post(env["CALLBACK_URL"], env["CALLBACK_SECRET"], body)  # noqa: E731
    if "--setup-failed" in argv:
        send({**head, "ok": False, "reason": "render job setup failed"})
        return 1
    fields, reason = parse(p)
    res = work(fields, run, render_fn, today or date.today()) if fields else {"reason": reason}
    ok = "reason" not in res
    if not send({**head, "ok": ok, **res}):
        return 1
    print(f"{rid} round {rnd}: ok" if ok else f"{rid} round {rnd}: not ok ({res['reason']})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:], os.environ))
