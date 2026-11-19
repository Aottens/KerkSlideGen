# KerkSlideGen — State

The handoff, one screen: what is true now, what is next, what waits for whom. No history: what was built is in
`BACKLOG.md`, what works in `README.md`. `scripts/check-tracking.py` fails CI when this file drifts from `BACKLOG.md`
(`specs/modules/tracking.md`).

## Now
- Phase 1: a member's request becomes an approved slide in the ProPresenter loop without a volunteer (`specs/PRD.md`).
- The specs are approved (gate 1, 2026-11-18). The renderer puts slide text on the church's background in Montserrat,
  inside the safe area, shrinking to fit, with an image beside the text when there is one (left or right by id).
- `slidegen condense` turns a request into slide text with Claude Code (`claude -p`) on the owner's subscription,
  Opus 5.5 at low effort, budgets checked in code with one retry. A weekday on the slide that does not match its
  date sends the request to the visual team, checked in code (CND-09). `line` holds only what the request says
  (CND-03) and an activity's name stays as written (CND-10); the eval set, with both, passed live (2026-11-18).
- `render.yml` turns a `slide-request` dispatch into a PNG, fetching the request's image first over a link signed for
  15 minutes, and posts the PNG, signed, to the Apps Script web app; every failure is posted too.
- The intake runs, on the owner's own Google account (DECISIONS 2026-11-18): a member signs in, submits the form, the
  request gets an id and a row in the Sheet `Aanvragen` and is dispatched to `render.yml`; a refused file, a long
  text or a sixth request in an hour, and a dispatch GitHub keeps refusing, end as `geweigerd` or `handwerk`.
- The web app runs (run 2026-11-18): it checks the callback's signature, stores the PNG in `Te keuren/`, mails the
  approval mail from the owner's address to an allowlisted requester or else to the owner, and *Goedkeuren* moves it
  to `Bibliotheek/`. *Aanpassen* asks what must change and renders again, at most 3 rounds, then the team takes over.
- The night run also expires a slide nobody approved in 7 days (`verlopen`) and hands a render without answer after
  2 hours to the team. *Aanpassen* runs on Google (run of 2026-11-19); the expiry is still to run.
- `Loop/` is composed in code after each approval and every night: every PNG in `Vast/`, one from `Vast/Wisselend/`
  by ISO week, approved requests up to their last day; expired ones go to `Archief/`. It runs on Google, and
  *Goedkeuren* puts the slide in `Loop/` at once (run of 2026-11-18). The agenda in the loop starts with VS4-01.

## Next
1. FIX-05, FIX-06: the change page must not reach the script's other functions; retries of a change round.
2. VS3-01: the Smart Playlist on the church Mac plays `Loop/` (gate 3).
3. VS4-01: read the coming week from the church's public Google Agenda (`specs/modules/agenda.md`).

## Waiting on the owner
- The rest of the *Aanpassen* run: round 3, the old links, the logs, the expiry and the watchdog
  (`tests/manual/approve.md`, run of 2026-11-19).
- Share `KerkSlideGen` with `visueel@` and the church Mac's account; check the night run of `composeLoop` in
  *Executions* (`tests/manual/loop.md`, run of 2026-11-18).
- `clasp push` and a new web app version, so the night run and the web app send the new team mails.
- The owner's Drive is nearly full: a full Drive stops every copy into `Loop/`. Free space or buy storage.
- Renew `GITHUB_TOKEN` (fine-grained, one year) before it expires; the date goes in the owner's calendar.
- Renew `CLAUDE_CODE_OAUTH_TOKEN` before 2027-11-18 (`claude setup-token`); a reminder is in the owner's calendar.

## Blocked
- Nothing.

## Owner to decide
- The owner questions in `specs/modules/render.md`, `condense.md`, `intake.md`, `deliver.md`, `autoreview.md`,
  `agenda.md`.
- Order of the loop, and is "de dienst begint zo" in the loop or cued by hand (`deliver.md`, question 4)?
- Whether ProPresenter's Smart Playlist advances images every 15 s with a transition: VS3-01 at the church decides.

## Good to know
- The repo is public: no request text, slide text or PNG in workflow logs or artifacts (INT-07).
- Only the centre 1920×1080 of the triple-wide canvas carries text: it is also the livestream.
- ProPresenter is reached only through the synced `Loop/` folder: its API cannot import media (research 2026-11-17).
- The callback's signature is in the query string: Apps Script cannot read headers (DECISIONS 2026-11-18).
- Approval and team mails come from the owner's address for phase 1; `visueel@` can follow (DECISIONS 2026-11-18).
- CI never calls Claude; the eval set uses the owner's subscription and runs only on the owner's word.
