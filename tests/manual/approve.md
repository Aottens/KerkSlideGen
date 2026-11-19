# Manual check: callback, image link and approval (DLV-01..08, 14)

After the setup in `subprojects/google/README.md` (steps 10–13: web app, secrets, allowlist), on the owner's account
(DECISIONS 2026-11-18). Write the run in `tests/manual/runs/<date>-VS2-02.md` with the ticked list and
`## Open points`. Use made-up requests; ids and addresses stay in the Sheet (INT-04).

## Callback (DLV-01, 02)
- [ ] **DLV-01** In a terminal, a POST to the web app with a wrong signature
      (`curl -sL -H 'Content-Type: application/json' -d '{"id":"R1","round":1,"ok":true}' "<web app URL>?sig=00"`)
      answers `{"ok":false,…}`; the Sheet and `Te keuren/` are unchanged.
- [ ] **DLV-02** A form submit without image from an address on the `Toegestaan` tab: within 5 minutes the run of
      `render.yml` is green, `KerkSlideGen/Te keuren/<id>.png` exists, the row says `te keuren` with a token of 32
      characters.

## Approval mail (DLV-03, 06)
- [ ] **DLV-03** That requester gets one mail from the owner's address with the slide inline, its text, and the
      buttons *Goedkeuren* and *Aanpassen*.
- [ ] **DLV-03** The *Goedkeuren* link with one character of `t=` changed shows "Deze link klopt niet…" and changes
      nothing.
- [ ] **DLV-06** A submit from an address not on `Toegestaan`: the approval mail reaches the owner's address, the
      requester gets "Je aanvraag is ontvangen en wordt bekeken."

## Approve (DLV-04)
- [ ] **DLV-04** *Goedkeuren* shows "Je slide staat in de loop tot <datum>." with the last day; the PNG moved from
      `Te keuren/` to `Bibliotheek/`; the row says `goedgekeurd`. (`Loop/` is composed by VS2-04, not yet.)
- [ ] **DLV-04** A second click shows that the slide is already approved.

## Image (DLV-14)
- [ ] **DLV-14** A submit with a photo: the run is green and the mailed slide shows the photo.
- [ ] **DLV-14** `curl -sL "<web app URL>?image=<id>&exp=9999999999&sig=00"` answers `{"error":…}`, no image.
- [ ] **INT-07** The run's log shows only id, round and outcome: no text, no image, no URL.

## Aanpassen (DLV-05, VS2-03)
Before the run: `clasp push`, a new web app version, and `setup` once (the Sheet gets the columns `aanpassing` and
`sinds`). Write the run in `tests/manual/runs/<date>-VS2-03.md`.
- [ ] **DLV-05** *Aanpassen* in the mail of round 1 shows "Wat moet er anders?", a text box and *Versturen*.
- [ ] **DLV-05** *Versturen* with an empty box says so and changes nothing in the Sheet.
- [ ] **DLV-05** *Versturen* with "Zet de tijd op 20.00 uur" shows "Je aanpassing is verstuurd…"; the row says
      `verzonden`, round 2, the text in `aanpassing`; the old PNG is in the bin; a new run of `render.yml` is green and
      a new mail arrives whose slide follows the change.
- [ ] **DLV-05** *Goedkeuren* and *Aanpassen* in the mail of round 1 now show "Deze link klopt niet (meer)…".
- [ ] **DLV-05** *Aanpassen* again: round 3, `aanpassing` holds both texts, oldest first.
- [ ] **DLV-05, 08** *Aanpassen* in round 3 with a text: the page says "Het kerkteam maakt je slide verder af…", no new
      run starts, the row says `handwerk` with reason `3 rondes aangepast`, and the owner gets one mail with the
      request text and all three change texts.
- [ ] **INT-07** The runs of round 2 and 3 log only id, round and outcome: no change text.

## Expiry and watchdog (DLV-07, 08)
Fake the time in the Sheet instead of waiting a week; run `composeLoop` by hand in the editor.
- [ ] **DLV-07** A row in `te keuren` with `sinds` set 8 days back: after the run its PNG is in `Archief/`, the row
      says `verlopen`, nobody got a mail, and its *Goedkeuren* link shows "Deze aanvraag wacht niet op goedkeuring."
- [ ] **DLV-07** A row in `te keuren` with `sinds` 6 days back stays as it is.
- [ ] **DLV-08** A row in `verzonden` with `sinds` 3 hours back: after the run it says `handwerk` with reason
      `geen antwoord van de render`, and the owner gets one mail with its request text.

## Failure (DLV-08)
- [ ] A request whose render fails (e.g. a text that cannot fit) ends as `handwerk` with a mail to the owner naming the
      reason.
