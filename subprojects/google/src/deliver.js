// Deliver (specs/modules/deliver.md): the pure half of the callback, mails, pages and the image link.
// Apps Script shares one global scope across files in unknown order: names here carry no clash and STATE is read lazily.
const TO_APPROVE_FOLDER = 'Te keuren';
const LIBRARY_FOLDER = 'Bibliotheek';
const ALLOWLIST_TAB = 'Toegestaan';
const LOOP_FOLDER = 'Loop';
const FIXED_FOLDER = 'Vast';
const ROTATING_FOLDER = 'Wisselend';
const ARCHIVE_FOLDER = 'Archief';
const LOOP_TEMP_FOLDER = 'Loop (opbouw)';

function dlvState_() { return typeof STATE !== 'undefined' ? STATE : require('./intake.js').STATE; }

const hex = (bytes) => Array.from(bytes, (b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');

function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a === '' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Reasons never hold request data.
function checkCallback({ raw, sig, expected, row }) {
  const no = (error) => ({ error, body: null });
  if (!sameHex(sig, expected)) return no('handtekening klopt niet');
  let body;
  try { body = JSON.parse(raw); } catch (e) { return no('geen geldige JSON'); }
  if (!body || typeof body !== 'object') return no('geen geldige JSON');
  if (!row) return no('onbekende aanvraag');
  const S = dlvState_();
  if (![S.SENT, S.RETRY].includes(row.state)) return no('aanvraag wacht niet op een antwoord');
  if (Number(body.round) !== Number(row.round)) return no('andere ronde');
  return { error: '', body };
}

const pngName = (id) => `${id}.png`;

function afterCallback(row, body, token, pngId, now) {
  const S = dlvState_();
  if (body.ok) return { ...row, state: S.TO_APPROVE, token, png: pngId, reason: '', since: now };
  return { ...row, state: S.MANUAL, token: '', reason: ('render: ' + (body.reason || '')).slice(0, 200) };
}

function afterError(row, reason) { return { ...row, state: dlvState_().MANUAL, reason, token: '' }; }

function makeToken(bytes) {
  if (bytes.length < 16) throw new Error('too few bytes for a token');
  return hex(Array.from(bytes).slice(0, 16));
}

function approvalLinks(base, id, token) {
  const u = (a) => `${base}?a=${a}&id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`;
  return { approve: u('goedkeuren'), change: u('aanpassen') };
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function approvalMail(row, slide, links) {
  const btn = (href, text, bg) => `<a href="${esc(href)}" style="display:inline-block;padding:10px 20px;margin-right:8px;` +
    `background:${bg};color:#fff;text-decoration:none;border-radius:6px">${text}</a>`;
  const lines = [slide.title, slide.when, slide.where, slide.line].filter(Boolean);
  return {
    subject: `Slide ${row.id} ter goedkeuring`,
    body: ['Hier is de slide voor je aanvraag.', '', ...lines, '', `Goedkeuren: ${links.approve}`,
      `Aanpassen: ${links.change}`].join('\n'),
    htmlBody: `<p>Hier is de slide voor je aanvraag.</p><p><img src="cid:slide" style="max-width:100%"></p>` +
      `<p>${lines.map(esc).join('<br>')}</p><p>${btn(links.approve, 'Goedkeuren', '#2e7d32')}` +
      `${btn(links.change, 'Aanpassen', '#555')}</p>`,
  };
}

const RECEIVED_MAIL = {
  subject: 'Je aanvraag voor een slide is ontvangen',
  body: 'Je aanvraag is ontvangen en wordt bekeken.\n\nHet kerkteam kijkt mee en laat het je weten.',
};

function recipients(email, allowlistRows2D, teamEmail) {
  const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();
  const me = norm(email);
  const ok = me !== '' && allowlistRows2D.some((r) => norm(r[0]) === me);
  return ok ? { approval: email, received: '' } : { approval: teamEmail, received: me ? email : '' };
}

function approveDecision(row, token) {
  if (!row || typeof token !== 'string' || !sameHex(token, row.token)) return 'bad-token';
  const S = dlvState_();
  if (row.state === S.APPROVED) return 'already';
  return row.state === S.TO_APPROVE ? 'approve' : 'not-open';
}

const PAGES = {
  badToken: 'Deze link klopt niet (meer). Vraag het kerkteam om hulp.',
  already: 'Deze slide is al goedgekeurd.',
  notOpen: 'Deze aanvraag wacht niet op goedkeuring.',
  changeSent: 'Je aanpassing is verstuurd. Je krijgt binnen een paar minuten een nieuw voorbeeld per mail.',
  changeToTeam: 'Het kerkteam maakt je slide verder af en neemt contact met je op.',
  changeEmpty: 'Schrijf eerst wat er anders moet.',
  error: 'Er ging iets mis. Het kerkteam is op de hoogte.',
};

const MAX_CHANGE = 1500;
const NO_RENDER_REASON = 'geen antwoord van de render';

// Never mutates the row. Null: nothing written.
function afterChange(row, text, now) {
  const add = String(text == null ? '' : text).trim().slice(0, MAX_CHANGE);
  if (!add) return null;
  const S = dlvState_();
  const change = row.change ? row.change + '\n\n' + add : add;
  if (row.round >= 3) return { toTeam: true, row: { ...row, change, state: S.MANUAL, reason: '3 rondes aangepast', token: '' } };
  return { toTeam: false, row: { ...row, change, round: row.round + 1, state: S.SENT, token: '', png: '', attempts: 0,
    reason: '', next: '', since: now } };
}

function stalePlan(requests, now) {
  const S = dlvState_();
  const age = (r) => now - (r.since || r.created);
  return {
    expire: requests.filter((r) => r.state === S.TO_APPROVE && age(r) >= 7 * 24 * 3600e3).map((r) => r.id),
    stuck: requests.filter((r) => r.state === S.SENT && age(r) >= 2 * 3600e3).map((r) => r.id),
  };
}

function changeForm(id, token) {
  const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<div id="f" style="font-family:sans-serif;font-size:18px;margin:2em">' +
    '<p><label for="t">Wat moet er anders?</label></p>' +
    '<p><textarea id="t" maxlength="1500" rows="6" style="width:100%;font-size:18px"></textarea></p>' +
    '<p><button id="b" style="font-size:18px;padding:8px 20px">Versturen</button></p></div>' +
    '<script>const id=' + js(id) + ',token=' + js(token) + ';' +
    'const show=(m)=>{const p=document.createElement("p");p.style.cssText="font-family:sans-serif;font-size:18px;margin:2em";' +
    'p.textContent=m;document.getElementById("f").replaceWith(p);};' +
    'document.getElementById("b").onclick=function(){this.disabled=true;' +
    'google.script.run.withSuccessHandler(show).withFailureHandler(()=>show("Er ging iets mis. Het kerkteam is op de hoogte."))' +
    '.submitChange(id,token,document.getElementById("t").value);};</script>';
}

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober',
  'november', 'december'];
function approvedPage(row) {
  const [y, m, d] = String(row.show_until || row.event_date).slice(0, 10).split('-').map(Number);
  return `Je slide staat in de loop tot ${d} ${MONTHS[m - 1]} ${y}.`;
}

const imageMessage = (id, exp) => `${id}.${exp}`;

function checkImageRequest({ id, exp, sig, expected, nowSec }) {
  if (!/^\d+$/.test(String(exp))) return 'ongeldige link';
  const e = Number(exp);
  if (e < nowSec || e > nowSec + 900) return 'link verlopen';
  return sameHex(sig, expected) ? '' : 'handtekening klopt niet';
}

function imageAnswer(fileName, base64) {
  const m = /\.([^.]+)$/.exec(String(fileName));
  const ext = m && { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp', heic: 'heic' }[m[1].toLowerCase()];
  return JSON.stringify(ext ? { ext, base64 } : { error: 'bestandstype' });
}

// The loop (DLV-09/12/13/16).
function isoWeek(day) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); // the Thursday of this ISO week
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function amsterdamDay(v) {
  if (typeof v === 'string') return v.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit',
    day: '2-digit' }).format(v);
}

const isPng_ = (f) => /\.png$/i.test(f.name);

function rotatingPick(files, today) {
  const l = files.filter(isPng_).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return l.length ? l[isoWeek(today) % l.length] : null;
}

function loopPlan({ fixed, rotating, requests, current, today }) {
  const S = dlvState_();
  const wanted = [];
  const archive = [];
  const asItem = (f) => ({ sourceId: f.id, name: f.name, key: `${f.id}:${f.updated}` });
  fixed.filter(isPng_).forEach((f) => wanted.push(asItem(f)));
  const pick = rotatingPick(rotating, today);
  if (pick) wanted.push(asItem(pick));
  for (const r of requests) {
    if (r.state !== S.APPROVED) continue;
    const inDate = amsterdamDay(r.show_until || r.event_date) >= today;
    if (inDate) wanted.push({ sourceId: r.png, name: pngName(r.id), key: r.png });
    else archive.push(r.id);
  }
  const keys = new Set(wanted.map((w) => w.key));
  const have = new Set(current.map((c) => c.key));
  return {
    add: wanted.filter((w) => !have.has(w.key)),
    remove: current.filter((c) => !keys.has(c.key)).map((c) => c.id),
    archive,
  };
}

function loopFailMail(reason) {
  return {
    subject: `Loop niet bijgewerkt: ${reason}`,
    body: 'Het samenstellen van de loop is mislukt. Loop/ staat er zoals hij was, tenzij de reden met "archiveren" ' +
      `begint: dan is de loop wel bijgewerkt en is alleen het archiveren mislukt.\n\nReden: ${reason}`,
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    hex, sameHex, checkCallback, TO_APPROVE_FOLDER, LIBRARY_FOLDER, ALLOWLIST_TAB, pngName, afterCallback, afterError, makeToken,
    approvalLinks, approvalMail, RECEIVED_MAIL, recipients, approveDecision, PAGES, approvedPage, imageMessage,
    checkImageRequest, imageAnswer, LOOP_FOLDER, FIXED_FOLDER, ROTATING_FOLDER, ARCHIVE_FOLDER, LOOP_TEMP_FOLDER,
    isoWeek, amsterdamDay, rotatingPick, loopPlan, loopFailMail,
    MAX_CHANGE, NO_RENDER_REASON, afterChange, stalePlan, changeForm,
  };
}
