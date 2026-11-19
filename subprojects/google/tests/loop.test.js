// The loop (specs/modules/deliver.md, "The loop"): which files belong in Loop/, the weekly rotating slide, expiry.
// Run: node --test subprojects/google/tests/*.test.js. The Drive half is checked by tests/manual/loop.md.
const test = require('node:test');
const assert = require('node:assert/strict');

const I = require('../src/intake.js');
const D = require('../src/deliver.js');

const A = I.STATE.APPROVED;
const req = (id, over) => ({ id, state: A, show_until: '', event_date: '2026-12-24', png: 'png-' + id, ...over });
const file = (id, name, updated = '2026-11-01T10:00:00.000Z') => ({ id, name, updated });
const plan = (over) => D.loopPlan({ fixed: [], rotating: [], requests: [], current: [], today: '2026-11-18', ...over });
const names = (p) => p.add.map((a) => a.name).sort();

// ISO week and the composition date ------------------------------------------------------------------------------------

test('dlv_16_iso_week_runs_monday_to_sunday', () => {
  assert.equal(D.isoWeek('2026-11-21'), 47); // Saturday
  assert.equal(D.isoWeek('2026-11-22'), 47); // Sunday
  assert.equal(D.isoWeek('2026-11-23'), 48); // Monday
});

test('dlv_16_iso_week_across_the_year_boundary', () => {
  assert.equal(D.isoWeek('2025-12-29'), 1); // Monday of week 1 of 2026 (1 January 2026 is a Thursday)
  assert.equal(D.isoWeek('2026-01-01'), 1);
  assert.equal(D.isoWeek('2026-12-31'), 53); // 2026 has 53 weeks
  assert.equal(D.isoWeek('2027-01-01'), 53);
  assert.equal(D.isoWeek('2027-01-03'), 53);
  assert.equal(D.isoWeek('2027-01-04'), 1);
});

test('dlv_09_composition_date_is_the_day_in_amsterdam', () => {
  assert.equal(D.amsterdamDay(new Date('2026-11-21T23:30:00Z')), '2026-11-22'); // winter, UTC+1
  assert.equal(D.amsterdamDay(new Date('2026-06-30T22:30:00Z')), '2026-07-01'); // summer, UTC+2
  assert.equal(D.amsterdamDay(new Date('2026-11-18T12:00:00Z')), '2026-11-18');
  assert.equal(D.amsterdamDay('2026-12-24'), '2026-12-24');
});

// DLV-16: the rotating slide -------------------------------------------------------------------------------------------

const ROT = [file('c', 'c.png'), file('a', 'a.png'), file('b', 'b.png')];

test('dlv_16 picks by ISO week mod count, sorted by file name', () => {
  assert.equal(D.rotatingPick(ROT, '2026-11-23').name, 'a.png'); // week 48 % 3 = 0
  assert.equal(D.rotatingPick(ROT, '2026-12-31').name, 'c.png'); // week 53 % 3 = 2
  assert.equal(D.rotatingPick(ROT, '2027-01-04').name, 'b.png'); // week 1 % 3 = 1
});

test('dlv_16_saturday_night_and_sunday_give_the_same_slide_monday_the_next', () => {
  const sat = D.rotatingPick(ROT, '2026-11-21').name;
  assert.equal(D.rotatingPick(ROT, '2026-11-22').name, sat);
  assert.notEqual(D.rotatingPick(ROT, '2026-11-23').name, sat);
  assert.equal(D.rotatingPick(ROT, '2027-01-01').name, D.rotatingPick(ROT, '2026-12-31').name);
});

test('dlv_16_empty_folder_adds_nothing_and_non_png_files_do_not_count', () => {
  assert.equal(D.rotatingPick([], '2026-11-23'), null);
  assert.equal(D.rotatingPick([file('t', 'lees mij.txt')], '2026-11-23'), null);
  const two = [file('x', 'notes.txt'), file('b', 'b.PNG'), file('a', 'a.png')];
  assert.equal(D.rotatingPick(two, '2026-11-23').name, 'a.png'); // week 48 % 2 = 0
});

test('dlv_16_exactly_one_rotating_slide_in_the_plan', () => {
  const p = plan({ rotating: ROT, today: '2026-11-23' });
  assert.deepEqual(names(p), ['a.png']);
  assert.deepEqual(names(plan({ rotating: [] })), []);
});

// DLV-12: fixed slides -------------------------------------------------------------------------------------------------

test('dlv_12_every_png_in_vast_is_in_the_loop', () => {
  const p = plan({ fixed: [file('w', 'welkom.png'), file('c', 'collecte.PNG'), file('t', 'notitie.txt')] });
  assert.deepEqual(names(p), ['collecte.PNG', 'welkom.png']);
  assert.deepEqual(p.add.find((a) => a.name === 'welkom.png').sourceId, 'w');
});

// DLV-09: approved requests in date, keep / add / remove ---------------------------------------------------------------

test('dlv_09_approved_requests_until_their_last_day_inclusive', () => {
  const p = plan({
    today: '2026-11-18',
    requests: [
      req('R1', { show_until: '2026-11-18' }), // last day today: in
      req('R2', { show_until: '2026-11-17' }), // yesterday: out
      req('R3', { show_until: '', event_date: '2026-11-20' }), // empty show_until: until the event date
      req('R4', { state: I.STATE.TO_APPROVE, show_until: '2026-12-01' }), // not approved: out
      req('R5', { show_until: new Date('2026-11-18T00:00:00+01:00') }), // a Date from the Sheet
    ],
  });
  assert.deepEqual(names(p), ['R1.png', 'R3.png', 'R5.png']);
  assert.equal(p.add.find((a) => a.name === 'R1.png').sourceId, 'png-R1');
});

test('dlv_09_a_file_already_in_the_loop_with_the_same_key_is_kept', () => {
  const first = plan({ fixed: [file('w', 'welkom.png')], requests: [req('R1')] });
  const current = first.add.map((a, i) => ({ id: 'loop-' + i, key: a.key }));
  const again = plan({ fixed: [file('w', 'welkom.png')], requests: [req('R1')], current });
  assert.deepEqual(again.add, []);
  assert.deepEqual(again.remove, []);
});

test('dlv_09_a_changed_fixed_slide_is_replaced', () => {
  const first = plan({ fixed: [file('w', 'welkom.png', '2026-11-01T10:00:00.000Z')] });
  const current = [{ id: 'loop-0', key: first.add[0].key }];
  const p = plan({ fixed: [file('w', 'welkom.png', '2026-11-17T09:00:00.000Z')], current });
  assert.deepEqual(names(p), ['welkom.png']);
  assert.deepEqual(p.remove, ['loop-0']);
});

test('dlv_09_a_file_in_the_loop_that_belongs_nowhere_is_removed', () => {
  const p = plan({ current: [{ id: 'hand', key: '' }, { id: 'old', key: 'png-R9' }] });
  assert.deepEqual(p.remove.sort(), ['hand', 'old']);
});

// DLV-13: expiry -------------------------------------------------------------------------------------------------------

test('dlv_13_approved_requests_past_their_last_day_are_archived', () => {
  const p = plan({
    today: '2026-11-18',
    requests: [
      req('R1', { show_until: '2026-11-17' }),
      req('R2', { show_until: '2026-11-18' }),
      req('R3', { show_until: '', event_date: '2026-11-10' }),
      req('R4', { state: I.STATE.MANUAL, show_until: '2026-11-01' }), // only approved requests are archived
    ],
  });
  assert.deepEqual(p.archive.sort(), ['R1', 'R3']);
});

test('dlv_13_archived_is_a_state', () => {
  assert.equal(I.STATE.ARCHIVED, 'gearchiveerd');
});

// DLV-08: a failed composition is mailed, without request data --------------------------------------------------------

test('dlv_08_loop_failure_mail_names_the_reason', () => {
  const m = D.loopFailMail('Drive antwoordde niet');
  assert.match(m.subject, /loop/i);
  assert.match(m.body, /Drive antwoordde niet/);
  assert.match(m.body, /ongewijzigd|zoals hij was/);
});

// FIX-03 (DLV-09, DLV-08): the mail says which of the two it was ---------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const fnBody = (name) => {
  const start = MAIN.indexOf(`function ${name}(`);
  const next = MAIN.indexOf('\nfunction ', start + 1);
  return MAIN.slice(start, next < 0 ? undefined : next);
};

test('dlv_09_a_failure_while_moving_says_loop_may_be_partly_updated', () => {
  const m = D.loopFailMail('verplaatsen: Drive antwoordde niet');
  assert.match(m.subject, /deels/);
  assert.match(m.body, /deels bijgewerkt/);
  assert.match(m.body, /volgende run/);
  assert.match(m.body, /Drive antwoordde niet/);
  assert.doesNotMatch(m.subject + m.body, /zoals hij was|niet bijgewerkt/);
});

test('dlv_09_a_failure_before_moving_says_loop_is_as_it_was', () => {
  const m = D.loopFailMail('Drive antwoordde niet');
  assert.match(m.body, /zoals hij was/);
  assert.doesNotMatch(m.body, /deels/);
  assert.doesNotMatch(D.loopFailMail('archiveren: x').subject + D.loopFailMail('archiveren: x').body, /deels|zoals hij was/);
});

test('dlv_09_compose_marks_the_move_step_after_copying', () => {
  const c = fnBody('composeLoop_');
  const copy = c.indexOf('makeCopy(');
  const mark = c.indexOf("step = 'verplaatsen: '");
  assert.ok(copy > 0 && mark > copy, 'marked after the copies are made');
  assert.ok(mark < c.indexOf('.moveTo(loop)'), 'and before the first move into Loop/');
});

// FIX-04 (DLV-08): a nightly run that cannot get the lock mails the team -----------------------------------------------

test('dlv_08_night_run_without_the_lock_mails_the_team', () => {
  const night = fnBody('composeLoop');
  assert.doesNotMatch(night, /waitLock/);
  assert.match(night, /if \(!lock\.tryLock\(30000\)\)/);
  assert.match(night, /loopFailMail\(/);
});
