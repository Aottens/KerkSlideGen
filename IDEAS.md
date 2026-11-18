# KerkSlideGen — Ideas

Ideas the owner dropped or that came up, not yet planned. No criteria or code until a phase is chosen.

| Id | Idea | Phase | Status |
| --- | --- | --- | --- |
| IDEA-01 | A photo or logo in the slide. | 1 | planned (2026-11-18, INT-08, REN-11..13, DLV-14) |
| IDEA-02 | Mail-in intake: a mail to `visueel+slide@` works like the form. | later | open |
| IDEA-03 | More layouts (e.g. a date-first layout for recurring events). | later | open |
| IDEA-04 | A live dashboard like CMDMX's `scripts/dashboard.py` (TRK-05..08). | later | open |
| IDEA-05 | A weekday on a slide is checked against its date in code; a wrong one never reaches the screen. | 1 | planned (2026-11-18, CND-09, VS1-07 done) |
| IDEA-06 | Team mails and the requester's mail come from or go to `visueel@`, though the script runs on the owner's account. | 1 | decided (2026-11-18): the owner's address for phase 1, DECISIONS |
| IDEA-07 | Condense keeps an activity's name as written, in its own language (changes CND-02). | 1? | open |

### IDEA-01
Intent: members want their own image on a slide. Touches: render (image placement inside the safe area), intake (a
Google Form upload forces a login, so it needs a link or a mail attachment). Open: image rights, cropping, quality.

### IDEA-02
Intent: mail is what members already use. Touches: intake (Gmail trigger on a plus-address or label), condense (read
the event date from free text). Open: how to ask for a missing date without a form.

### IDEA-03
Intent: some requests (weekly prayer meeting) fit a fixed layout better. Touches: render, condense (pick a layout).
Open: who maintains the layouts.

### IDEA-04
Intent: the owner sees the state without reading files. Touches: scripts only. Open: worth it at this project's size?

### IDEA-05
Intent: a member writes "zaterdag 6 december" when the 6th is a Sunday, or the model adds a weekday; condense copies
it and the slide shows a wrong day (run `tests/manual/runs/2026-11-18-VS1-04.md`). Touches: condense (check a Dutch
weekday in `when` against the date it names or the form's date; a mismatch gives the one retry, or drops the weekday).
Decided 2026-11-18: a mismatch goes to the visual team; the code cannot tell whether the day or the date is wrong.

### IDEA-06
Intent: the script runs on the owner's account (DECISIONS 2026-11-18), so DLV-08 mails go to the owner and, with
VS2-02, the approval mail (DLV-03) would come from the owner's address. Touches: `subprojects/google/src/main.js`
(`mailTeam_` sends to `Session.getEffectiveUser()`); a script property with the team's address, or a Gmail forward;
for DLV-03 `GmailApp` with `visueel@` as a verified *Send mail as* alias. Decided 2026-11-18: the owner's address is fine for
phase 1 (DECISIONS). Found in run `tests/manual/runs/2026-11-18-VS2-01.md`.

### IDEA-07
Intent: the slide says what the requester wrote. In run `tests/manual/runs/2026-11-18-VS2-02.md` an English activity
name was translated (CND-02: "All text is Dutch, whatever language") and `line` got an invitation the request did not
hold (CND-03 already says a field the request does not support is empty: that part is a defect, VS1-08). Owner,
2026-11-18:
1. the name or title of an activity stays as written, in its own language; the rest of the slide is Dutch;
2. `line` holds only what the request says, condensed so it still covers it; nothing in the request, then empty;
3. a weekday derived from the date (CND-09) stays: "netjes zelfs".
Touches: `specs/modules/condense.md` (CND-02), `subprojects/renderer/prompts/condense.md`, the eval set
(`tests/fixtures/requests/`: a request with an English activity name), `slidegen eval` on the
owner's word. Open: does "as written" keep the requester's capitals and `&`?
