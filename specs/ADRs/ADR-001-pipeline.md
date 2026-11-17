# ADR-001 — The pipeline

Date: 2026-11-17. Status: proposed (gate 1).

## Context
Requests come from non-technical members, in long free text. The slide must sit inside the title-safe area of the
centre 1920×1080 of a triple-wide canvas, because that area is also the livestream. ProPresenter 7 plays the loop.
The church mails from a Google account (`visueel@baptistengemeente.nl`). Budget: as close to €0 as possible.

## Options (research 2026-11-17, `docs/research-2026-11.md`)
| Option | For | Against | Cost/month |
| --- | --- | --- | --- |
| A. Google Form + Apps Script → GitHub Actions (Claude + Chromium) → Drive → Pro7 Smart Playlist | Exact safe area, own template, no lock-in, personal data stays in Google | We maintain code and the HTML template | ~€0 + €0.05–2 Claude |
| B. Google Form → Apps Script + Claude → Google Slides template → Drive | All Google, no CI | Thumbnails max 1600 px wide, weak text fit | €0 |
| C. Form → Make/n8n → Claude → Placid/Templated or Canva autofill | Volunteers edit the template in a visual editor | Lock-in; Canva plan requirements unclear in 2026 | €20–50 |

## Decision
Option A. The renderer is a pure Python package (`slidegen`) run in GitHub Actions; Apps Script owns everything that
touches people and Google (form, mail, approval, folders). The interface between them is one dispatch and one signed
callback (`subprojects/renderer/INTERFACE.md`).

## Consequences
- The church Mac needs Google Drive for Desktop signed in to the visual team's account, mirroring `KerkSlideGen/Loop/`.
- The template is HTML/CSS plus `assets/background.png`; changing the look is a PR, not a drag in an editor (IDEA-03
  if that becomes a burden).
- If the Smart Playlist proves unreliable (VS3-01), the fallback is a small watcher on the Mac, not a change upstream.
