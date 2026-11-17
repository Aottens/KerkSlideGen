# KerkSlideGen

A church member sends a request for an announcement slide, in their own words and as long as they like. A minute
later they get a finished slide by mail, on the church's own triple-wide background, with only a few words on it, all
inside the safe area of the centre screen. One click approves it and it appears in the intro loop in ProPresenter
before the service, and it leaves the loop by itself after the event.

## Client / Stakeholder
- Owner: Aernout Ottens. Product owner, reviewer, runs the checks at the church.
- Requesters: members of the Baptistengemeente who ask for a slide. Not technical, use mail and a phone.
- The visual team (`visueel@baptistengemeente.nl`, Gmail): today one volunteer builds every slide by hand. After this
  project they only step in when a slide cannot be made automatically.

## The screen
- Three beamers blended into one triple-wide canvas. The background template is one image of that full width
  (owner, 2026-11-17).
- Only the centre 16:9 area carries content: that same 1920×1080 signal goes to the livestream. Text stays inside its
  title-safe area; the side screens show the background only.
- Played by ProPresenter 7 on the church Mac, as a looping announcement playlist before the service.

## Scope (phase 1)
- Intake: a Google Form owned by the visual team's Google account; no login for requesters.
- Condense: Claude turns the request into a title and at most three short lines (when, where, one line), in Dutch,
  inventing nothing.
- Render: the text on the background, centre safe area only, shrink-to-fit, one PNG of the full triple-wide size.
- Approve: the requester gets the slide by mail and approves it or asks for a change; senders the church does not
  know go to the visual team instead.
- Deliver: an approved slide lands in a Drive folder that the church Mac syncs; a ProPresenter Smart Playlist on that
  folder plays it; a slide past its date moves to the archive by itself.

## Out of scope (phase 1)
- Photos or logos in a slide (IDEA-01), video or motion slides, more than one layout.
- Writing ProPresenter `.pro` files or driving ProPresenter's API (research 2026-11-17: no media import in its API;
  the folder is the stable interface).
- Song lyrics, sermon slides, anything live during the service.

## Stack
- `subprojects/renderer/`: Python. Condense with the Anthropic SDK (structured outputs), render HTML/CSS to PNG with
  headless Chromium via Playwright. Runs as a GitHub Actions job; runs locally the same way.
- `subprojects/google/`: Google Apps Script bound to the visual team's account: form trigger, approval pages, mail,
  Drive folders, the daily expiry.
- CI and review: GitHub Actions; the review and risk gate are ported from CMDMX (`specs/modules/autoreview.md`).

## Key people
- Product owner / church tester: Aernout.
- Engineering: Claude Code sessions, gated by spec approval, PR review and the church checklist.

## Reference material
- Research of 2026-11-17 (options for intake, rendering, ProPresenter ingestion, cost): `docs/research-2026-11.md`.
- The harness this project copies: `../ColourmotionDMX` (CLAUDE.md loop, tracking, risk gate).

## Status
See `STATE.md`.
