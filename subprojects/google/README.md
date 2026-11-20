# subprojects/google — Apps Script

The Google side of KerkSlideGen, on the owner's Google account (DECISIONS 2026-11-18; the folders are to be
shared with the visual team once `Loop/` exists, VS2-04): the form, the requests Sheet, mail, Drive folders, the
callback and approvals. It holds no slide logic (`CLAUDE.md`). Names and mail addresses never leave Google:
the dispatch to GitHub carries only id, round, text, change, dates and an image flag (INT-04,
`subprojects/renderer/INTERFACE.md`).

| File | What |
| --- | --- |
| `src/intake.js` | Pure: the form's fields, ids, Sheet rows, the dispatch body, the guard, retries, mail texts |
| `src/deliver.js` | Pure: callback and image signatures, tokens, the allowlist, the approval mail and pages |
| `src/main.js` | The thin Google layer: `setup()`, `onSubmit(e)`, `retryDispatches()`, the web app `doPost`/`doGet` |
| `src/appsscript.json` | The manifest (V8, Europe/Amsterdam) |
| `tests/` | Node tests of `src/intake.js` and `src/deliver.js`: `node --test subprojects/google/tests/*.test.js` |

`.clasp.json` holds the script id and is git-ignored; `clasp push` and deploying are the owner's steps.

## How a request flows (VS2-01)
1. A member signs in with Google and submits the form. `onSubmit` gives it an id (`R20261118-K7Q`) and a row with
   state `nieuw` in the tab `Aanvragen` of the Sheet *KerkSlideGen aanvragen*.
2. An image is copied to `KerkSlideGen/Beelden/<id>.<ext>` (JPG, PNG, WebP, HEIC). Another type: the member gets the
   mail "Dit bestandstype kunnen we niet gebruiken…" and the row says `geweigerd` (INT-08).
3. A text over 5000 characters, or a sixth submit within an hour from one address: no dispatch, the visual team gets
   a mail and the row says `handwerk` (INT-06).
4. Otherwise a `repository_dispatch` goes to GitHub: `verzonden`. GitHub refusing or not answering: `opnieuw`, retried
   by the minute trigger after 2, 5 and 10 minutes; after that `handwerk` and a mail to the visual team (INT-05).

## After the render (VS2-02, VS2-05)
5. The render job fetches the image, if any, from the web app with a link signed for 15 minutes (DLV-14).
6. It posts the PNG back, signed. The web app checks the signature, the id and that the request waits for this round,
   stores `KerkSlideGen/Te keuren/<id>.png`, sets `te keuren` and a random token, and mails the approval mail with
   *Goedkeuren* and *Aanpassen* to the requester if the address is on the tab `Toegestaan`, otherwise to this account
   and "Je aanvraag is ontvangen en wordt bekeken." to the requester (DLV-01..03, 06). A failed render: `handwerk`
   and a mail to this account.
7. *Goedkeuren* moves the PNG to `Bibliotheek/` and sets `goedgekeurd` (DLV-04), then composes `Loop/` at once.
   *Aanpassen* shows a placeholder until VS2-03.
8. `Loop/` is composed after every approval and every night (DLV-09): every PNG in `Vast/`, one from
   `Vast/Wisselend/` by ISO week (DLV-16), and every approved request up to its last day. Missing copies are made in
   `Loop (opbouw)/` first, then moved in; a failed run leaves `Loop/` as it was and mails this account (DLV-08).
   Requests past their last day move to `Archief/` as `gearchiveerd` (DLV-13).

## Setup (the owner, once)
Do every step signed in as the account that will own the script: the owner's own Google account (DECISIONS
2026-11-18). It works on a plain Gmail account and on Google Workspace; step 6 has the one Workspace-only setting.
Mails "to the visual team" go to this account (`Session.getEffectiveUser()`).

1. **Apps Script API.** Open <https://script.google.com/home/usersettings> and turn *Google Apps Script API* on.
2. **clasp.** No install needed: run it with `npx @google/clasp …` (a global `npm install -g` fails with `EACCES`
   when npm's prefix is `/usr/local`; do not use `sudo`). `npx @google/clasp login`, choose the account and allow
   every scope it asks for (projects, Drive, deployments, logs). Every `clasp …` below is `npx @google/clasp …`.
3. **Create the script project.** In `subprojects/google`:
   ```bash
   clasp create --type standalone --title "KerkSlideGen" --rootDir src
   ```
   This writes `.clasp.json` (git-ignored). If `git status` then shows a changed `src/appsscript.json` or a new
   `src/Code.js`, undo that: `git checkout -- src/appsscript.json` and `rm -f src/Code.js`.
4. **Push the code.** `clasp push` (answer yes when it asks to overwrite the manifest).
5. **Run `setup` once.** `clasp open-script` (clasp 3; `clasp open` on clasp 2), pick `main.gs`, choose `setup` in the
   function list and press *Run*. On "Google hasn't verified this app" choose *Advanced → Go to KerkSlideGen
   (unsafe)*: it is your own script. Allow what it asks: Forms, Sheets, Drive, sending mail, connecting to an external
   service (GitHub) and triggers. It makes, in *My Drive* (not a shared drive: uploads do not work there):
   - the folder `KerkSlideGen` with `Beelden` inside;
   - the Sheet *KerkSlideGen aanvragen* with the tab `Aanvragen`;
   - the form *Slide aanvragen* with name, text, event date and last date, collecting verified mail addresses,
     linked to the Sheet;
   - the triggers `onSubmit` (on form submit) and `retryDispatches` (every minute).

   The execution log shows the form's edit link and its public link. Running `setup` again changes nothing but the
   triggers, which it reinstalls.
6. **Finish the form in the Forms editor** (FormApp cannot make a file-upload question). Open the edit link:
   1. Add a question at the end, type *File upload* (*Bestand uploaden*); confirm the upload folder with *Continue*.
   2. Title `Afbeelding`, description `Niet verplicht: een foto (JPG, PNG, WebP of HEIC), maximaal 10 MB.` (the text
      in `src/intake.js`).
   3. *Allow only specific file types* on, tick only *Image*; *Maximum number of files* 1; *Maximum file size*
      10 MB; *Required* off.
   4. *Settings → Responses*: *Collect email addresses* is *Verified*; *Limit to 1 response* is off.
      **Workspace only:** *Restrict to users in baptistengemeente.nl and its trusted organisations* must be **off**,
      or members with their own Google account cannot answer (`setup` tries to switch it off already).
   5. *Settings → Presentation*: the confirmation message reads "Je krijgt binnen een paar minuten een voorbeeld per
      mail."
7. **GitHub token.** On GitHub (the owner's account): *Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token*. Name `KerkSlideGen intake`, expiry one year (put the renewal date in the
   calendar), *Resource owner* Aottens, *Only select repositories* → `KerkSlideGen`, *Repository permissions →
   Contents: Read and write* (nothing else: GitHub adds *Metadata: Read-only* by itself, and the dispatch needs only
   *Contents: write*). Copy it once into the script: editor → *Project Settings → Script
   Properties → Add script property*, name `GITHUB_TOKEN`. Do not paste it anywhere else.
8. **Check the triggers.** Editor → *Triggers*: `onSubmit` *From form – On form submit* and `retryDispatches`
   *Time-driven – Every minute*, both owned by the account from step 1.
9. **Test it** with `tests/manual/intake.md`.

### The callback and approvals (VS2-02, VS2-05)
10. **Push and run `setup` again.** `clasp push`, then run `setup` once more in the editor and allow the new scopes.
    It adds the folders `Te keuren` and `Bibliotheek`, the new Sheet columns `token` and `png`, and the tab
    `Toegestaan`; nothing else changes.
11. **Deploy the web app.** Editor → *Deploy → New deployment*, type *Web app*, *Execute as: Me*, *Who has access:
    Anyone* (GitHub and members open it without a Google sign-in; every request is checked by its signature or token).
    Copy the *Web app URL* (ends in `/exec`). After a later `clasp push`, use *Deploy → Manage deployments → Edit →
    Version: New version* so the URL stays the same.
12. **The shared secret and the URL.** Make a secret once: `openssl rand -hex 32`. Put it, and nowhere else, in:
    - GitHub → the repo → *Settings → Secrets and variables → Actions*: `CALLBACK_SECRET` = the secret,
      `CALLBACK_URL` = the web app URL;
    - the script properties: `CALLBACK_SECRET` = the same secret, `WEB_APP_URL` = the web app URL (the buttons in the
      approval mail point there).
13. **The allowlist.** In the Sheet tab `Toegestaan`, one mail address per row in column A: these members approve
    their own slide (DLV-06). Everyone else's slide goes to this account first.
14. **Test it** with `tests/manual/approve.md`.

### The loop (VS2-04)
15. **Push, run `setup` again, new web app version.** `clasp push`, run `setup` in the editor and allow what it asks.
    It adds the folders `Vast`, `Loop` and `Archief` and the trigger `composeLoop` (every night between 03:00 and
    04:00, Apps Script's day timer). Then *Deploy → Manage deployments → Edit → Version: New version*.
16. **Fixed slides.** The visual team puts its fixed slides as PNGs in `KerkSlideGen/Vast/` and the rotating ones in
    `KerkSlideGen/Vast/Wisselend/` (make that folder by hand). `Loop/` is never edited by hand.
17. **Share.** Share the folder `KerkSlideGen` with `visueel@` as *Editor* and with the church Mac's Google account as
    *Viewer*; on the church Mac, Drive for Desktop mirrors `KerkSlideGen/Loop/` (DLV-10, VS3-01).
18. **Test it** with `tests/manual/loop.md`.

### Aanpassen and expiry (VS2-03)
19. **Push, run `setup` again, new web app version.** In the owner's checkout: `git checkout main && git pull`, then
    in `subprojects/google` run `npx @google/clasp push` (answer yes to overwrite the manifest). Open the editor with
    `npx @google/clasp open-script`, pick `main.gs`, choose `setup`, press *Run*: it adds the Sheet columns
    `aanpassing` and `sinds`. Then *Deploy → Manage deployments*, the pencil at the web app, *Version: New version*,
    *Deploy*: the URL stays the same. Without the new version the *Aanpassen* button still shows the old page.
20. **Test it** with the *Aanpassen* and *Expiry* sections of `tests/manual/approve.md`.

### The agenda (VS4-01)
21. **Set the id, push, allow.** Put the church agenda's id in the script property `AGENDA_CALENDAR_ID` (never in
    the repo), `npx @google/clasp push`, and run `composeLoop` once in the editor to allow the new *Calendar* scope;
    the script subscribes this account to the agenda itself. Every night the coming week then lands in the
    Sheet tab `Agenda`; a failed read keeps the last good one and mails this account once a day.
22. **Test it** with `tests/manual/agenda.md` (click by click, in Dutch).

The approval mail, the "ontvangen" mail and the team mails come from this account's address (DECISIONS 2026-11-18).

## Gmail or Workspace
The script runs as the account that installed the triggers, on either kind of account. Only the quotas differ: on
Gmail 100 mails a day and 90 minutes of trigger time a day, on Workspace 1500 mails and 6 hours. At about 20 requests a
week both fit; `retryDispatches` runs every minute but returns at once unless a dispatch is waiting for a retry.
