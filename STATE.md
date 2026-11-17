# KerkSlideGen — State

The handoff, one screen: what is true now, what is next, what waits for whom. No history: what was built is in
`BACKLOG.md`, what works in `README.md`. `scripts/check-tracking.py` fails CI when this file drifts from `BACKLOG.md`
(`specs/modules/tracking.md`).

## Now
- Phase 1: a member's request becomes an approved slide in the ProPresenter loop without a volunteer (`specs/PRD.md`).
- The harness is ported from CMDMX; the specs for intake, condense, render and deliver are drafts.

## Next
1. Gate 1: the owner approves `specs/PRD.md` and the module specs, with the owner questions in each.
2. HAR-02: the private GitHub repo, then HAR-03 the review in shadow.
3. VS1-01 + VS1-02, the renderer, as soon as `assets/background.png` and a font are in.

## Waiting on the owner
- Put the triple-wide background in `assets/background.png` (one file, full width, 1080 high) and say which font.

## Blocked
- Nothing.

## Owner to decide
- The owner questions in `specs/modules/render.md`, `condense.md`, `intake.md`, `deliver.md`, `autoreview.md`.
- Model and API key for condense (CND, question 1 and 2): Opus 5.5 at low effort or Haiku 5.5; whose account.
- The allowlist (DLV-06): only known members approve their own slide; others go to the visual team.
- Is `visueel@baptistengemeente.nl` a Google Workspace account, and may Apps Script run as that account?

## Good to know
- Only the centre 1920×1080 of the triple-wide canvas carries text: it is also the livestream.
- ProPresenter is reached only through the synced `Loop/` folder: its API cannot import media (research 2026-11-17).
- CI never calls the Claude API; the eval set costs money and runs only on the owner's word.
