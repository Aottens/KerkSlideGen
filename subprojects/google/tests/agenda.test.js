// The agenda (specs/modules/agenda.md, AGD-01, 02, 08): occurrences from the church's Google Agenda, the week window,
// the last good read and the once-a-day failure mail. Run: node --test subprojects/google/tests/*.test.js.
// The CalendarApp call itself is checked by tests/manual/agenda.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const G = require('../src/agenda.js');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const fnBody = (name) => {
  const start = MAIN.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `main.js has ${name}`);
  const next = MAIN.indexOf('\nfunction ', start + 1);
  return MAIN.slice(start, next < 0 ? undefined : next);
};

// A CalendarEvent look-alike: only the getters the adapter may use.
const ev = (o) => ({
  getId: () => o.id,
  getTitle: () => o.title,
  getDescription: () => o.description,
  getStartTime: () => new Date(o.start),
  getEndTime: () => new Date(o.end),
  getLocation: () => o.location,
});
const E = (over) => ev({ id: 's1@google.com', title: 'Bijbelkring', description: 'Hoofdstuk 3', location: 'Zaal 2',
  start: '2026-11-25T18:30:00Z', end: '2026-11-25T20:00:00Z', ...over });

// AGD-01: the adapter -------------------------------------------------------------------------------------------------

test('AGD-01 an event becomes an occurrence with exactly the spec fields', () => {
  const o = G.toOccurrence(E());
  assert.deepEqual(o, {
    seriesId: 's1@google.com', title: 'Bijbelkring', description: 'Hoofdstuk 3',
    start: '2026-11-25T18:30:00.000Z', end: '2026-11-25T20:00:00.000Z', location: 'Zaal 2', cancelled: false,
  });
});

test('AGD-01 missing description and location become empty strings, title is trimmed', () => {
  const o = G.toOccurrence(E({ title: '  Jeugdclub ', description: null, location: undefined }));
  assert.equal(o.title, 'Jeugdclub');
  assert.equal(o.description, '');
  assert.equal(o.location, '');
});

test('AGD-01 occurrences of one recurring series share the series id', () => {
  const week = G.weekOccurrences([
    E({ start: '2026-11-20T18:30:00Z', end: '2026-11-20T20:00:00Z' }),
    E({ start: '2026-11-25T18:30:00Z', end: '2026-11-25T20:00:00Z' }),
  ], '2026-11-19');
  assert.equal(week.length, 2);
  assert.equal(week[0].seriesId, week[1].seriesId);
});

test('AGD-01 an occurrence survives the round trip through the Agenda tab, as literal text', () => {
  const o = G.toOccurrence(E({ title: '=HYPERLINK("x")', description: '2026-12-01' }));
  const row = G.toAgendaRow(o);
  assert.equal(row.length, G.AGENDA_COLUMNS.length);
  assert.ok(row.filter((v) => typeof v === 'string' && v !== '').every((v) => v.startsWith("'")), 'no formula, no date');
  const back = G.fromAgendaRow(row.map((v) => (typeof v === 'string' ? v.replace(/^'/, '') : v)));
  assert.deepEqual(back, o);
});

test('AGD-01 the calendar id is a script property, never in the repo', () => {
  const src = path.join(__dirname, '..', 'src');
  const all = fs.readdirSync(src).map((f) => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
  assert.doesNotMatch(all, /@group\.calendar\.google\.com/);
  assert.match(all, /getProperty\('AGENDA_CALENDAR_ID'\)/);
  assert.match(all, /CalendarApp\.getCalendarById\(/);
  const outside = fs.readdirSync(src).filter((f) => f !== 'main.js' && f !== 'agenda.js')
    .map((f) => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
  assert.doesNotMatch(outside, /CalendarApp/, 'only the adapter knows the agenda');
});

test('AGD-01 the script subscribes the account to the agenda itself when it is not subscribed yet', () => {
  const r = fnBody('readAgenda_');
  assert.match(r, /CalendarApp\.getCalendarById\(id\) \|\| CalendarApp\.subscribeToCalendar\(id\)/);
});

// AGD-02: the window --------------------------------------------------------------------------------------------------

test('AGD-02 the query window covers today through today + 7 in Amsterdam, with margin', () => {
  const w = G.agendaWindow('2026-11-19');
  assert.ok(w.from <= new Date('2026-11-18T23:00:00Z'), 'Amsterdam midnight of today is inside');
  assert.ok(w.to >= new Date('2026-11-26T23:00:00Z'), 'the end of day 7 in Amsterdam is inside');
});

test('AGD-02 the week is the occurrences starting today up to and including 7 days later, by Amsterdam day', () => {
  const at = (start) => E({ id: start, start, end: start });
  const week = G.weekOccurrences([
    at('2026-11-18T22:59:00Z'), // 23.59 on the 18th in Amsterdam: yesterday
    at('2026-11-18T23:00:00Z'), // 00.00 on the 19th: today
    at('2026-11-26T22:59:00Z'), // 23.59 on the 26th: day 7
    at('2026-11-26T23:00:00Z'), // 00.00 on the 27th: day 8
  ], '2026-11-19');
  assert.deepEqual(week.map((o) => o.seriesId), ['2026-11-18T23:00:00Z', '2026-11-26T22:59:00Z']);
});

test('AGD-02 the week is sorted by start', () => {
  const week = G.weekOccurrences([
    E({ id: 'b', start: '2026-11-22T09:00:00Z' }), E({ id: 'a', start: '2026-11-20T09:00:00Z' }),
  ], '2026-11-19');
  assert.deepEqual(week.map((o) => o.seriesId), ['a', 'b']);
});

test('AGD-02 the night run reads the agenda, and only the night run', () => {
  assert.match(fnBody('composeLoop'), /readAgenda_\(\)/);
  assert.doesNotMatch(fnBody('composeLoop_'), /readAgenda_/, 'not after every approval');
  assert.doesNotMatch(fnBody('doGet'), /readAgenda_/);
});

test('AGD-02 a good read replaces the Agenda tab and remembers its day', () => {
  const r = fnBody('readAgenda_');
  assert.match(r, /AGENDA_TAB/);
  assert.match(r, /setProperty\('AGENDA_READ_DAY'/);
});

// AGD-08: failure -----------------------------------------------------------------------------------------------------

test('AGD-08 the failure mail goes out at most once per day', () => {
  assert.equal(G.agendaMailDue(null, '2026-11-19'), true);
  assert.equal(G.agendaMailDue('', '2026-11-19'), true);
  assert.equal(G.agendaMailDue('2026-11-18', '2026-11-19'), true);
  assert.equal(G.agendaMailDue('2026-11-19', '2026-11-19'), false);
});

test('AGD-08 the failure mail is Dutch and names the error and the last good read', () => {
  const m = G.agendaFailMail('agenda niet gevonden', '2026-11-17');
  assert.match(m.subject, /[Aa]genda/);
  assert.match(m.body, /agenda niet gevonden/);
  assert.match(m.body, /2026-11-17/);
  assert.match(G.agendaFailMail('x', '').body, /nog nooit/);
});

test('AGD-08 a failed read keeps the last good read, mails once a day and never throws', () => {
  const r = fnBody('readAgenda_');
  const write = r.indexOf('setValues(');
  const fail = r.indexOf('catch');
  assert.ok(write > 0 && fail > write, 'the tab is written only after a successful read');
  assert.match(r.slice(fail), /agendaMailDue\(/);
  assert.match(r.slice(fail), /agendaFailMail\(/);
  assert.match(r.slice(fail), /setProperty\('AGENDA_MAIL_DAY'/);
  assert.doesNotMatch(r.slice(fail), /clearContents|deleteRows|setValues/, 'a failure leaves the tab as it was');
  assert.doesNotMatch(r, /Logger\.log|console\./, 'no agenda content in the logs (INT-04)');
});

test('AGD-08 a failed agenda read never stops composeLoop from finishing', () => {
  const night = fnBody('composeLoop');
  // AGD-09 reads the agenda before the loop: readAgenda_ and activities_ never throw, so composeLoop_ still runs.
  assert.ok(night.indexOf('readAgenda_()') < night.indexOf('composeLoop_()'));
  const act = fnBody('activities_');
  assert.ok(act.indexOf('try {') < act.indexOf('activityTab_('), 'activities_ never throws');
  const r = fnBody('readAgenda_');
  const t = r.indexOf('try {');
  assert.ok(t > 0 && t < r.indexOf('CalendarApp') && t < r.indexOf('getProperty('), 'every Google call is inside the try');
});
