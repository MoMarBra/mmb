import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root = resolve(process.argv[2] || '.');
for (const app of ['gta', 'weltreise']) {
  const html = readFileSync(`${root}/${app}/index.html`, 'utf8');
  const manifest = JSON.parse(readFileSync(`${root}/${app}/manifest.webmanifest`, 'utf8'));
  for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], `/${app}/`);
  assert.equal(manifest.display, 'standalone');
  assert.match(html, new RegExp(`apple-mobile-web-app-title" content="${manifest.short_name}"`));
  assert.match(html, new RegExp(`rel="manifest" href="/${app}/manifest.webmanifest\\?v=20261026"`));
  const links = [...html.matchAll(/<link\s[^>]*>/g)].map(m => m[0]).filter(s => /rel="(?:icon|apple-touch-icon)"/.test(s));
  assert.equal(links.length, 4);
  for (const link of links) {
    const href = link.match(/href="([^"]+)"/)[1];
    assert.ok(href.startsWith(`/${app}/icons/`));
    assert.ok(readFileSync(`${root}${href}`).length > 0);
  }
  const touch = links.find(s => s.includes('apple-touch-icon'));
  assert.ok(touch.includes('sizes="180x180"'));
  const pngs = [{src: touch.match(/href="([^"]+)"/)[1], sizes: '180x180'}, ...manifest.icons];
  for (const {src, sizes, type} of pngs) {
    assert.ok(src.startsWith(`/${app}/icons/`));
    if (type) assert.equal(type, 'image/png');
    const bytes = readFileSync(`${root}${src}`);
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, sizes);
  }
  assert.deepEqual(manifest.icons.map(i => i.sizes), ['192x192', '512x512']);
  console.log(`${app}: scoped favicon, Apple touch icon, title, manifest and PNG dimensions passed`);
}
