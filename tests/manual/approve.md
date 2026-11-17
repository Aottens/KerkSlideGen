# Manual check: approval round trip (DLV-02..07)

Run in the visual team's Google account with a test allowlist entry. Make a run file
`tests/manual/runs/<date>-<task>.md` with the ticked list and `## Open points`.

- [ ] A form submit from an allowlisted address gives a mail with the slide inline and two buttons within 5 minutes.
- [ ] *Goedkeuren* moves the PNG to `Loop/` as `<show_until>_<id>.png`; a second click says it is already approved.
- [ ] A link with one character of the token changed does nothing and says so.
- [ ] *Aanpassen* with "zet de tijd erbij" gives a new mail with a new slide; the fourth round goes to the visual team.
- [ ] A submit from an address not on the allowlist mails the visual team, and the requester gets the received mail.
