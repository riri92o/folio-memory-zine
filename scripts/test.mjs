import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import 'fake-indexeddb/auto';
const directory = await mkdtemp(path.join(tmpdir(), 'folio-tests-'));
try {
  for (const name of ['model', 'layout', 'storage']) {
    const input = await readFile(
      new URL(`../lib/folio/${name}.ts`, import.meta.url),
      'utf8',
    );
    const compiled = ts
      .transpileModule(input, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replaceAll("'./model'", "'./model.mjs'");
    await writeFile(path.join(directory, name + '.mjs'), compiled);
  }
  const model = await import(pathToFileURL(path.join(directory, 'model.mjs')));
  const { generateLayout } = await import(
    pathToFileURL(path.join(directory, 'layout.mjs'))
  );
  const storage = await import(
    pathToFileURL(path.join(directory, 'storage.mjs'))
  );
  let tested = 0;
  for (const theme of Object.keys(model.themes))
    for (let count = 1; count <= 5; count++)
      for (let seed = 1; seed <= 40; seed++) {
        const page = model.newPage('test', seed % 2, model.themes[theme].paper);
        page.elements = Array.from({ length: count }, (_, i) => ({
          ...model.newElement('photo'),
          aspect: [0.45, 0.66, 1, 1.5, 2.4][i],
        }));
        const layout = generateLayout(page, theme, seed);
        const photos = layout.elements.filter((e) => e.type === 'photo');
        assert.equal(photos.length, count);
        for (const photo of photos) {
          assert.ok(photo.width > 0 && photo.height > 0);
          assert.ok(photo.x >= 0 && photo.y >= 0);
          assert.ok(
            photo.x + photo.width <= 100.01 && photo.y + photo.height <= 100.01,
          );
          assert.ok(
            Math.abs(photo.width / photo.height / 1.414 - photo.aspect) < 0.001,
            'source aspect ratio preserved',
          );
        }
        const second = generateLayout(page, theme, seed).elements.filter(
          (e) => e.type === 'photo',
        );
        assert.deepEqual(photos, second, 'seed is deterministic');
        const varied = generateLayout(page, theme, seed + 123).elements.filter(
          (e) => e.type === 'photo',
        );
        assert.notDeepEqual(
          photos,
          varied,
          'another design has a different composition',
        );
        tested++;
      }
  const locked = model.newPage('lock', 1, 'white');
  const lockedPhoto = {
    ...model.newElement('photo'),
    locked: true,
    aspect: 1.5,
    x: 12,
    y: 12,
  };
  locked.elements = [lockedPhoto];
  assert.deepEqual(
    generateLayout(locked, 'scrap', 3).elements.find((e) => e.type === 'photo'),
    lockedPhoto,
    'automatic generation respects locks',
  );
  const folio = model.newFolio(
    '保存テスト',
    '思い出',
    'book',
    'scrap',
    'cream',
  );
  const photo = {
    id: model.uid(),
    blob: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
    thumbnail: new Blob(['thumbnail']),
    width: 1200,
    height: 800,
  };
  folio.pages[1].elements = [
    { ...model.newElement('photo'), imageRef: photo.id, aspect: 1.5 },
  ];
  folio.pages[1].doodles = [
    {
      id: model.uid(),
      tool: 'pen',
      color: '#ff0000',
      width: 4,
      points: [
        [10, 12],
        [30, 60],
      ],
    },
  ];
  await storage.saveFolio(folio, [photo]);
  const loaded = await storage.loadFolios();
  assert.deepEqual(
    loaded[0],
    folio,
    'round trip preserves every page and doodle',
  );
  const blobUrl = await storage.imageUrl(photo.id);
  assert.equal(
    await (await fetch(blobUrl)).text(),
    'photo-bytes',
    'photo is saved as Blob',
  );
  const broken = { ...folio, title: 'must not commit' };
  await assert.rejects(() =>
    storage.saveFolio(broken, [{ blob: new Blob(['bad']) }]),
  );
  assert.equal(
    (await storage.loadFolios())[0].title,
    folio.title,
    'failed writes roll back metadata',
  );
  const other = model.newFolio('共有参照', '', 'binder', 'minimal', 'white');
  other.pages[1].elements = [
    { ...model.newElement('photo'), imageRef: photo.id },
  ];
  await storage.saveFolio(other);
  await storage.deleteFolio(folio);
  storage.releaseImages();
  assert.ok(
    await storage.imageUrl(photo.id),
    'image referenced by another book survives deletion',
  );
  const shorter = model.normalize({ ...other, pages: other.pages.slice(0, 1) });
  await storage.saveFolio(shorter);
  assert.equal(
    (await storage.loadFolios())[0].pages.length,
    1,
    'removed pages do not reappear',
  );
  await storage.deleteFolio(shorter);
  storage.releaseImages();
  assert.equal((await storage.loadFolios()).length, 0);
  assert.equal(
    await storage.imageUrl(photo.id),
    '',
    'unreferenced image is removed',
  );
  console.log(
    `PASS: ${tested} layouts across 8 themes; deterministic seeds, variation, bounds, aspect ratios, locks; IndexedDB Blob/doodle round trip, atomic rollback, page deletion and shared-image cleanup.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
