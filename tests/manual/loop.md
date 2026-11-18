# Manual check: composing `Loop/` (DLV-09, 12, 13, 16)

After steps 15–17 of `subprojects/google/README.md`, on the owner's account (DECISIONS 2026-11-18). Write the run in
`tests/manual/runs/<date>-VS2-04.md` with the ticked list and `## Open points`. Use made-up requests and plain test
PNGs; ids stay in the Sheet (INT-04). Run `composeLoop` from the editor (function list → *Run*) where a step says so.

## Fixed slides (DLV-12)
- [ ] **DLV-12** Put two PNGs and one `.txt` in `KerkSlideGen/Vast/`, run `composeLoop`: `Loop/` holds the two PNGs,
      not the `.txt`.
- [ ] **DLV-12** Take one PNG out of `Vast/`, run `composeLoop`: it is gone from `Loop/`; the other one is the same
      file as before (same id in its link, not re-copied).
- [ ] **DLV-09** Replace the remaining PNG in `Vast/` with a changed one of the same name, run `composeLoop`: `Loop/`
      holds the new version.

## The rotating slide (DLV-16)
- [ ] **DLV-16** No folder `Vast/Wisselend/`: `composeLoop` runs without error and adds nothing for it.
- [ ] **DLV-16** Make `Vast/Wisselend/` with `a.png`, `b.png`, `c.png`, run `composeLoop`: `Loop/` holds exactly one
      of them, the one at index *ISO week of today mod 3* (`a` = 0); the Node tests cover other weeks.

## Requests (DLV-09, 04)
- [ ] **DLV-09** Approve a request with a last day in the future (`tests/manual/approve.md`): `Loop/<id>.png` appears
      right after *Goedkeuren*, and `<id>.png` stays in `Bibliotheek/`.
- [ ] **DLV-09** Drop any file into `Loop/` by hand, run `composeLoop`: it is removed.
- [ ] **DLV-09** No folder `Loop (opbouw)` is left in `KerkSlideGen/` after a run.

## Expiry (DLV-13)
- [ ] **DLV-13** In the Sheet, set that request's `tot` to yesterday, run `composeLoop`: `<id>.png` is gone from
      `Loop/`, has moved from `Bibliotheek/` to `Archief/`, and the row says `gearchiveerd`.

## Failure and the night (DLV-08, 09)
- [ ] **DLV-08** Make one PNG in `Vast/` unreadable for the script (e.g. a shortcut to a deleted file, or a file
      shared with you but whose owner removed access), run `composeLoop`: `Loop/` is unchanged and this account gets
      the mail "Loop niet bijgewerkt: …". Remove that file again.
- [ ] **DLV-09** Editor → *Triggers*: `composeLoop` *Time-driven – Day timer – 3am to 4am*. The next morning its
      execution in *Executions* is green.

## Sharing (owner, once)
- [ ] Share the folder `KerkSlideGen` with `visueel@` (editor) and the church Mac's Google account (viewer), as the
      steps in `subprojects/google/README.md` say. Both see `Vast/` and `Loop/`.
