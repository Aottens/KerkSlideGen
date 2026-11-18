# Module spec: intake (INT)

Owner: `subprojects/google/` (form trigger and dispatch), `.github/workflows/render.yml` (the receiving end).
Tests: `subprojects/google/tests/` (pure functions, run with Node), `tests/manual/intake.md`.
Status: draft 2026-11-17; login and image upload 2026-11-18 (owner: "niet elke gek moet een aanvraag kunnen doen",
"er moet ook een plaatje in kunnen"). Waits for gate 1.

How a request gets in: as easy as a form on a phone, but only for someone who signs in, so the church knows who asked.

## The form
- **INT-01** One Google Form owned by the account that runs the script, the owner's (DECISIONS 2026-11-18; not in a
  shared drive: uploads do not work there),
  fields in this order: name, the text ("Wat wil je aankondigen? Plak gerust de hele tekst."), event date, last date
  to show (optional, help text: "leeg = tot de datum van het evenement"), an image (optional, INT-08).
- **INT-02** The form requires a Google sign-in and collects the verified mail address of whoever signs in; there is
  no typed mail field. Someone without a Google account can make one with their own mail address. Its answers go to
  the requests Sheet; the form collects no other data.
- **INT-08** The image question accepts one file, images only, at most 10 MB. Forms stores it in that account's
  Drive; Apps Script copies it to `KerkSlideGen/Beelden/<id>.<ext>`. JPG, PNG, WebP and HEIC (iPhone photos) are
  accepted; another type gives a mail to the requester: "Dit bestandstype kunnen we niet gebruiken, stuur een foto
  (JPG of PNG).", and the request is not dispatched; their next submit is a new request.
- **INT-03** The form's confirmation says: "Je krijgt binnen een paar minuten een voorbeeld per mail."

## Dispatch
- **INT-04** On submit, Apps Script gives the request an id (`R` + date + 3 random characters), writes it with state
  `nieuw` to the Sheet, and sends a `repository_dispatch` of type `slide-request` to the GitHub repo with only id,
  text, event date, last show date and whether there is an image (`subprojects/renderer/INTERFACE.md`). No name or
  mail address leaves Google. The image itself is fetched by the render job through a signed link (DLV-14).
- **INT-05** A dispatch that GitHub refuses or that times out is retried 3 times over 10 minutes by a time trigger;
  then the request goes to the visual team (DLV-08). The Sheet shows the state at every step.
- **INT-06** A text over 5000 characters or a form filled in more than 5 times in an hour from the same mail address
  is not dispatched: the visual team gets it (abuse and cost guard).
- **INT-07** The repo is public (DECISIONS 2026-11-17), so its workflow logs and artifacts are too: no workflow
  prints the request text, the `change` text, the slide text, the image or the PNG, and no workflow uploads them as an
  artifact.
  A run's log shows only the request id, the round and the outcome. A test greps the workflow files for `echo`,
  `cat` or `upload-artifact` of those fields.

## Owner questions
1. **Google Form or mail-in?** Answered 2026-11-18: a Google Form with sign-in, so not everyone can ask (owner). Mail
   to `visueel+slide@` stays IDEA-02.
2. **Is `visueel@baptistengemeente.nl` a Google Workspace account?** Needed to know whether Apps Script runs as that
   account (it does on Workspace and on a plain Gmail account; only the quotas differ: 100 mails a day on Gmail).
   Answered 2026-11-18: moot, the script runs on the owner's own account, a plain Gmail account (owner: "Dan kan ik
   beheer houden"); the folders are shared with the visual team.
