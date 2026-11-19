// VS2-03 (specs/modules/deliver.md): the Aanpassen round trip (DLV-05), the 7-day expiry (DLV-07) and the render
// watchdog plus the team mail with every change text (DLV-08). Google glue is checked by tests/manual/approve.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../src/intake.js');
const D = require('../src/deliver.js');

const NOW = new Date('2026-11-18T12:00:00Z');
const H = 3600 * 1000;
const ROW = {
  id: 'R20261118-K7Q', state: I.STATE.TO_APPROVE, round: 1, created: new Date('2026-11-18T10:00:00Z'),
  name: 'Jan de Vries', email: 'jan@example.com', text: 'Kerstnachtdienst', event_date: '2026-12-24',
  show_until: '', image: '', attempts: 1, next: '', reason: '', token: 'a'.repeat(32), png: 'file-1', change: '',
  since: new Date('2026-11-18T11:00:00Z'),
};
const unlit = (row) => row.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v));

// DLV-05 --------------------------------------------------------------------------------------------------------------

test('dlv_05_sheet_keeps_aanpassing_and_sinds', () => {
  assert.deepEqual(I.COLUMNS.slice(-2), ['aanpassing', 'sinds']);
  const row = I.toRow({ ...ROW, change: 'Andere tijd\n\nGroter', since: NOW });
  assert.equal(row.length, I.COLUMNS.length);
  const got = I.fromRow(unlit(row));
  assert.equal(got.change, 'Andere tijd\n\nGroter');
  assert.equal(got.since.getTime(), NOW.getTime());
  const empty = I.fromRow(unlit(I.toRow({ ...ROW, change: undefined, since: undefined })));
  assert.equal(empty.change, '');
  assert.equal(empty.since, '');
});

test('dlv_05_change_raises_the_round_and_keeps_every_text_oldest_first', () => {
  const r2 = D.afterChange(ROW, '  Andere tijd  ', NOW);
  assert.equal(r2.toTeam, false);
  assert.equal(r2.row.round, 2);
  assert.equal(r2.row.change, 'Andere tijd');
  assert.equal(r2.row.state, I.STATE.SENT);
  const r3 = D.afterChange({ ...r2.row, state: I.STATE.TO_APPROVE }, 'Groter', NOW);
  assert.equal(r3.row.round, 3);
  assert.equal(r3.row.change, 'Andere tijd\n\nGroter');
  assert.equal(I.buildDispatch(r3.row).client_payload.change, 'Andere tijd\n\nGroter');
  assert.equal(I.buildDispatch(r3.row).client_payload.round, 3);
});

test('dlv_05_change_kills_the_old_links_and_starts_a_fresh_dispatch', () => {
  const { row } = D.afterChange(ROW, 'Andere tijd', NOW);
  assert.equal(row.token, '', 'old links show "klopt niet (meer)"');
  assert.equal(row.png, '');
  assert.equal(row.attempts, 0);
  assert.equal(row.reason, '');
  assert.equal(row.since.getTime(), NOW.getTime());
  assert.equal(D.approveDecision(row, ROW.token), 'bad-token');
  assert.equal(ROW.round, 1, 'the input row is not changed');
});

test('dlv_05_an_empty_text_box_sends_nothing', () => {
  assert.equal(D.afterChange(ROW, '', NOW), null);
  assert.equal(D.afterChange(ROW, '  \n ', NOW), null);
  assert.equal(D.afterChange(ROW, undefined, NOW), null);
});

test('dlv_05_round_3_change_goes_to_the_team_not_a_fourth_render', () => {
  const r = D.afterChange({ ...ROW, round: 3, change: 'Andere tijd\n\nGroter' }, 'Nog kleiner', NOW);
  assert.equal(r.toTeam, true);
  assert.equal(r.row.round, 3);
  assert.equal(r.row.state, I.STATE.MANUAL);
  assert.equal(r.row.reason, '3 rondes aangepast');
  assert.equal(r.row.change, 'Andere tijd\n\nGroter\n\nNog kleiner');
  assert.equal(r.row.token, '');
});

test('dlv_05_change_text_is_capped', () => {
  const { row } = D.afterChange(ROW, 'x'.repeat(5000), NOW);
  assert.equal(row.change.length, D.MAX_CHANGE);
  assert.ok(3 * D.MAX_CHANGE + 4 <= 5000, 'three rounds fit the render job\'s 5000-character change');
});

test('dlv_05_change_form_has_the_text_box_and_escapes_its_values', () => {
  const html = D.changeForm('R1</script><b>', 'c'.repeat(32));
  assert.match(html, /Wat moet er anders\?/);
  assert.match(html, /<textarea[^>]*maxlength="1500"/);
  assert.match(html, /Versturen/);
  assert.match(html, /google\.script\.run/);
  assert.match(html, /submitChange/);
  assert.ok(!html.includes('R1</script>'), 'the id cannot close the script');
  assert.ok(html.includes('c'.repeat(32)));
});

test('dlv_05_pages_say_what_happens', () => {
  assert.equal(D.PAGES.changeSent,
    'Je aanpassing is verstuurd. Je krijgt binnen een paar minuten een nieuw voorbeeld per mail.');
  assert.equal(D.PAGES.changeToTeam, 'Het kerkteam maakt je slide verder af en neemt contact met je op.');
  assert.ok(D.PAGES.changeEmpty.trim());
  assert.equal(D.PAGES.changeLater, undefined, 'the placeholder is gone');
});

// DLV-07 --------------------------------------------------------------------------------------------------------------

const t = (ms) => new Date(NOW.getTime() - ms);
const R = (over) => ({ ...ROW, ...over });

test('dlv_07_te_keuren_for_7_days_expires', () => {
  assert.equal(I.STATE.EXPIRED, 'verlopen');
  const p = D.stalePlan([
    R({ id: 'A', since: t(7 * 24 * H) }),
    R({ id: 'B', since: t(7 * 24 * H - 1) }),
    R({ id: 'C', state: I.STATE.APPROVED, since: t(30 * 24 * H) }),
  ], NOW);
  assert.deepEqual(p.expire, ['A']);
  assert.deepEqual(p.stuck, []);
});

test('dlv_07_a_row_from_before_sinds_counts_from_its_creation', () => {
  const p = D.stalePlan([R({ id: 'A', since: '', created: t(8 * 24 * H) })], NOW);
  assert.deepEqual(p.expire, ['A']);
});

test('dlv_07_the_nightly_run_expires_and_checks_the_watchdog', () => {
  const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const night = MAIN.slice(MAIN.indexOf('function composeLoop('));
  assert.match(night.slice(0, night.indexOf('\n}\n')), /expireStale_\(\)/);
});

// DLV-08 --------------------------------------------------------------------------------------------------------------

test('dlv_08_a_render_without_answer_for_2_hours_goes_to_the_team', () => {
  const p = D.stalePlan([
    R({ id: 'A', state: I.STATE.SENT, since: t(2 * H) }),
    R({ id: 'B', state: I.STATE.SENT, since: t(2 * H - 1) }),
    R({ id: 'C', state: I.STATE.RETRY, since: t(5 * H) }),
  ], NOW);
  assert.deepEqual(p.stuck, ['A']);
  assert.deepEqual(p.expire, []);
  assert.equal(D.NO_RENDER_REASON, 'geen antwoord van de render');
});

test('dlv_08_team_mail_carries_every_change_text', () => {
  const m = I.teamMail({ ...ROW, change: 'Andere tijd\n\nGroter' }, '3 rondes aangepast');
  assert.match(m.body, /Andere tijd\n\nGroter/);
  assert.match(m.body, /Aanpassingen/);
  assert.doesNotMatch(I.teamMail(ROW, 'x').body, /Aanpassingen/, 'no empty block without changes');
});

test('dlv_07_a_mailed_round_starts_its_7_days', () => {
  const after = D.afterCallback(R({ state: I.STATE.SENT, since: t(H) }), { ok: true }, 'b'.repeat(32), 'f', NOW);
  assert.equal(after.since.getTime(), NOW.getTime());
});

test('dlv_05_main_has_the_change_round_trip', () => {
  const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const get = MAIN.slice(MAIN.indexOf('function doGet('));
  assert.match(get, /changeForm\(/);
  assert.doesNotMatch(MAIN, /changeLater/);
  const sub = MAIN.slice(MAIN.indexOf('function submitChange('));
  assert.ok(MAIN.includes('function submitChange('));
  assert.match(sub, /afterChange\(/);
  assert.match(sub, /tryDispatch_\(/);
  assert.match(sub.slice(sub.lastIndexOf('catch (err)')), /mailTeam_\(/, 'a failed Aanpassen mails the team');
});
