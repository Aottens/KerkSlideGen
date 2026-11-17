# Module spec: render (REN)

Owner: `subprojects/renderer/slidegen/render.py`, its template and `assets/`. Tests: `subprojects/renderer/tests/`.
Status: draft 2026-11-17, waits for gate 1.

Turns slide text (a `SlideText`, `subprojects/renderer/INTERFACE.md`) into one PNG on the church's background. The
triple-wide canvas is the background's own size; only the centre 16:9 area carries text, because that area is also
the livestream.

## Geometry
- **REN-01** The output PNG has exactly the pixel size of `assets/background.png`, and the background fills it
  unscaled and uncropped.
- **REN-02** The centre area is 1920×1080, horizontally centred and vertically filling the canvas, unless
  `assets/layout.json` gives another `centre` rectangle. A background whose height is not 1080 or that is narrower
  than 1920 is refused with a message naming its size.
- **REN-03** Text is placed only inside the title-safe area: the centre area inset by `safe_margin` on every side,
  default 10 % of the centre's width and height (192 px left/right, 108 px top/bottom), configurable in
  `assets/layout.json`. A test renders a text of maximal length and checks that no text pixel lies outside the
  title-safe area (by bounding boxes of the text elements, reported by the browser).
- **REN-04** `--guides` draws the centre area and the title-safe area as outlines on the output, for the owner to check
  a new background. Without it, no guide is drawn.

## Text and fit
- **REN-05** The slide shows the title, then the `when`, `where` and `line` fields that are not empty, each on its own
  block, in that order. Empty fields leave no gap.
- **REN-06** Each block starts at its design size (title 110 px, others 64 px, from `assets/layout.json`) and the whole
  text shrinks in steps until it fits inside the title-safe area, to at most 60 % of the design size. Words are never
  broken except by Dutch hyphenation (`lang="nl"`, `hyphens: auto`).
- **REN-07** Text that does not fit at 60 % is not rendered: render exits with code 3 and the reason `does not fit`,
  so the request goes back to condense once (CND-06) and else to the visual team (DLV-08).
- **REN-08** Fonts come only from `assets/fonts/`; no system font and no network font is used. A missing font file is
  an error, not a fallback.

## Determinism and speed
- **REN-09** The same `SlideText` and assets give the same PNG on the same renderer version: a golden-image test
  compares a fixture render pixel by pixel, with at most 0.5 % differing pixels (anti-aliasing between Chromium
  builds).
- **REN-10** One render takes at most 10 s on a GitHub-hosted runner after Chromium is installed.

## Owner questions
1. **Safe area 10 %?** Recommended: yes, the classic title-safe of broadcast; the livestream crops nothing, but the
   beamer blend and the stream overlay (logo, lower thirds) might. Say if the stream has a fixed overlay to avoid.
2. **Which font?** Recommended: the church's house font if it has one with a licence that allows embedding; else an
   open font (e.g. Inter or Source Sans 3, SIL OFL).
3. **Text colour and alignment?** Recommended: white, centred, with a soft shadow; changeable in `assets/layout.json`.
