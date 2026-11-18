# KerkSlideGen — State

The handoff, one screen: what is true now, what is next, what waits for whom. No history: what was built is in
`BACKLOG.md`, what works in `README.md`. `scripts/check-tracking.py` fails CI when this file drifts from `BACKLOG.md`
(`specs/modules/tracking.md`).

## Now
- Phase 1: a member's request becomes an approved slide in the ProPresenter loop without a volunteer (`specs/PRD.md`).
- The harness is ported from CMDMX; the specs for intake, agenda, condense, render and deliver are drafts.
- The loop has three sources: fixed slides (`Vast/`), approved requests, the agenda's coming week (2026-11-18).

## Next
1. Gate 1: the owner approves `specs/PRD.md` and the module specs, with the owner questions in each.
2. HAR-03: the review and risk gate in shadow on the first PR; `risk-gate` becomes a required check after it.
3. VS1-01 + VS1-02, the renderer (Montserrat, background in `assets/`); then VS1-06, the image layout.

## Waiting on the owner
- Set the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) for the review (HAR-03).

## Blocked
- VS4-01: which system holds the church's agenda; the owner has asked at the church.

## Owner to decide
- The owner questions in `specs/modules/render.md`, `condense.md`, `intake.md`, `deliver.md`, `autoreview.md`.
- Model and API key for condense (CND, question 1 and 2): Opus 5.5 at low effort or Haiku 5.5; whose account.
- The allowlist (DLV-06): only known members approve their own slide; others go to the visual team.
- Is `visueel@baptistengemeente.nl` a Google Workspace account, and may Apps Script run as that account?
- Order of the loop, and is "de dienst begint zo" in the loop or cued by hand (`deliver.md`, question 4)?
- Whether ProPresenter's Smart Playlist advances images every 15 s with a transition: VS3-01 at the church decides.

## Good to know
- The repo is public: no request text, slide text or PNG in workflow logs or artifacts (INT-07).
- Only the centre 1920×1080 of the triple-wide canvas carries text: it is also the livestream.
- ProPresenter is reached only through the synced `Loop/` folder: its API cannot import media (research 2026-11-17).
- CI never calls the Claude API; the eval set costs money and runs only on the owner's word.
