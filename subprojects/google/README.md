# subprojects/google — Apps Script

The Google side of KerkSlideGen, on the visual team's account: the form, the requests Sheet, mail, Drive folders and,
later, the callback and approvals. It holds no slide logic (`CLAUDE.md`). Names and mail addresses never leave Google:
the dispatch to GitHub carries only id, round, text, change, dates and an image flag (INT-04,
`subprojects/renderer/INTERFACE.md`).

| File | What |
| --- | --- |
| `src/intake.js` | Pure: the form's fields, ids, Sheet rows, the dispatch body, the guard, retries, mail texts |
| `src/main.js` | The thin Google layer: `setup()`, `onSubmit(e)`, `retryDispatches()` |
| `src/appsscript.json` | The manifest (V8, Europe/Amsterdam) |
| `tests/` | Node tests of `src/intake.js`: `node --test subprojects/google/tests/*.test.js` |

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

## Setup (the owner, once)
Do every step signed in as `visueel@baptistengemeente.nl`. It works on a plain Gmail account and on Google Workspace;
step 6 has the one Workspace-only setting.

1. **Apps Script API.** Open <https://script.google.com/home/usersettings> and turn *Google Apps Script API* on.
2. **clasp.** `npm install -g @google/clasp`, then `clasp login` and choose the visual team's account.
3. **Create the script project.** In `subprojects/google`:
   ```bash
   clasp create --type standalone --title "KerkSlideGen" --rootDir src
   ```
   This writes `.clasp.json` (git-ignored). If `git status` then shows a changed `src/appsscript.json` or a new
   `src/Code.js`, undo that: `git checkout -- src/appsscript.json` and `rm -f src/Code.js`.
4. **Push the code.** `clasp push` (answer yes when it asks to overwrite the manifest).
5. **Run `setup` once.** `clasp open-script` (clasp 3; `clasp open` on clasp 2), pick `main.gs`, choose `setup` in the
   function list and press *Run*. Allow what it asks: Forms, Sheets, Drive, sending mail, connecting to an external
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
   2. Title `Afbeelding`, description `Mag leeg. Eén foto: JPG, PNG, WebP of HEIC, hoogstens 10 MB.`
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
   Contents: Read and write* (nothing else). Copy it once into the script: editor → *Project Settings → Script
   Properties → Add script property*, name `GITHUB_TOKEN`. Do not paste it anywhere else.
8. **Check the triggers.** Editor → *Triggers*: `onSubmit` *From form – On form submit* and `retryDispatches`
   *Time-driven – Every minute*, both owned by the visual team's account.
9. **Test it** with `tests/manual/intake.md`.

Later, with VS2-02: the script property `CALLBACK_SECRET` (the same value as the GitHub secret) and the web app
deploy.

## Gmail or Workspace
The script runs as the account that installed the triggers, on either kind of account. Only the quotas differ: on
Gmail 100 mails a day and 90 minutes of trigger time a day, on Workspace 1500 mails and 6 hours. At about 20 requests a
week both fit; `retryDispatches` runs every minute but returns at once unless a dispatch is waiting for a retry.
