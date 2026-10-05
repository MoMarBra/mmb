import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css', import.meta.url),'utf8');

test('requested title, world-trip heading and 126 travel days precede countdown and map',()=>{
  assert.match(html,/<header class="topbar shell">[\s\S]*?Weltreise<span class="wordmark-year"> 2026<\/span>/);
  assert.match(html,/<section class="hero compact-hero" aria-labelledby="hero-title">/);
  assert.match(html,/AIDAsol · 126 Tage/);
  assert.match(html,/<h1 id="hero-title">Einmal um<br><span>die Welt\.<\/span><\/h1>/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.ok(html.indexOf('id="hero-title"')<html.indexOf('class="countdown-card"'));
  assert.ok(html.indexOf('class="countdown-card"')<html.indexOf('class="map-card"'));
  assert.doesNotMatch(html,/class="hero-sub"|class="top-link"|DEM HORIZONT ENTGEGEN/);
});

test('mobile viewport and compact spacing remain, with current versioned stylesheet',()=>{
  assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(css,/\.hero\.compact-hero \{ padding:20px 0 18px; \}/);
  assert.match(css,/\.compact-hero \.countdown-card \{ margin:0 auto; \}/);
  const version=createHash('sha256').update(css).digest('hex').slice(0,12);
  assert.ok(html.includes(`./style.css?v=${version}`));
});
