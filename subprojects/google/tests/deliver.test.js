// Deliver (specs/modules/deliver.md): the pure half of the callback, the approval mail and pages, and the image link.
// Run: node --test subprojects/google/tests/*.test.js. What needs Google (Drive, MailApp, the web app) is checked by
// tests/manual/approve.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../src/intake.js');
const D = require('../src/deliver.js');

const SECRET = 'test-secret-not-real';
const TEAM = 'owner@example.com';
const ROW = {
  id: 'R20261118-K7Q', state: I.STATE.SENT, round: 1, created: new Date('2026-11-18T10:00:00Z'), name: 'Jan de Vries',
  email: 'Jan@Example.com', text: 'Kerstnachtdienst', event_date: '2026-12-24', show_until: '', image: '',
  attempts: 1, next: '', reason: '', token: '', png: '',
};
const SLIDE = { title: 'Kerstnachtdienst', when: '24 december, 22.00 uur', where: 'Grote zaal',
  line: 'Iedereen welkom', show_until: '2026-12-24' };

// Apps Script's Utilities.computeHmacSha256Signature returns signed bytes (-128..127).
const signedBytes = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const hmacHex = (msg) => crypto.createHmac('sha256', SECRET).update(msg).digest('hex');
const appsHmac = (msg) => signedBytes(crypto.createHmac('sha256', SECRET).update(msg).digest());

// DLV-01 --------------------------------------------------------------------------------------------------------------

test('dlv_01_hex_of_apps_script_signed_bytes_matches_the_render_jobs_hmac', () => {
  const body = JSON.stringify({ id: ROW.id, round: 1, ok: true });
  assert.equal(D.hex(appsHmac(body)), hmacHex(body));
  assert.equal(D.hex([0, 15, -1, -128, 127]), '000fff807f');
});

test('dlv_01_same_hex_is_exact_and_refuses_non_strings', () => {
  const h = hmacHex('x');
  assert.equal(D.sameHex(h, h), true);
  assert.equal(D.sameHex(h.toUpperCase(), h), false);
  assert.equal(D.sameHex(h.slice(0, -1) + (h.endsWith('0') ? '1' : '0'), h), false);
  assert.equal(D.sameHex(h.slice(0, 10), h), false);
  for (const bad of [undefined, null, '', 42]) assert.equal(D.sameHex(bad, h), false);
});

function check(over = {}) {
  const body = { id: ROW.id, round: 1, ok: true, slide: SLIDE, png_base64: 'iVBORw0K' };
  const raw = JSON.stringify(body);
  return D.checkCallback({ raw, sig: hmacHex(raw), expected: hmacHex(raw), row: { ...ROW }, ...over });
}

test('dlv_01_a_signed_callback_for_a_waiting_request_is_accepted', () => {
  const r = check();
  assert.equal(r.error, '');
  assert.equal(r.body.id, ROW.id);
  assert.equal(check({ row: { ...ROW, state: I.STATE.RETRY } }).error, '');
});

test('dlv_01_missing_or_wrong_signature_is_refused', () => {
  assert.notEqual(check({ sig: undefined }).error, '');
  assert.notEqual(check({ sig: '' }).error, '');
  assert.notEqual(check({ sig: hmacHex('another body') }).error, '');
});

test('dlv_01_unknown_id_or_a_request_not_waiting_is_refused', () => {
  assert.notEqual(check({ row: undefined }).error, '');
  for (const state of [I.STATE.TO_APPROVE, I.STATE.APPROVED, I.STATE.MANUAL, I.STATE.REFUSED, I.STATE.NEW]) {
    assert.notEqual(check({ row: { ...ROW, state } }).error, '', state);
  }
  assert.notEqual(check({ row: { ...ROW, round: 2 } }).error, '', 'a callback of another round');
});

test('dlv_01_a_body_that_is_not_json_is_refused', () => {
  const raw = '{not json';
  assert.notEqual(D.checkCallback({ raw, sig: hmacHex(raw), expected: hmacHex(raw), row: { ...ROW } }).error, '');
});

test('dlv_01_refusal_reasons_hold_no_request_data', () => {
  const r = check({ sig: 'bad', row: { ...ROW, text: 'Geheime tekst' } });
  assert.doesNotMatch(r.error, /Geheime|Jan|example/);
});

// DLV-02 --------------------------------------------------------------------------------------------------------------

test('dlv_02_states_and_folders', () => {
  assert.equal(I.STATE.TO_APPROVE, 'te keuren');
  assert.equal(I.STATE.APPROVED, 'goedgekeurd');
  assert.equal(D.TO_APPROVE_FOLDER, 'Te keuren');
  assert.equal(D.LIBRARY_FOLDER, 'Bibliotheek');
  assert.equal(D.pngName(ROW.id), 'R20261118-K7Q.png');
});

test('dlv_02_an_ok_callback_sets_te_keuren_with_token_and_png', () => {
  const after = D.afterCallback({ ...ROW }, { ok: true }, 'a'.repeat(32), 'png-file-id');
  assert.equal(after.state, 'te keuren');
  assert.equal(after.token, 'a'.repeat(32));
  assert.equal(after.png, 'png-file-id');
  assert.equal(after.reason, '');
});

test('dlv_02_token_and_png_survive_the_sheet', () => {
  const row = I.toRow({ ...ROW, token: 'b'.repeat(32), png: 'file-9' });
  assert.equal(row.length, I.COLUMNS.length);
  assert.deepEqual(I.COLUMNS.slice(-2), ['token', 'png']);
  const got = I.fromRow(row.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)));
  assert.equal(got.token, 'b'.repeat(32));
  assert.equal(got.png, 'file-9');
});

// DLV-08: a failure callback is not lost (VS2-03 owns the rest of DLV-08).
test('dlv_08_a_failure_callback_sets_handwerk_with_its_reason', () => {
  const after = D.afterCallback({ ...ROW }, { ok: false, reason: 'does not fit' }, '', '');
  assert.equal(after.state, I.STATE.MANUAL);
  assert.match(after.reason, /does not fit/);
  assert.equal(after.token, '');
});

// DLV-03 --------------------------------------------------------------------------------------------------------------

test('dlv_03_token_is_128_bits_of_hex', () => {
  const bytes = signedBytes(crypto.randomBytes(32));
  const t = D.makeToken(bytes);
  assert.match(t, /^[0-9a-f]{32}$/);
  assert.equal(t, D.hex(bytes.slice(0, 16)));
  assert.throws(() => D.makeToken(bytes.slice(0, 15)));
});

test('dlv_03_links_carry_id_and_token', () => {
  const l = D.approvalLinks('https://script.google.com/macros/s/X/exec', ROW.id, 'c'.repeat(32));
  for (const [k, a] of [['approve', 'goedkeuren'], ['change', 'aanpassen']]) {
    const u = new URL(l[k]);
    assert.equal(u.origin + u.pathname, 'https://script.google.com/macros/s/X/exec');
    assert.equal(u.searchParams.get('a'), a);
    assert.equal(u.searchParams.get('id'), ROW.id);
    assert.equal(u.searchParams.get('t'), 'c'.repeat(32));
  }
});

test('dlv_03_approval_mail_has_the_slide_inline_its_text_and_two_buttons', () => {
  const links = D.approvalLinks('https://x.example/exec', ROW.id, 'c'.repeat(32));
  const m = D.approvalMail(ROW, SLIDE, links);
  assert.ok(m.subject.trim());
  assert.match(m.htmlBody, /<img[^>]+src="cid:slide"/);
  for (const v of Object.values(SLIDE).slice(0, 4)) assert.ok(m.htmlBody.includes(v), v);
  assert.ok(m.htmlBody.includes(`href="${links.approve.replace(/&/g, '&amp;')}"`));
  assert.ok(m.htmlBody.includes(`href="${links.change.replace(/&/g, '&amp;')}"`));
  assert.match(m.htmlBody, />\s*Goedkeuren\s*</);
  assert.match(m.htmlBody, />\s*Aanpassen\s*</);
  assert.ok(m.body.includes(links.approve) && m.body.includes(links.change), 'plain-text fallback has the links');
});

test('dlv_03_slide_text_is_escaped_in_the_mail', () => {
  const links = D.approvalLinks('https://x.example/exec', ROW.id, 'c'.repeat(32));
  const m = D.approvalMail(ROW, { ...SLIDE, title: '<b>Feest</b> & "meer"' }, links);
  assert.ok(m.htmlBody.includes('&lt;b&gt;Feest&lt;/b&gt; &amp; &quot;meer&quot;'));
  assert.ok(!m.htmlBody.includes('<b>Feest'));
});

test('dlv_03_wrong_token_does_nothing_and_says_so', () => {
  const row = { ...ROW, state: I.STATE.TO_APPROVE, token: 'd'.repeat(32) };
  assert.equal(D.approveDecision(row, 'd'.repeat(31) + 'e'), 'bad-token');
  assert.equal(D.approveDecision(row, ''), 'bad-token');
  assert.equal(D.approveDecision(row, undefined), 'bad-token');
  assert.equal(D.approveDecision(undefined, 'd'.repeat(32)), 'bad-token');
  assert.equal(D.approveDecision({ ...row, token: '' }, ''), 'bad-token', 'an empty token never matches');
  assert.ok(D.PAGES.badToken.trim());
});

// DLV-04 --------------------------------------------------------------------------------------------------------------

test('dlv_04_approve_then_already_approved', () => {
  const row = { ...ROW, state: I.STATE.TO_APPROVE, token: 'd'.repeat(32) };
  assert.equal(D.approveDecision(row, 'd'.repeat(32)), 'approve');
  assert.equal(D.approveDecision({ ...row, state: I.STATE.APPROVED }, 'd'.repeat(32)), 'already');
  assert.equal(D.approveDecision({ ...row, state: I.STATE.MANUAL }, 'd'.repeat(32)), 'not-open');
  assert.match(D.PAGES.already, /al goedgekeurd/);
});

test('dlv_04_approved_page_names_the_last_day_in_dutch', () => {
  assert.equal(D.approvedPage({ ...ROW, show_until: '2027-01-06' }), 'Je slide staat in de loop tot 6 januari 2027.');
  assert.equal(D.approvedPage({ ...ROW, show_until: '' }), 'Je slide staat in de loop tot 24 december 2026.');
});

test('dlv_04_approve_calls_the_loop_composition_hook', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  assert.match(main, /function composeLoop_\(/, 'the VS2-04 hook exists');
  assert.match(main, /composeLoop_\(\)/, 'and is called');
  assert.match(main, /function doPost\(e\)/);
  assert.match(main, /function doGet\(e\)/);
});

// DLV-06 --------------------------------------------------------------------------------------------------------------

test('dlv_06_allowlisted_requester_gets_the_approval_mail', () => {
  const r = D.recipients('Jan@Example.com', [[' jan@example.com '], ['piet@example.com'], ['']], TEAM);
  assert.deepEqual(r, { approval: 'Jan@Example.com', received: '' });
});

test('dlv_06_others_go_to_the_team_and_get_the_received_mail', () => {
  assert.deepEqual(D.recipients('kees@example.com', [['jan@example.com']], TEAM),
    { approval: TEAM, received: 'kees@example.com' });
  assert.deepEqual(D.recipients('kees@example.com', [], TEAM), { approval: TEAM, received: 'kees@example.com' });
  assert.equal(D.RECEIVED_MAIL.body.trim().split('\n')[0], 'Je aanvraag is ontvangen en wordt bekeken.');
  assert.equal(D.ALLOWLIST_TAB, 'Toegestaan');
});

test('dlv_06_an_empty_address_never_matches_an_empty_allowlist_row', () => {
  assert.deepEqual(D.recipients('', [[''], ['']], TEAM), { approval: TEAM, received: '' });
});

// DLV-05 placeholder (VS2-03) -----------------------------------------------------------------------------------------

test('dlv_05_aanpassen_has_a_placeholder_page_until_vs2_03', () => {
  assert.ok(D.PAGES.changeLater.trim());
});

// DLV-14 --------------------------------------------------------------------------------------------------------------

const NOW = 1_800_000_000;
function img(over = {}) {
  const id = ROW.id;
  const exp = String(NOW + 900);
  const msg = D.imageMessage(id, exp);
  return D.checkImageRequest({ id, exp, sig: hmacHex(msg), expected: hmacHex(msg), nowSec: NOW, ...over });
}

test('dlv_14_signs_id_dot_exp', () => {
  assert.equal(D.imageMessage('R1', '123'), 'R1.123');
});

test('dlv_14_a_valid_signature_within_15_minutes_is_served', () => {
  assert.equal(img(), '');
  assert.equal(img({ exp: String(NOW + 1) }), '');
});

test('dlv_14_wrong_expired_or_too_far_signature_gives_nothing', () => {
  assert.notEqual(img({ sig: hmacHex('other') }), '');
  assert.notEqual(img({ sig: undefined }), '');
  assert.notEqual(img({ nowSec: NOW + 901 }), '', 'expired');
  assert.notEqual(img({ exp: String(NOW + 901) }), '', 'more than 15 minutes ahead');
  assert.notEqual(img({ exp: '12abc' }), '');
  assert.notEqual(img({ exp: '' }), '');
});

test('dlv_14_image_answer_names_the_extension', () => {
  assert.deepEqual(JSON.parse(D.imageAnswer('R1.heic', 'AAAA')), { ext: 'heic', base64: 'AAAA' });
  assert.deepEqual(Object.keys(JSON.parse(D.imageAnswer('R1.pdf', 'AAAA'))), ['error']);
});

// DLV-08: an accepted callback that then throws ends as handwerk, not stuck in verzonden (review of #12).
test('dlv_08_an_accepted_callback_that_throws_sets_handwerk', () => {
  const after = D.afterError({ ...ROW, token: 'e'.repeat(32) }, 'fout in het script: WEB_APP_URL ontbreekt');
  assert.equal(after.state, I.STATE.MANUAL);
  assert.equal(after.reason, 'fout in het script: WEB_APP_URL ontbreekt');
  assert.equal(after.token, '', 'no approval link works for it');
});

// Review of #12, round 2. main.js is Google glue: these read its source, the behaviour is in tests/manual/approve.md.
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const fnBody = (name) => {
  const start = MAIN.indexOf(`function ${name}(`);
  const next = MAIN.indexOf('\nfunction ', start + 1);
  return MAIN.slice(start, next < 0 ? undefined : next);
};

test('dlv_08_a_failed_goedkeuren_mails_the_team', () => {
  const get = fnBody('doGet');
  const c = get.slice(get.lastIndexOf('catch (err)'));
  assert.match(c, /mailTeam_\(/, 'the catch of doGet mails the team');
});

test('dlv_01_a_post_without_body_is_refused_before_anything_can_throw', () => {
  assert.match(fnBody('doPost'), /e && e\.postData && e\.postData\.contents\) \|\| ''/);
});
