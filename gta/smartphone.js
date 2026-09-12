import { euro } from './data.js';

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const paths = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  tasks:
    '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6v4H9zM9 12l1 1 2-2m2 1h2M9 17h7"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zm6-2v16m6-14v16"/><circle cx="15" cy="10" r="2"/>',
  bank: '<path d="m3 8 9-5 9 5M4 9h16M5 19h14M3 21h18M6 12v5m6-5v5m6-5v5"/>',
  restaurants: '<path d="M5 3v6c0 3 5 3 5 0V3M7.5 3v18M18 3c-4 3-4 9 0 10V3Zm0 10v8"/>',
  stats: '<path d="M4 20h16M6 16v-4m6 4V7m6 9V3"/>',
  achievements:
    '<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-6-3h4v3h-4z"/>',
  music:
    '<path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="17" rx="3" ry="3"/><ellipse cx="17" cy="15" rx="3" ry="3"/>',
  settings:
    '<path d="m9 3-.6 2.2-2 .9-2-.6-2 3.5 1.6 1.6v2.3L2.5 15l2 3.5 2-.6 2 .9L9 21h4l.6-2.2 2-.9 2 .6 2-3.5-1.5-2.1v-2.3L19.5 9l-2-3.5-2 .6-2-.9L13 3z"/><circle cx="11" cy="12" r="3"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  rain: '<path d="M6 15a5 5 0 1 1 9-6 3.5 3.5 0 0 1 3 6M7 18l-1 3m6-3-1 3m6-3-1 3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
};
const icon = (id) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.tasks}</svg>`;
export const PHONE_APPS = [
  ['mail', 'BBE Mail', 'Posteingang'],
  ['tasks', 'BBE Tasks', 'Projekte'],
  ['map', 'Karte', 'Dein München'],
  ['bank', 'Konto', 'Bankkonto'],
  ['restaurants', 'Essen gehen', 'Restaurants'],
  ['stats', 'Mein Leben', 'Stats & Inventar'],
  ['achievements', 'Erfolge', 'Achievements'],
  ['music', 'ISAR FM', 'Musik'],
  ['settings', 'Einstellungen', 'Einstellungen'],
];
const STATIONS = [
  ['Brienner Lo-Fi', '88 BPM · Rhodes & Kaffeepause', 'brienner', '08:17'],
  ['Isar Afterhours', '108 BPM · Feierabend mit Groove', 'afterhours', '17:30'],
  ['Augusten Drive', '118 BPM · Noch eine Runde München', 'drive', '22:04'],
];
const MIXERS = [
  ['audioMaster', 'Gesamtlautstärke'],
  ['musicVolume', 'Musik'],
  ['audioDialogue', 'Stimmen'],
  ['audioEffects', 'Schritte & Aktionen'],
  ['audioAmbience', 'Umgebung'],
  ['audioUI', 'Menügeräusche'],
];

function home(game) {
  const { sim } = game,
    s = sim.s;
  const next = s.active[0];
  return `<div class="phone-home-scene" aria-hidden="true"><span class="phone-sun"></span><span class="phone-tower first"></span><span class="phone-tower second"></span><span class="phone-roof"></span></div>
    <div class="phone-home-heading"><p>${escapeHTML(sim.weekday)} · Maxvorstadt</p><h1>Dein München.</h1><div class="phone-weather">${icon(s.weather === 'Regen' ? 'rain' : 'sun')}<span>${escapeHTML(s.weather)}</span><span class="phone-clock">${sim.clock}</span></div></div>
    <button class="phone-day-card" data-phone-app="tasks"><span class="phone-card-kicker">BBE · DEIN ARBEITSTAG ${icon('arrow')}</span><strong>${s.courier.active ? 'Der Kunde wartet auf den Koffer.' : next ? escapeHTML(next.title) : 'Bereit für die nächste gute Folie?'}</strong><span>${s.courier.active ? 'Eilauftrag läuft · Uhr im Handy pausiert' : next ? `${s.active.length} offene Projekte · ${escapeHTML(sim.career.name)}` : `${escapeHTML(sim.career.name)} · Aufträge am BBE-PC`}</span></button>
    <nav class="phone-app-grid" aria-label="Smartphone Apps">${PHONE_APPS.map(([id, label, description]) => `<button data-phone-app="${id}" aria-label="${label} · ${description}"><span class="phone-app-icon app-${id}">${icon(id)}${id === 'mail' && s.mail.length ? `<span class="phone-app-badge" aria-label="${s.mail.length} Nachrichten">${s.mail.length > 99 ? '99+' : s.mail.length}</span>` : ''}</span><span>${label}</span></button>`).join('')}</nav>
    <div class="phone-home-note">Feierabend ist auch eine Strategie.</div>`;
}

function mail(game, page) {
  const s = game.sim.s;
  if (page.startsWith('mail/')) {
    const message = s.mail[Number(page.slice(5))];
    return `<article class="phone-message"><div class="phone-sender">${icon('mail')}<div><strong>BBE Handelsberatung</strong><span>${escapeHTML(message.time)}</span></div></div><h2>${escapeHTML(message.title)}</h2><p>${escapeHTML(message.body)}</p><div class="phone-message-signature">BBE Mail<br><span>Gesendet zwischen zwei letzten Änderungen.</span></div></article>`;
  }
  return `<div class="phone-section-lead"><h3>Dein Posteingang</h3><p>${s.mail.length} Nachrichten aus dem Büro.</p></div><div class="phone-mail-list">${s.mail.map((m, i) => `<button data-phone-app="mail/${i}" class="phone-mail-row"><span class="phone-mail-meta"><b>BBE Handelsberatung</b><time>${escapeHTML(m.time)}</time></span><strong>${escapeHTML(m.title)}</strong><span class="phone-mail-preview">${escapeHTML(m.body)}</span></button>`).join('') || '<p class="muted">Noch keine Nachrichten. Genieße den Moment.</p>'}</div>`;
}

function fader(key, name, s) {
  const value = Math.round(s[key] * 100);
  return `<label class="phone-fader"><span>${name}</span><input type="range" data-phone-mix="${key}" aria-label="${name}" min="0" max="100" value="${value}"><output>${value} %</output></label>`;
}

function settings(game) {
  const s = game.sim.s;
  return `<div class="phone-section-lead"><h3>Dein Spiel. Dein Gefühl.</h3><p>Alles Wichtige, ohne Umwege.</p></div>
    <section class="phone-settings-group"><h3>Bild & Ton</h3>
      <div class="phone-setting"><label for="phone-audio-toggle">Spielton</label><button id="phone-audio-toggle" class="phone-switch" role="switch" aria-checked="${game.audio.enabled}">${game.audio.enabled ? 'An' : 'Aus'}</button></div>
      <label class="phone-setting stacked">Grafikqualität<select id="phone-quality"><option value="balanced" ${game.world.lowQuality ? 'selected' : ''}>Flüssiger · mit Schatten</option><option value="high" ${!game.world.lowQuality ? 'selected' : ''}>Hoch · volle Effekte</option></select><small>Die flüssigere Stufe reduziert die Auflösung und zusätzliche Effekte.</small></label>
      ${fader('audioMaster', 'Gesamtlautstärke', s)}
      <details class="phone-details"><summary>Musik, Stimmen & Umgebung</summary><div>${MIXERS.slice(
        1,
      )
        .map(([key, name]) => fader(key, name, s))
        .join('')}</div></details>
      <label class="phone-check"><span>Untertitel mit Sprechernamen</span><input id="phone-subtitles" type="checkbox" ${s.audioSubtitles ? 'checked' : ''}></label>
      <label class="phone-setting stacked">Klangdynamik<select id="phone-audio-range"><option value="full" ${s.audioRange !== 'night' ? 'selected' : ''}>Voller Spielmix</option><option value="night" ${s.audioRange === 'night' ? 'selected' : ''}>Nachtmodus · sanftere Lautstärken</option></select></label>
    </section>
    <section class="phone-settings-group"><h3>Deine Karriere sichern</h3><p>Automatisch alle 20 Sekunden. Dein Spielstand bleibt in diesem Browser.</p><button class="primary" id="phone-save">Jetzt speichern</button><p id="phone-save-status" class="phone-inline-status" role="status" aria-live="polite"></p><button id="phone-more-settings" class="phone-text-link">Spielstand verwalten & weitere Optionen ${icon('arrow')}</button></section>
    <section class="phone-settings-group"><h3>Schnell zur richtigen App</h3><p>P · Startbildschirm<br>M · Karte &nbsp; J · Aufträge &nbsp; Tab · Stats<br>Esc · Handy wegstecken</p></section>`;
}

function music(game) {
  const s = game.sim.s,
    playing = s.music && game.audio.enabled,
    station = game.arcade.music.station,
    track = STATIONS[station];
  return `<div class="phone-record-cover ${track[2]}" aria-hidden="true"><span>ISAR FM / ORIGINALS</span><div class="phone-record"></div><strong>${track[3]}</strong><small>MÜNCHEN HAT SEINEN EIGENEN TAKT.</small></div>
    <div class="phone-now-playing"><span>DEIN GEWÄHLTER SENDER</span><h3 id="phone-track-title">${track[0]}</h3><p>${track[1]}</p></div>
    <button id="phone-music-toggle" class="phone-play-button" aria-label="${playing ? 'Musik pausieren' : 'Musik einschalten'}">${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Musik pausieren' : 'Musik einschalten'}</span></button>
    ${!game.audio.enabled ? '<p class="phone-audio-note">Der Spielton ist aus. Einschalten startet auch den Ton.</p>' : ''}
    <div class="phone-stations">${STATIONS.map(([name, desc], i) => `<button data-phone-station="${i}" aria-pressed="${i === station}"><span class="phone-station-number">0${i + 1}</span><span><strong>${name}</strong><small>${desc}</small></span>${i === station ? '<span class="phone-station-active" aria-hidden="true">●</span>' : icon('play')}</button>`).join('')}</div>
    ${fader('musicVolume', 'Musiklautstärke', s)}
    <label class="phone-check"><span>Musik folgt dem Spiel<small>Büro, Restaurant und Fahrt wählen den passenden Soundtrack.</small></span><input id="phone-music-auto" type="checkbox" ${s.musicAuto ? 'checked' : ''}></label>`;
}

function pageContent(game, page) {
  if (page === 'home') return home(game);
  if (page === 'settings') return settings(game);
  if (page === 'music') return music(game);
  if (page === 'mail' || page.startsWith('mail/')) return mail(game, page);
  return game.phoneContent(page);
}

// App navigation keeps one paused modal and the original opener. Replacing a
// page never leaks music previews or steals focus from a detached old button.
export function showPhone(game, requested = 'home', navigation = 'push') {
  if (game.modal?.locked || game.busy || !game.started) return null;
  let page = requested;
  const known =
    PHONE_APPS.some(([id]) => id === page) ||
    page === 'home' ||
    (/^mail\/\d+$/.test(page) && game.sim.s.mail[Number(page.slice(5))]);
  if (!known) page = 'home';
  if (!game.modal?.phone) {
    game.open('Dein Smartphone', '', {
      pause: true,
      onClose: () => {
        game.arcade.music.preview = false;
        game.smartphone = null;
        document.body.classList.remove('phone-open');
      },
    });
    game.modal.phone = true;
    game.smartphone = { history: [], page: null, scroll: new Map() };
    document.body.classList.add('phone-open');
    document.querySelector('.modal-shade').classList.add('phone-shade');
  }
  const state = game.smartphone;
  const scroller = document.getElementById('phone-content');
  if (state.page && scroller) state.scroll.set(state.page, scroller.scrollTop);
  const previous = state.page;
  if (navigation === 'back') page = state.history.pop() || 'home';
  else if (page === 'home') state.history = [];
  else if (navigation !== 'replace' && previous && previous !== page) state.history.push(previous);
  state.page = page;
  game.arcade.music.preview = page === 'music';
  const app = PHONE_APPS.find(([id]) => id === page.split('/')[0]);
  const title = page === 'home' ? 'Dein Smartphone' : app?.[1] || 'BBE Mail';
  const panel = document.querySelector('#modal-root .panel');
  panel.classList.add('phone-device');
  panel.dataset.phonePage = page;
  panel.innerHTML = `<div class="phone-display">
    <div class="phone-statusbar"><span>${game.sim.clock}</span><span class="phone-camera" aria-hidden="true"></span><span class="phone-status-label">BBE PHONE</span></div>
    <header class="phone-app-header"><button id="phone-back" class="phone-icon-button" aria-label="Zurück" ${page === 'home' ? 'disabled' : ''}>${icon('back')}</button><h2 id="modal-title">${title}</h2><button id="phone-close" class="phone-icon-button" aria-label="Smartphone schließen">${icon('close')}</button></header>
    <div id="phone-content" class="phone-scroll ${page === 'home' ? 'is-home' : ''}" tabindex="-1">${pageContent(game, page)}</div>
    <footer class="phone-footer"><span>SPIEL PAUSIERT</span><button id="phone-home" aria-label="Startbildschirm"><span aria-hidden="true"></span></button><span>${euro(game.sim.s.money)}</span></footer>
    </div>`;
  panel.querySelector('#phone-close').onclick = () => game.close();
  panel.querySelector('#phone-home').onclick = () => game.phone('home');
  panel.querySelector('#phone-back').onclick = () => game.phone('home', 'back');
  panel
    .querySelectorAll('[data-phone-app]')
    .forEach((button) => (button.onclick = () => game.phone(button.dataset.phoneApp)));
  panel.querySelectorAll('[data-phone-mix]').forEach(
    (input) =>
      (input.oninput = () => {
        game.sim.s[input.dataset.phoneMix] = +input.value / 100;
        input.nextElementSibling.textContent = input.value + ' %';
        game.audio.applyMix();
        game.sim.save();
      }),
  );
  const click = (id, handler) => {
    const button = document.getElementById(id);
    if (button) button.onclick = handler;
  };
  click('phone-save', () => {
    document.getElementById('phone-save-status').textContent = game.sim.save()
      ? `Gespeichert · ${game.sim.clock} Uhr`
      : 'Speichern nicht möglich. Bitte über die Spieloptionen exportieren.';
  });
  click('phone-more-settings', () => game.settings());
  click('phone-audio-toggle', () => {
    const enabled = game.audio.toggle(),
      button = document.getElementById('phone-audio-toggle');
    button.setAttribute('aria-checked', String(enabled));
    button.textContent = enabled ? 'An' : 'Aus';
  });
  const quality = document.getElementById('phone-quality');
  if (quality)
    quality.onchange = () => {
      game.slowTime = 0;
      game.world.setQuality(quality.value === 'balanced');
    };
  const subtitles = document.getElementById('phone-subtitles');
  if (subtitles)
    subtitles.onchange = () => {
      game.sim.s.audioSubtitles = subtitles.checked;
      game.sim.save();
    };
  const range = document.getElementById('phone-audio-range');
  if (range)
    range.onchange = () => {
      game.sim.s.audioRange = range.value;
      game.audio.applyMix();
      game.sim.save();
    };
  const auto = document.getElementById('phone-music-auto');
  if (auto)
    auto.onchange = () => {
      game.sim.s.musicAuto = auto.checked;
      game.sim.save();
    };
  click('phone-music-toggle', () => {
    if (!game.audio.enabled) {
      game.audio.toggle();
      if (!game.sim.s.music) game.arcade.music.toggle();
    } else game.arcade.music.toggle();
    game.phone('music', 'replace');
  });
  panel.querySelectorAll('[data-phone-station]').forEach(
    (button) =>
      (button.onclick = () => {
        game.arcade.music.station = +button.dataset.phoneStation;
        if (!game.audio.enabled) game.audio.toggle();
        if (!game.sim.s.music) game.arcade.music.toggle();
        game.phone('music', 'replace');
      }),
  );
  if (page === 'map') mountMapControls(panel);
  const content = document.getElementById('phone-content');
  content.scrollTop = state.scroll.get(page) || 0;
  // Reading starts at the app heading; keyboard users can Tab into its controls.
  const heading = document.getElementById('modal-title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  return page;
}

// Magnify the existing city drawing rather than running a second map renderer.
function mountMapControls(panel) {
  const canvas = panel.querySelector('#large-map');
  if (!canvas) return;
  const viewport = document.createElement('div');
  viewport.className = 'phone-map-window';
  canvas.before(viewport);
  viewport.append(canvas);
  const controls = document.createElement('div');
  controls.className = 'phone-map-controls';
  controls.innerHTML =
    '<button id="phone-map-out" aria-label="Karte verkleinern">−</button><output aria-live="polite">100 %</output><button id="phone-map-in" aria-label="Karte vergrößern">+</button><small>Ziehen zum Verschieben</small>';
  viewport.after(controls);
  let zoom = 1,
    drag = null;
  const resize = (step) => {
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / canvas.clientWidth;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / canvas.clientHeight;
    zoom = Math.max(1, Math.min(3, zoom + step));
    canvas.style.width = zoom * 100 + '%';
    viewport.scrollLeft = centerX * canvas.clientWidth - viewport.clientWidth / 2;
    viewport.scrollTop = centerY * canvas.clientHeight - viewport.clientHeight / 2;
    controls.querySelector('output').textContent = zoom * 100 + ' %';
    controls.querySelector('#phone-map-out').disabled = zoom === 1;
    controls.querySelector('#phone-map-in').disabled = zoom === 3;
  };
  controls.querySelector('#phone-map-out').onclick = () => resize(-0.5);
  controls.querySelector('#phone-map-in').onclick = () => resize(0.5);
  controls.querySelector('#phone-map-out').disabled = true;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag = { x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) return;
    viewport.scrollLeft = drag.left + drag.x - e.clientX;
    viewport.scrollTop = drag.top + drag.y - e.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    viewport.addEventListener(type, () => {
      drag = null;
    });
}
