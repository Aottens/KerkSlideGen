# Module spec: agenda (AGD)

Owner: `subprojects/google/` (reading the agenda, the activities tab, the nightly run), `subprojects/renderer`
(rendering an occurrence without Claude). Tests: `subprojects/google/tests/`, `subprojects/renderer/tests/`.
Status: draft 2026-11-18, asked for by the owner ("koppelen aan de gemeente-agenda, zodat de terugkerende dingen er
automatisch ingezet kunnen worden"). Waits for gate 1. The agenda's system is not known yet (owner question 1).

What is in the church's agenda for the coming week is on the screen without anyone asking for it. A recurring
activity gets one slide, approved once; after that only its date changes.

## Reading the agenda
- **AGD-01** The rest of this spec sees the agenda only as *occurrences*: series id, title, description, start, end,
  location, cancelled. One adapter turns the agenda's system into occurrences; which adapter is chosen when the owner
  names the system (owner question 1). The adapter is the only code that knows the system.
- **AGD-02** Every night, in the same run as the loop composition (DLV-09), Apps Script reads the occurrences that
  start from today up to and including 7 days later. That is what the loop shows: on Sunday morning, the coming week
  (owner, 2026-11-18).

## Activities
- **AGD-03** An *activity* is one recurring series (same series id), or one event that does not recur. The Sheet
  has a tab *Activiteiten*: series id, title, state (`nieuw`, `te keuren`, `tonen`, `niet tonen`) and the approved
  slide text.
- **AGD-04** An occurrence of an activity in state `nieuw` gets its slide made once: condense (CND) reads the title and
  description and fills only `title` and `line`; `when` and `where` come from the agenda, never from Claude. The visual
  team gets the approval mail (DLV-03) with three buttons: *Goedkeuren*, *Aanpassen*, *Niet tonen*. The agenda has no
  requester, so the visual team approves (owner, 2026-11-18: once per activity).
- **AGD-05** For an activity in state `tonen`, every occurrence in the window of AGD-02 is rendered without Claude: the
  approved `title` and `line`, `when` from the occurrence's start in Dutch ("zondag 30 november, 19.30 uur"), `where`
  from its location (cut to 40 characters at a word boundary, empty when the agenda has none).
- **AGD-06** *Niet tonen* gives the activity state `niet tonen`: none of its occurrences gets a slide. The visual team
  undoes it by setting the state back to `nieuw` in the Sheet.
- **AGD-07** An occurrence whose time or place changes in the agenda is rendered again in the next night's run; one
  that is cancelled or deleted is not in the next loop. A change to an activity's title or description does not make
  a new slide: the visual team sets the activity back to `nieuw` when it should.

## Failure
- **AGD-08** When the agenda cannot be read, the night's run keeps the agenda slides of the last successful read in
  the loop, and the visual team gets one mail per day with the error until it works again (DLV-08).

## Owner questions
1. **Which agenda system?** Asked at the church (2026-11-18). Most church apps and websites can export a calendar
   link (iCal); a Google Agenda can be read directly. Needed before VS4-01.
2. **What if an activity's slide should differ per date** (e.g. a speaker's name)? Recommended: phase 1 no; such an
   evening goes through the form. Otherwise: let condense read each occurrence's description, with an approval each time.
