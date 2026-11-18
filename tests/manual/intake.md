# Manual check: intake (INT-01..08)

After the setup in `subprojects/google/README.md`. Write the run in `tests/manual/runs/<date>-VS2-01.md` with a
`## Open points` section. Until VS2-02 exists, `render.yml` cannot post its result back (no `CALLBACK_URL`): a run
that fails on a missing secret still shows the dispatch arrived.

- [ ] **INT-01/02** In a private browser window the form asks for a Google sign-in first, then shows name, text, event
      date, last date (with "leeg = tot de datum van het evenement") and image, in that order, and no mail field.
- [ ] **INT-02** Workspace only: a member with a plain Gmail account (not `@baptistengemeente.nl`) can answer.
- [ ] **INT-03/04** A submit without image shows "Je krijgt binnen een paar minuten een voorbeeld per mail."; the
      `Aanvragen` tab gets a row with an id `R<date>-XXX`, the verified mail address and state `nieuw`, then `verzonden`.
- [ ] **INT-04/07** That submit starts a run of `render.yml` (Actions tab). Its log shows no text, name or mail address.
- [ ] **INT-08** An iPhone photo (HEIC) lands in `KerkSlideGen/Beelden/<id>.heic` and the request is `verzonden` with
      the image flag. Its run ends on `missing secret: CALLBACK_URL` until VS2-02 (the job checks its secrets first),
      then on "image fetch not built yet" until VS2-05.
- [ ] **INT-08** A PDF in the image question (pick *Any file* for this test, then back to *Image*): the requester gets
      "Dit bestandstype kunnen we niet gebruiken, stuur een foto (JPG of PNG).", the row says `geweigerd`, no run.
- [ ] **INT-06** A text of 5001 characters: no run, the row says `handwerk`, the visual team gets a mail with the text
      and the reason.
- [ ] **INT-06** A sixth submit within an hour from one address: `handwerk` and a mail to the visual team.
- [ ] **INT-05** From an address with at most 4 submits in the last hour (else INT-06 stops it first), with
      `GITHUB_TOKEN` set to `wrong`: the row says `opnieuw` with 1 attempt at once, 2 after about 2
      minutes and 3 after about 5, then after about 10 minutes `handwerk` (4 attempts) and a mail naming "GitHub
      antwoordde 401". Put the right token back.
