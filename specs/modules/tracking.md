# Module spec: tracking (TRK)

Owner: `scripts/check-tracking.py`, the SessionStart hook in `.claude/settings.json`. Tests: `scripts/test_tracking.py`.
Status: ported from CMDMX on 2026-11-17 (TRK-01..04 and TRK-09; its dashboard TRK-05..08 is IDEA-04). Waits for gate 1.

The owner cannot see where the project stands when `STATE.md` drifts from `BACKLOG.md`, or when a checkout lags behind
`main`. So the handoff repeats as little as it can, CI compares what is left, and the session start reads `main`.

## Handoff
- **TRK-01** `STATE.md` has exactly the sections Now, Next, Waiting on the owner, Blocked, Owner to decide and Good
  to know, at most 70 lines of at most 120 characters, and no version number. CI fails otherwise.
- **TRK-02** `STATE.md` names no BACKLOG task that is done, and *Next* names at least one that is open. CI fails
  otherwise, so finishing a task named there forces the rewrite in the same PR.
- **TRK-03** Every `gate3` task is named under *Waiting on the owner* and every `blocked` task under *Blocked*; a
  task under *Blocked* has status `blocked`. CI fails otherwise.
- **TRK-09** Every BACKLOG id is used by one row. CI fails otherwise.
- **TRK-04** Every session start prints `STATE.md` as it is on `main`, whatever the checkout is on.
