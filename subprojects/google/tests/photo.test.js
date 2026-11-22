// An activity's own photo (specs/modules/agenda.md AGD-10..13, IDEA-14; deliver.md DLV-14): a photo in
// Vast/Agenda/Foto's/ goes beside the text of the first slide and of every date. Run:
// node --test subprojects/google/tests/*.test.js. The Google half is checked by tests/manual/agenda.md, step 19 onwards.
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

const TODAY = '2026-11-20';
const NOW = new Date('2026-11-20T02:00:00Z');
const SLIDE = JSON.stringify({ title: 'Bijbelkring', line: 'Iedereen welkom' });
const occ = (over) => ({ seriesId: 's1', title: 'Bijbelkring', description: 'We lezen Marcus.', start: '2026-11-25T18:30:00.000Z',
  end: '2026-11-25T20:00:00.000Z', location: 'Zaal 2', cancelled: false, ...over });
const act = (title, over) => ({ id: G.activityId(title), title, state: G.ACT.SHOW, slide: SLIDE, round: 1, token: '', png: '',
  change: '', since: '', reason: '', ...over });
const png = (name, id = 'f-' + name) => ({ id, name, updated: '2026-11-01T10:00:00.000Z' });
const photo = (name, over) => ({ id: 'p-' + name, name, size: 2e6, updated: '2026-11-01T10:00:00.000Z', ...over });
const ID = G.activityId('Bijbelkring') + '-2026-11-25';
const plan = (over) => G.datedPlan({ activities: [act('Bijbelkring')], occurrences: [occ()], files: [], photos: [],
  dated: [], today: TODAY, now: NOW, ...over });
const rendered = (over) => {
  const item = plan(over).dispatch[0];
  return { id: item.id, key: item.key, png: 'png-1', since: '', reason: '', round: 1 };
};
const firstSlide = (over) => G.activitiesToDispatch({ activities: [act('Bijbelkring', { state: G.ACT.NEW, slide: '' })],
  occurrences: [occ()], files: [], photos: [], today: TODAY, now: NOW, ...over });

// AGD-10: which file is an activity's photo --------------------------------------------------------------------------

test('AGD-10 the photo is the file named after the title, trimmed and case ignored, with jpg, png, webp or heic', () => {
  for (const name of ['Bijbelkring.jpg', 'bijbelkring.PNG', 'BIJBELKRING.webp', ' Bijbelkring .heic']) {
    assert.equal(G.activityPhoto([photo(name)], 'Bijbelkring ').id, 'p-' + name, name);
  }
});

test('AGD-10 another title, another extension or no extension is no photo', () => {
  for (const name of ['Bijbelkring.gif', 'Bijbelkring.pdf', 'Bijbelkring', 'Bijbelkring 2.jpg', 'Jeugd.jpg']) {
    assert.equal(G.activityPhoto([photo(name)], 'Bijbelkring'), null, name);
  }
});

test('AGD-10 a photo over 10 MB is no photo (as INT-08)', () => {
  assert.equal(G.activityPhoto([photo('Bijbelkring.jpg', { size: 10 * 1024 * 1024 + 1 })], 'Bijbelkring'), null);
  assert.ok(G.activityPhoto([photo('Bijbelkring.jpg', { size: 10 * 1024 * 1024 })], 'Bijbelkring'));
});

test('AGD-10 of two photos for one title the newest counts', () => {
  const p = G.activityPhoto([photo('Bijbelkring.jpg'), photo('Bijbelkring.png', { updated: '2026-11-10T10:00:00.000Z' })],
    'Bijbelkring');
  assert.equal(p.id, 'p-Bijbelkring.png');
});

test('AGD-10 the photos live in the subfolder Foto\'s of Vast/Agenda', () => {
  assert.equal(G.PHOTOS_FOLDER, "Foto's");
  const body = fnBody('agendaPhotos_');
  assert.match(body, /PHOTOS_FOLDER/);
  assert.match(body, /getSize\(\)/);
  assert.match(body, /getLastUpdated\(\)/);
});

test('AGD-10 a finished slide in Vast/Agenda wins over a photo: no first slide and no dated slide', () => {
  const photos = [photo('Bijbelkring.jpg')];
  assert.deepEqual(firstSlide({ files: [png('Bijbelkring.png')], photos }), []);
  assert.deepEqual(plan({ files: [png('Bijbelkring.png')], photos }).dispatch, []);
});

// AGD-11: the first slide ------------------------------------------------------------------------------------------

test('AGD-11 a new activity with a photo is dispatched with image true; without one, image false', () => {
  const [withPhoto] = firstSlide({ photos: [photo('Bijbelkring.jpg')] });
  assert.equal(G.activityDispatch(withPhoto.activity, withPhoto.occurrence, withPhoto.photo).client_payload.image, true);
  const [without] = firstSlide();
  assert.equal(G.activityDispatch(without.activity, without.occurrence, without.photo).client_payload.image, false);
});

test('AGD-11 the night run reads the photos and passes them to the first slide', () => {
  const body = fnBody('activities_');
  assert.match(body, /photos: agendaPhotos_\(\)/);
  assert.match(fnBody('dispatchActivity_'), /activityDispatch\(a, occ, photo\)/);
});

test('AGD-11 the image link serves the activity photo for an activity id (DLV-14)', () => {
  const acts = [act('Bijbelkring'), act('Jeugd')];
  const photos = [photo('Jeugd.jpg'), photo('Bijbelkring.heic')];
  assert.equal(G.activityPhotoFor(G.activityId('Bijbelkring'), acts, photos).id, 'p-Bijbelkring.heic');
  assert.equal(G.activityPhotoFor(G.activityId('Bijbelkring'), acts, []), null);
  assert.equal(G.activityPhotoFor('A00000000', acts, photos), null, 'an unknown activity');
  const get = fnBody('doGet');
  assert.match(get, /activityPhotoFor\(/);
  assert.match(get, /agendaPhotos_\(\)/);
});

// AGD-12: every date -------------------------------------------------------------------------------------------------

test('AGD-12 every date of an activity in tonen with a photo is dispatched with image true, still kind occurrence', () => {
  const item = plan({ photos: [photo('Bijbelkring.jpg')] }).dispatch[0];
  const p = G.datedDispatch(item).client_payload;
  assert.equal(p.image, true);
  assert.equal(p.kind, 'occurrence');
  assert.equal(p.id, ID);
  assert.deepEqual(Object.keys(p.slide).sort(), ['line', 'title', 'when', 'where'], 'the photo is not in the slide');
  assert.equal(G.datedDispatch(plan().dispatch[0]).client_payload.image, false);
});

test('AGD-12 the night run and the loop pass the photos to the dated slides', () => {
  assert.match(fnBody('datedSlides_'), /photos: agendaPhotos_\(\)/);
  assert.match(fnBody('composeLoop_'), /datedLoopItems\(\{[^}]*photos/);
});

test('AGD-12 a rendered date with a photo stays in the loop', () => {
  const photos = [photo('Bijbelkring.jpg')];
  const items = G.datedLoopItems({ dated: [rendered({ photos })], activities: [act('Bijbelkring')], occurrences: [occ()],
    files: [], photos, today: TODAY });
  assert.equal(items.length, 1);
});

// AGD-13: a replaced or removed photo --------------------------------------------------------------------------------

test('AGD-13 a date without a photo keeps the key of VS4-03, so nothing renders again after the deploy', () => {
  const item = plan().dispatch[0];
  assert.equal(item.key, JSON.stringify(item.slide));
});

test('AGD-13 an unchanged photo renders nothing again', () => {
  const photos = [photo('Bijbelkring.jpg')];
  assert.deepEqual(plan({ photos, dated: [rendered({ photos })] }).dispatch, []);
});

test('AGD-13 a new photo, a replaced photo (newer file or new upload) or a removed photo renders the date again', () => {
  const old = [photo('Bijbelkring.jpg')];
  const cases = {
    added: [[], old],
    newer: [old, [photo('Bijbelkring.jpg', { updated: '2026-11-19T10:00:00.000Z' })]],
    upload: [old, [photo('Bijbelkring.jpg', { id: 'p-new' })]],
    removed: [old, []],
  };
  for (const [name, [before, after]] of Object.entries(cases)) {
    const d = plan({ photos: after, dated: [rendered({ photos: before })] }).dispatch;
    assert.equal(d.length, 1, name);
    assert.equal(G.datedDispatch(d[0]).client_payload.image, after.length > 0, name);
  }
});

test('AGD-13 a replaced photo keeps the state and the approved text, and mails nobody', () => {
  const a = act('Bijbelkring');
  const p = plan({ activities: [a], photos: [photo('Bijbelkring.jpg', { id: 'p-new' })],
    dated: [rendered({ photos: [photo('Bijbelkring.jpg')] })] });
  assert.equal(p.dispatch[0].retry, false, 'a retry is what mails the team');
  assert.deepEqual(p.dispatch[0].slide, plan().dispatch[0].slide);
  assert.deepEqual(a, act('Bijbelkring'));
});

test('AGD-13 the old rendered date leaves the loop once its photo changed', () => {
  const items = G.datedLoopItems({ dated: [rendered({ photos: [photo('Bijbelkring.jpg')] })], activities: [act('Bijbelkring')],
    occurrences: [occ()], files: [], photos: [], today: TODAY });
  assert.deepEqual(items, []);
});

test('AGD-13 an activity in te keuren keeps the first slide it was sent with, photo or not', () => {
  const sent = act('Bijbelkring', { state: G.ACT.TO_APPROVE, since: new Date('2026-11-01') });
  assert.deepEqual(firstSlide({ activities: [sent], photos: [photo('Bijbelkring.jpg', { id: 'p-new' })] }), []);
});
