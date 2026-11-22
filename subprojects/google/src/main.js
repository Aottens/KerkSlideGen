// Thin Google layer: all logic lives in intake.js. Only function declarations at top level.

function props_() { return PropertiesService.getScriptProperties(); }

// FIX-05 / DLV-05: trigger and setup entry points run only from our own triggers or the owner,
// never from the web app's google.script.run.
function fromOwner_(e) {
  const uid = e && e.triggerUid;
  if (uid && ScriptApp.getProjectTriggers().some((t) => t.getUniqueId() === String(uid))) return true;
  const me = Session.getEffectiveUser().getEmail();
  return Boolean(me) && Session.getActiveUser().getEmail() === me;
}

function setup(e) {
  if (!fromOwner_(e)) return;
  const p = props_();
  let formId = p.getProperty('FORM_ID');
  if (!formId) {
    const root = findOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER);
    p.setProperty('IMAGES_FOLDER_ID', findOrCreateFolder_(root, IMAGES_FOLDER).getId());

    const ss = SpreadsheetApp.create('KerkSlideGen aanvragen');
    DriveApp.getFileById(ss.getId()).moveTo(root);
    const tab = ss.getSheets()[0];
    tab.setName(SHEET_TAB);
    tab.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    tab.setFrozenRows(1);
    p.setProperty('SHEET_ID', ss.getId());

    const form = FormApp.create(FORM.title);
    for (const it of FORM.items) {
      if (it.type === 'FILE_UPLOAD') continue; // FormApp cannot create it: the owner adds it in the Forms UI.
      const item = it.type === 'TEXT' ? form.addTextItem()
        : it.type === 'PARAGRAPH_TEXT' ? form.addParagraphTextItem() : form.addDateItem();
      item.setTitle(it.title).setHelpText(it.help || '').setRequired(it.required);
    }
    form.setDescription(FORM.description);
    form.setConfirmationMessage(FORM.confirmation);
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
    // Workspace only: lets members with their own Google account in. A plain Gmail account has no such setting.
    try { form.setRequireLogin(false); } catch (e) {}
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    DriveApp.getFileById(form.getId()).moveTo(root);
    p.setProperty('FORM_ID', form.getId());
    formId = form.getId();
  }
  const root = DriveApp.getFolderById(p.getProperty('IMAGES_FOLDER_ID')).getParents().next();
  p.setProperty('TO_APPROVE_FOLDER_ID', findOrCreateFolder_(root, TO_APPROVE_FOLDER).getId());
  p.setProperty('LIBRARY_FOLDER_ID', findOrCreateFolder_(root, LIBRARY_FOLDER).getId());
  p.setProperty('LOOP_FOLDER_ID', findOrCreateFolder_(root, LOOP_FOLDER).getId());
  p.setProperty('FIXED_FOLDER_ID', findOrCreateFolder_(root, FIXED_FOLDER).getId());
  p.setProperty('ARCHIVE_FOLDER_ID', findOrCreateFolder_(root, ARCHIVE_FOLDER).getId());
  const ss = SpreadsheetApp.openById(p.getProperty('SHEET_ID'));
  sheet_().getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  if (!ss.getSheetByName(ALLOWLIST_TAB)) ss.insertSheet(ALLOWLIST_TAB);
  const form = FormApp.openById(formId);
  for (const t of ScriptApp.getProjectTriggers()) {
    if (['onSubmit', 'retryDispatches', 'composeLoop'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('onSubmit').forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger('retryDispatches').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('composeLoop').timeBased().atHour(3).everyDays(1).create();
  Logger.log('Form: ' + form.getPublishedUrl());
  Logger.log('Edit: ' + form.getEditUrl());
}

function findOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function sheet_() {
  return SpreadsheetApp.openById(props_().getProperty('SHEET_ID')).getSheetByName(SHEET_TAB);
}

function rows_() {
  const s = sheet_();
  const n = s.getLastRow() - 1;
  return n < 1 ? [] : s.getRange(2, 1, n, COLUMNS.length).getValues().map(fromRow);
}

function writeRow_(rowNumber, req) {
  sheet_().getRange(rowNumber, 1, 1, COLUMNS.length).setValues([toRow(req)]);
}

function mailTeam_(req, reason) {
  const m = teamMail(req, reason);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
}

function mailTeamDeliver_(req, reason) {
  const m = teamMail(req, reason, 'deliver');
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
}

function onSubmit(e) {
  if (!fromOwner_(e)) return;
  const lock = LockService.getScriptLock();
  let answers = {};
  let email = '';
  let req = null;
  let rowNumber = 0;
  try {
    lock.waitLock(30000);
    answers = readAnswers(e.response.getItemResponses().map((r) => ({
      title: r.getItem().getTitle(), type: String(r.getItem().getType()), response: r.getResponse(),
    })));
    email = e.response.getRespondentEmail();
    const created = e.response.getTimestamp();
    const existing = rows_();
    const id = makeId(Utilities.formatDate(created, 'Europe/Amsterdam', 'yyyyMMdd'), Math.random,
      existing.map((r) => r.id));
    req = {
      id, state: STATE.NEW, round: 1, created, name: answers.name, email, text: answers.text,
      event_date: answers.event_date, show_until: answers.show_until, image: '', attempts: 0, next: '', reason: '',
    };
    const s = sheet_();
    s.appendRow(toRow(req));
    rowNumber = s.getLastRow();

    if (answers.imageFileId) {
      const file = DriveApp.getFileById(answers.imageFileId);
      const ext = imageExtension(file.getMimeType(), file.getName());
      if (!ext) {
        MailApp.sendEmail(email, FILE_TYPE_MAIL.subject, FILE_TYPE_MAIL.body);
        req.state = STATE.REFUSED;
        req.reason = 'bestandstype';
        writeRow_(rowNumber, req);
        return;
      }
      req.image = file.makeCopy(imageName(id, ext), DriveApp.getFolderById(props_().getProperty('IMAGES_FOLDER_ID'))).getId();
      writeRow_(rowNumber, req);
    }

    const reason = guardReason(req.text, earlierFrom(existing, email), created);
    if (reason) {
      req.state = STATE.MANUAL;
      req.reason = reason;
      writeRow_(rowNumber, req);
      mailTeam_(req, reason);
      return;
    }
    tryDispatch_(req, rowNumber);
  } catch (err) {
    // DLV-08: nothing is lost silently.
    const reason = 'fout in het script: ' + String((err && err.message) || err).slice(0, 200);
    if (req && rowNumber) {
      req.state = STATE.MANUAL;
      req.reason = reason;
      try { writeRow_(rowNumber, req); } catch (e2) {}
    }
    mailTeam_(req || {
      id: '(nog geen id)', name: answers.name || '', email: email || '', text: answers.text || '',
      event_date: '', show_until: '',
    }, reason);
  } finally {
    try { lock.releaseLock(); } catch (e3) {}
  }
}

// Writes the row itself. Never logs the token or any request data.
function tryDispatch_(req, rowNumber) {
  let why = '';
  const token = props_().getProperty('GITHUB_TOKEN');
  if (!token) {
    why = 'GITHUB_TOKEN ontbreekt';
  } else {
    try {
      const code = UrlFetchApp.fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        payload: JSON.stringify(buildDispatch(req)),
        muteHttpExceptions: true,
      }).getResponseCode();
      if (!dispatched(code)) why = 'GitHub antwoordde ' + code;
    } catch (err) {
      why = ('GitHub niet bereikt: ' + err.message).slice(0, 200);
    }
  }
  req.attempts += 1;
  if (!why) {
    req.state = STATE.SENT;
    req.since = new Date();
    req.next = '';
    req.reason = '';
    writeRow_(rowNumber, req);
    return;
  }
  const next = nextAttempt(req.attempts, retryFrom(req));
  if (next) {
    req.state = STATE.RETRY;
    req.next = next;
    req.reason = why;
    props_().setProperty('RETRY_PENDING', '1');
    writeRow_(rowNumber, req);
  } else {
    req.state = STATE.MANUAL;
    req.next = '';
    req.reason = `GitHub nam de aanvraag niet aan na ${req.attempts} pogingen (${why})`;
    writeRow_(rowNumber, req);
    mailTeam_(req, req.reason);
  }
}

// Runs every minute: stays cheap until a retry is pending.
function retryDispatches(e) {
  if (!props_().getProperty('RETRY_PENDING') && !props_().getProperty('LOOP_PENDING')) return;
  if (!fromOwner_(e)) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // the next minute tries again
  // No catch: an error here leaves the rows in 'opnieuw' in the Sheet and Google mails the script owner about the
  // failed trigger (a mail per minute to the team would burn the daily mail quota).
  try {
    if (props_().getProperty('LOOP_PENDING')) { // DLV-09: a dated slide arrived
      props_().deleteProperty('LOOP_PENDING');
      composeLoop_();
    }
    if (!props_().getProperty('RETRY_PENDING')) return;
    const now = new Date();
    const rows = rows_();
    rows.forEach((req, i) => {
      if (req.state === STATE.RETRY && req.next <= now) tryDispatch_(req, i + 2);
    });
    if (!rows.some((r) => r.state === STATE.RETRY)) props_().deleteProperty('RETRY_PENDING');
  } finally {
    lock.releaseLock();
  }
}

function rowById_(id) {
  const rows = rows_();
  const i = rows.findIndex((r) => r.id === id);
  return i < 0 ? { row: undefined, rowNumber: 0 } : { row: rows[i], rowNumber: i + 2 };
}

function hmacHex_(msg) {
  return hex(Utilities.computeHmacSha256Signature(msg, props_().getProperty('CALLBACK_SECRET')));
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function page_(text) {
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;font-size:18px;margin:2em">' +
    String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>');
}

// Activities (AGD-03/04/06/09). Never log agenda content.
function activityTab_() {
  const ss = SpreadsheetApp.openById(props_().getProperty('SHEET_ID'));
  let tab = ss.getSheetByName(ACTIVITIES_TAB);
  if (!tab) {
    tab = ss.insertSheet(ACTIVITIES_TAB);
    tab.getRange(1, 1, 1, ACTIVITY_COLUMNS.length).setValues([ACTIVITY_COLUMNS]);
  }
  return tab;
}

function activityRows_() {
  const t = activityTab_();
  const n = t.getLastRow() - 1;
  return n < 1 ? [] : t.getRange(2, 1, n, ACTIVITY_COLUMNS.length).getValues()
    .map((r, i) => ({ a: fromActivityRow(r), rowNumber: i + 2 })).filter((x) => x.a.id);
}

function writeActivity_(rowNumber, a) {
  activityTab_().getRange(rowNumber, 1, 1, ACTIVITY_COLUMNS.length).setValues([toActivityRow(a)]);
}

function agendaOccurrences_() {
  const tab = SpreadsheetApp.openById(props_().getProperty('SHEET_ID')).getSheetByName(AGENDA_TAB);
  const n = tab ? tab.getLastRow() - 1 : 0;
  return n < 1 ? [] : tab.getRange(2, 1, n, AGENDA_COLUMNS.length).getValues().map(fromAgendaRow);
}

function agendaFiles_() {
  const it = DriveApp.getFolderById(props_().getProperty('FIXED_FOLDER_ID')).getFoldersByName(AGENDA_FOLDER);
  const out = [];
  if (!it.hasNext()) return out;
  const files = it.next().getFiles();
  while (files.hasNext()) {
    const f = files.next();
    out.push({ id: f.getId(), name: f.getName(), updated: f.getLastUpdated().toISOString() });
  }
  return out;
}

// AGD-10: the photos in Vast/Agenda/Foto's.
function agendaPhotos_() {
  const ag = DriveApp.getFolderById(props_().getProperty('FIXED_FOLDER_ID')).getFoldersByName(AGENDA_FOLDER);
  if (!ag.hasNext()) return [];
  const sub = ag.next().getFoldersByName(PHOTOS_FOLDER);
  if (!sub.hasNext()) return [];
  const out = [];
  const files = sub.next().getFiles();
  while (files.hasNext()) {
    const f = files.next();
    out.push({ id: f.getId(), name: f.getName(), size: f.getSize(), updated: f.getLastUpdated().toISOString() });
  }
  return out;
}

function mailTeamActivity_(a, reason) {
  const m = activityTeamMail(a, reason);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
}

// Returns '' on success, else the reason. Same call as tryDispatch_.
function dispatchActivity_(a, occ, photo) { return postDispatch_(activityDispatch(a, occ, photo)); }

function postDispatch_(payload) {
  const token = props_().getProperty('GITHUB_TOKEN');
  if (!token) return 'GITHUB_TOKEN ontbreekt';
  try {
    const code = UrlFetchApp.fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }).getResponseCode();
    return dispatched(code) ? '' : 'GitHub antwoordde ' + code;
  } catch (err) {
    return ('GitHub niet bereikt: ' + err.message).slice(0, 200);
  }
}

// Adds new activities to the tab and asks the render job for the first slide of each (AGD-03/04). Never throws.
function activities_() {
  try {
    const tab = activityTab_();
    const add = newActivities(activityRows_().map((x) => x.a), agendaOccurrences_());
    if (add.length) {
      const first = tab.getLastRow() + 1;
      tab.getRange(first, 1, add.length, ACTIVITY_COLUMNS.length).setValues(add.map(toActivityRow));
    }
    const rows = activityRows_();
    const list = activitiesToDispatch({ activities: rows.map((x) => x.a), occurrences: agendaOccurrences_(),
      files: agendaFiles_(), photos: agendaPhotos_(), today: amsterdamDay(new Date()), now: new Date() });
    for (const { activity, occurrence, retry, photo } of list) {
      const rowNumber = rows.find((x) => x.a.id === activity.id).rowNumber;
      const why = dispatchActivity_(activity, occurrence, photo);
      const after = why ? { ...activity, reason: why, since: '' } : { ...activity, reason: '', since: new Date() };
      writeActivity_(rowNumber, after);
      if (why || retry) mailTeamActivity_(after, why || NO_RENDER_REASON);
    }
  } catch (err) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Activiteiten niet bijgewerkt',
        'Het bijwerken van de activiteiten uit de agenda is mislukt.\n\nReden: ' + String((err && err.message) || err).slice(0, 200));
    } catch (x) {}
  }
}

// The render job's answer for an activity: the approval mail goes to the visual team only (AGD-04).
function activityCallback_(e, raw, id) {
  const found = activityRows_().find((x) => x.a.id === id);
  const c = checkCallback({ raw, sig: e.parameter && e.parameter.sig, expected: hmacHex_(raw), row: found && found.a });
  if (c.error) return json_({ ok: false, error: c.error });
  const a = found.a;
  const body = c.body;
  if (!body.ok) {
    const after = afterActivityCallback(a, body, '', '', new Date());
    writeActivity_(found.rowNumber, after);
    mailTeamActivity_(after, after.reason);
    return json_({ ok: true });
  }
  const base = props_().getProperty('WEB_APP_URL');
  if (!base) throw new Error('WEB_APP_URL ontbreekt');
  const blob = Utilities.newBlob(Utilities.base64Decode(body.png_base64), 'image/png', pngName(a.id));
  const file = DriveApp.getFolderById(props_().getProperty('TO_APPROVE_FOLDER_ID')).createFile(blob);
  const token = makeToken(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid()));
  const after = afterActivityCallback(a, body, token, file.getId(), new Date());
  writeActivity_(found.rowNumber, after);
  const m = approvalMail(after, body.slide || {}, approvalLinks(base, a.id, token));
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: m.subject, body: m.body, htmlBody: m.htmlBody,
    inlineImages: { slide: file.getBlob() } });
  return json_({ ok: true });
}

// Dated slides (AGD-05/07/09): tab Datums. Never log agenda content.
function datedTab_() {
  const ss = SpreadsheetApp.openById(props_().getProperty('SHEET_ID'));
  let tab = ss.getSheetByName(DATED_TAB);
  if (!tab) {
    tab = ss.insertSheet(DATED_TAB);
    tab.getRange(1, 1, 1, DATED_COLUMNS.length).setValues([DATED_COLUMNS]);
  }
  return tab;
}

function datedRows_() {
  const t = datedTab_();
  const n = t.getLastRow() - 1;
  return n < 1 ? [] : t.getRange(2, 1, n, DATED_COLUMNS.length).getValues()
    .map((r, i) => ({ d: fromDatedRow(r), rowNumber: i + 2 })).filter((x) => x.d.id);
}

function writeDated_(rowNumber, d) {
  datedTab_().getRange(rowNumber, 1, 1, DATED_COLUMNS.length).setValues([toDatedRow(d)]);
}

// Asks the render job for every new or changed date of an activity in tonen (AGD-05/07), prunes past dates. Never throws.
function datedSlides_() {
  try {
    const tab = datedTab_();
    const rows = datedRows_();
    const today = amsterdamDay(new Date());
    const plan = datedPlan({ activities: activityRows_().map((x) => x.a), occurrences: agendaOccurrences_(),
      files: agendaFiles_(), photos: agendaPhotos_(), dated: rows.map((x) => x.d), today, now: new Date() });
    const bad = [];
    for (const item of plan.dispatch) {
      const found = rows.find((x) => x.d.id === item.id);
      const why = postDispatch_(datedDispatch(item));
      const after = afterDatedDispatch(found && found.d, item, why, new Date());
      if (found && found.d.png && !after.png) { try { DriveApp.getFileById(found.d.png).setTrashed(true); } catch (x) {} }
      if (found) writeDated_(found.rowNumber, after);
      else tab.getRange(tab.getLastRow() + 1, 1, 1, DATED_COLUMNS.length).setValues([toDatedRow(after)]);
      if (why || item.retry) bad.push({ key: item.key, reason: why || NO_RENDER_REASON });
    }
    if (plan.prune.length) {
      for (const x of rows.filter((r) => plan.prune.includes(r.d.id))) {
        if (x.d.png) { try { DriveApp.getFileById(x.d.png).setTrashed(true); } catch (e) {} }
      }
      const keep = datedRows_().filter((x) => !plan.prune.includes(x.d.id));
      const n = tab.getLastRow() - 1;
      if (n > 0) tab.getRange(2, 1, n, DATED_COLUMNS.length).clearContent();
      if (keep.length) tab.getRange(2, 1, keep.length, DATED_COLUMNS.length).setValues(keep.map((x) => toDatedRow(x.d)));
    }
    if (bad.length) {
      const m = datedTeamMail(bad);
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
    }
  } catch (err) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Datums niet bijgewerkt',
        'Het bijwerken van de datum-slides uit de agenda is mislukt.\n\nReden: ' + String((err && err.message) || err).slice(0, 200));
    } catch (x) {}
  }
}

// The render job's answer for a dated slide: stored straight in the library, no approval (AGD-05); a failure is mailed (DLV-08).
function datedCallback_(e, raw, id) {
  const found = datedRows_().find((x) => x.d.id === id);
  const c = checkCallback({ raw, sig: e.parameter && e.parameter.sig, expected: hmacHex_(raw), row: found && found.d });
  if (c.error) return json_({ ok: false, error: c.error });
  const d = found.d;
  const body = c.body;
  let pngId = '';
  if (body.ok) {
    const blob = Utilities.newBlob(Utilities.base64Decode(body.png_base64), 'image/png', pngName(id));
    pngId = DriveApp.getFolderById(props_().getProperty('LIBRARY_FOLDER_ID')).createFile(blob).getId();
  }
  const after = afterDatedCallback(d, body, pngId);
  writeDated_(found.rowNumber, after);
  if (body.ok) props_().setProperty('LOOP_PENDING', '1');
  else {
    const m = datedTeamMail([{ key: d.key, reason: after.reason }]);
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
  }
  return json_({ ok: true });
}

// Builds Loop/ (DLV-09/12/13/16). Copies go into a temp folder first; Loop/ itself stays, since Drive for Desktop and
// ProPresenter watch it. Never throws: a failure mails the team. A failure while copying leaves Loop/ as it was; one while
// moving may leave it partly updated, and the next run completes it (DLV-09).
function composeLoop_() {
  let temp = null;
  let step = '';
  try {
    const p = props_();
    const root = DriveApp.getFolderById(p.getProperty('LOOP_FOLDER_ID')).getParents().next();
    const fixedFolder = DriveApp.getFolderById(p.getProperty('FIXED_FOLDER_ID'));
    const list = (it, f) => { const a = []; while (it.hasNext()) a.push(f(it.next())); return a; };
    const info = (f) => ({ id: f.getId(), name: f.getName(), updated: f.getLastUpdated().toISOString() });
    const rot = fixedFolder.getFoldersByName(ROTATING_FOLDER);
    const loop = DriveApp.getFolderById(p.getProperty('LOOP_FOLDER_ID'));
    const ag = fixedFolder.getFoldersByName(AGENDA_FOLDER);
    const agFiles = ag.hasNext() ? list(ag.next().getFiles(), info) : [];
    const acts = activityRows_().map((x) => x.a);
    const photos = agendaPhotos_();
    const today = amsterdamDay(new Date());
    const occs = agendaOccurrences_();
    const plan = loopPlan({
      fixed: list(fixedFolder.getFiles(), info),
      agenda: agendaLoopFiles({ files: agFiles, activities: acts, occurrences: occs, today }),
      dated: datedLoopItems({ dated: datedRows_().map((x) => x.d), activities: acts, occurrences: occs, files: agFiles, photos, today }),
      rotating: rot.hasNext() ? list(rot.next().getFiles(), info) : [],
      requests: rows_(),
      current: list(loop.getFiles(), (f) => ({ id: f.getId(), key: f.getDescription() || '' })),
      today: amsterdamDay(new Date()),
    });
    for (const old of list(root.getFoldersByName(LOOP_TEMP_FOLDER), (f) => f)) old.setTrashed(true);
    temp = root.createFolder(LOOP_TEMP_FOLDER);
    for (const a of plan.add) DriveApp.getFileById(a.sourceId).makeCopy(a.name, temp).setDescription(a.key);
    step = 'verplaatsen: ';
    for (const f of list(temp.getFiles(), (x) => x)) f.moveTo(loop);
    for (const id of plan.remove) DriveApp.getFileById(id).setTrashed(true);
    temp.setTrashed(true);
    temp = null;
    step = 'archiveren: ';
    const archive = DriveApp.getFolderById(p.getProperty('ARCHIVE_FOLDER_ID'));
    for (const id of plan.archive) {
      const { row, rowNumber } = rowById_(id);
      if (!row) continue;
      DriveApp.getFileById(row.png).moveTo(archive);
      row.state = STATE.ARCHIVED;
      writeRow_(rowNumber, row);
    }
  } catch (err) {
    try { if (temp) temp.setTrashed(true); } catch (e) {}
    try {
      const m = loopFailMail((step + String((err && err.message) || err)).slice(0, 200));
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
    } catch (e) {}
  }
}

// Daily trigger (setup): also expires requests past their last day.
function composeLoop(e) {
  if (!fromOwner_(e)) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    try {
      const m = loopFailMail('geen slot: het script was na 30 s nog met iets anders bezig');
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
    } catch (e) {}
    return;
  }
  try { readAgenda_(); activities_(); datedSlides_(); composeLoop_(); expireStale_(); } finally { lock.releaseLock(); }
}

// Reads the coming week from the church agenda into the Agenda tab (AGD-01/02). A failure keeps the last good read
// in the tab and mails the team once a day (AGD-08). Never throws.
function readAgenda_() {
  const p = props_();
  const today = amsterdamDay(new Date());
  try {
    const id = p.getProperty('AGENDA_CALENDAR_ID');
    if (!id) throw new Error('script property AGENDA_CALENDAR_ID ontbreekt');
    // Not subscribed yet: subscribe this account once; a wrong id throws and is mailed below.
    const cal = CalendarApp.getCalendarById(id) || CalendarApp.subscribeToCalendar(id);
    const w = agendaWindow(today);
    const occ = weekOccurrences(cal.getEvents(w.from, w.to), today);
    const ss = SpreadsheetApp.openById(p.getProperty('SHEET_ID'));
    const tab = ss.getSheetByName(AGENDA_TAB) || ss.insertSheet(AGENDA_TAB);
    const values = [AGENDA_COLUMNS].concat(occ.map(toAgendaRow));
    tab.getRange(1, 1, values.length, AGENDA_COLUMNS.length).setValues(values);
    const extra = tab.getMaxRows() - values.length;
    if (extra > 0) tab.getRange(values.length + 1, 1, extra, AGENDA_COLUMNS.length).clearContent();
    p.setProperty('AGENDA_READ_DAY', today);
    p.deleteProperty('AGENDA_MAIL_DAY');
  } catch (err) {
    try {
      if (agendaMailDue(p.getProperty('AGENDA_MAIL_DAY'), today)) {
        const m = agendaFailMail(String((err && err.message) || err).slice(0, 200), p.getProperty('AGENDA_READ_DAY') || '');
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(), m.subject, m.body);
        p.setProperty('AGENDA_MAIL_DAY', today);
      }
    } catch (e) {}
  }
}

function submitActivityChange_(id, token, text) {
  const found = activityRows_().find((x) => x.a.id === id);
  const a = found && found.a;
  const d = approveDecision(a, token);
  if (d === 'bad-token') return PAGES.badToken;
  if (d === 'already') return PAGES.already;
  if (d === 'not-open') return PAGES.notOpen;
  const after = afterActivityChange(a, text, new Date());
  if (!after) return PAGES.changeEmpty;
  if (after === 'rounds') return PAGES.activityRounds;
  if (a.png) DriveApp.getFileById(a.png).setTrashed(true);
  writeActivity_(found.rowNumber, after);
  const next = activitiesToDispatch({ activities: [{ ...after, since: '' }], occurrences: agendaOccurrences_(),
    files: [], photos: agendaPhotos_(), today: amsterdamDay(new Date()), now: new Date() })[0];
  const why = next ? dispatchActivity_(after, next.occurrence, next.photo) : 'geen komende datum in de agenda';
  if (why) {
    writeActivity_(found.rowNumber, { ...after, reason: why, since: '' });
    mailTeamActivity_(after, why);
  } else {
    writeActivity_(found.rowNumber, { ...after, since: new Date() });
  }
  return PAGES.activityChanged;
}

// Called by the change form via google.script.run (DLV-05). Returns the Dutch message to show.
function submitChange(id, token, text) {
  const lock = LockService.getScriptLock();
  let row;
  try {
    lock.waitLock(30000);
    if (String(id || '').startsWith('A')) return submitActivityChange_(String(id), token, text);
    const found = rowById_(String(id || ''));
    row = found.row;
    const d = approveDecision(row, token);
    if (d === 'bad-token') return PAGES.badToken;
    if (d === 'already') return PAGES.already;
    if (d === 'not-open') return PAGES.notOpen;
    const after = afterChange(row, text, new Date());
    if (!after) return PAGES.changeEmpty;
    if (row.png) DriveApp.getFileById(row.png).setTrashed(true);
    writeRow_(found.rowNumber, after.row);
    if (after.toTeam) {
      mailTeamDeliver_(after.row, after.row.reason);
      return PAGES.changeToTeam;
    }
    tryDispatch_(after.row, found.rowNumber);
    return PAGES.changeSent;
  } catch (err) {
    const reason = 'aanpassen mislukt: ' + String((err && err.message) || err).slice(0, 200);
    try { mailTeamDeliver_(row || { id: String(id || '(onbekend)'), name: '', email: '', text: '', event_date: '', show_until: '' }, reason); } catch (x) {}
    return PAGES.error;
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Expires requests nobody approved in 7 days and hands renders without an answer to the team (DLV-07/08). Never throws.
function expireStale_() {
  try {
    const rows = rows_();
    const plan = stalePlan(rows, new Date());
    const archive = DriveApp.getFolderById(props_().getProperty('ARCHIVE_FOLDER_ID'));
    rows.forEach((row, i) => {
      if (plan.expire.includes(row.id)) {
        if (row.png) DriveApp.getFileById(row.png).moveTo(archive);
        row.state = STATE.EXPIRED;
        writeRow_(i + 2, row);
      } else if (plan.stuck.includes(row.id)) {
        row.state = STATE.MANUAL;
        row.reason = NO_RENDER_REASON;
        row.token = '';
        writeRow_(i + 2, row);
        mailTeamDeliver_(row, row.reason);
      }
    });
  } catch (err) {
    try {
      mailTeamDeliver_({ id: '(nachtrun)', name: '', email: '', text: '', event_date: '', show_until: '' },
        'verlopen/wachtende aanvragen: ' + String((err && err.message) || err).slice(0, 200));
    } catch (x) {}
  }
}

// The render job's callback (DLV-01/02/06). Never logs request data, tokens or secrets.
function doPost(e) {
  const lock = LockService.getScriptLock();
  let req = null;
  let rowNumber = 0;
  let mailed = false;
  try {
    lock.waitLock(120000);
    // DLV-08: a missing setting is mailed, not silently refused.
    if (!props_().getProperty('CALLBACK_SECRET')) throw new Error('CALLBACK_SECRET ontbreekt');
    const raw = (e && e.postData && e.postData.contents) || '';
    let id = '';
    try { id = String(JSON.parse(raw).id); } catch (x) {}
    if (/^A[0-9a-f]{8}-\d{4}-\d{2}-\d{2}$/.test(id)) return datedCallback_(e, raw, id);
    if (id.startsWith('A')) return activityCallback_(e, raw, id);
    const found = rowById_(id);
    const row = found.row;
    const c = checkCallback({ raw, sig: e.parameter && e.parameter.sig,
      expected: hmacHex_(raw), row });
    if (c.error) return json_({ ok: false, error: c.error });
    req = row;
    rowNumber = found.rowNumber;
    const body = c.body;
    if (!body.ok) {
      const after = afterCallback(row, body, '', '');
      writeRow_(rowNumber, after);
      mailTeamDeliver_(after, after.reason);
      return json_({ ok: true });
    }
    const base = props_().getProperty('WEB_APP_URL');
    if (!base) throw new Error('WEB_APP_URL ontbreekt');
    const blob = Utilities.newBlob(Utilities.base64Decode(body.png_base64), 'image/png', pngName(row.id));
    const file = DriveApp.getFolderById(props_().getProperty('TO_APPROVE_FOLDER_ID')).createFile(blob);
    const token = makeToken(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid()));
    const after = afterCallback(row, body, token, file.getId(), new Date());
    writeRow_(rowNumber, after);
    const team = Session.getEffectiveUser().getEmail();
    const al = SpreadsheetApp.openById(props_().getProperty('SHEET_ID')).getSheetByName(ALLOWLIST_TAB);
    const list = al && al.getLastRow() > 0 ? al.getRange(1, 1, al.getLastRow(), 1).getValues() : [];
    const to = recipients(row.email, list, team);
    const m = approvalMail(row, body.slide || {}, approvalLinks(base, row.id, token));
    MailApp.sendEmail({ to: to.approval, subject: m.subject, body: m.body, htmlBody: m.htmlBody,
      inlineImages: { slide: file.getBlob() } });
    mailed = true;
    if (to.received) MailApp.sendEmail(to.received, RECEIVED_MAIL.subject, RECEIVED_MAIL.body);
    return json_({ ok: true });
  } catch (err) {
    const reason = 'fout in het script: ' + String((err && err.message) || err).slice(0, 200);
    if (req && rowNumber && !mailed) { req = afterError(req, reason); try { writeRow_(rowNumber, req); } catch (e2) {} }
    try { mailTeamDeliver_(req || { id: '(onbekend)', name: '', email: '', text: '', event_date: '', show_until: '' }, reason); } catch (x) {}
    return json_({ ok: false });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Image link (DLV-14) and the approval links (DLV-03/04/05).
function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.image) {
    if (!props_().getProperty('CALLBACK_SECRET')) return json_({ error: 'geen toegang' });
    const bad = checkImageRequest({ id: q.image, exp: q.exp, sig: q.sig, nowSec: Math.floor(Date.now() / 1000),
      expected: hmacHex_(imageMessage(q.image, q.exp)) });
    // AGD-11: an id starting with A is an activity, its photo is served (DLV-14).
    const fileId = bad ? '' : q.image.startsWith('A')
      ? (activityPhotoFor(q.image, activityRows_().map((x) => x.a), agendaPhotos_()) || {}).id
      : (rowById_(q.image).row || {}).image;
    if (!fileId) return json_({ error: 'geen afbeelding' });
    const file = DriveApp.getFileById(fileId);
    return ContentService.createTextOutput(imageAnswer(file.getName(), Utilities.base64Encode(file.getBlob().getBytes())))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (!['goedkeuren', 'aanpassen', 'niet-tonen'].includes(q.a)) return page_(PAGES.badToken);
  const lock = LockService.getScriptLock();
  let row;
  try {
    lock.waitLock(30000);
    if (String(q.id || '').startsWith('A')) return activityDecision_(q);
    if (q.a === 'niet-tonen') return page_(PAGES.badToken);
    const found = rowById_(String(q.id || ''));
    row = found.row;
    const rowNumber = found.rowNumber;
    const d = approveDecision(row, q.t);
    if (d === 'bad-token') return page_(PAGES.badToken);
    if (d === 'already') return page_(PAGES.already);
    if (d === 'not-open') return page_(PAGES.notOpen);
    if (q.a === 'aanpassen') {
      return HtmlService.createHtmlOutput(changeForm(row.id, q.t))
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    DriveApp.getFileById(row.png).moveTo(DriveApp.getFolderById(props_().getProperty('LIBRARY_FOLDER_ID')));
    row.state = STATE.APPROVED;
    writeRow_(rowNumber, row);
    composeLoop_();
    return page_(approvedPage(row));
  } catch (err) {
    const reason = 'goedkeuren mislukt: ' + String((err && err.message) || err).slice(0, 200);
    try { mailTeamDeliver_(row || { id: String(q.id || '(onbekend)'), name: '', email: '', text: '', event_date: '', show_until: '' }, reason); } catch (x) {}
    return page_(PAGES.error);
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Approval links of an activity (AGD-04/06): Goedkeuren, Aanpassen, Niet tonen. Called inside doGet's lock and try.
function activityDecision_(q) {
  const found = activityRows_().find((x) => x.a.id === String(q.id));
  const a = found && found.a;
  const d = approveDecision(a, q.t);
  if (d === 'bad-token') return page_(PAGES.badToken);
  if (d === 'already') return page_(PAGES.already);
  if (d === 'not-open') return page_(PAGES.notOpen);
  if (q.a === 'aanpassen') {
    return HtmlService.createHtmlOutput(changeForm(a.id, q.t)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  if (q.a === 'goedkeuren') {
    DriveApp.getFileById(a.png).moveTo(DriveApp.getFolderById(props_().getProperty('LIBRARY_FOLDER_ID')));
    writeActivity_(found.rowNumber, afterActivityApprove(a));
    return page_(PAGES.activityApproved);
  }
  DriveApp.getFileById(a.png).setTrashed(true);
  writeActivity_(found.rowNumber, afterActivityHide(a));
  return page_(PAGES.activityHidden);
}
