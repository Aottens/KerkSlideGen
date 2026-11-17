# KerkSlideGen — State

The handoff, one screen: what is true now, what is next, what waits for whom. No history: what was built is in
`BACKLOG.md`, what works in `README.md`. `scripts/check-tracking.py` fails CI when this file drifts from `BACKLOG.md`
(`specs/modules/tracking.md`).

## Now
- Phase 1: a member's request becomes an approved slide in the ProPresenter loop without a volunteer (`specs/PRD.md`).
- The harness is ported from CMDMX; the specs for intake, condense, render and deliver are drafts.

## Next
1. Gate 1: the owner approves `specs/PRD.md` and the module specs, with the owner questions in each.
2. HAR-03: the review and risk gate in shadow on the first PR; `risk-gate` becomes a required check after it.
3. VS1-01 + VS1-02, the renderer, as soon as `assets/background.png` and a font are in.

## Waiting on the owner
- Set the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) for the review (HAR-03).
- Put the triple-wide background in `assets/background.png` (one file, full width, 1080 high) and say which font.

## Blocked
- Nothing.

## Owner to decide
- The owner questions in `specs/modules/render.md`, `condense.md`, `intake.md`, `deliver.md`, `autoreview.md`.
- Model and API key for condense (CND, question 1 and 2): Opus 5.5 at low effort or Haiku 5.5; whose account.
- The allowlist (DLV-06): only known members approve their own slide; others go to the visual team.
- Is `visueel@baptistengemeente.nl` a Google Workspace account, and may Apps Script run as that account?

## Good to know
- The repo is public: no request text, slide text or PNG in workflow logs or artifacts (INT-07).
- Only the centre 1920×1080 of the triple-wide canvas carries text: it is also the livestream.
- ProPresenter is reached only through the synced `Loop/` folder: its API cannot import media (research 2026-11-17).
- CI never calls the Claude API; the eval set costs money and runs only on the owner's word.
