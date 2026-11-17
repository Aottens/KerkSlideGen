# Module spec: deliver (DLV)

Owner: `subprojects/google/` (callback, mail, approval pages, folders, expiry), `.github/workflows/render.yml` (the
call back). Tests: `subprojects/google/tests/`, `tests/manual/approve.md`, the church run `tests/church/propresenter.md`.
Status: draft 2026-11-17, waits for gate 1.

From a rendered PNG to a slide in the loop, with the requester as the one who says yes.

## Back to Google
- **DLV-01** The render job POSTs the PNG, the `SlideText` and the request id to the Apps Script web app, signed with
  an HMAC-SHA256 of the body under a shared secret. Apps Script refuses a body with a missing or wrong signature or an
  unknown request id, and changes nothing.
- **DLV-02** Apps Script stores the PNG in Drive `KerkSlideGen/Te keuren/` as `<id>.png` and sets the state `te keuren`.

## Approval
- **DLV-03** The requester gets one mail from the visual team's account with the slide inline, its text, and two
  buttons: *Goedkeuren* and *Aanpassen*. The links carry the request id and a random token of 128 bits stored in the
  Sheet; a link with a wrong token does nothing and says so.
- **DLV-04** *Goedkeuren* moves the PNG to `KerkSlideGen/Loop/` as `<show_until>_<id>.png`, sets state `in loop`, and
  shows a page "Je slide staat in de loop tot <datum>." A second click says it is already approved.
- **DLV-05** *Aanpassen* shows a page with one text box ("Wat moet er anders?"); its text goes with the original
  request through condense and render again (a new dispatch with the same id and the round). After 3 rounds the
  request goes to the visual team.
- **DLV-06** A sender whose mail address is not on the allowlist tab of the Sheet does not approve: the mail with the
  buttons goes to the visual team, and the requester gets "Je aanvraag is ontvangen en wordt bekeken." The visual team
  adds trusted members to the allowlist.
- **DLV-07** A request in `te keuren` for 7 days is archived with state `verlopen`; the requester is not mailed again.

## Failure and expiry
- **DLV-08** Every request that does not reach `te keuren` (INT-05, INT-06, CND-06, CND-07, REN-07, DLV-05) reaches
  the visual team's inbox as one mail with the request text and the reason, and the state `handwerk`.
- **DLV-09** A daily trigger at 03:00 moves every PNG in `Loop/` whose `show_until` date is before today to
  `KerkSlideGen/Archief/` and sets state `gearchiveerd`.

## In the church
- **DLV-10** The church Mac syncs `KerkSlideGen/Loop/` with Google Drive for Desktop (mirrored, so the files exist
  offline). A ProPresenter 7 Smart Playlist linked to that folder is the announcement loop; a PNG added or removed in
  Drive is added or removed in the playlist before the next service without a click (gate 3,
  `tests/church/propresenter.md`).
- **DLV-11** The loop advances every 8 seconds and loops (set in ProPresenter, recorded in the church checklist).

## Owner questions
1. **Allowlist (DLV-06)?** Recommended: yes. Without it anyone with the form link can put a slide on the screen in
   front of the congregation and on the livestream. The visual team fills it once from the member list.
2. **Smart Playlist or a fixed playlist?** Recommended: Smart Playlist; research could not verify its refresh and
   looping behaviour, so the church run tests it first (VS3-01). Fallback: a folder-watching import script on the Mac.
3. **8 seconds per slide?** Recommended: yes; set in ProPresenter, not in this project.
