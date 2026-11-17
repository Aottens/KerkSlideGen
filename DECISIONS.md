# KerkSlideGen — Decision Log

Append-only. Newest at top. Each entry: date, decision, alternatives, why, reversal trigger.
Long-form records live in `specs/ADRs/`; this log is the index.

---

## 2026-11-17 — Port the CMDMX harness, English in the repo

**Decision:** The project runs on the CMDMX harness: spec → test → code → review, numbered criteria, `STATE.md` as
handoff checked by `scripts/check-tracking.py`, the GitHub review and risk gate (`scripts/risk-gate.py`) with its own
path table. Repo language English, owner in Dutch, everything members read in Dutch.

**Alternatives considered:** the Harnas per-feature workflow (mini-PM and build chat); no harness for a small project.

**Why:** the owner asked for the CMDMX harness; its gates are tested and its scripts are standard-library Python, so
they port by changing one path table.

**Reversal trigger:** the overhead is larger than the project; then drop the autoreview first, keep the tracking.

---

## 2026-11-17 — Pipeline: Google Form → GitHub Actions (Claude + Chromium) → Drive folder → ProPresenter (ADR-001)

**Decision:** Intake with a Google Form and Apps Script on the visual team's account; condense with the Claude API and
render HTML/CSS with headless Chromium in a GitHub Actions job; the requester approves by mail; an approved PNG goes
to a Drive folder that the church Mac syncs and that a ProPresenter Smart Playlist plays.

**Alternatives considered:** Canva Connect autofill or Placid/Bannerbear/Templated (lock-in, €20–50 a month, plan
requirements unclear in 2026); Google Slides API (thumbnails at most 1600 px wide, weak text fit); writing `.pro`
files or using ProPresenter's API (no media import; reverse-engineered format); Tally form with webhook (no login, but
one more service and an endpoint to host); n8n or Make (another platform to keep).

**Why:** €0 a month plus cents for Claude; pixel-exact safe area in CSS; everything personal stays in the church's
Google account; the folder is the most stable interface to any player. Details: `specs/ADRs/ADR-001-pipeline.md`.

**Reversal trigger:** the Smart Playlist does not pick up folder changes reliably (VS3-01); Google Form proves too
hard for members; GitHub Actions minutes or the 2026 pricing change for private repos start to cost money.
