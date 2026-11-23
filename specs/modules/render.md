# Module spec: render (REN)

Owner: `subprojects/renderer/slidegen/render.py`, its template and `assets/`. Tests: `subprojects/renderer/tests/`.
Status: draft 2026-11-17; image 2026-11-18 (owner: "er moet ook een plaatje in kunnen"); geometry fitted to the real
background (3615×768) and the two layouts chosen from example renders 2026-11-18 (owner: "0 of A"). Waits for gate 1. REN-12 reworded 2026-11-23: the image is shown whole, not cropped (owner);
waits for gate 1.

Turns slide text (a `SlideText`, `subprojects/renderer/INTERFACE.md`) into one PNG on the church's background. The
triple-wide canvas is the background's own size; only the centre 16:9 area carries text, because that area is also
the livestream.

## Geometry
- **REN-01** The output PNG has exactly the pixel size of `assets/background.png`, and the background fills it
  unscaled and uncropped.
- **REN-02** The centre area is the 16:9 rectangle of the canvas's full height, horizontally centred (on the church's
  3615×768 background: 1365×768 from x = 1125), unless `assets/layout.json` gives another `centre` rectangle. A
  background narrower than its centre area is refused with a message naming its size.
- **REN-03** Text is placed only inside the title-safe area: the centre area inset by `safe_margin` on every side,
  default 10 % of the centre's width and height (on the church's background 1093×614 from x = 1261, y = 77),
  configurable in `assets/layout.json`. A test renders a text of maximal length and checks that no text pixel lies outside the
  title-safe area (by bounding boxes of the text elements, reported by the browser).
- **REN-04** `--guides` draws the centre area and the title-safe area as outlines on the output, for the owner to check
  a new background. Without it, no guide is drawn.

## Text and fit
- **REN-05** The slide shows the title, then the `when`, `where` and `line` fields that are not empty, each on its own
  block, in that order. Empty fields leave no gap.
- **REN-06** Each block starts at its design size (from `assets/layout.json`; on the 768-high background title 78 px,
  `when` and `where` 40 px, `line` 36 px) and the whole text shrinks in steps until it fits inside the title-safe
  area, to at most 60 % of the design size. No word is
  hyphenated while a smaller size still fits without it (owner, 2026-11-18: rather smaller than broken); only when
  nothing fits at 60 % unhyphenated is Dutch hyphenation (`lang="nl"`, `hyphens: auto`) tried, at the largest size
  that then fits. Words are never broken otherwise.
- **REN-07** Text that does not fit at 60 % is not rendered: render exits with code 3 and the reason `does not fit`,
  so the request goes back to condense once (CND-06) and else to the visual team (DLV-08).
- **REN-08** All text is set in Montserrat (SIL Open Font License; the church's slides already use it), from
  `assets/fonts/` with its licence file; title bold, `when` and `where` semibold, `line` regular. No system font and
  no network font is used. A missing font file is an error, not a fallback.

## Image
- **REN-11** There are two layouts, chosen by whether the request has an image (owner, 2026-11-18):
  - *text* (no image): the text centred in the whole title-safe area, as in REN-05;
  - *with image*: inside the title-safe area, the image on one side (42 % of its width, full height, rounded corners)
    and the text on the other (53 %, aligned towards the image). Both are in the livestream.

  The boxes come from `assets/layout.json` as fractions of the title-safe area; a box outside it is refused when the
  layout is loaded. With an image the text has less room, so it shrinks sooner (REN-06).
- **REN-14** The image's side varies, so the loop is not monotonous (owner, 2026-11-18): it is left when the first
  byte of the SHA-256 of the slide's id is even, else right, so about half of the slides each way. The same id always
  gives the same side, also after *Aanpassen*. A test renders two ids with different sides and checks both.
- **REN-12** The image is shown whole: scaled to the largest size that fits its box, never cropped or stretched,
  turned upright by its EXIF orientation (phone photos), with rounded corners. It sits against the text side of its
  box and is centred in height; where it leaves the box empty, the background shows. Transparent parts of a PNG or
  WebP stay transparent, never black or white (owner, 2026-11-23, after a square image lost its sides). JPG, PNG,
  WebP and HEIC are read; HEIC is converted before the browser sees it.
- **REN-13** The image is read from a local file passed to `slidegen render --image <path>`; the renderer never
  fetches from the network itself (the job fetches it first, DLV-14).

## Determinism and speed
- **REN-09** The same `SlideText` and assets give the same PNG on the same renderer version: a golden-image test
  compares a fixture render pixel by pixel, with at most 0.5 % differing pixels (anti-aliasing between Chromium
  builds).
- **REN-10** One render takes at most 10 s on a GitHub-hosted runner after Chromium is installed.

## Owner questions
1. **Safe area 10 %?** Recommended: yes, the classic title-safe of broadcast; the livestream crops nothing, but the
   beamer blend and the stream overlay (logo, lower thirds) might. Say if the stream has a fixed overlay to avoid.
2. **Which font?** Answered 2026-11-18: Montserrat, which the church's slides use already (REN-08).
3. **Text colour and alignment?** Recommended: white, centred, with a soft shadow; changeable in `assets/layout.json`.
4. **Where does the image go?** Answered 2026-11-18 from four example renders: beside the text in the centre (REN-11);
   behind the text and on a side screen were not chosen.
5. **How does the centre reach the livestream?** Answered 2026-11-18: ProPresenter scales the centre 1365×768 up to
   1920×1080 for the stream, so REN-02 holds as written. Text sizes are chosen for the beamers; upscaling only softens.
