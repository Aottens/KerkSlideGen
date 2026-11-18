# KerkSlideGen

Slide requests for the church's announcement loop, fully automatic: a member fills in a form with their text, gets a
finished slide by mail within minutes, approves it with one click, and it plays in ProPresenter before the service
until the event has passed. Built for a triple-wide projection whose centre 16:9 screen is also the livestream.

How it works: `ARCHITECTURE.md`. How we work: `CLAUDE.md`. Where it stands: `STATE.md`.

## What works today
- The engineering harness: specs with numbered criteria, the tracking check and the risk gate (ported from CMDMX).
- CI and Tracking run on every push and PR; `main` requires both.
- The renderer: `slidegen render slide.json -o out.png [--guides]` puts a slide's title, when, where and line in
  Montserrat on the church's triple-wide background, inside the centre's safe area, shrinking the text to fit;
  `--image photo.jpg --id <id>` puts the image beside the text, left or right by the id (JPG, PNG, WebP, HEIC).
- Condense: `slidegen condense request.txt [-o slide.json]` asks Claude (`claude -p`, the owner's subscription) for
  the slide text within the character budgets; `slidegen eval` runs the eval set live (owner's word only).
- The intake in Apps Script (`subprojects/google/`, set up once by the owner as its README says): a form with Google
  sign-in and an optional image, a row per request in the Sheet, and the dispatch to `render.yml` with retries.

## Status
Phase 1 is specified and approved; the renderer makes slides with and without an image on the church's background.
Condense runs on Claude Code with the owner's subscription and passed its eval set on Opus 5.5 at low effort.
`render.yml` turns a dispatch into a signed callback with the PNG; the Apps Script side receives it with VS2-02.
The intake form, Sheet and dispatch are written; they wait for the owner's setup and manual run (VS2-01).
The Claude review and risk gate run on every PR, in shadow. Next: VS2-02 the callback, VS2-05 the image link.

## Layout
| Path | What |
| --- | --- |
| `specs/` | PRD, module specs with numbered criteria, ADRs |
| `subprojects/renderer/` | `slidegen`: condense (Claude) and render (Chromium), Python; `job.py` behind `render.yml` |
| `subprojects/google/` | Apps Script: form, approval mails and pages, Drive folders, expiry |
| `assets/` | The church's triple-wide background, `layout.json` and fonts |
| `scripts/` | Tracking check and risk gate (stdlib Python, ported from CMDMX) |
| `tests/` | Eval fixtures, manual checks, church checklists (gate 3) |
