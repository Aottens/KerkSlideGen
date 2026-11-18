# Manual check: intake (INT-01..06)

- [ ] In a private browser window the form asks for a Google sign-in first, then shows the fields of INT-01.
- [ ] An iPhone photo (HEIC) uploads and lands in `Beelden/<id>.heic`; a PDF gives the INT-08 mail.
- [ ] A submit shows the INT-03 confirmation and a new row with state `nieuw` and an id in the Sheet.
- [ ] The Actions run of `render.yml` shows only id, round and outcome: no text, image, name or mail address (INT-07).
- [ ] A text of 5001 characters is not dispatched and reaches the visual team (INT-06).
