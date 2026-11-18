# KerkSlideGen — State

The handoff, one screen: what is true now, what is next, what waits for whom. No history: what was built is in
`BACKLOG.md`, what works in `README.md`. `scripts/check-tracking.py` fails CI when this file drifts from `BACKLOG.md`
(`specs/modules/tracking.md`).

## Now
- Phase 1: a member's request becomes an approved slide in the ProPresenter loop without a volunteer (`specs/PRD.md`).
- The specs are approved (gate 1, 2026-11-18). The renderer puts slide text on the church's background in Montserrat,
  inside the safe area, shrinking to fit, with an image beside the text when there is one (left or right by id).
- `slidegen condense` turns a request into slide text with Claude Code (`claude -p`) on the owner's subscription,
  Opus 5.5 at low effort, budgets checked in code with one retry; the eval set passed live (2026-11-18). A weekday
  on the slide that does not match its date sends the request to the visual team, checked in code (CND-09).
- `render.yml` turns a `slide-request` dispatch into a PNG and posts it, signed, to the Apps Script web app; every
  failure is posted too. It waits for the secrets `CALLBACK_URL` and `CALLBACK_SECRET`, set once VS2-02 exists.
- `subprojects/google/` holds the intake in Apps Script: `setup()` makes the form (Google sign-in, verified address),
  the Sheet tab `Aanvragen` and the triggers; a submit gets an id and a state and is dispatched to `render.yml`,
  retried 3× in 10 minutes, else mailed to the visual team. It waits for the owner's setup (VS2-01).
- The loop has three sources: fixed slides (`Vast/`), approved requests, the agenda's coming week (2026-11-18).

## Next
1. VS2-01: the owner's setup and the manual intake run; then VS2-02, the callback and approval mail, after which the
   owner sets the callback secrets.
2. VS2-05: the signed image link; until then a request with an image goes to the visual team.

## Waiting on the owner
- VS2-01: set up the intake as `subprojects/google/README.md` says (Apps Script API, `clasp create` and `clasp push`,
  run `setup`, add the image question in the Forms editor, the script property `GITHUB_TOKEN`), then run
  `tests/manual/intake.md`.
- Renew `CLAUDE_CODE_OAUTH_TOKEN` before 2027-11-18 (`claude setup-token`); a reminder is in the owner's calendar.

## Blocked
- VS4-01: which system holds the church's agenda; the owner has asked at the church.

## Owner to decide
- The owner questions in `specs/modules/render.md`, `condense.md`, `intake.md`, `deliver.md`, `autoreview.md`.
- The allowlist (DLV-06): only known members approve their own slide; others go to the visual team.
- Is `visueel@baptistengemeente.nl` a Google Workspace account? The intake works on both; on Workspace the form's
  domain restriction must be off (setup step 6).
- Order of the loop, and is "de dienst begint zo" in the loop or cued by hand (`deliver.md`, question 4)?
- Whether ProPresenter's Smart Playlist advances images every 15 s with a transition: VS3-01 at the church decides.

## Good to know
- The repo is public: no request text, slide text or PNG in workflow logs or artifacts (INT-07).
- Only the centre 1920×1080 of the triple-wide canvas carries text: it is also the livestream.
- ProPresenter is reached only through the synced `Loop/` folder: its API cannot import media (research 2026-11-17).
- The callback's signature is in the query string: Apps Script cannot read headers (DECISIONS 2026-11-18).
- CI never calls Claude; the eval set uses the owner's subscription and runs only on the owner's word.
