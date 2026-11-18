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
