// Intake (specs/modules/intake.md): the pure half of the Apps Script project. Run: node --test subprojects/google/tests/
// What needs Google (FormApp, SpreadsheetApp, DriveApp, UrlFetchApp, triggers) is checked by tests/manual/intake.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../src/intake.js');

const MIN = 60 * 1000;
const NOW = new Date('2026-11-18T10:00:00Z');
const REQ = {
  id: 'R20261118-K7Q', round: 1, name: 'Jan de Vries', email: 'jan@example.com',
  text: 'Kerstnachtdienst op 24 december om 22.00 uur in de grote zaal.',
  event_date: '2026-12-24', show_until: '', image: true,
};

// INT-01 --------------------------------------------------------------------------------------------------------------

test('int_01_form_fields_in_order_with_dutch_texts', () => {
  assert.deepEqual(I.FORM.items.map((i) => [i.key, i.type, i.required]), [
    ['name', 'TEXT', true],
    ['text', 'PARAGRAPH_TEXT', true],
    ['event_date', 'DATE', true],
    ['show_until', 'DATE', false],
    ['image', 'FILE_UPLOAD', false],
  ]);
  const byKey = Object.fromEntries(I.FORM.items.map((i) => [i.key, i]));
  assert.equal(byKey.text.title, 'Wat wil je aankondigen? Plak gerust de hele tekst.');
  assert.equal(byKey.show_until.help, 'leeg = tot de datum van het evenement');
  for (const i of I.FORM.items) assert.ok(i.title.trim(), i.key);
});

test('int_01_answers_are_read_by_the_form_titles', () => {
  const t = Object.fromEntries(I.FORM.items.map((i) => [i.key, i.title]));
  const a = I.readAnswers([
    { title: t.name, type: 'TEXT', response: 'Jan de Vries' },
    { title: t.text, type: 'PARAGRAPH_TEXT', response: '  Kerstnachtdienst  ' },
    { title: t.event_date, type: 'DATE', response: '2026-12-24' },
    { title: 'Een plaatje (hernoemd in de Forms-UI)', type: 'FILE_UPLOAD', response: ['file-1', 'file-2'] },
  ]);
  assert.deepEqual(a, {
    name: 'Jan de Vries', text: 'Kerstnachtdienst', event_date: '2026-12-24', show_until: '', imageFileId: 'file-1',
  });
});

test('int_01_no_image_means_no_file', () => {
  const t = Object.fromEntries(I.FORM.items.map((i) => [i.key, i.title]));
  const a = I.readAnswers([
    { title: t.text, type: 'PARAGRAPH_TEXT', response: 'Koffie na de dienst' },
    { title: t.event_date, type: 'DATE', response: '2026-12-01' },
    { title: t.show_until, type: 'DATE', response: '2026-12-02' },
  ]);
  assert.equal(a.imageFileId, '');
  assert.equal(a.show_until, '2026-12-02');
});

// INT-02 --------------------------------------------------------------------------------------------------------------

test('int_02_form_collects_the_verified_address_and_no_typed_one', () => {
  assert.equal(I.FORM.emailCollection, 'VERIFIED');
  for (const i of I.FORM.items) {
    assert.doesNotMatch(i.title, /e-?mail|adres/i, `${i.key} asks for a mail address`);
  }
  assert.equal(I.FORM.items.length, 5, 'the form collects no other data');
});

// INT-03 --------------------------------------------------------------------------------------------------------------

test('int_03_confirmation_message', () => {
  assert.equal(I.FORM.confirmation, 'Je krijgt binnen een paar minuten een voorbeeld per mail.');
});

// INT-04 --------------------------------------------------------------------------------------------------------------

test('int_04_id_is_R_date_and_3_random_characters', () => {
  const id = I.makeId('20261118', Math.random, []);
  assert.match(id, /^R20261118-[A-Z0-9]{3}$/);
  // The render job accepts it (subprojects/renderer/job.py: [A-Za-z0-9-]{1,64}).
  assert.match(id, /^[A-Za-z0-9-]{1,64}$/);
});

test('int_04_id_is_random_and_never_one_already_taken', () => {
  const seq = [0, 0, 0, 0, 0, 0, 0.99, 0.5, 0.01];
  let n = 0;
  const rand = () => seq[n++];
  const id = I.makeId('20261118', rand, ['R20261118-AAA']);
  assert.notEqual(id, 'R20261118-AAA');
  assert.match(id, /^R20261118-[A-Z0-9]{3}$/);
  const ids = new Set(Array.from({ length: 50 }, () => I.makeId('20261118', Math.random, [])));
  assert.ok(ids.size > 40, 'ids are random');
});

// What Sheets does with a written row: a leading apostrophe marks literal text and is not read back.
const sheets = (row) => row.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v));

test('int_04_new_row_has_state_nieuw', () => {
  const row = I.toRow({ ...REQ, created: NOW });
  assert.equal(row.length, I.COLUMNS.length);
  const got = I.fromRow(sheets(row));
  assert.equal(got.state, 'nieuw');
  assert.equal(I.STATE.NEW, 'nieuw');
  assert.equal(got.id, REQ.id);
  assert.equal(got.email, REQ.email);
  assert.equal(got.text, REQ.text);
  assert.equal(got.round, 1);
  assert.equal(got.attempts, 0);
  assert.equal(got.created.getTime(), NOW.getTime());
});

test('int_04_sheet_keeps_form_answers_as_text', () => {
  // A text that starts with "=" must not become a formula; a date must not become a Sheets date.
  const req = { ...REQ, created: NOW, name: '=IMPORTXML("http://x","//a")', text: "'s Avonds koffie", event_date: '2026-12-24' };
  const row = I.toRow(req);
  for (const v of row) if (typeof v === 'string' && v) assert.ok(v.startsWith("'"), v);
  const got = I.fromRow(sheets(row));
  assert.equal(got.name, req.name);
  assert.equal(got.text, "'s Avonds koffie");
  assert.equal(got.event_date, '2026-12-24');
  assert.deepEqual(I.buildDispatch(got).client_payload.event_date, '2026-12-24');
});

test('int_05_retry_state_survives_the_sheet', () => {
  const next = new Date(NOW.getTime() + 2 * MIN);
  const req = { ...REQ, created: NOW, state: 'opnieuw', attempts: 1, next, reason: 'GitHub antwoordde 502' };
  const got = I.fromRow(sheets(I.toRow(req)));
  assert.equal(got.state, 'opnieuw');
  assert.equal(got.attempts, 1);
  assert.equal(got.next.getTime(), next.getTime());
  assert.equal(got.reason, 'GitHub antwoordde 502');
});

test('int_04_dispatch_carries_only_the_interface_fields', () => {
  const body = I.buildDispatch(REQ);
  assert.equal(body.event_type, 'slide-request');
  assert.deepEqual(Object.keys(body).sort(), ['client_payload', 'event_type']);
  assert.deepEqual(body.client_payload, {
    id: 'R20261118-K7Q', round: 1, text: REQ.text, change: '', event_date: '2026-12-24', show_until: '', image: true,
  });
});

test('int_04_no_name_or_mail_address_leaves_google', () => {
  const s = JSON.stringify(I.buildDispatch(REQ));
  assert.ok(!s.includes(REQ.name) && !s.includes(REQ.email), s);
});

test('int_04_dispatch_matches_interface_md', () => {
  const md = fs.readFileSync(path.join(__dirname, '../../renderer/INTERFACE.md'), 'utf8');
  const example = JSON.parse(md.match(/```json\n([\s\S]*?)```/)[1]);
  const body = I.buildDispatch(REQ);
  assert.equal(body.event_type, example.event_type);
  assert.deepEqual(Object.keys(body.client_payload).sort(), Object.keys(example.client_payload).sort());
  for (const [k, v] of Object.entries(example.client_payload)) {
    assert.equal(typeof body.client_payload[k], typeof v, k);
  }
});

test('int_04_image_flag_is_a_boolean', () => {
  assert.equal(I.buildDispatch({ ...REQ, image: '' }).client_payload.image, false);
  assert.equal(I.buildDispatch({ ...REQ, image: 'Beelden/R20261118-K7Q.jpg' }).client_payload.image, true);
});

// INT-05 --------------------------------------------------------------------------------------------------------------

test('int_05_three_retries_within_10_minutes_then_none', () => {
  const first = NOW;
  const due = [1, 2, 3].map((n) => I.nextAttempt(n, first));
  for (const d of due) assert.ok(d instanceof Date);
  assert.ok(due[0] > first && due[0] < due[1] && due[1] < due[2]);
  assert.ok(due[2] - first <= 10 * MIN, 'the last retry is at most 10 minutes after the submit');
  assert.equal(I.nextAttempt(4, first), null, 'after 1 attempt and 3 retries: the visual team');
});

test('int_05_only_a_2xx_answer_is_a_dispatch', () => {
  assert.equal(I.dispatched(204), true);
  assert.equal(I.dispatched(200), true);
  for (const code of [301, 401, 403, 404, 422, 500, 502]) assert.equal(I.dispatched(code), false, code);
});

test('int_05_states_shown_in_the_sheet', () => {
  assert.deepEqual(I.STATE, {
    NEW: 'nieuw', SENT: 'verzonden', RETRY: 'opnieuw', MANUAL: 'handwerk', REFUSED: 'geweigerd',
    TO_APPROVE: 'te keuren', APPROVED: 'goedgekeurd', ARCHIVED: 'gearchiveerd',
  });
});

// INT-06 --------------------------------------------------------------------------------------------------------------

test('int_06_text_over_5000_characters_goes_to_the_visual_team', () => {
  assert.equal(I.guardReason('a'.repeat(5000), [], NOW), '');
  assert.notEqual(I.guardReason('a'.repeat(5001), [], NOW), '');
});

test('int_06_characters_are_counted_as_the_render_job_counts_them', () => {
  // job.py counts code points (Python len); an emoji is one character, not two.
  assert.equal(I.guardReason('🎄'.repeat(5000), [], NOW), '');
});

test('int_06_more_than_5_in_an_hour_from_one_address_goes_to_the_visual_team', () => {
  const four = [5, 15, 25, 35].map((m) => new Date(NOW - m * MIN));
  const five = [...four, new Date(NOW - 59 * MIN)];
  assert.equal(I.guardReason('tekst', four, NOW), '', 'the 5th in an hour is dispatched');
  assert.notEqual(I.guardReason('tekst', five, NOW), '', 'the 6th in an hour is not');
  const old = [...four, new Date(NOW - 61 * MIN)];
  assert.equal(I.guardReason('tekst', old, NOW), '', 'older than an hour does not count');
});

test('int_06_earlier_submits_are_matched_by_address_ignoring_case', () => {
  const rows = [
    { email: 'Jan@Example.com', created: new Date(NOW - 10 * MIN) },
    { email: 'piet@example.com', created: new Date(NOW - 10 * MIN) },
    { email: 'jan@example.com', created: new Date(NOW - 2 * 60 * MIN) },
  ];
  assert.deepEqual(I.earlierFrom(rows, 'jan@example.com'), [rows[0].created, rows[2].created]);
});

test('int_06_visual_team_mail_has_id_text_and_reason_in_dutch', () => {
  const m = I.teamMail(REQ, 'tekst langer dan 5000 tekens');
  assert.ok(m.subject.includes(REQ.id));
  for (const s of [REQ.text, 'tekst langer dan 5000 tekens', REQ.name, REQ.email, REQ.event_date]) {
    assert.ok(m.body.includes(s), s);
  }
});

// INT-08 --------------------------------------------------------------------------------------------------------------

test('int_08_jpg_png_webp_heic_are_accepted', () => {
  assert.equal(I.imageExtension('image/jpeg', 'IMG_1.JPG'), 'jpg');
  assert.equal(I.imageExtension('image/jpeg', 'foto.jpeg'), 'jpg');
  assert.equal(I.imageExtension('image/png', 'a.png'), 'png');
  assert.equal(I.imageExtension('image/webp', 'a.webp'), 'webp');
  assert.equal(I.imageExtension('image/heic', 'IMG_0042.HEIC'), 'heic');
  assert.equal(I.imageExtension('image/heif', 'IMG_0042.heif'), 'heic');
  // Drive does not always know HEIC's type: the name decides then.
  assert.equal(I.imageExtension('application/octet-stream', 'IMG_0042.HEIC'), 'heic');
});

test('int_08_other_types_are_refused', () => {
  for (const [mime, name] of [
    ['application/pdf', 'flyer.pdf'], ['image/gif', 'a.gif'], ['image/svg+xml', 'logo.svg'],
    ['image/tiff', 'scan.tif'], ['application/octet-stream', 'flyer'], ['application/pdf', 'flyer.jpg.pdf'],
  ]) {
    assert.equal(I.imageExtension(mime, name), null, name);
  }
});

test('int_08_image_is_copied_as_its_id', () => {
  assert.equal(I.imageName('R20261118-K7Q', 'heic'), 'R20261118-K7Q.heic');
});

test('int_08_refusal_mail_to_the_requester', () => {
  assert.ok(I.FILE_TYPE_MAIL.subject.trim());
  assert.ok(I.FILE_TYPE_MAIL.body.includes(
    'Dit bestandstype kunnen we niet gebruiken, stuur een foto (JPG of PNG).'));
});
