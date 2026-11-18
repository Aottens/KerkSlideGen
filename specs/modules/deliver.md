# Module spec: deliver (DLV)

Owner: `subprojects/google/` (callback, mail, approval pages, folders, loop composition), `.github/workflows/render.yml` (the
call back). Tests: `subprojects/google/tests/`, `tests/manual/approve.md`, the church run `tests/church/propresenter.md`.
Status: draft 2026-11-17, loop composition and `Vast/` added 2026-11-18 (owner: agenda, fixed slides). Waits for gate 1.

From a rendered PNG to a slide in the loop, with the requester as the one who says yes. The loop holds three kinds of
slide: requests (this spec and `intake.md`), the agenda's coming week (`agenda.md`) and the visual team's fixed slides.

## Back to Google
- **DLV-01** The render job POSTs the PNG, the `SlideText` and the request id to the Apps Script web app, signed with
  an HMAC-SHA256 of the body under a shared secret. Apps Script refuses a body with a missing or wrong signature or an
  unknown request id, and changes nothing.
- **DLV-02** Apps Script stores the PNG in Drive `KerkSlideGen/Te keuren/` as `<id>.png` and sets the state `te keuren`.
- **DLV-14** The render job fetches a request's image from the Apps Script web app (`?image=<id>&exp=<unix time>&sig=`),
  signed with the shared secret and valid for 15 minutes; a wrong or expired signature gives nothing. The job keeps
  the image only on the runner and never logs or uploads it (INT-07).

## Approval
- **DLV-03** The requester gets one mail from the visual team's account with the slide inline, its text, and two
  buttons: *Goedkeuren* and *Aanpassen*. The links carry the request id and a random token of 128 bits stored in the
  Sheet; a link with a wrong token does nothing and says so.
- **DLV-04** *Goedkeuren* moves the PNG to `KerkSlideGen/Bibliotheek/` as `<id>.png`, sets state `goedgekeurd`, runs
  the loop composition (DLV-09) at once, and shows a page "Je slide staat in de loop tot <datum>." A second click says
  it is already approved.
- **DLV-05** *Aanpassen* shows a page with one text box ("Wat moet er anders?"); its text goes with the original
  request through condense and render again (a new dispatch with the same id and the round). After 3 rounds the
  request goes to the visual team.
- **DLV-06** A sender (the verified mail address of the sign-in, INT-02) who is not on the allowlist tab of the Sheet
  does not approve: the mail with the buttons goes to the visual team, and the requester gets "Je aanvraag is ontvangen
  en wordt bekeken." The visual team adds trusted members to the allowlist.
- **DLV-07** A request in `te keuren` for 7 days is archived with state `verlopen`; the requester is not mailed again.

## Failure
- **DLV-08** Every request that does not reach `te keuren` (INT-05, INT-06, CND-06, CND-07, REN-07, DLV-05) reaches
  the visual team's inbox as one mail with the request text and the reason, and the state `handwerk`.

## The loop
- **DLV-09** `KerkSlideGen/Loop/` is composed, never edited by hand: every night at 03:00 and after every approval,
  Apps Script makes it hold exactly
  - every PNG in `KerkSlideGen/Vast/` (DLV-12);
  - every approved request whose `show_until` is today or later (from its approval on);
  - every agenda occurrence of the coming week (AGD-02, AGD-05).

  A file in `Loop/` that is none of these is removed; a file that should be there and is not is added. A run that fails
  halfway leaves the loop as it was (it composes in a temporary folder and swaps), and mails the visual team (DLV-08).
- **DLV-12** The visual team keeps its fixed slides (welkom, collecte, "de dienst begint zo") as PNGs in
  `KerkSlideGen/Vast/`: a file there is in the loop, a file taken out is gone after the next composition. A fixed slide
  for a period goes through the form, with its last date (owner, 2026-11-18).
- **DLV-13** A request past its `show_until` moves from `Bibliotheek/` to `KerkSlideGen/Archief/` with state
  `gearchiveerd`.

## In the church
Today (owner, 2026-11-18): on Sunday morning the beamer volunteer starts the beamer Mac mini and, before the service,
clicks the intro slideshow in ProPresenter: separate slides, 15 seconds each, with a transition. Each week they first
disable by hand the slides that do not matter that week. This module takes that disabling away; the click stays.
- **DLV-10** The church Mac syncs `KerkSlideGen/Loop/` with Google Drive for Desktop (mirrored, so the files exist
  offline). A ProPresenter 7 Smart Playlist linked to that folder is the announcement loop; a PNG added or removed in
  Drive is added or removed in the playlist before the next service without a click (gate 3,
  `tests/church/propresenter.md`).
- **DLV-11** The intro slideshow is that Smart Playlist: 15 seconds per slide, with the transition the church uses now,
  looping, started with one click as today (set in ProPresenter, recorded in the church checklist). The volunteer
  never enables or disables a slide.
- **DLV-15** The fixed slides of today's intro slideshow are exported once from ProPresenter as PNGs of the full
  canvas into `Vast/` (VS3-03), so the loop holds all of the intro and the old presentation can go.

## Owner questions
1. **Allowlist (DLV-06)?** Recommended: yes. Without it anyone with the form link can put a slide on the screen in
   front of the congregation and on the livestream. The visual team fills it once from the member list.
2. **Smart Playlist or a fixed playlist?** Recommended: Smart Playlist; research could not verify its refresh, its
   15-second advance and its transitions for images, so the church run tests it first (VS3-01). Fallback: a small
   script on the Mac mini that, at start-up, rebuilds the intro playlist from the folder through ProPresenter's API.
3. **Time per slide?** Answered 2026-11-18: 15 seconds with a transition, as today (DLV-11).
4. **Order in the loop?** ProPresenter's Smart Playlist most likely sorts by file name (to check in VS3-01).
   Recommended: fixed slides first in the order of their names (the team names them `01 welkom.png`, …), then the
   agenda by date, then requests by date. Is "de dienst begint zo" part of the loop, or cued by hand at the end?
