// Dated slides (specs/modules/agenda.md AGD-05, 07, 09; deliver.md DLV-08, 09): every date of an activity in tonen is
// rendered without Claude and joins the loop up to its date. Run: node --test subprojects/google/tests/*.test.js.
// The Google half is checked by tests/manual/agenda.md, step 13 onwards.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const G = require('../src/agenda.js');
const D = require('../src/deliver.js');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const fnBody = (name) => {
  const start = MAIN.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `main.js has ${name}`);
  const next = MAIN.indexOf('\nfunction ', start + 1);
  return MAIN.slice(start, next < 0 ? undefined : next);
};

const TODAY = '2026-11-20';
const NOW = new Date('2026-11-20T02:00:00Z');
const SLIDE = JSON.stringify({ title: 'Bijbelkring', line: 'Iedereen welkom' });
const occ = (over) => ({ seriesId: 's1', title: 'Bijbelkring', description: 'We lezen Marcus.', start: '2026-11-25T18:30:00.000Z',
  end: '2026-11-25T20:00:00.000Z', location: 'Zaal 2', cancelled: false, ...over });
const act = (title, over) => ({ id: G.activityId(title), title, state: G.ACT.SHOW, slide: SLIDE, round: 1, token: '', png: '',
  change: '', since: '', reason: '', ...over });
const png = (name, id = 'f-' + name) => ({ id, name, updated: '2026-11-01T10:00:00.000Z' });
const ID = G.activityId('Bijbelkring') + '-2026-11-25';
const plan = (over) => G.datedPlan({ activities: [act('Bijbelkring')], occurrences: [occ()], files: [], dated: [],
  today: TODAY, now: NOW, ...over });
const rendered = (over) => {
  const item = plan().dispatch[0];
  return { id: item.id, key: item.key, png: 'png-1', since: '', reason: '', round: 1, ...over };
};

// AGD-05: which dates are rendered -------------------------------------------------------------------------------------

test('AGD-05 every occurrence of an activity in tonen is dispatched, one per date, id is activity id and date', () => {
  const p = plan({ occurrences: [occ(), occ({ start: '2026-11-22T09:00:00.000Z' })] });
  assert.deepEqual(p.dispatch.map((x) => x.id).sort(), [G.activityId('Bijbelkring') + '-2026-11-22', ID]);
});

test('AGD-05 only activities in tonen: nieuw, te keuren and niet tonen get no dated slide', () => {
  for (const s of [G.ACT.NEW, G.ACT.TO_APPROVE, G.ACT.HIDE]) {
    assert.deepEqual(plan({ activities: [act('Bijbelkring', { state: s })] }).dispatch, [], s);
  }
});

test('AGD-05 an activity with its own PNG in Vast/Agenda gets no dated slide (AGD-09)', () => {
  assert.deepEqual(plan({ files: [png('Bijbelkring.png')] }).dispatch, []);
});

test('AGD-05 cancelled, past and Samenkomst occurrences are not dispatched', () => {
  assert.deepEqual(plan({ occurrences: [occ({ cancelled: true })] }).dispatch, []);
  assert.deepEqual(plan({ occurrences: [occ({ start: '2026-11-18T18:30:00.000Z' })] }).dispatch, [], 'a stale read');
  assert.deepEqual(plan({ activities: [act('Samenkomst')], occurrences: [occ({ title: 'Samenkomst' })] }).dispatch, []);
});

test('AGD-05 the slide takes title and line from the approved slide text, when and where from the agenda', () => {
  const s = plan().dispatch[0].slide;
  assert.deepEqual(s, { title: 'Bijbelkring', when: 'woensdag 25 november, 19.30 uur', where: 'Zaal 2', line: 'Iedereen welkom' });
  assert.equal(plan({ occurrences: [occ({ location: '' })] }).dispatch[0].slide.where, '');
  const long = 'Gebouw De Ark, Achterzaal naast de keuken, Kerkstraat 12, Ergens';
  assert.equal(plan({ occurrences: [occ({ location: long })] }).dispatch[0].slide.where, G.agendaWhere(long));
});

test('AGD-05 when is the start in Dutch, Amsterdam time, as in the spec', () => {
  assert.equal(G.agendaWhen('2026-11-30T18:30:00.000Z'), 'maandag 30 november, 19.30 uur');
  assert.equal(G.agendaWhen('2026-06-28T17:30:00.000Z'), 'zondag 28 juni, 19.30 uur');
});

test('AGD-05 where is cut to 40 characters at a word boundary and empty without a location', () => {
  const w = G.agendaWhere('Gebouw De Ark, Achterzaal naast de keuken, Kerkstraat 12');
  assert.ok(w.length <= 40 && 'Gebouw De Ark, Achterzaal naast de keuken'.startsWith(w) && !/[ ,]$/.test(w), w);
  assert.equal(G.agendaWhere(''), '');
  assert.equal(G.agendaWhere(undefined), '');
});

test('AGD-05 the dispatch is kind occurrence with the full SlideText and no text', () => {
  const d = G.datedDispatch(plan().dispatch[0]);
  assert.equal(d.event_type, 'slide-request');
  assert.deepEqual(d.client_payload, { id: ID, round: 1, kind: 'occurrence', event_date: '2026-11-25',
    slide: { title: 'Bijbelkring', when: 'woensdag 25 november, 19.30 uur', where: 'Zaal 2', line: 'Iedereen welkom' }, image: false });
});

test('AGD-05 two occurrences of one activity on one day make one dated slide, the first', () => {
  const p = plan({ occurrences: [occ({ start: '2026-11-25T09:00:00.000Z' }), occ()] });
  assert.equal(p.dispatch.length, 1);
  assert.match(p.dispatch[0].slide.when, /10\.00 uur/);
});

// Never twice ----------------------------------------------------------------------------------------------------------

test('AGD-05 a date already rendered and unchanged is not dispatched again', () => {
  assert.deepEqual(plan({ dated: [rendered()] }).dispatch, []);
});

test('AGD-05 a date waiting for its render is not dispatched again within 20 hours, then again as a retry', () => {
  const waiting = rendered({ png: '', since: new Date('2026-11-19T22:00:00Z') });
  assert.deepEqual(plan({ dated: [waiting] }).dispatch, []);
  const late = plan({ dated: [waiting], now: new Date('2026-11-20T19:00:00Z') }).dispatch;
  assert.equal(late.length, 1);
  assert.equal(late[0].retry, true);
  assert.equal(plan().dispatch[0].retry, false);
});

test('AGD-05 a dated row survives the round trip through the Datums tab, as literal text', () => {
  const d = rendered({ since: new Date('2026-11-20T02:00:00Z') });
  const row = G.toDatedRow(d);
  assert.equal(row.length, G.DATED_COLUMNS.length);
  assert.equal(G.DATED_TAB, 'Datums');
  const back = G.fromDatedRow(row.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)));
  assert.equal(back.id, d.id);
  assert.equal(back.key, d.key);
  assert.equal(back.png, d.png);
  assert.equal(back.round, 1);
  assert.equal(new Date(back.since).getTime(), d.since.getTime());
});

// AGD-07: a change in the agenda ---------------------------------------------------------------------------------------

test('AGD-07 a moved time is dispatched again', () => {
  const p = plan({ dated: [rendered()], occurrences: [occ({ start: '2026-11-25T19:00:00.000Z' })] });
  assert.equal(p.dispatch.length, 1);
  assert.equal(p.dispatch[0].retry, false);
  assert.match(p.dispatch[0].slide.when, /20\.00 uur/);
});

test('AGD-07 a moved place is dispatched again', () => {
  assert.equal(plan({ dated: [rendered()], occurrences: [occ({ location: 'Grote zaal' })] }).dispatch.length, 1);
});

test('AGD-07 a changed description or end makes no new slide', () => {
  const o = occ({ description: 'Nu Lucas.', end: '2026-11-25T21:00:00.000Z' });
  assert.deepEqual(plan({ dated: [rendered()], occurrences: [o] }).dispatch, []);
});

test('AGD-07 a new approved slide text renders every date again', () => {
  const a = act('Bijbelkring', { slide: JSON.stringify({ title: 'Bijbelkring', line: 'Nieuw: met koffie' }) });
  assert.equal(plan({ dated: [rendered()], activities: [a] }).dispatch.length, 1);
});

test('AGD-07 a new dispatch for a changed date drops the old PNG; an unchanged retry keeps it', () => {
  const old = rendered();
  const moved = plan({ dated: [old], occurrences: [occ({ location: 'Grote zaal' })] }).dispatch[0];
  const after = G.afterDatedDispatch(old, moved, '', NOW);
  assert.equal(after.png, '', 'the old time never shows while the new one renders');
  assert.equal(after.key, moved.key);
  assert.equal(after.since, NOW);
  assert.equal(after.reason, '');
  const failed = G.afterDatedDispatch(undefined, moved, 'GitHub antwoordde 401', NOW);
  assert.equal(failed.since, '');
  assert.equal(failed.reason, 'GitHub antwoordde 401');
  assert.equal(failed.id, moved.id);
});

test('AGD-07 past dates are pruned from the Datums tab', () => {
  const past = rendered({ id: G.activityId('Bijbelkring') + '-2026-11-19' });
  assert.deepEqual(plan({ dated: [past, rendered()] }).prune, [past.id]);
});

// The callback: no approval mail (AGD-05), a failure is mailed (DLV-08) ------------------------------------------------

test('AGD-05 the callback of a dated slide is accepted while it waits for its render, refused otherwise', () => {
  const raw = JSON.stringify({ id: ID, round: 1, ok: true });
  const waiting = rendered({ png: '', since: NOW });
  assert.equal(D.checkCallback({ raw, sig: 'ab', expected: 'ab', row: waiting }).error, '');
  assert.notEqual(D.checkCallback({ raw, sig: 'ab', expected: 'ab', row: rendered() }).error, '');
});

test('AGD-05 a good render stores the PNG; a failed one keeps no PNG and says why', () => {
  const waiting = rendered({ png: '', since: NOW });
  const ok = G.afterDatedCallback(waiting, { ok: true }, 'png-2');
  assert.equal(ok.png, 'png-2');
  assert.equal(ok.since, '');
  assert.equal(ok.reason, '');
  const bad = G.afterDatedCallback(waiting, { ok: false, reason: 'does not fit' }, '');
  assert.equal(bad.png, '');
  assert.equal(bad.since, '');
  assert.match(bad.reason, /does not fit/);
});

test('AGD-05 the dated callback stores without any approval mail and asks for a loop composition', () => {
  const c = fnBody('datedCallback_');
  assert.doesNotMatch(c, /approvalMail|approvalLinks|makeToken/);
  assert.match(c, /afterDatedCallback\(/);
  assert.match(c, /LOOP_PENDING/);
  assert.match(fnBody('doPost'), /datedCallback_\(/);
});

test('DLV-08 a failed dated render mails the team with the date and the reason', () => {
  const m = G.datedTeamMail([{ key: rendered().key, reason: 'render: does not fit' }]);
  assert.match(m.subject, /Bijbelkring/);
  assert.match(m.body, /woensdag 25 november, 19\.30 uur/);
  assert.match(m.body, /does not fit/);
  assert.match(m.body, /Vast\/Agenda/, 'tells the team what it can do');
  const two = G.datedTeamMail([{ key: rendered().key, reason: 'a' }, { key: rendered().key, reason: 'b' }]);
  assert.match(two.body, /a[\s\S]*b/, 'one mail for the night');
  assert.match(fnBody('datedCallback_'), /datedTeamMail\(/);
});

test('DLV-08 the night run mails the team on a failed dispatch and on a render without answer', () => {
  const n = fnBody('datedSlides_');
  assert.match(n, /datedTeamMail\(/);
  assert.match(n, /NO_RENDER_REASON/);
  assert.match(n, /afterDatedDispatch\(/);
});

test('AGD-05 the night run makes the dated slides after the activities and before the loop', () => {
  const c = fnBody('composeLoop');
  const i = (s) => c.indexOf(s);
  assert.ok(i('activities_()') >= 0 && i('activities_()') < i('datedSlides_()') && i('datedSlides_()') < i('composeLoop_()'), c);
});

test('DLV-09 a pending composition runs on the minute trigger', () => {
  assert.match(fnBody('retryDispatches'), /LOOP_PENDING/);
  assert.match(fnBody('retryDispatches'), /composeLoop_\(\)/);
});

// DLV-09: the loop takes the dated slides up to their date ------------------------------------------------------------

const loopItems = (over) => G.datedLoopItems({ dated: [rendered()], activities: [act('Bijbelkring')],
  occurrences: [occ()], files: [], today: TODAY, ...over });

test('DLV-09 a rendered date is in the loop up to and including its date', () => {
  assert.deepEqual(loopItems(), [{ sourceId: 'png-1', name: ID + '.png', key: 'png-1' }]);
  assert.equal(loopItems({ today: '2026-11-25' }).length, 1, 'on the day itself');
  assert.equal(loopItems({ today: '2026-11-26' }).length, 0, 'the day after');
});

test('DLV-09 a cancelled or deleted date is not in the loop', () => {
  assert.equal(loopItems({ occurrences: [occ({ cancelled: true })] }).length, 0);
  assert.equal(loopItems({ occurrences: [] }).length, 0);
});

test('DLV-09 an activity in niet tonen, or one with its own PNG, has no dated slide in the loop', () => {
  assert.equal(loopItems({ activities: [act('Bijbelkring', { state: G.ACT.HIDE })] }).length, 0);
  assert.equal(loopItems({ files: [png('Bijbelkring.png')] }).length, 0);
});

test('DLV-09 a date whose time moved is out of the loop until it is rendered again', () => {
  assert.equal(loopItems({ occurrences: [occ({ start: '2026-11-25T19:00:00.000Z' })] }).length, 0);
  assert.equal(loopItems({ dated: [rendered({ png: '' })] }).length, 0, 'not rendered yet');
});

test('DLV-09 loopPlan adds the dated slides and removes them when they leave', () => {
  const dated = loopItems();
  const p = D.loopPlan({ fixed: [], rotating: [], requests: [], current: [], today: TODAY, dated });
  assert.deepEqual(p.add, dated);
  const current = [{ id: 'loop-1', key: 'png-1' }];
  assert.deepEqual(D.loopPlan({ fixed: [], rotating: [], requests: [], current, today: TODAY, dated }).add, []);
  assert.deepEqual(D.loopPlan({ fixed: [], rotating: [], requests: [], current, today: TODAY }).remove, ['loop-1']);
});

test('DLV-09 the loop composition reads the Datums tab', () => {
  assert.match(fnBody('composeLoop_'), /datedLoopItems\(/);
});
