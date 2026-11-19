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

if (typeof module !== 'undefined') {
  module.exports = { AGENDA_TAB, AGENDA_COLUMNS, toOccurrence, agendaWindow, weekOccurrences, toAgendaRow,
    fromAgendaRow, agendaMailDue, agendaFailMail };
}
