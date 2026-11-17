# KerkSlideGen

Slide requests for the church's announcement loop, fully automatic: a member fills in a form with their text, gets a
finished slide by mail within minutes, approves it with one click, and it plays in ProPresenter before the service
until the event has passed. Built for a triple-wide projection whose centre 16:9 screen is also the livestream.

How it works: `ARCHITECTURE.md`. How we work: `CLAUDE.md`. Where it stands: `STATE.md`.

## What works today
- The engineering harness: specs with numbered criteria, the tracking check and the risk gate (ported from CMDMX).

## Status
Phase 1 is specified and waits for the owner's approval of the specs (gate 1).
Next: HAR-02 the GitHub repo, then the renderer VS1-01 and VS1-02 once the background is in `assets/`.

## Layout
| Path | What |
| --- | --- |
| `specs/` | PRD, module specs with numbered criteria, ADRs |
| `subprojects/renderer/` | `slidegen`: condense (Claude) and render (Chromium), Python |
| `subprojects/google/` | Apps Script: form, approval mails and pages, Drive folders, expiry |
| `assets/` | The church's triple-wide background, `layout.json` and fonts |
| `scripts/` | Tracking check and risk gate (stdlib Python, ported from CMDMX) |
| `tests/` | Eval fixtures, manual checks, church checklists (gate 3) |
