# KerkSlideGen — Backlog

Conventions (from CMDMX): one sentence per task with a verifiable done criterion; T-shirt size (S ≤ 2 h, M ≤ half
day, L ≤ day, XL = split it); owner reviews every PR that the risk gate does not merge.
Status (the first word of the Status cell, checked by `scripts/check-tracking.py` in CI):
`todo` · `doing` · `done` · `gate3` · `blocked`, details in brackets or after a colon.
- A task PR sets its own row to `done (date, #PR)` in the PR itself: **merged = done**.
- `gate3: <checklist path>` = merged, only the owner's church run is left; the path must exist.
- Open points found in a run become their own row (or an IDEA) in the same PR.

## Harness
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| HAR-01 | The harness is in place: meta-layer, specs with criteria, tracking and risk-gate scripts green locally. | TRK, ARV | M | done (2026-11-17) |
| HAR-02 | The public GitHub repo exists with this history, CI and Tracking are green on `main`, a ruleset on `main` requires them. | TRK-01..09 | S | done (2026-11-17) |
| HAR-03 | Review and risk gate run on a first PR in shadow: `CLAUDE_CODE_OAUTH_TOKEN` set, `findings.json` and the lane comment appear, then `risk-gate` joins the required checks. | ARV-01..09 | S | done (2026-11-18, #6) |

## Vertical slice 1 — text in, PNG out, on a laptop
Builds (proposed): VS1-01 + VS1-02 (render); VS1-03 + VS1-04 (condense); VS1-05 alone (Actions).

| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS1-01 | `slidegen render slide.json` writes a PNG of the background's size with the text in Montserrat inside the title-safe area, `--guides` draws both areas. | REN-01..05, 08 | M | done (2026-11-18, #2) |
| VS1-02 | Shrink-to-fit with Dutch hyphenation, exit 3 when it does not fit at 60 %, golden-image test, under 10 s. | REN-06, 07, 09, 10 | S | done (2026-11-18, #2) |
| VS1-03 | `slidegen condense request.txt` returns a `SlideText` within the budgets via structured output, with one retry on violations; offline tests on recorded responses. | CND-01, 04..08 | M | done (2026-11-18, #4) |
| VS1-04 | The eval set (`tests/fixtures/requests/`) passes CND-01..04 on the chosen model, run once on the owner's word. | CND-02, 03, 05 | S | done (2026-11-18, #5) |
| VS1-07 | Condense sends a request whose slide names a weekday that does not match its date to the visual team, checked in code. | CND-09 | S | done (2026-11-18, #7) |
| VS1-08 | Condense leaves `line` empty when the request holds no such line (found in run 2026-11-18-VS2-02), with an eval case for it. | CND-03 | S | done (2026-11-18, #15) |
| VS1-09 | Condense keeps an activity's name as written, in its own language, with an eval case for it (IDEA-07). | CND-10 | S | done (2026-11-18, #15) |
| VS1-06 | `--image`: the *with image* layout, the image left or right by id, cropped to its box, upright by EXIF, HEIC read. | REN-11..14 | S | done (2026-11-18, #3) |
| VS1-05 | `render.yml` turns a `repository_dispatch` `slide-request` into a PNG and posts it, signed, to a URL from a secret. | INT-04, 07, DLV-01, 08, CND-06 | S | done (2026-11-18, #6) |

## Vertical slice 2 — Google: form, approval, folders
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS2-01 | Form with sign-in and image, requests Sheet and dispatch: a submit shows up as a run of `render.yml` with only id, text, dates and the image flag. | INT-01..08 | M | done (2026-11-18, #10) |
| VS2-05 | The signed image link: the render job fetches a request's image for 15 minutes, nothing with a wrong or old signature. | DLV-14 | S | done (2026-11-18, #12) |
| VS2-02 | Callback, `Te keuren/` and the approval mail with *Goedkeuren* and *Aanpassen*, signed bodies and tokens checked. | DLV-01..04, 06 | M | done (2026-11-18, #12) |
| VS2-03 | *Aanpassen* round trip (3 rounds max), 7-day expiry of unanswered requests, every failure mailed to the visual team. | DLV-05, 07, 08 | M | done (2026-11-18, #22) |
| VS2-04 | Loop composition at night and after each approval: `Vast/` + one rotating slide from `Vast/Wisselend/` + approved requests in date, swapped in atomically; expired requests archived; `KerkSlideGen` shared with `visueel@` and the church Mac's account. | DLV-09, 12, 13, 16 | M | done (2026-11-18, #18) |

## Vertical slice 4 — the agenda
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS4-01 | The agenda adapter reads the coming week of the church's agenda as occurrences, and a failed read keeps the last good week. | AGD-01, 02, 08 | S | blocked: the agenda's system is not known yet |
| VS4-02 | The *Activiteiten* tab: a new activity's first slide goes to the visual team with *Goedkeuren*, *Aanpassen*, *Niet tonen*. | AGD-03, 04, 06 | M | todo |
| VS4-03 | Every occurrence of an approved activity is rendered without Claude with the agenda's time and place and joins the loop composition. | AGD-05, 07, DLV-09 | M | todo |

## Vertical slice 3 — in the church
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS3-01 | Drive for Desktop mirrors `Loop/` on the Mac mini and a ProPresenter Smart Playlist on it adds and removes slides by itself, 15 s per slide with a transition, looping. | DLV-10, 11 | S | todo |
| VS3-03 | The fixed slides of today's intro slideshow are exported from ProPresenter as full-canvas PNGs into `Vast/`. | DLV-15 | S | todo |
| VS3-02 | Phase 1 done: a real member's request reaches the loop without the visual team, and last week's slide left it by itself. | PRD | S | todo |

### Fixes from reviews (ARV-13, ARV-14)
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| FIX-01 | A failing slidegen import in the render job still posts `internal error` (`subprojects/renderer/job.py:73`, imports outside the try; #6). | DLV-08 | S | done (2026-11-18, #9) |
| FIX-02 | The team mail on a failed render callback, a failed callback, a failed *Goedkeuren* or *Aanpassen*, the round-3 handoff and a render without answer says "niet naar GitHub gestuurd" (`subprojects/google/src/main.js:254`, reuses `teamMail` of `intake.js`; #12, plausible): give these paths their own Dutch headline, with a test. | DLV-08 | S | todo |
| FIX-03 | A failure while moving staged copies into `Loop/` leaves it half updated and the team mail says it is unchanged (`subprojects/google/src/main.js:254`; #18, plausible, major): mark that step so the mail says `Loop/` may be partly updated and the next run completes it (DLV-09 as reworded), with a test. | DLV-09, 08 | S | todo |
| FIX-04 | When the nightly `composeLoop` cannot get the script lock within 30 s it fails without a team mail (`subprojects/google/src/main.js:279`, `waitLock` outside a try; #18, minor): use `tryLock` and mail `loopFailMail` on a miss, with a test. | DLV-08 | S | todo |
| FIX-05 | The change page loads `google.script.run`, which lets anyone holding an *Aanpassen* link call every public top-level function of the script as the owner (`setup`, `composeLoop`, `retryDispatches`, `onSubmit`; `subprojects/google/src/main.js`; #22, plausible, minor): make the trigger and setup entry points refuse a call from the web app, with a test. | DLV-05 | S | todo |
| FIX-06 | A failed dispatch in an *Aanpassen* round retries every minute and ends as `handwerk` after about 3 minutes instead of 3 times over 10 minutes (`subprojects/google/src/main.js:177`, `nextAttempt` counts from `created`; #22, major): count from `since`, with a test. | INT-05, DLV-05 | S | todo |

## Open questions
- See *Owner to decide* in `STATE.md`.
