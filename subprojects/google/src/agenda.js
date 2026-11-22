// The church agenda as occurrences (AGD-01, 02, 08). Pure: the CalendarApp call lives in main.js readAgenda_.
const AGENDA_TAB = 'Agenda';
const AGENDA_COLUMNS = ['serie', 'titel', 'omschrijving', 'begin', 'einde', 'plaats', 'vervallen'];

const agLit_ = (v) => (typeof v === 'string' && v !== '' ? "'" + v : v);
const agDay_ = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric',
  month: '2-digit', day: '2-digit' }).format(d);
const agAddDays_ = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// CalendarApp returns no cancelled or deleted occurrences, so an absent one simply is not in the read (AGD-07).
function toOccurrence(ev) {
  return {
    seriesId: ev.getId(), title: String(ev.getTitle() || '').trim(), description: ev.getDescription() || '',
    start: ev.getStartTime().toISOString(), end: ev.getEndTime().toISOString(), location: ev.getLocation() || '',
    cancelled: false,
  };
}

function agendaWindow(today) {
  return { from: new Date(agAddDays_(today, -1) + 'T00:00:00Z'), to: new Date(agAddDays_(today, 9) + 'T00:00:00Z') };
}

function weekOccurrences(events, today) {
  const last = agAddDays_(today, 7);
  return events.map(toOccurrence)
    .filter((o) => { const d = agDay_(new Date(o.start)); return d >= today && d <= last; })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

const toAgendaRow = (o) => [o.seriesId, o.title, o.description, o.start, o.end, o.location, o.cancelled].map(agLit_);
const fromAgendaRow = (r) => ({ seriesId: r[0], title: r[1], description: r[2], start: r[3], end: r[4],
  location: r[5], cancelled: r[6] === true });

const agendaMailDue = (lastMailDay, today) => lastMailDay !== today;

function agendaFailMail(reason, lastGoodDay) {
  const keep = lastGoodDay ? `de loop houdt de agenda van de laatste goede lezing (${lastGoodDay})`
    : 'de agenda is nog nooit gelezen';
  return {
    subject: `Agenda niet gelezen: ${reason}`,
    body: `De agenda kon niet worden gelezen; ${keep}.\n`
      + 'Deze mail komt hooguit één keer per dag, tot het lezen weer lukt.\n\nReden: ' + reason + '\n',
  };
}

// Activities (AGD-03, 04, 06, 09): one row per activity title in the tab Activiteiten.
const ACTIVITIES_TAB = 'Activiteiten';
const ACTIVITY_COLUMNS = ['id', 'titel', 'status', 'slide', 'ronde', 'token', 'png', 'aanpassing', 'sinds', 'reden'];
const ACT = { NEW: 'nieuw', TO_APPROVE: 'te keuren', SHOW: 'tonen', HIDE: 'niet tonen' };
const AGENDA_FOLDER = 'Agenda';

const agNorm_ = (t) => String(t == null ? '' : t).trim().toLowerCase();
const isActivity_ = (o) => !agNorm_(o.title).startsWith('samenkomst');

// FNV-1a 32-bit over the normalised title.
function activityId(title) {
  let h = 0x811c9dc5;
  for (const c of agUtf8_(agNorm_(title))) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; }
  return 'A' + h.toString(16).padStart(8, '0');
}
// UTF-8 bytes without Buffer/TextEncoder (both absent or odd in Apps Script).
function agUtf8_(s) {
  const out = [];
  for (const ch of unescape(encodeURIComponent(s))) out.push(ch.charCodeAt(0));
  return out;
}

function newActivities(activities, occurrences) {
  const seen = new Set(activities.map((a) => agNorm_(a.title)));
  const out = [];
  for (const o of occurrences) {
    const n = agNorm_(o.title);
    if (!n || !isActivity_(o) || seen.has(n)) continue;
    seen.add(n);
    out.push({ id: activityId(o.title), title: o.title.trim(), state: ACT.NEW, slide: '', round: 1, token: '', png: '',
      change: '', since: '', reason: '' });
  }
  return out;
}

const toActivityRow = (a) => [a.id, a.title, a.state, a.slide, a.round, a.token, a.png, a.change, a.since, a.reason]
  .map(agLit_);
function fromActivityRow(r) {
  const s = (v) => (v == null ? '' : String(v));
  return { id: s(r[0]), title: s(r[1]), state: agNorm_(r[2]), slide: s(r[3]), round: Number(r[4]) || 1, token: s(r[5]),
    png: s(r[6]), change: s(r[7]), since: r[8] instanceof Date ? r[8] : r[8] ? new Date(r[8]) : '', reason: s(r[9]) };
}

const AG_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const AG_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober',
  'november', 'december'];
function agendaWhen(iso) {
  const d = new Date(iso);
  const [y, m, day] = agDay_(d).split('-').map(Number);
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23' }).format(d).split(':');
  return `${AG_DAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]} ${day} ${AG_MONTHS[m - 1]}, ${Number(t[0])}.${t[1]} uur`;
}

function agendaWhere(loc) {
  const l = String(loc || '').trim();
  if (l.length <= 40) return l;
  const head = l.slice(0, 40);
  const cut = /[ ,]/.test(l[40]) ? head : head.slice(0, Math.max(head.lastIndexOf(' '), 0));
  return cut.replace(/[ ,]+$/, '');
}

// The earliest not cancelled occurrence of this title on or after today.
const agNext_ = (title, occurrences, today) => occurrences
  .filter((o) => agNorm_(o.title) === agNorm_(title) && isActivity_(o) && !o.cancelled && agDay_(new Date(o.start)) >= today)
  .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))[0];
const agOwnPng_ = (files, title) => files.some((f) => /\.png$/i.test(f.name) && agNorm_(f.name.replace(/\.png$/i, '')) === agNorm_(title));

function activitiesToDispatch({ activities, occurrences, files, today, now }) {
  const out = [];
  for (const a of activities) {
    if (a.state !== ACT.NEW || agOwnPng_(files, a.title)) continue;
    if (a.since && now - new Date(a.since) < 20 * 3600e3) continue;
    const occurrence = agNext_(a.title, occurrences, today);
    if (occurrence) out.push({ activity: a, occurrence, retry: Boolean(a.since) });
  }
  return out;
}

function activityDispatch(a, occ) {
  return { event_type: 'slide-request', client_payload: { id: a.id, round: a.round, kind: 'activity',
    text: (occ.title + '\n\n' + occ.description).trim().slice(0, 5000), change: a.change || '',
    event_date: agDay_(new Date(occ.start)), show_until: '', image: false, when: agendaWhen(occ.start),
    where: agendaWhere(occ.location) } };
}

function agendaLoopFiles({ files, activities, occurrences, today }) {
  return files.filter((f) => {
    if (!/\.png$/i.test(f.name)) return false;
    const n = agNorm_(f.name.replace(/\.png$/i, ''));
    if (!agNext_(n, occurrences, today)) return false;
    const a = activities.find((x) => agNorm_(x.title) === n);
    return !a || a.state !== ACT.HIDE;
  });
}

function afterActivityCallback(a, body, token, pngId, now) {
  if (body.ok) {
    const s = body.slide || {};
    return { ...a, state: ACT.TO_APPROVE, token, png: pngId, slide: JSON.stringify({ title: s.title, line: s.line }),
      reason: '', since: now };
  }
  return { ...a, token: '', png: '', reason: ('render: ' + (body.reason || '')).slice(0, 200) };
}
const afterActivityApprove = (a) => ({ ...a, state: ACT.SHOW, token: '', since: '' });
const afterActivityHide = (a) => ({ ...a, state: ACT.HIDE, token: '', png: '', since: '' });

function afterActivityChange(a, text, now) {
  const add = String(text == null ? '' : text).trim().slice(0, 1500);
  if (!add) return null;
  if (a.round >= 3) return 'rounds';
  return { ...a, change: a.change ? a.change + '\n\n' + add : add, round: a.round + 1, state: ACT.NEW, token: '', png: '',
    reason: '', since: now };
}

function activityTeamMail(a, reason) {
  return {
    subject: `Activiteit zonder slide: ${a.title}`,
    body: `Voor de activiteit "${a.title}" is geen slide gelukt.\n\nReden: ${reason}\n\n`
      + 'Wat het team kan doen:\n'
      + `- Zet een eigen PNG in Vast/Agenda/${a.title}.png; die komt dan zelf in de loop.\n`
      + '- Of zet de status op niet tonen in de tab Activiteiten; dan komt er geen slide.\n\n'
      + 'Anders probeert de volgende nachtrun het opnieuw.\n',
  };
}

// Dated slides (AGD-05, 07, 09): every date of an activity in tonen, rendered without Claude, tab Datums.
const DATED_TAB = 'Datums';
const DATED_COLUMNS = ['id', 'sleutel', 'png', 'sinds', 'reden'];
const toDatedRow = (d) => [d.id, d.key, d.png, d.since, d.reason].map(agLit_);
function fromDatedRow(r) {
  const s = (v) => (v == null ? '' : String(v));
  return { id: s(r[0]), key: s(r[1]), png: s(r[2]), since: r[3] instanceof Date ? r[3] : r[3] ? new Date(r[3]) : '',
    reason: s(r[4]), round: 1 };
}

// The dates that should have a dated slide: id -> { activity, occurrence, slide, key, event_date }.
function datedWanted_({ activities, occurrences, files, today }) {
  const out = new Map();
  const sorted = occurrences.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  for (const o of sorted) {
    const day = agDay_(new Date(o.start));
    if (!isActivity_(o) || o.cancelled || day < today) continue;
    const a = activities.find((x) => agNorm_(x.title) === agNorm_(o.title));
    if (!a || a.state !== ACT.SHOW || agOwnPng_(files, a.title)) continue;
    const id = a.id + '-' + day;
    if (out.has(id)) continue;
    let t = {};
    try { t = JSON.parse(a.slide) || {}; } catch (e) {}
    const slide = { title: String(t.title || ''), when: agendaWhen(o.start), where: agendaWhere(o.location),
      line: String(t.line || '') };
    out.set(id, { id, activity: a, occurrence: o, slide, key: JSON.stringify(slide), event_date: day });
  }
  return out;
}

function datedPlan({ activities, occurrences, files, dated, today, now }) {
  const dispatch = [];
  for (const w of datedWanted_({ activities, occurrences, files, today }).values()) {
    const d = dated.find((x) => x.id === w.id);
    const same = d && d.key === w.key;
    if (same && d.png) continue;
    if (same && d.since && now - new Date(d.since) < 20 * 3600e3) continue;
    dispatch.push({ ...w, retry: Boolean(same && d.since) });
  }
  return { dispatch, prune: dated.filter((d) => d.id.slice(-10) < today).map((d) => d.id) };
}

const datedDispatch = (item) => ({ event_type: 'slide-request', client_payload: { id: item.id, round: 1,
  kind: 'occurrence', event_date: item.event_date, slide: item.slide } });

const afterDatedDispatch = (d, item, why, now) => ({ id: item.id, key: item.key,
  png: d && d.key === item.key ? d.png : '', since: why ? '' : now, reason: why, round: 1 });

function afterDatedCallback(d, body, pngId) {
  if (body.ok) return { ...d, png: pngId, since: '', reason: '' };
  return { ...d, png: '', since: '', reason: ('render: ' + (body.reason || '')).slice(0, 200) };
}

function datedLoopItems({ dated, activities, occurrences, files, today }) {
  const wanted = datedWanted_({ activities, occurrences, files, today });
  return dated.filter((d) => d.png && wanted.has(d.id) && wanted.get(d.id).key === d.key)
    .map((d) => ({ sourceId: d.png, name: d.id + '.png', key: d.png }));
}

function datedTeamMail(items) {
  const parse = (k) => { try { return JSON.parse(k) || {}; } catch (e) { return {}; } };
  const lines = items.map((i) => { const s = parse(i.key);
    return `- ${s.title || '(titel onbekend)'}, ${s.when || 'datum onbekend'}\n  Reden: ${i.reason}`; });
  const first = parse(items[0].key).title || 'onbekend';
  return {
    subject: items.length > 1 ? `Datums zonder slide: ${items.length} stuks` : `Datum zonder slide: ${first}`,
    body: 'Voor deze datums is geen slide gelukt:\n\n' + lines.join('\n') + '\n\nWat het team kan doen:\n'
      + '- Zet een eigen PNG in Vast/Agenda/<titel>.png; die komt dan zelf in de loop.\n'
      + '- Of zet de activiteit op niet tonen in de tab Activiteiten; dan komt er geen slide.\n\n'
      + 'Anders probeert de volgende nachtrun het opnieuw.\n',
  };
}

if (typeof module !== 'undefined') {
  module.exports = { AGENDA_TAB, AGENDA_COLUMNS, toOccurrence, agendaWindow, weekOccurrences, toAgendaRow,
    fromAgendaRow, agendaMailDue, agendaFailMail, ACTIVITIES_TAB, ACTIVITY_COLUMNS, ACT, AGENDA_FOLDER, activityId,
    newActivities, toActivityRow, fromActivityRow, agendaWhen, agendaWhere, activitiesToDispatch, activityDispatch,
    agendaLoopFiles, afterActivityCallback, afterActivityApprove, afterActivityHide, afterActivityChange,
    activityTeamMail, DATED_TAB, DATED_COLUMNS, toDatedRow, fromDatedRow, datedPlan, datedDispatch, afterDatedDispatch,
    afterDatedCallback, datedLoopItems, datedTeamMail };
}
