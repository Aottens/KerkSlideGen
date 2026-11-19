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
| IDEA-07 | Condense keeps an activity's name as written, in its own language (changes CND-02). | 1 | planned (2026-11-18, CND-10, VS1-09 done) |
| IDEA-08 | Rotating fixed slides: one of a set shows per week, e.g. the pastoral team's messages. | 1 | planned (2026-11-18, DLV-16, with VS2-04) |
| IDEA-09 | *Aanpassen* can drop the request's image (a checkbox on the change page). | 1 | open |
| IDEA-10 | *Aanpassen* can change the event date and the last day on screen. | 1 | open |

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

### IDEA-08
Intent: the pastoral team asked (2026-11-18, by mail to the visual team) for seven short messages ("call the pastoral
team") on the beamer, a different one each week, with no weekly work for the team. Touches: `specs/modules/deliver.md`
(a new DLV criterion: composition takes one PNG from a rotation folder, e.g. `Vast/Wisselend/`, by ISO week number,
beside all of `Vast/`), VS2-04's composition in `subprojects/google/src/main.js`; the seven slides are rendered once
with `slidegen render` and live only in Drive (INT-07). Open: one per week or a few; does the rotation reset when a
slide is added; the photos sent along are too small for 1920×1080 (text only, or larger photos); one message is too
long for 15 seconds and goes back to the team to shorten.

### IDEA-09
Intent: a requester who asks in *Aanpassen* to leave the image out gets it again: the change text only goes to condense
(DLV-05), and the render uses the request's image whenever there is one (REN-11). Found in the VS2-03 run
(2026-11-19). Proposed: the change page gets a checkbox *Afbeelding weglaten*; ticked, the next dispatch sends
`image: false`. Phase 1, after the fix blocks. Touches: `specs/modules/deliver.md` (DLV-05),
`subprojects/google/src/deliver.js` (`changeForm`, `afterChange`), `main.js` (`submitChange`), a Sheet field for "no
image", `tests/manual/approve.md`. Open: can a requester also add or swap an image in *Aanpassen*, or only drop it?

### IDEA-10
Intent: when a change moves the event's date, the slide's last day on screen (`show_until`) moves with it; today the
dates stay those of the form, whatever the change text says. Found in the VS2-03 run (2026-11-19). Proposed: the change
page shows the event date and the last day, filled in from the request, editable; the next dispatch carries the new
dates (a date read from the change text by Claude is not trusted: CND-03). Phase 1, together with IDEA-09 (one change
page). Touches: `specs/modules/deliver.md` (DLV-05), `intake.md` (INT-01 date rules), `deliver.js`, `main.js`,
`tests/manual/approve.md`. Open: what if the text says another date than the fields; can the last day be after the
event date.
