// Thin Google layer: all logic lives in intake.js. Only function declarations at top level.

function props_() { return PropertiesService.getScriptProperties(); }

function setup() {
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
  const ss = SpreadsheetApp.openById(p.getProperty('SHEET_ID'));
  sheet_().getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  if (!ss.getSheetByName(ALLOWLIST_TAB)) ss.insertSheet(ALLOWLIST_TAB);
  const form = FormApp.openById(formId);
  for (const t of ScriptApp.getProjectTriggers()) {
    if (['onSubmit', 'retryDispatches'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('onSubmit').forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger('retryDispatches').timeBased().everyMinutes(1).create();
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

function onSubmit(e) {
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
    req.next = '';
    req.reason = '';
    writeRow_(rowNumber, req);
    return;
  }
  const next = nextAttempt(req.attempts, req.created);
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
function retryDispatches() {
  if (!props_().getProperty('RETRY_PENDING')) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // the next minute tries again
  // No catch: an error here leaves the rows in 'opnieuw' in the Sheet and Google mails the script owner about the
  // failed trigger (a mail per minute to the team would burn the daily mail quota).
  try {
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

// No-op hook: VS2-04 (DLV-09) composes Loop/ here.
function composeLoop_() {}

// The render job's callback (DLV-01/02/06). Never logs request data, tokens or secrets.
function doPost(e) {
  const lock = LockService.getScriptLock();
  let req = null;
  let rowNumber = 0;
  let mailed = false;
  try {
    lock.waitLock(30000);
    // DLV-08: a missing setting is mailed, not silently refused.
    if (!props_().getProperty('CALLBACK_SECRET')) throw new Error('CALLBACK_SECRET ontbreekt');
    const raw = (e && e.postData && e.postData.contents) || '';
    let id = '';
    try { id = String(JSON.parse(raw).id); } catch (x) {}
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
      mailTeam_(after, after.reason);
      return json_({ ok: true });
    }
    const base = props_().getProperty('WEB_APP_URL');
    if (!base) throw new Error('WEB_APP_URL ontbreekt');
    const blob = Utilities.newBlob(Utilities.base64Decode(body.png_base64), 'image/png', pngName(row.id));
    const file = DriveApp.getFolderById(props_().getProperty('TO_APPROVE_FOLDER_ID')).createFile(blob);
    const token = makeToken(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid()));
    const after = afterCallback(row, body, token, file.getId());
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
    try { mailTeam_(req || { id: '(onbekend)', name: '', email: '', text: '', event_date: '', show_until: '' }, reason); } catch (x) {}
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
    const { row } = bad ? {} : rowById_(q.image);
    if (bad || !row || !row.image) return json_({ error: 'geen afbeelding' });
    const file = DriveApp.getFileById(row.image);
    return ContentService.createTextOutput(imageAnswer(file.getName(), Utilities.base64Encode(file.getBlob().getBytes())))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (q.a !== 'goedkeuren' && q.a !== 'aanpassen') return page_(PAGES.badToken);
  const lock = LockService.getScriptLock();
  let row;
  try {
    lock.waitLock(30000);
    const found = rowById_(String(q.id || ''));
    row = found.row;
    const rowNumber = found.rowNumber;
    const d = approveDecision(row, q.t);
    if (d === 'bad-token') return page_(PAGES.badToken);
    if (q.a === 'aanpassen') return page_(PAGES.changeLater);
    if (d === 'already') return page_(PAGES.already);
    if (d === 'not-open') return page_(PAGES.notOpen);
    DriveApp.getFileById(row.png).moveTo(DriveApp.getFolderById(props_().getProperty('LIBRARY_FOLDER_ID')));
    row.state = STATE.APPROVED;
    writeRow_(rowNumber, row);
    composeLoop_();
    return page_(approvedPage(row));
  } catch (err) {
    const reason = 'goedkeuren mislukt: ' + String((err && err.message) || err).slice(0, 200);
    try { mailTeam_(row || { id: String(q.id || '(onbekend)'), name: '', email: '', text: '', event_date: '', show_until: '' }, reason); } catch (x) {}
    return page_(PAGES.error);
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
