import { VOICE_LINES } from './voice-lines.js';

export function openAudioSettings(game) {
  const a = game.audio,
    s = game.sim.s;
  const sliders = [
    ['audioMaster', 'Gesamtlautstärke'],
    ['musicVolume', 'Musik'],
    ['audioDialogue', 'Stimmen'],
    ['audioEffects', 'Schritte, Fahrzeuge & Aktionen'],
    ['audioAmbience', 'Umgebung & Innenräume'],
    ['audioUI', 'Menüs & Nachrichten'],
  ];
  game.open(
    'Soundstudio · Dein München-Mix',
    `<div class="audio-studio"><div class="audio-studio-head"><span class="audio-eq">▂ ▆ ▃ █ ▅ ▂ ▇</span><div><span class="eyebrow">ISAR AUDIO</span><h2>Die Stadt hat etwas zu erzählen.</h2><p>Räumliche Geräusche, 19 Sprechrollen, drei Radiosongs und eigens komponierte Storymusik. Kopfhörer machen Richtungen besonders gut hörbar.</p></div></div><div class="audio-mixer">${sliders.map(([key, title]) => `<label class="audio-fader"><span>${title}</span><input type="range" data-mix="${key}" aria-label="${title}" min="0" max="100" value="${Math.round(s[key] * 100)}"><output>${Math.round(s[key] * 100)} %</output></label>`).join('')}</div><div class="audio-options"><label><input id="audio-subtitles" type="checkbox" ${s.audioSubtitles ? 'checked' : ''}> Untertitel mit Sprechernamen</label><label>Klangdynamik <select id="audio-range"><option value="full" ${s.audioRange !== 'night' ? 'selected' : ''}>Voller Spielmix</option><option value="night" ${s.audioRange === 'night' ? 'selected' : ''}>Nachtmodus · kleinere Lautstärkesprünge</option></select></label></div><section class="voice-cast"><h3>Ein Team. Sehr viele letzte Änderungen.</h3><p>Wähle eine Stimme zum Probehören. Die deutschen Stimmen sind vorproduzierte Sprachsynthese; die Texte wurden eigens für das Spiel geschrieben.</p><div id="audio-preview-slot" class="audio-preview-slot"></div><div>${['Lena', 'Tobias', 'Mara', 'Jan', 'lukas', 'clara', 'player', 'seen', 'bao', 'palm', 'gyoza', 'wirt', 'mentors', 'diner', 'cyclist', 'passerby', 'bus_driver', 'taxi_driver', 'officer'].map((actor) => `<button data-voice="${actor}">${{ lukas: 'Lukas Fleischmann', clara: 'Clara', officer: 'Polizei', player: 'Du', seen: 'SEEN', bao: 'MAMMA BAO', palm: 'PALMTREECLUB', gyoza: 'GYOZA BAR', wirt: 'Wirtshaus', mentors: 'MENTOR’S', diner: 'Gast', cyclist: 'Radfahrer', passerby: 'Passant', bus_driver: 'Busfahrer', taxi_driver: 'Taxifahrer' }[actor] || actor} <span>▶</span></button>`).join('')}</div></section><div class="toolbar"><button id="audio-test">Räumlicher Hörtest · links / rechts</button><button id="audio-radio">Musik & Radiosender</button><button id="audio-restore">Standardmix</button><button class="primary" id="audio-back">Zurück ins Spiel</button></div><p class="audio-small">Aufnahmen werden bei Bedarf geladen. Musik wird während Dialogen sanft abgesenkt. Beim Wechsel in einen anderen Browser-Tab pausiert der Ton.</p></div>`,
    { pause: true, onClose: () => a.voices.stop() },
  );
  const persist = () => {
    a.applyMix();
    game.sim.save();
  };
  document.querySelectorAll('[data-mix]').forEach(
    (input) =>
      (input.oninput = () => {
        s[input.dataset.mix] = +input.value / 100;
        input.nextElementSibling.textContent = input.value + ' %';
        persist();
      }),
  );
  document.getElementById('audio-subtitles').onchange = (e) => {
    s.audioSubtitles = e.target.checked;
    persist();
  };
  document.getElementById('audio-range').onchange = (e) => {
    s.audioRange = e.target.value;
    persist();
  };
  document.querySelectorAll('[data-voice]').forEach(
    (button) =>
      (button.onclick = () => {
        if (!a.enabled) a.toggle();
        const actor = button.dataset.voice,
          line = VOICE_LINES.find((l) => l.actor === actor);
        a.voices.say(actor, line.event, { id: line.id, preview: true, force: true, priority: 5 });
      }),
  );
  document.getElementById('audio-test').onclick = () => {
    if (!a.enabled) a.toggle();
    const p = game.world.player.position,
      cam = game.world.camera.position;
    const dx = p.x - cam.x,
      dz = p.z - cam.z,
      len = Math.hypot(dx, dz) || 1;
    const right = { x: -dz / len, z: dx / len };
    a.tone(640, 0.5, 'sine', 0.3, 0, {
      bus: 'ui',
      position: { x: p.x - right.x * 3, y: 1.5, z: p.z - right.z * 3 },
    });
    a.tone(850, 0.5, 'sine', 0.3, 0.7, {
      bus: 'ui',
      position: { x: p.x + right.x * 3, y: 1.5, z: p.z + right.z * 3 },
    });
    game.toast(
      'Hörtest',
      'Erster Klang links, zweiter Klang rechts – aus deiner aktuellen Blickrichtung.',
    );
  };
  document.getElementById('audio-radio').onclick = () => game.arcade.leisure.radio();
  document.getElementById('audio-back').onclick = () => game.close();
  document.getElementById('audio-restore').onclick = () => {
    Object.assign(s, {
      audioMaster: 0.8,
      musicVolume: 0.4,
      audioDialogue: 1,
      audioEffects: 0.85,
      audioAmbience: 0.65,
      audioUI: 0.65,
      audioRange: 'full',
      audioSubtitles: true,
    });
    persist();
    openAudioSettings(game);
  };
}
