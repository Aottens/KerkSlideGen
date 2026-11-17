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
| HAR-02 | The public GitHub repo exists with this history, CI and Tracking are green on `main`, branch protection requires them. | TRK-01..09 | S | todo |
| HAR-03 | Review and risk gate run on a first PR in shadow: `CLAUDE_CODE_OAUTH_TOKEN` set, `findings.json` and the lane comment appear. | ARV-01..09 | S | todo |

## Vertical slice 1 — text in, PNG out, on a laptop
Builds (proposed): VS1-01 + VS1-02 (render); VS1-03 + VS1-04 (condense); VS1-05 alone (Actions).

| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS1-01 | `slidegen render slide.json` writes a PNG of the background's size with the text inside the title-safe area, `--guides` draws both areas. | REN-01..05, 08 | M | todo |
| VS1-02 | Shrink-to-fit with Dutch hyphenation, exit 3 when it does not fit at 60 %, golden-image test, under 10 s. | REN-06, 07, 09, 10 | S | todo |
| VS1-03 | `slidegen condense request.txt` returns a `SlideText` within the budgets via structured output, with one retry on violations; offline tests on recorded responses. | CND-01, 04..08 | M | todo |
| VS1-04 | The eval set (`tests/fixtures/requests/`) passes CND-01..04 on the chosen model, run once on the owner's word. | CND-02, 03, 05 | S | todo |
| VS1-05 | `render.yml` turns a `repository_dispatch` `slide-request` into a PNG and posts it, signed, to a URL from a secret. | INT-04, DLV-01 | S | todo |

## Vertical slice 2 — Google: form, approval, folders
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS2-01 | Form, requests Sheet and dispatch: a submitted form shows up as a run of `render.yml` with only id, text and dates. | INT-01..06 | M | todo |
| VS2-02 | Callback, `Te keuren/` and the approval mail with *Goedkeuren* and *Aanpassen*, signed bodies and tokens checked. | DLV-01..04, 06 | M | todo |
| VS2-03 | *Aanpassen* round trip (3 rounds max), 7-day expiry of unanswered requests, every failure mailed to the visual team. | DLV-05, 07, 08 | M | todo |
| VS2-04 | Daily trigger archives slides past `show_until` from `Loop/`. | DLV-09 | S | todo |

## Vertical slice 3 — in the church
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |
| VS3-01 | Drive for Desktop mirrors `Loop/` on the church Mac and a ProPresenter Smart Playlist on it adds and removes slides by itself, 8 s per slide, looping. | DLV-10, 11 | S | todo |
| VS3-02 | Phase 1 done: a real member's request reaches the loop without the visual team, and last week's slide left it by itself. | PRD | S | todo |

### Fixes from reviews (ARV-13, ARV-14)
| Id | Task (one sentence, verifiable) | Spec ids | Size | Status |
| --- | --- | --- | --- | --- |

## Open questions
- See *Owner to decide* in `STATE.md`.
