// Intake (specs/modules/intake.md): the pure half. No Google globals here; main.js is the thin Google layer.
const GITHUB_REPO = 'Aottens/KerkSlideGen';
const SHEET_TAB = 'Aanvragen';
const IMAGES_FOLDER = 'Beelden';
const ROOT_FOLDER = 'KerkSlideGen';

const FORM = {
  title: 'Slide aanvragen',
  description: 'Log in met een Google-account, zodat de kerk weet wie de aanvraag doet. ' +
    'Heb je er geen, dan maak je er een met je eigen mailadres.',
  confirmation: 'Je krijgt binnen een paar minuten een voorbeeld per mail.',
  emailCollection: 'VERIFIED',
  items: [
    { key: 'name', type: 'TEXT', title: 'Naam', required: true },
    { key: 'text', type: 'PARAGRAPH_TEXT', title: 'Wat wil je aankondigen? Plak gerust de hele tekst.', required: true },
    { key: 'event_date', type: 'DATE', title: 'Datum van het evenement', required: true },
    { key: 'show_until', type: 'DATE', title: 'Laatste dag op het scherm', help: 'leeg = tot de datum van het evenement', required: false },
    { key: 'image', type: 'FILE_UPLOAD', title: 'Afbeelding',
      help: 'Niet verplicht: een foto (JPG, PNG, WebP of HEIC), maximaal 10 MB.', required: false },
  ],
};

function readAnswers(list) {
  const out = { name: '', text: '', event_date: '', show_until: '', imageFileId: '' };
  const title = (key) => FORM.items.find((i) => i.key === key).title;
  for (const a of list) {
    if (a.type === 'FILE_UPLOAD') {
      const ids = [].concat(a.response || []);
      if (!out.imageFileId && ids.length) out.imageFileId = ids[0];
      continue;
    }
    for (const key of ['name', 'text', 'event_date', 'show_until']) {
      if (a.title === title(key)) out[key] = String(a.response == null ? '' : a.response);
    }
  }
  out.text = out.text.trim();
  return out;
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function makeId(ymd, random, taken) {
  for (;;) {
    let s = '';
    for (let i = 0; i < 3; i++) s += ID_CHARS[Math.floor(random() * 36)];
    const id = 'R' + ymd + '-' + s;
    if (!taken.includes(id)) return id;
  }
}

const STATE = { NEW: 'nieuw', SENT: 'verzonden', RETRY: 'opnieuw', MANUAL: 'handwerk', REFUSED: 'geweigerd',
  TO_APPROVE: 'te keuren', APPROVED: 'goedgekeurd', ARCHIVED: 'gearchiveerd', EXPIRED: 'verlopen' };

const COLUMNS = ['id', 'status', 'ronde', 'aangemaakt', 'naam', 'mail', 'tekst', 'datum', 'tot', 'afbeelding',
  'pogingen', 'volgende poging', 'reden', 'token', 'png', 'aanpassing', 'sinds'];

// A leading apostrophe makes Sheets store literal text: no formula, no date conversion. Sheets does not return it.
const lit = (v) => (typeof v === 'string' && v !== '' ? "'" + v : v);

function toRow(r) {
  return [
    r.id, r.state || STATE.NEW, r.round || 1, r.created, r.name, r.email, r.text, r.event_date, r.show_until,
    r.image === undefined || r.image === null ? '' : r.image, r.attempts || 0, r.next || '', r.reason || '', r.token || '', r.png || '',
    r.change || '', r.since || '',
  ].map(lit);
}

function fromRow(row) {
  const num = (v, d) => (v === '' || v == null ? d : Number(v));
  const date = (v) => (v === '' || v == null || v instanceof Date ? v : new Date(v));
  return {
    id: row[0], state: row[1], round: num(row[2], 1), created: date(row[3]), name: row[4], email: row[5],
    text: row[6], event_date: row[7], show_until: row[8], image: row[9], attempts: num(row[10], 0),
    next: date(row[11]), reason: row[12], token: row[13] == null ? '' : row[13],
    png: row[14] == null ? '' : row[14], change: row[15] == null ? '' : String(row[15]), since: date(row[16]),
  };
}

function buildDispatch(r) {
  return {
    event_type: 'slide-request',
    client_payload: {
      id: r.id, round: r.round, text: r.text, change: r.change || '', event_date: r.event_date,
      show_until: r.show_until, image: Boolean(r.image),
    },
  };
}

const dispatched = (code) => code >= 200 && code < 300;

const MIN_MS = 60 * 1000;
const RETRY_MINUTES = [2, 5, 10];
function nextAttempt(attemptsMade, firstAt) {
  const m = RETRY_MINUTES[attemptsMade - 1];
  return m === undefined ? null : new Date(new Date(firstAt).getTime() + m * MIN_MS);
}
// Retries count from the last change (Aanpassen round), else from the submit.
const retryFrom = (req) => req.since || req.created;

const MAX_TEXT = 5000;
const MAX_PER_HOUR = 5;
function guardReason(text, earlierDates, now) {
  if ([...text].length > MAX_TEXT) return 'tekst langer dan 5000 tekens';
  const recent = earlierDates.filter((d) => now - d < 60 * MIN_MS).length;
  if (recent + 1 > MAX_PER_HOUR) return 'meer dan 5 aanvragen in een uur van hetzelfde adres';
  return '';
}

const earlierFrom = (rows, email) =>
  rows.filter((r) => String(r.email).toLowerCase() === String(email).toLowerCase()).map((r) => r.created);

function teamMail(r, reason, kind) {
  const deliver = kind === 'deliver';
  return {
    subject: deliver ? `Aanvraag ${r.id} moet met de hand: ${reason}` : `Aanvraag ${r.id} is niet doorgestuurd: ${reason}`,
    body: [
      deliver ? `Aanvraag ${r.id} loopt niet vanzelf verder en moet met de hand afgemaakt worden.`
        : `Aanvraag ${r.id} is niet naar GitHub gestuurd en moet met de hand gemaakt worden.`,
      '', `Reden: ${reason}`, `Id: ${r.id}`, `Naam: ${r.name}`, `Mail: ${r.email}`,
      `Datum van het evenement: ${r.event_date}`, `Laatste dag op het scherm: ${r.show_until || '(leeg)'}`,
      '', 'Tekst van de aanvraag:', r.text,
      ...(r.change ? ['', 'Aanpassingen van de aanvrager:', r.change] : []),
    ].join('\n'),
  };
}

function imageExtension(mime, name) {
  const byMime = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic' };
  if (byMime[mime]) return byMime[mime];
  if (mime && mime !== 'application/octet-stream') return null;
  const m = /\.([^.]+)$/.exec(String(name || ''));
  const byExt = { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp', heic: 'heic', heif: 'heic' };
  return (m && byExt[m[1].toLowerCase()]) || null;
}

const imageName = (id, ext) => `${id}.${ext}`;

const FILE_TYPE_MAIL = {
  subject: 'Je aanvraag voor een slide is niet verstuurd',
  body: 'Dit bestandstype kunnen we niet gebruiken, stuur een foto (JPG of PNG).\n\n' +
    'Je aanvraag is niet verstuurd. Vul het formulier opnieuw in met een foto; dat wordt een nieuwe aanvraag.',
};

if (typeof module !== 'undefined') {
  module.exports = {
    GITHUB_REPO, SHEET_TAB, IMAGES_FOLDER, ROOT_FOLDER, FORM, readAnswers, makeId, STATE, COLUMNS, toRow, fromRow,
    buildDispatch, dispatched, RETRY_MINUTES, nextAttempt, retryFrom, MAX_TEXT, MAX_PER_HOUR, guardReason, earlierFrom,
    teamMail, imageExtension, imageName, FILE_TYPE_MAIL,
  };
}
