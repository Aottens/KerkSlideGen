# KerkSlideGen — Architecture

## Data flow

```
 requester ──► Google Form (Google sign-in) church agenda (system to be named, AGD-01)
                   │ onFormSubmit                 │ nightly: the coming week
                   ▼                              ▼
 ┌──────────────────────────────────────┐   repository_dispatch    ┌───────────────────────────────────────┐
 │ subprojects/google (Apps Script,     │ ───────────────────────► │ GitHub Actions: render.yml            │
 │ visual team's account)               │  {id, text, dates}       │ subprojects/renderer (Python)         │
 │ - Sheet: requests, allowlist, state  │                          │  condense: Claude → SlideText (JSON)  │
 │ - Drive: Te keuren / Bibliotheek /   │ ◄─────────────────────── │  render: HTML → Chromium → PNG        │
 │   Vast / Loop / Archief              │                          │                                       │
 │ - mail + approve/adjust web pages    │  POST PNG + text, signed │                                       │
 │ - nightly loop composition           │                          └───────────────────────────────────────┘
 └──────────────────┬───────────────────┘
                    │ Loop/ = Vast/ + approved requests + agenda's coming week
                    ▼
     Google Drive for Desktop on the church Mac ──► ProPresenter 7 Smart Playlist ──► triple-wide + livestream
```

## Why this shape
- **Google holds everything personal.** Names and mail addresses stay in the visual team's Sheet. GitHub only sees a
  request id, the request text and dates (`subprojects/renderer/INTERFACE.md`).
- **The renderer is pure and local-first.** `slidegen` takes text in and gives a PNG out; the same command runs on a
  laptop and in Actions. No Google or GitHub code inside it.
- **The folder is the interface to ProPresenter.** No `.pro` files, no API: a PNG in `Loop/` is on screen, a PNG out
  of it is gone. ProPresenter can be swapped for any player that loops a folder.
- **The requester approves.** No single volunteer is the bottleneck; unknown senders fall back to the visual team.
- **The loop is composed, not edited.** Every night (and after an approval) `Loop/` is rebuilt from three sources:
  the team's fixed slides in `Vast/`, approved requests still in date, and the agenda's coming week. Expiry and
  cancellations need no code of their own: what is no longer due is simply not composed.
- **A recurring activity is approved once.** Its title and line are kept; each date is rendered without Claude, with
  time and place taken from the agenda itself.

## Subprojects
- `subprojects/renderer/` — Python package `slidegen`: `condense` (Claude, structured output, character budgets),
  `render` (HTML template, safe area, shrink-to-fit, Playwright screenshot), CLI. Tests in `subprojects/renderer/tests/`.
- `subprojects/google/` — Apps Script project (`clasp` layout): form trigger, agenda adapter, dispatch, callback
  `doPost`, approval pages `doGet`, mail, the nightly loop composition.
- `assets/` — the church's background (`background.png`, full triple-wide) and the fonts the slides use.

## Cross-cutting rules
- **A slide never shows text outside the centre title-safe area** (REN criteria). The safe area is configuration
  derived from the background, never hard-coded pixel offsets in code.
- **Nothing invented.** Condense may shorten and rephrase; it never adds a date, time, place or name that is not in
  the request (CND criteria).
- **No silent failure.** A request that cannot be condensed or rendered reaches the visual team's inbox with the
  reason; it never vanishes.
- **Secrets** live in GitHub secrets and Apps Script properties, never in the repo.
