// Activities (specs/modules/agenda.md, AGD-03, 04, 06, 09): the Activiteiten tab, the first slide of a new activity
// for the visual team, Niet tonen, and an activity's own PNG. Run: node --test subprojects/google/tests/*.test.js.
// The Google half is checked by tests/manual/agenda.md, step 7 onwards.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const G = require('../src/agenda.js');
const D = require('../src/deliver.js');
const I = require('../src/intake.js');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const fnBody = (name) => {
  const start = MAIN.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `main.js has ${name}`);
  const next = MAIN.indexOf('\nfunction ', start + 1);
  return MAIN.slice(start, next < 0 ? undefined : next);
};

const TODAY = '2026-11-20';
const NOW = new Date('2026-11-20T02:00:00Z');
const occ = (over) => ({ seriesId: 's1', title: 'Bijbelkring', description: 'We lezen Marcus.', start: '2026-11-25T18:30:00.000Z',
  end: '2026-11-25T20:00:00.000Z', location: 'Zaal 2', cancelled: false, ...over });
const act = (title, over) => ({ id: G.activityId(title), title, state: G.ACT.NEW, slide: '', round: 1, token: '', png: '',
  change: '', since: '', reason: '', ...over });
const png = (name, id = 'f-' + name) => ({ id, name, updated: '2026-11-01T10:00:00.000Z' });

// AGD-03: activities -------------------------------------------------------------------------------------------------

test('AGD-03 the four states', () => {
  assert.deepEqual(G.ACT, { NEW: 'nieuw', TO_APPROVE: 'te keuren', SHOW: 'tonen', HIDE: 'niet tonen' });
  assert.equal(G.ACTIVITIES_TAB, 'Activiteiten');
  for (const c of ['titel', 'status', 'slide']) assert.ok(G.ACTIVITY_COLUMNS.includes(c), c);
});

test('AGD-03 the activity id is A plus a hash of the trimmed, lower-case title', () => {
  const id = G.activityId('Bijbelkring');
  assert.match(id, /^A[0-9a-f]{8}$/);
  assert.equal(G.activityId('  BIJBELKRING '), id);
  assert.notEqual(G.activityId('Jeugdclub'), id);
  assert.match(id, /^[A-Za-z0-9-]{1,64}$/, 'the render job accepts it as an id');
});

test('AGD-03 occurrences with the same title are one activity, separate events or one series', () => {
  const add = G.newActivities([], [
    occ({ seriesId: 'a' }), occ({ seriesId: 'b', title: 'bijbelkring ', start: '2026-11-26T18:30:00.000Z' }),
    occ({ seriesId: 'c', title: 'Jeugdclub' }),
  ]);
  assert.deepEqual(add.map((a) => a.title), ['Bijbelkring', 'Jeugdclub']);
  assert.deepEqual(add.map((a) => a.state), ['nieuw', 'nieuw']);
  assert.equal(add[0].id, G.activityId('Bijbelkring'));
});

test('AGD-03 an occurrence whose title starts with Samenkomst is no activity', () => {
  const add = G.newActivities([], [occ({ title: 'Samenkomst' }), occ({ title: 'samenkomst met avondmaal' }),
    occ({ title: 'Na de samenkomst koffie' })]);
  assert.deepEqual(add.map((a) => a.title), ['Na de samenkomst koffie']);
});

test('AGD-03 an activity already in the tab is not added again, whatever its state', () => {
  const have = [act('Bijbelkring', { state: G.ACT.HIDE }), act('Jeugdclub', { state: G.ACT.SHOW })];
  assert.deepEqual(G.newActivities(have, [occ({ title: 'BIJBELKRING' }), occ({ title: 'Jeugdclub' })]), []);
});

test('AGD-03 an activity survives the round trip through the Activiteiten tab, as literal text', () => {
  const a = act('=HYPERLINK("x")', { slide: '{"title":"x","line":""}', round: 2, since: '2026-11-20T02:00:00.000Z' });
  const row = G.toActivityRow(a);
  assert.equal(row.length, G.ACTIVITY_COLUMNS.length);
  assert.ok(row.filter((v) => typeof v === 'string' && v !== '').every((v) => v.startsWith("'")));
  const back = G.fromActivityRow(row.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)));
  assert.equal(back.title, a.title);
  assert.equal(back.state, a.state);
  assert.equal(back.slide, a.slide);
  assert.equal(back.round, 2);
  assert.equal(new Date(back.since).toISOString(), a.since);
});

test('AGD-03 a state typed by the team with other capitals or spaces still counts', () => {
  const row = G.toActivityRow(act('Bijbelkring')).map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v));
  row[G.ACTIVITY_COLUMNS.indexOf('status')] = ' Nieuw ';
  assert.equal(G.fromActivityRow(row).state, 'nieuw');
});

// AGD-04: the first slide of a new activity -----------------------------------------------------------------------------

test('AGD-04 when is the occurrence start in Dutch, Amsterdam time', () => {
  assert.equal(G.agendaWhen('2026-11-29T18:30:00.000Z'), 'zondag 29 november, 19.30 uur');
  assert.equal(G.agendaWhen('2026-07-01T07:05:00.000Z'), 'woensdag 1 juli, 9.05 uur'); // summer time
});

test('AGD-04 where is the location cut to 40 characters at a word boundary', () => {
  assert.equal(G.agendaWhere(''), '');
  assert.equal(G.agendaWhere('Zaal 2'), 'Zaal 2');
  const long = 'Kerkgebouw De Rank, Grote zaal, Hoofdstraat 12, 1234 AB Dorp';
  const w = G.agendaWhere(long);
  assert.ok(w.length <= 40, w);
  assert.ok(long.startsWith(w));
  assert.ok(long[w.length] === ' ' || long[w.length] === ',' , 'cut at a word boundary');
  assert.ok(!/[ ,]$/.test(w), 'no trailing space or comma');
});

test('AGD-04 a new activity is dispatched with kind activity, its first occurrence and the title and description', () => {
  const list = G.activitiesToDispatch({ activities: [act('Bijbelkring')], files: [], today: TODAY, now: NOW,
    occurrences: [occ({ start: '2026-11-27T18:30:00.000Z' }), occ({ start: '2026-11-25T18:30:00.000Z' })] });
  assert.equal(list.length, 1);
  const d = G.activityDispatch(list[0].activity, list[0].occurrence);
  assert.equal(d.event_type, 'slide-request');
  const p = d.client_payload;
  assert.equal(p.kind, 'activity');
  assert.equal(p.id, G.activityId('Bijbelkring'));
  assert.equal(p.round, 1);
  assert.equal(p.text, 'Bijbelkring\n\nWe lezen Marcus.');
  assert.equal(p.when, 'woensdag 25 november, 19.30 uur');
  assert.equal(p.where, 'Zaal 2');
  assert.equal(p.event_date, '2026-11-25');
  assert.equal(p.change, '');
  assert.equal(p.image, false);
  assert.deepEqual(Object.keys(p).sort(), ['change', 'event_date', 'id', 'image', 'kind', 'round', 'show_until', 'text',
    'when', 'where']);
});

test('AGD-04 the dispatch text is at most 5000 characters and the change goes along', () => {
  const p = G.activityDispatch(act('Bijbelkring', { round: 2, change: 'Korter graag.' }),
    occ({ description: 'x'.repeat(6000) })).client_payload;
  assert.equal(p.text.length, 5000);
  assert.equal(p.round, 2);
  assert.equal(p.change, 'Korter graag.');
});

test('AGD-04 only activities in state nieuw are dispatched', () => {
  const activities = [act('Bijbelkring'), act('Jeugdclub', { state: G.ACT.TO_APPROVE }),
    act('Gebedsuur', { state: G.ACT.SHOW }), act('Koor', { state: G.ACT.HIDE })];
  const occurrences = ['Bijbelkring', 'Jeugdclub', 'Gebedsuur', 'Koor'].map((title) => occ({ title }));
  const list = G.activitiesToDispatch({ activities, occurrences, files: [], today: TODAY, now: NOW });
  assert.deepEqual(list.map((x) => x.activity.title), ['Bijbelkring']);
});

test('AGD-04 a dispatched activity is not dispatched again while its render runs, but again after 20 hours', () => {
  const run = (since) => G.activitiesToDispatch({ activities: [act('Bijbelkring', { since })], occurrences: [occ()],
    files: [], today: TODAY, now: NOW }).length;
  assert.equal(run(''), 1);
  assert.equal(run(new Date(NOW.getTime() - 3600e3)), 0);
  assert.equal(run(new Date(NOW.getTime() - 21 * 3600e3)), 1);
});

test('AGD-04 an activity without a coming, not cancelled occurrence is not dispatched', () => {
  const run = (o) => G.activitiesToDispatch({ activities: [act('Bijbelkring')], occurrences: o, files: [], today: TODAY,
    now: NOW }).length;
  assert.equal(run([]), 0);
  assert.equal(run([occ({ cancelled: true })]), 0);
  assert.equal(run([occ({ start: '2026-11-18T18:30:00.000Z' })]), 0, 'a stale read: that date is past');
});

test('AGD-04 the callback of an activity is accepted while it waits for its render', () => {
  const crypto = require('node:crypto');
  const body = { id: G.activityId('Bijbelkring'), round: 1, ok: true, slide: {}, png_base64: '' };
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', 's').update(raw).digest('hex');
  const check = (row) => D.checkCallback({ raw, sig, expected: sig, row }).error;
  assert.equal(check(act('Bijbelkring', { since: NOW })), '');
  assert.notEqual(check(act('Bijbelkring')), '', 'never dispatched');
  assert.notEqual(check(act('Bijbelkring', { since: NOW, state: G.ACT.TO_APPROVE })), '', 'already answered');
  assert.notEqual(check(act('Bijbelkring', { since: NOW, round: 2 })), '', 'another round');
});

test('AGD-04 a good render puts the activity in te keuren with the proposed title and line', () => {
  const a = act('Bijbelkring', { since: NOW });
  const slide = { title: 'Bijbelkring', when: 'woensdag 25 november, 19.30 uur', where: 'Zaal 2', line: 'We lezen Marcus' };
  const after = G.afterActivityCallback(a, { ok: true, slide }, 'c'.repeat(32), 'png-1', NOW);
  assert.equal(after.state, 'te keuren');
  assert.equal(after.token, 'c'.repeat(32));
  assert.equal(after.png, 'png-1');
  assert.deepEqual(JSON.parse(after.slide), { title: 'Bijbelkring', line: 'We lezen Marcus' });
  assert.equal(a.state, 'nieuw', 'never mutates');
});

test('AGD-04 a failed render keeps the activity nieuw with the reason, and the team is mailed', () => {
  const after = G.afterActivityCallback(act('Bijbelkring', { since: NOW }), { ok: false, reason: 'does not fit' }, '', '', NOW);
  assert.equal(after.state, 'nieuw');
  assert.equal(after.token, '');
  assert.match(after.reason, /does not fit/);
  const m = G.activityTeamMail(after, after.reason);
  assert.match(m.subject, /Bijbelkring/);
  assert.match(m.body, /does not fit/);
  assert.match(m.body, /Vast\/Agenda/);
  assert.match(m.body, /niet tonen/);
});

test('AGD-04 the approval mail of an activity has three buttons and says it is for the visual team', () => {
  const a = act('Bijbelkring', { state: G.ACT.TO_APPROVE, token: 'c'.repeat(32) });
  const links = D.approvalLinks('https://x.example/exec', a.id, a.token);
  const u = new URL(links.hide);
  assert.equal(u.searchParams.get('a'), 'niet-tonen');
  assert.equal(u.searchParams.get('id'), a.id);
  const m = D.approvalMail(a, { title: 'Bijbelkring', when: 'woensdag 25 november, 19.30 uur', where: 'Zaal 2', line: '' }, links);
  for (const b of ['Goedkeuren', 'Aanpassen', 'Niet tonen']) assert.match(m.htmlBody, new RegExp(`>\\s*${b}\\s*<`));
  assert.ok(m.body.includes(links.hide));
  assert.match(m.subject, /activiteit/i);
  assert.match(m.body, /agenda/i);
  assert.doesNotMatch(m.body, /je aanvraag/);
});

test('AGD-04 a request mail keeps its two buttons', () => {
  const links = D.approvalLinks('https://x.example/exec', 'R20261117-K7Q', 'c'.repeat(32));
  assert.equal(links.hide, undefined);
  assert.doesNotMatch(D.approvalMail({ id: 'R20261117-K7Q' }, { title: 'x' }, links).htmlBody, /Niet tonen/);
});

test('AGD-04 Goedkeuren sets tonen and keeps the approved slide text, and the link is used up', () => {
  const a = act('Bijbelkring', { state: G.ACT.TO_APPROVE, token: 'c'.repeat(32), slide: '{"title":"Bijbelkring","line":""}' });
  assert.equal(D.approveDecision(a, 'c'.repeat(32)), 'approve');
  const after = G.afterActivityApprove(a);
  assert.equal(after.state, 'tonen');
  assert.equal(after.slide, a.slide);
  assert.equal(after.since, '', 'set back to nieuw (AGD-07), the next run dispatches it at once');
  assert.equal(D.approveDecision(after, 'c'.repeat(32)), 'bad-token');
});

test('AGD-04 Aanpassen renders again with the change, as nieuw, and stops after round 3', () => {
  const a = act('Bijbelkring', { state: G.ACT.TO_APPROVE, token: 'c'.repeat(32), png: 'p' });
  assert.equal(G.afterActivityChange(a, '   ', NOW), null);
  const after = G.afterActivityChange(a, 'Noem de koffie.', NOW);
  assert.equal(after.state, 'nieuw');
  assert.equal(after.round, 2);
  assert.equal(after.change, 'Noem de koffie.');
  assert.equal(after.token, '');
  assert.equal(after.png, '');
  assert.equal(after.since, NOW);
  const third = G.afterActivityChange({ ...a, round: 3 }, 'Nog eens.', NOW);
  assert.equal(third, 'rounds');
});

test('AGD-04 the night run reads the agenda before the loop and then handles the activities', () => {
  const night = fnBody('composeLoop');
  const read = night.indexOf('readAgenda_(');
  assert.ok(read >= 0 && read < night.indexOf('composeLoop_('), 'the loop sees tonight\'s agenda');
  assert.match(night, /activities_\(/);
});

test('AGD-04 the activity mail goes to the visual team, never to a requester', () => {
  const post = fnBody('doPost');
  assert.match(post, /activityCallback_\(/);
  const cb = fnBody('activityCallback_');
  assert.match(cb, /Session\.getEffectiveUser\(\)\.getEmail\(\)/);
  assert.doesNotMatch(cb, /recipients\(/);
});

// AGD-06: Niet tonen ---------------------------------------------------------------------------------------------------

test('AGD-06 Niet tonen sets niet tonen and uses up the link', () => {
  const a = act('Bijbelkring', { state: G.ACT.TO_APPROVE, token: 'c'.repeat(32), png: 'p' });
  const after = G.afterActivityHide(a);
  assert.equal(after.state, 'niet tonen');
  assert.equal(after.token, '');
  assert.equal(after.since, '', 'set back to nieuw, the next run dispatches it at once');
  assert.equal(D.approveDecision(after, 'c'.repeat(32)), 'bad-token');
});

test('AGD-06 an activity in niet tonen gets no slide; set back to nieuw it is dispatched again', () => {
  const run = (state) => G.activitiesToDispatch({ activities: [act('Bijbelkring', { state, since: new Date('2026-11-01') })],
    occurrences: [occ()], files: [], today: TODAY, now: NOW }).length;
  assert.equal(run(G.ACT.HIDE), 0);
  assert.equal(run(G.ACT.NEW), 1);
});

test('AGD-06 the web app knows the niet-tonen link', () => {
  assert.match(fnBody('doGet'), /niet-tonen/);
});

// AGD-09: an activity's own PNG ------------------------------------------------------------------------------------------

test('AGD-09 an activity with its own PNG in Vast/Agenda is not dispatched', () => {
  const run = (files) => G.activitiesToDispatch({ activities: [act('Bijbelkring')], occurrences: [occ()], files,
    today: TODAY, now: NOW }).length;
  assert.equal(run([png(' bijbelKRING .PNG')]), 0);
  assert.equal(run([png('Bijbelkring.jpg')]), 1, 'only a PNG counts');
  assert.equal(run([png('Jeugdclub.png')]), 1);
});

test('AGD-09 own PNG joins the loop once while the activity has a coming, not cancelled occurrence', () => {
  const files = [png('Bijbelkring.png'), png('Jeugdclub.png'), png('notitie.txt')];
  const pick = (occurrences, activities = []) =>
    G.agendaLoopFiles({ files, activities, occurrences, today: TODAY }).map((f) => f.name);
  assert.deepEqual(pick([occ(), occ({ start: '2026-11-26T18:30:00.000Z' })]), ['Bijbelkring.png']);
  assert.deepEqual(pick([occ({ cancelled: true })]), []);
  assert.deepEqual(pick([occ({ start: '2026-11-18T18:30:00.000Z' })]), [], 'a stale read: that date is past');
  assert.deepEqual(pick([]), []);
});

test('AGD-09 own PNG never joins for an activity in niet tonen', () => {
  const files = [png('Bijbelkring.png')];
  const pick = (state) => G.agendaLoopFiles({ files, activities: [act('Bijbelkring', { state })], occurrences: [occ()],
    today: TODAY }).length;
  assert.equal(pick(G.ACT.HIDE), 0);
  for (const s of [G.ACT.NEW, G.ACT.TO_APPROVE, G.ACT.SHOW]) assert.equal(pick(s), 1, s);
});

test('AGD-09 own PNG of a Samenkomst title is no agenda slide', () => {
  assert.deepEqual(G.agendaLoopFiles({ files: [png('Samenkomst.png')], activities: [],
    occurrences: [occ({ title: 'Samenkomst' })], today: TODAY }), []);
});

test('AGD-09 the loop composition reads Vast/Agenda, the activities and the agenda', () => {
  const c = fnBody('composeLoop_');
  assert.match(c, /AGENDA_FOLDER/);
  assert.match(c, /agendaLoopFiles\(/);
  assert.equal(G.AGENDA_FOLDER, 'Agenda');
});

test('AGD-04 intake STATE.NEW is the activity state nieuw', () => {
  assert.equal(I.STATE.NEW, G.ACT.NEW);
  assert.equal(I.STATE.TO_APPROVE, G.ACT.TO_APPROVE);
});
