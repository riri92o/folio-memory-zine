import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = 'dist/client';
async function list(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await list(p)));
    else if (!p.endsWith('.map') && !p.endsWith('sw.js')) result.push(p);
  }
  return result;
}
const files = await list(root);
if (!files.includes(path.join(root, 'index.html')))
  throw new Error('Static index.html is required for offline output.');
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const version = 'folio-assets-' + hash.digest('hex').slice(0, 12);
const paths = files.map(
  (f) => '/' + path.relative(root, f).replaceAll('\\', '/'),
);
await writeFile(
  path.join(root, 'sw.js'),
  `const CACHE=${JSON.stringify(version)};
const FILES=${JSON.stringify(['/', ...paths])};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('folio-assets-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/index.html')));return;}if(!FILES.includes(url.pathname))return;event.respondWith(caches.match(url.pathname).then(hit=>hit||fetch(request)));});
`,
);
console.log(`Offline cache prepared: ${paths.length} bundled files.`);
