# KerkSlideGen — Decision Log

Append-only. Newest at top. Each entry: date, decision, alternatives, why, reversal trigger.
Long-form records live in `specs/ADRs/`; this log is the index.

---

## 2026-11-18 — `Loop/` keeps its folder: the swap moves staged copies in, file by file (DLV-09)

**Decision:** a composition copies only the files `Loop/` lacks into a temporary folder `Loop (opbouw)/`, then moves
them into `Loop/` and trashes the files that no longer belong. Each copy carries its source's id (and, for fixed slides,
its last change) in its description, so an unchanged slide is never re-copied and a replaced one is.

**Alternatives considered:** build a whole new folder and rename it to `Loop` (the literal swap), so every night the
church Mac sees a new folder and every file again.

**Why:** Drive for Desktop on the church Mac and ProPresenter's Smart Playlist watch the folder `Loop/`; replacing it
risks the watch and makes every slide reappear at 03:00. The part that fails (copying) happens in the temporary folder,
so a failed copy leaves `Loop/` as it was (DLV-09); the moves after it are quick and rarely fail.

**Reversal trigger:** VS3-01 shows the Smart Playlist handles a replaced folder well, or a run ends with `Loop/` half
moved.

**Follow-up (owner, 2026-11-18):** the review on #18 found that a failure while moving leaves `Loop/` partly updated,
against DLV-09's "leaves the loop as it was". The owner chose to reword DLV-09 rather than undo the moves: a failure
while copying leaves the loop as it was, a failure while moving may leave it partly updated until the next run, and
the team mail says which (FIX-03).

---

## 2026-11-18 — Approval and team mails come from the owner's own account for phase 1 (IDEA-06, DLV-03)

**Decision:** the approval mail (DLV-03), the "ontvangen" mail (DLV-06) and every mail to the visual team (DLV-08) are
sent by the script's account, the owner's own address, and team mails go to that address. A `visueel@` alias or
forward can follow later without a spec change.

**Alternatives considered:** a Gmail forward to `visueel@`; `GmailApp` with `visueel@` as a verified *Send mail as*
alias.

**Why:** the owner: "iedereen kent mij in de kerk"; no extra setup for phase 1.

**Reversal trigger:** the owner hands the project over, or members distrust a mail from a personal address.

---

## 2026-11-18 — The Apps Script runs on the owner's own Google account, not on `visueel@` (INT-01)

**Decision:** the script, its triggers, the form, the Sheet and the `KerkSlideGen` folders live on the owner's own
Google account (a plain Gmail account); the folders are shared with `visueel@baptistengemeente.nl` and the church
Mac. Mails "to the visual team" (DLV-08) go to the owner's address until IDEA-06 decides otherwise.

**Alternatives considered:** the visual team's account, as planned (the owner keeps no control of it).

**Why:** the owner: "Dan kan ik beheer houden." Personal data still stays in Google (INT-04).

**Reversal trigger:** the owner hands the project over; then the script moves to the team's account (setup again,
the Sheet copied over).

---

## 2026-11-18 — The intake form is made by `setup()`, its image question by hand; retries by a minute trigger (INT-01, INT-05)

**Decision:** `setup()` in Apps Script creates the form (verified mail addresses, which forces a Google sign-in), the
Sheet tab `Aanvragen` and the triggers; the owner adds the file-upload question in the Forms editor
(`subprojects/google/README.md`). A failed dispatch is retried 2, 5 and 10 minutes after the submit by a trigger that
runs every minute and returns at once unless a retry is waiting. The Sheet shows `nieuw`, `verzonden`, `opnieuw`,
`handwerk` or `geweigerd`. The form does not use `setRequireLogin(true)`: on Workspace that admits only the church's
own domain.

**Alternatives considered:** the whole form by hand (more owner steps, no record of its fields in the repo); one-off
`after()` triggers per retry (more triggers to clean up); a 5-minute trigger (the third retry would fall after 10
minutes).

**Why:** FormApp cannot create a file-upload question; everything else it can, so the fields and texts live in
`src/intake.js` where the tests check them.

**Reversal trigger:** FormApp learns file uploads, or the minute trigger shows up in the quota.

---

## 2026-11-18 — The callback's signature goes in the query string, not a header (DLV-01)

**Decision:** the render job POSTs its callback to `<CALLBACK_URL>?sig=<hex HMAC-SHA256 of the body>`, not with an
`X-Signature` header (`subprojects/renderer/INTERFACE.md` §3), the same form as the image link's `sig=` (DLV-14).

**Alternatives considered:** the `X-Signature: sha256=<hex>` header of the first interface draft.

**Why:** an Apps Script web app's `doPost(e)` gets the body, the query and the content type, but no request headers,
so it could never check that header. The body is what is signed either way. Apps Script also always answers 200, so
VS2-02 decides how the web app tells the job it refused a body (an answer `{"ok": false}` the job then checks).

**Reversal trigger:** the callback moves off Apps Script to something that reads headers.

---

## 2026-11-18 — Condense through Claude Code on the owner's subscription, not the API (CND-05)

**Decision:** `slidegen condense` calls `claude -p` (Claude Code in print mode) with `--json-schema`, `--model
claude-opus-5-5` and `--effort low`, signed in with the owner's Claude subscription through `CLAUDE_CODE_OAUTH_TOKEN`
(`claude setup-token`), the secret the review already uses. Claude gets no tools (`--tools ""`), no settings, no MCP
servers and no saved session. The `anthropic` Python SDK is not a dependency.

**Alternatives considered:** the Claude API with an `ANTHROPIC_API_KEY` and a spend limit (the spec's first draft):
the owner does not want a separate API account and bill.

**Why:** no API key and no second bill; one secret for review and condense, as in CMDMX. About 20 requests a week fit
easily in the subscription.

**Reversal trigger:** the subscription's limits stop requests, or the token's yearly renewal is missed too often; then
an API key with a spend limit after all.

---

## 2026-11-18 — Smaller before hyphenated (REN-06)

**Decision:** The text shrinks as far as 60 % before any word is hyphenated; Dutch hyphenation is the fallback only
when nothing fits unhyphenated.

**Alternatives considered:** hyphenating first at full size (REN-06 as approved, which broke "Kerstnacht-/dienst"
beside an image); shrinking only the title.

**Why:** owner, shown both: "eerst kleiner maken". A whole word reads better from the back row than a broken one.

**Reversal trigger:** slides with an image come out too small to read; then shrink only the title first.

---

## 2026-11-18 — Montserrat, the image's side varies, the intro slideshow is the composed folder

**Decision:** Slides are set in Montserrat (REN-08). A slide with an image puts it left or right by its id (REN-14).
The intro slideshow in ProPresenter becomes the Smart Playlist on `Loop/`, 15 s per slide with a transition; the
fixed slides of today's slideshow move to `Vast/` (DLV-11, DLV-15).

**Alternatives considered:** Roboto, or an own choice of font; the image always left; alternating strictly by
position in the loop (needs both mirrored renders of every slide); keeping the hand-made presentation and only
adding slides to it.

**Why:** owner: the church's slides use Montserrat or Roboto, and a new font would mean restyling everything; "soms
links, soms rechts, anders is het vrij eentonig"; the volunteer now disables slides by hand each week, which should
go. A side chosen by id is stable through *Aanpassen* and needs one render.

**Reversal trigger:** several image slides in a row end up on the same side often enough to look monotonous; then
render both sides and let the composition alternate.

---

## 2026-11-18 — Two layouts: text only, or image beside the text

**Decision:** A slide without image has its text centred in the title-safe area of the centre screen; a slide with an
image has the image on the left and the text on the right, both inside that area (REN-11, `assets/layout.json`).

**Alternatives considered:** the image behind the text with a dark veil; the image on the left side screen, out of
the livestream. All four were rendered on the church's background and shown to the owner.

**Why:** owner: "0 of A, afhankelijk van of er een afbeelding is meegestuurd". The image stays in the livestream; a
veil over a busy photo hurt legibility.

**Reversal trigger:** text with an image shrinks too often to read from the back row (VS3-01).

---

## 2026-11-18 — Requesters sign in with Google; a request may carry an image

**Decision:** The form requires a Google sign-in and records the verified mail address (INT-02); it has an optional
image upload (INT-08). The allowlist (DLV-06) checks that verified address.

**Alternatives considered:** a form without login (anyone with the link can ask); an own Apps Script form page or
Tally, which allow uploads without login.

**Why:** owner: "niet elke gek moet een aanvraag kunnen doen" and "er moet ook een plaatje in kunnen". A Google Form
with an upload question requires sign-in anyway, so both wishes give the simplest form.

**Reversal trigger:** members without a Google account give up rather than make one.

---

## 2026-11-17 — The GitHub repo is public

**Decision:** `Aottens/KerkSlideGen` is public. Workflow logs and artifacts never hold request text, slide text or a
PNG (INT-07); names and mail addresses never reach GitHub at all (INT-04).

**Alternatives considered:** private repo with a fixed billing or a higher Actions spending limit.

**Why:** the owner's choice when GitHub refused Actions on the private repo for the account's billing; public repos
run Actions for free.

**Reversal trigger:** a member's text shows up in a public log or artifact, or billing is fixed and the owner prefers
private.

---

## 2026-11-17 — Port the CMDMX harness, English in the repo

**Decision:** The project runs on the CMDMX harness: spec → test → code → review, numbered criteria, `STATE.md` as
handoff checked by `scripts/check-tracking.py`, the GitHub review and risk gate (`scripts/risk-gate.py`) with its own
path table. Repo language English, owner in Dutch, everything members read in Dutch.

**Alternatives considered:** the Harnas per-feature workflow (mini-PM and build chat); no harness for a small project.

**Why:** the owner asked for the CMDMX harness; its gates are tested and its scripts are standard-library Python, so
they port by changing one path table.

**Reversal trigger:** the overhead is larger than the project; then drop the autoreview first, keep the tracking.

---

## 2026-11-17 — Pipeline: Google Form → GitHub Actions (Claude + Chromium) → Drive folder → ProPresenter (ADR-001)

**Decision:** Intake with a Google Form and Apps Script on the visual team's account; condense with the Claude API and
render HTML/CSS with headless Chromium in a GitHub Actions job; the requester approves by mail; an approved PNG goes
to a Drive folder that the church Mac syncs and that a ProPresenter Smart Playlist plays.

**Alternatives considered:** Canva Connect autofill or Placid/Bannerbear/Templated (lock-in, €20–50 a month, plan
requirements unclear in 2026); Google Slides API (thumbnails at most 1600 px wide, weak text fit); writing `.pro`
files or using ProPresenter's API (no media import; reverse-engineered format); Tally form with webhook (no login, but
one more service and an endpoint to host); n8n or Make (another platform to keep).

**Why:** €0 a month plus cents for Claude; pixel-exact safe area in CSS; everything personal stays in the church's
Google account; the folder is the most stable interface to any player. Details: `specs/ADRs/ADR-001-pipeline.md`.

**Reversal trigger:** the Smart Playlist does not pick up folder changes reliably (VS3-01); Google Form proves too
hard for members; GitHub Actions minutes or the 2026 pricing change for private repos start to cost money.
