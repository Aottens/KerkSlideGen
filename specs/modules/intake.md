# Module spec: intake (INT)

Owner: `subprojects/google/` (form trigger and dispatch), `.github/workflows/render.yml` (the receiving end).
Tests: `subprojects/google/tests/` (pure functions, run with Node), `tests/manual/intake.md`.
Status: draft 2026-11-17, waits for gate 1.

How a request gets in. It has to be as easy as sending a mail, for people who do not have or want a Google account.

## The form
- **INT-01** One Google Form owned by the visual team's account, fields in this order: name, mail address, the text
  ("Wat wil je aankondigen? Plak gerust de hele tekst."), event date, last date to show (optional, help text: "leeg
  = tot de datum van het evenement"). No file upload: it forces a Google login (research 2026-11-17).
- **INT-02** The form needs no login and collects no other data. Its answers go to the requests Sheet.
- **INT-03** The form's confirmation says: "Je krijgt binnen een paar minuten een voorbeeld per mail."

## Dispatch
- **INT-04** On submit, Apps Script gives the request an id (`R` + date + 3 random characters), writes it with state
  `nieuw` to the Sheet, and sends a `repository_dispatch` of type `slide-request` to the GitHub repo with only id,
  text, event date and last show date (`subprojects/renderer/INTERFACE.md`). No name or mail address leaves Google.
- **INT-05** A dispatch that GitHub refuses or that times out is retried 3 times over 10 minutes by a time trigger;
  then the request goes to the visual team (DLV-08). The Sheet shows the state at every step.
- **INT-06** A text over 5000 characters or a form filled in more than 5 times in an hour from the same mail address
  is not dispatched: the visual team gets it (abuse and cost guard).

## Owner questions
1. **Google Form or mail-in?** Recommended: the form for phase 1: fixed fields, dates that parse. Mail to an address
   like `visueel+slide@` is IDEA-02: the most familiar for members, but dates and intent are harder to read.
2. **Is `visueel@baptistengemeente.nl` a Google Workspace account?** Needed to know whether Apps Script runs as that
   account (it does on Workspace and on a plain Gmail account; only the quotas differ: 100 mails a day on Gmail).
