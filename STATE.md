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
- The intake runs, on the owner's own Google account (DECISIONS 2026-11-18): a member signs in, submits the form, the
  request gets an id and a row in the Sheet `Aanvragen` and is dispatched to `render.yml`; a refused file, a long
  text or a sixth request in an hour, and a dispatch GitHub keeps refusing, end as `geweigerd` or `handwerk`.
- The loop has three sources: fixed slides (`Vast/`), approved requests, the agenda's coming week (2026-11-18).

## Next
1. VS2-02: the callback and approval mail; after it the owner deploys the web app and sets `CALLBACK_URL` and
   `CALLBACK_SECRET`.
2. VS2-05: the signed image link; until then a request with an image goes to the visual team.

## Waiting on the owner
- Renew `GITHUB_TOKEN` (fine-grained, one year) before it expires; the date goes in the owner's calendar.
- Renew `CLAUDE_CODE_OAUTH_TOKEN` before 2027-11-18 (`claude setup-token`); a reminder is in the owner's calendar.

## Blocked
- VS4-01: which system holds the church's agenda; the owner has asked at the church.

## Owner to decide
- The owner questions in `specs/modules/render.md`, `condense.md`, `intake.md`, `deliver.md`, `autoreview.md`.
- The allowlist (DLV-06): only known members approve their own slide; others go to the visual team.
- IDEA-06: team mails reach the owner, and VS2-02's approval mail would come from the owner's address. Fine for
  phase 1, or via `visueel@` (a forward, or a *Send mail as* alias)?
- Order of the loop, and is "de dienst begint zo" in the loop or cued by hand (`deliver.md`, question 4)?
- Whether ProPresenter's Smart Playlist advances images every 15 s with a transition: VS3-01 at the church decides.

## Good to know
- The repo is public: no request text, slide text or PNG in workflow logs or artifacts (INT-07).
- Only the centre 1920×1080 of the triple-wide canvas carries text: it is also the livestream.
- ProPresenter is reached only through the synced `Loop/` folder: its API cannot import media (research 2026-11-17).
- The callback's signature is in the query string: Apps Script cannot read headers (DECISIONS 2026-11-18).
- CI never calls Claude; the eval set uses the owner's subscription and runs only on the owner's word.
