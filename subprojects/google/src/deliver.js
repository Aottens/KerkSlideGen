// Deliver (specs/modules/deliver.md): the pure half of the callback, mails, pages and the image link.
// Apps Script shares one global scope across files in unknown order: names here carry no clash and STATE is read lazily.
const TO_APPROVE_FOLDER = 'Te keuren';
const LIBRARY_FOLDER = 'Bibliotheek';
const ALLOWLIST_TAB = 'Toegestaan';

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

function afterCallback(row, body, token, pngId) {
  const S = dlvState_();
  if (body.ok) return { ...row, state: S.TO_APPROVE, token, png: pngId, reason: '' };
  return { ...row, state: S.MANUAL, token: '', reason: ('render: ' + (body.reason || '')).slice(0, 200) };
}

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
  changeLater: 'Aanpassen komt binnenkort. Stuur het kerkteam intussen een mail.',
  error: 'Er ging iets mis. Het kerkteam is op de hoogte.',
};

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

if (typeof module !== 'undefined') {
  module.exports = {
    hex, sameHex, checkCallback, TO_APPROVE_FOLDER, LIBRARY_FOLDER, ALLOWLIST_TAB, pngName, afterCallback, makeToken,
    approvalLinks, approvalMail, RECEIVED_MAIL, recipients, approveDecision, PAGES, approvedPage, imageMessage,
    checkImageRequest, imageAnswer,
  };
}
