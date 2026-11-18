# Interface: renderer ↔ Google

The only contract between `subprojects/google` (Apps Script) and `subprojects/renderer` (GitHub Actions). A change
here changes both sides in one PR. No names or mail addresses cross it (INT-04). The repo is public: the render job
logs only id, round and outcome (INT-07).

## 1. Dispatch (Apps Script → GitHub)
`POST https://api.github.com/repos/<owner>/<repo>/dispatches`, fine-grained token with *Contents: read and write* on
this repo only, stored in the script property `GITHUB_TOKEN`.

```json
{
  "event_type": "slide-request",
  "client_payload": {
    "id": "R20261117-K7Q",
    "round": 1,
    "text": "<the request text, at most 5000 characters>",
    "change": "",
    "event_date": "2026-12-24",
    "show_until": "2026-12-24",
    "image": true
  }
}
```
`change` is the requester's *Aanpassen* text for round 2 and 3 (DLV-05), else `""`. `show_until` may be `""`.
`image` says whether the request has one; the job then fetches it with
`GET <web app URL>?image=<id>&exp=<unix time + 900>&sig=<hex HMAC-SHA256 of "<id>.<exp>">` (DLV-14).

Agenda (`specs/modules/agenda.md`) uses the same event with a `kind` (absent means `request`):
- `"kind": "activity"`: the first slide of an agenda activity (AGD-04). `id` is the activity id (`A` + series id
  hash), `text` is the event's title and description, and `when` and `where` come along filled from the agenda;
  condense fills only `title` and `line`.
- `"kind": "occurrence"`: one date of an approved activity (AGD-05). `id` is `<activity id>-<yyyy-mm-dd>`, and
  `slide` carries the full `SlideText`; there is no `text`, and the renderer does not call Claude.

## 2. SlideText (inside the renderer)
```json
{"title": "Kerstnachtdienst", "when": "24 december, 22.00 uur", "where": "Grote zaal", "line": "Iedereen welkom, neem gerust iemand mee", "show_until": "2026-12-24"}
```
Limits: title 32, when 40, where 40, line 70 characters (CND-01).

## 3. Callback (GitHub → Apps Script)
`POST <web app URL>` (secret `CALLBACK_URL`), header `X-Signature: sha256=<hex HMAC-SHA256 of the body>` under the
shared secret (`CALLBACK_SECRET` in GitHub, the same value in the script property `CALLBACK_SECRET`).

```json
{"id": "R20261117-K7Q", "round": 1, "ok": true, "slide": {"…": "SlideText"}, "png_base64": "<PNG>"}
```
On failure: `{"id": "…", "round": 1, "ok": false, "reason": "does not fit"}` (DLV-08).
