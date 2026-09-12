import { arrive, INTERIOR_LAYOUT, setDoor } from './doors.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { clamp, euro } from './data.js';

const $ = (s) => document.querySelector(s);
function box(root, x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}
function sign(root, text, x, y, z, width = 1.5) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#173c49';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffe0a0';
  ctx.font = 'bold 35px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 78, 480);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.35),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  mesh.position.set(x, y, z);
  root.add(mesh);
  return mesh;
}
export class Leisure {
  constructor(arcade) {
    this.a = arcade;
    this.game = arcade.game;
    this.world = arcade.world;
    this.sim = arcade.sim;
    this.cooldowns = {};
    this.activity = null;
    this.createProps();
    window.addEventListener('keydown', (e) => {
      if (!this.activity) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        this.activity.keys.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.activity?.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      if (this.activity) {
        this.activity.keys.clear();
        this.activity.holding = false;
      }
    });
  }
  createProps() {
    const office = this.world.groups.office,
      city = this.world.groups.city;
    box(office, 9.7, 0.75, 6.8, 0.65, 1.5, 0.65, '#d9e7e4');
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.5, 20),
      new THREE.MeshPhysicalMaterial({
        color: '#80c8dd',
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
      }),
    );
    water.position.set(9.7, 1.72, 6.8);
    office.add(water);
    sign(office, 'WASSER', 9.7, 1.16, 7.14, 0.55);
    this.world.interact('office', 'water', 'Wasser trinken', 9.7, 7.8, {
      kind: 'gimmick',
      data: 'water',
      radius: 1.35,
    });
    box(office, 12, 1.05, 6.5, 1.1, 2.1, 0.8, '#173f4c');
    box(office, 12, 1.25, 6.92, 0.78, 1.0, 0.03, '#263d45');
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        box(
          office,
          11.75 + c * 0.25,
          0.95 + r * 0.28,
          6.96,
          0.15,
          0.19,
          0.04,
          ['#d79651', '#aec7a2', '#de8c78'][c],
        );
    sign(office, 'SNACKS', 12, 1.91, 6.93, 0.9);
    this.world.interact('office', 'snack-machine', 'Snackautomat benutzen', 12, 7.8, {
      kind: 'gimmick',
      data: 'snack',
      radius: 1.45,
    });
    box(office, 2.8, 0.55, 8.3, 1.5, 1.1, 0.6, '#a48259');
    box(office, 2.8, 1.25, 8.3, 1.1, 0.42, 0.36, '#183e49');
    for (const x of [2.43, 3.17]) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 20),
        new THREE.MeshStandardMaterial({ color: '#242e32' }),
      );
      m.position.set(x, 1.25, 8.49);
      office.add(m);
    }
    sign(office, 'ISAR FM', 2.8, 1.28, 8.5, 0.43);
    this.world.interact('office', 'radio', 'Radio · ISAR FM', 2.8, 9.2, {
      kind: 'gimmick',
      data: 'radio',
      radius: 1.4,
    });
    const dartTexture = document.createElement('canvas');
    dartTexture.width = dartTexture.height = 256;
    const dc = dartTexture.getContext('2d');
    for (const [r, color] of [
      [127, '#dfdbc9'],
      [117, '#243a3e'],
      [100, '#ca735a'],
      [91, '#dfdbc9'],
      [64, '#244f4c'],
      [54, '#e6dfc5'],
      [15, '#af534a'],
      [7, '#e9be5e'],
    ]) {
      dc.fillStyle = color;
      dc.beginPath();
      dc.arc(128, 128, r, 0, Math.PI * 2);
      dc.fill();
    }
    const dt = new THREE.CanvasTexture(dartTexture);
    dt.colorSpace = THREE.SRGBColorSpace;
    const dart = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 40),
      new THREE.MeshStandardMaterial({ map: dt }),
    );
    dart.position.set(11.7, 1.8, 3.7);
    dart.rotation.y = Math.PI;
    office.add(dart);
    this.world.interact('office', 'darts', 'Büro-Darts spielen', 11.7, 2.7, {
      kind: 'gimmick',
      data: 'darts',
      radius: 1.4,
    });
    const bin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.25, 0.65, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: '#49676d', side: THREE.DoubleSide, roughness: 0.75 }),
    );
    bin.position.set(-12.1, 0.34, 6.7);
    office.add(bin);
    this.world.interact('office', 'paper-toss', 'Papierkorb-Basketball', -11.1, 6.8, {
      kind: 'gimmick',
      data: 'paper',
      radius: 1.45,
    });
    for (const x of [30.5, 33, 35.5]) {
      this.world.interact('office', 'toilet-' + x, 'Toilette benutzen · Pssssch!', x, 22.6, {
        kind: 'gimmick',
        data: 'toilet',
        radius: 1.3,
      });
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(0.25, 24),
        new THREE.MeshPhysicalMaterial({ color: '#81c8d9', roughness: 0.05, metalness: 0.4 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.731, 21.4);
      office.add(pool);
    }
    this.world.interact('office', 'wash', 'Hände waschen', 37.2, 25.4, {
      kind: 'gimmick',
      data: 'wash',
      radius: 1.45,
    });
    box(city, -21, 0.5, 34, 3, 0.16, 0.8, '#b28959');
    box(city, -21, 1, 33.65, 3, 0.7, 0.12, '#b28959');
    for (const x of [-22, -20]) box(city, x, 0.25, 34, 0.1, 0.5, 0.65, '#344950');
    this.world.interact('city', 'bench', 'Auf der Parkbank entspannen', -21, 35, {
      kind: 'gimmick',
      data: 'bench',
      radius: 1.8,
    });
    box(city, -16, 1, 34, 0.48, 2, 0.42, '#3e6575');
    sign(city, 'PARKEN', -16, 1.72, 34.23, 0.44);
    this.world.interact('city', 'parking', 'Parkschein ziehen · 1 €', -16, 35.2, {
      kind: 'gimmick',
      data: 'parking',
      radius: 1.4,
    });
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 20, 16),
      new THREE.MeshStandardMaterial({ color: '#f6e7c8', roughness: 0.55 }),
    );
    this.ball.castShadow = true;
    city.add(this.ball);
    for (let i = 0; i < 8; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(0.11, 5),
        new THREE.MeshStandardMaterial({ color: '#1d434f' }),
      );
      const a = i * 2.4,
        b = Math.acos(1 - (2 * (i + 0.5)) / 8);
      patch.position.set(
        Math.sin(b) * Math.cos(a) * 0.272,
        Math.cos(b) * 0.272,
        Math.sin(b) * Math.sin(a) * 0.272,
      );
      patch.lookAt(patch.position.clone().multiplyScalar(2));
      this.ball.add(patch);
    }
    this.ballBody = new CANNON.Body({
      mass: 0.5,
      shape: new CANNON.Sphere(0.27),
      linearDamping: 0.4,
      angularDamping: 0.3,
    });
    this.ballBody.position.set(-17, 0.4, 47);
    this.world.zoneData.city.physics.addBody(this.ballBody);
    this.world.interact('city', 'football', 'Fußball kicken', -17, 47, {
      kind: 'gimmick',
      data: 'ball',
      radius: 2,
    });
    // An immediately accessible company car beside the BBE entrance.
    const car = this.world.car(city, 'car', '#1d7c83');
    car.position.set(-24, 0, 38.1);
    car.rotation.y = Math.PI / 2;
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.925, 0.8, 2.2)),
    });
    body.position.set(-24, 0.8, 38.1);
    body.quaternion.setFromEuler(0, Math.PI / 2, 0);
    this.world.zoneData.city.physics.addBody(body);
    this.world.cars.push({ mesh: car, type: 'car', parked: true, speed: 0, max: 0, body });
  }
  interact(n) {
    if (n?.kind !== 'gimmick') return false;
    const type = n.data;
    if (type === 'toilet') {
      this.toilet();
      return true;
    }
    if (type === 'darts' || type === 'paper') {
      this.timing(type);
      return true;
    }
    if (type === 'radio') {
      this.radio();
      return true;
    }
    if (type === 'snack') {
      this.snacks();
      return true;
    }
    if (type === 'ball') {
      const p = this.world.player.position,
        dx = this.ballBody.position.x - p.x,
        dz = this.ballBody.position.z - p.z,
        l = Math.hypot(dx, dz) || 1;
      this.ballBody.wakeUp();
      this.ballBody.velocity.set((dx / l) * 9, 4, (dz / l) * 9);
      this.game.audio.play('kick');
      this.sim.change('happy', 1);
      return true;
    }
    if (this.a.time < (this.cooldowns[type] || 0)) {
      this.game.toast('Eine kurze Pause.', 'Gleich kannst du das wieder benutzen.');
      return true;
    }
    this.cooldowns[type] = this.a.time + 15;
    if (type === 'water') {
      this.sim.change('energy', 5);
      this.sim.change('bladder', 8);
      this.game.audio.play('water');
      this.game.toast('Frisches Wasser.', '+5 Energie · +8 Blase');
    }
    if (type === 'wash') {
      this.game.audio.play('wash');
      this.game.audio.voices?.say('player', 'wash');
      arrive(this.world, INTERIOR_LAYOUT.sink);
      this.world.pose = 'wash';
      this.game.timedAction('Hände waschen', '20 Sekunden? Consulting-Zeit: drei.', 3, () => {
        this.world.pose = 'walk';
        if (this.sim.s.toiletPending) {
          this.sim.change('happy', 10);
          this.sim.change('focus', 8);
          this.sim.s.toiletPending = false;
          this.game.toast('Frisch für die nächste Folie.', '+10 Zufriedenheit · +8 Fokus', true);
        } else this.game.toast('Saubere Sache.');
        this.sim.save();
      });
    }
    if (type === 'bench') {
      const standing = this.world.player.position.clone();
      this.world.teleport(-21, 34, 0.035);
      this.world.player.rotation.y = 0;
      this.world.pose = 'seated';
      this.game.timedAction(
        'Eine kleine München-Pause',
        'Sonne tanken. Für drei Sekunden keine Slides.',
        4,
        () => {
          this.world.pose = 'walk';
          this.world.teleport(standing.x, standing.z, Math.max(0, standing.y));
          this.sim.change('energy', 10);
          this.sim.change('happy', 7);
          this.sim.change('health', 8);
          this.game.toast('Weiter geht’s.', '+10 Energie · +7 Zufriedenheit · +8 Gesundheit');
          this.sim.save();
        },
      );
    }
    if (type === 'parking') {
      if (this.sim.s.money < 1) this.game.toast('Ein Euro fehlt zum Parkglück.');
      else {
        this.sim.transaction(-1, 'Parkschein');
        this.game.audio.play('print');
        this.game.toast('Parkschein: M – BBE 45', 'Gültig bis zur nächsten kleinen Änderung.');
        this.sim.save();
      }
    }
    return true;
  }
  snacks() {
    const items = [
      { name: 'Brezn', price: 1.8, hunger: 18, energy: 3 },
      { name: 'Nussmix', price: 2.4, hunger: 14, energy: 12 },
      { name: 'Mate', price: 2.9, hunger: 0, energy: 23 },
    ];
    this.game.open(
      'Der 16-Uhr-Notfallautomat',
      `<div class="three-col">${items.map((n, i) => `<article class="card"><h3>${n.name}</h3><p>+${n.hunger} Sättigung · +${n.energy} Energie</p><button data-snack="${i}" class="primary">${euro(n.price)} · Kaufen</button></article>`).join('')}</div>`,
    );
    document.querySelectorAll('[data-snack]').forEach(
      (b) =>
        (b.onclick = () => {
          const n = items[+b.dataset.snack];
          if (this.sim.s.money < n.price) {
            this.game.toast('Nicht genug Kleingeld.');
            return;
          }
          this.sim.transaction(-n.price, 'Automat · ' + n.name);
          this.sim.change('hunger', n.hunger);
          this.sim.change('energy', n.energy);
          if (n.name === 'Mate') this.sim.change('bladder', 16);
          this.game.audio.play('vending');
          this.game.close();
          this.world.pose = n.name === 'Mate' ? 'drink' : 'eat';
          this.game.timedAction(
            n.name + ' ist da.',
            'Die kleinen Dinge im Beratungsleben.',
            2.5,
            () => {
              this.world.pose = 'walk';
            },
          );
          this.sim.save();
        }),
    );
  }
  radio() {
    this.game.open(
      'ISAR FM · Original Game Soundtrack',
      `<p>Drei Originalstücke mit Rhodes, Saiten, Bass, Pads und Drums. Wähle einen Sender oder lass die Musik deiner Runde durch München folgen.</p><div class="three-col">${['Brienner Lo-Fi', 'Isar Afterhours', 'Augusten Drive'].map((s, i) => `<article class="card"><h3>${s}</h3><p>${['Entspannter Büro-Groove · 88 BPM', 'Funkiger Feierabend · 108 BPM', 'Elektronische Stadtrunde · 118 BPM'][i]}</p><button class="primary" data-station="${i}">Einschalten</button></article>`).join('')}</div><div class="setting-row"><label for="radio-volume">Musiklautstärke</label><input id="radio-volume" type="range" min="0" max="100" value="${Math.round(this.sim.s.musicVolume * 100)}"></div><button id="radio-toggle">${this.sim.s.music ? 'Musik ausschalten' : 'Musik einschalten'}</button>`,
      {
        pause: true,
        onClose: () => {
          this.a.music.preview = false;
        },
      },
    );
    this.a.music.preview = true;
    const auto = document.createElement('button');
    auto.id = 'radio-auto';
    auto.textContent = this.sim.s.musicAuto
      ? 'Musik folgt dem Spiel: an'
      : 'Musik folgt dem Spiel: aus';
    $('#radio-toggle').after(auto);
    auto.onclick = () => {
      this.sim.s.musicAuto = !this.sim.s.musicAuto;
      this.sim.save();
      auto.textContent = this.sim.s.musicAuto
        ? 'Musik folgt dem Spiel: an'
        : 'Musik folgt dem Spiel: aus';
    };
    document.querySelectorAll('[data-station]').forEach(
      (b) =>
        (b.onclick = () => {
          this.a.music.station = +b.dataset.station;
          auto.textContent = 'Musik folgt dem Spiel: aus';
          if (!this.sim.s.music) this.a.music.toggle();
          this.game.toast('Jetzt läuft: ' + b.closest('article').querySelector('h3').textContent);
        }),
    );
    $('#radio-toggle').onclick = () => {
      $('#radio-toggle').textContent = this.a.music.toggle()
        ? 'Musik ausschalten'
        : 'Musik einschalten';
    };
    $('#radio-volume').oninput = (e) => {
      this.sim.s.musicVolume = +e.target.value / 100;
      this.sim.save();
    };
  }
  toilet() {
    if (this.sim.s.toiletPending) {
      this.game.toast('Erst die Hände waschen.', 'Das Waschbecken ist rechts in der Toilette.');
      return;
    }
    this.activity = {
      type: 'toilet',
      phase: 'ready',
      keys: new Set(),
      time: 0,
      aim: 0.5,
      target: 0.5,
      hits: 0,
      flow: 0,
      holding: false,
    };
    const x = [30.5, 33, 35.5].reduce((a, b) =>
      Math.abs(a - this.world.player.position.x) < Math.abs(b - this.world.player.position.x)
        ? a
        : b,
    );
    arrive(this.world, { x, z: 22.3, yaw: 0 });
    setDoor(this.world, this.world.portals?.['cubicle-' + x], false);
    this.world.pose = 'restroom';
    this.game.open(
      'Pssssch. Bitte zielsicher.',
      `<div class="wc-layout"><canvas id="wc-canvas" width="720" height="390" aria-label="Toiletten-Minispiel mit beweglichem Ziel"></canvas><div><span class="tag gold">10 SEKUNDEN RUHE</span><h3>Triff den blauen Zielbereich.</h3><p>A/D oder Pfeile verschieben den Strahl. Alternativ Maus oder Finger im Bild bewegen. Halte die Leertaste oder den Knopf unten zum Pieseln.</p><div id="wc-status">Bereit? Erst starten, dann zielen.</div><progress id="wc-progress" max="10" value="0"></progress><button id="wc-start" class="primary">Minispiel starten</button><button id="wc-hold" hidden>Pssssch … gedrückt halten</button><button id="wc-flush" class="primary" hidden>Spülen</button></div></div>`,
      {
        onClose: () => {
          this.activity = null;
          this.game.audio.waterFlow?.(false);
          this.world.pose = 'walk';
          setDoor(this.world, this.world.portals?.['cubicle-' + x], true);
        },
      },
    );
    const c = $('#wc-canvas');
    c.onpointermove = (e) => {
      if (!this.activity) return;
      const r = c.getBoundingClientRect();
      this.activity.aim = clamp((e.clientX - r.left) / r.width, 0, 1);
    };
    $('#wc-start').onclick = () => {
      this.activity.phase = 'playing';
      this.game.audio.voices?.say('player', 'toilet_start');
      this.activity.time = 0;
      $('#wc-start').hidden = true;
      $('#wc-hold').hidden = false;
    };
    const hold = $('#wc-hold');
    hold.onpointerdown = (e) => {
      e.preventDefault();
      hold.setPointerCapture?.(e.pointerId);
      this.activity.holding = true;
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
      hold.addEventListener(ev, () => {
        if (this.activity) this.activity.holding = false;
      });
    $('#wc-flush').onclick = () => {
      if (this.activity?.phase !== 'done') return;
      this.activity.phase = 'flush';
      this.activity.time = 0;
      $('#wc-flush').disabled = true;
      this.game.audio.play('flush');
      this.game.audio.voices?.say('player', 'toilet_flush', { force: true });
    };
  }
  timing(type) {
    const a = { type, phase: 'playing', keys: new Set(), time: 0, shots: [], cursor: 0.5 };
    this.activity = a;
    this.game.open(
      type === 'darts' ? 'Darts: Board statt Boardroom' : 'Papierkorb-Basketball',
      `<div class="timing-game"><div class="timing-target"><div class="timing-sweet"></div><div id="timing-cursor"></div></div><h3 id="timing-result">Triff die goldene Mitte.</h3><p>Drei Versuche. Klicke im richtigen Moment.</p><button id="timing-throw" class="primary">${type === 'darts' ? 'Dart werfen' : 'Papier werfen'}</button><div id="timing-scores"></div></div>`,
      {
        onClose: () => {
          this.activity = null;
        },
      },
    );
    $('#timing-throw').onclick = () => {
      if (a.phase !== 'playing') return;
      const points = Math.max(0, Math.round(100 - Math.abs(a.cursor - 0.5) * 200));
      a.shots.push(points);
      this.game.audio.play(type === 'darts' ? 'dart' : 'paper');
      $('#timing-scores').textContent = a.shots
        .map((s, i) => 'Wurf ' + (i + 1) + ': ' + s)
        .join(' · ');
      $('#timing-result').textContent =
        points > 90 ? 'Volltreffer!' : points > 60 ? 'Sauber!' : 'Knapp daneben.';
      if (a.shots.length === 3) {
        a.phase = 'done';
        const mean = Math.round(a.shots.reduce((n, v) => n + v, 0) / 3);
        this.sim.change('happy', mean / 10);
        this.sim.change('focus', mean > 80 ? 4 : 1);
        this.sim.save();
        $('#timing-result').textContent =
          mean + ' Punkte · +' + Math.round(mean / 10) + ' Zufriedenheit';
        $('#timing-throw').textContent = 'Zurück ins Büro';
        $('#timing-throw').onclick = () => this.game.close();
      }
    };
  }
  update(dt) {
    this.ball.position.copy(this.ballBody.position);
    this.ball.quaternion.copy(this.ballBody.quaternion);
    const ballInteraction = this.world.zoneData.city.interactions.find((n) => n.id === 'football');
    ballInteraction.x = this.ballBody.position.x;
    ballInteraction.z = this.ballBody.position.z;
    if (
      this.ballBody.position.y < -1 ||
      Math.abs(this.ballBody.position.x) > 120 ||
      Math.abs(this.ballBody.position.z) > 125
    ) {
      this.ballBody.position.set(-17, 0.4, 47);
      this.ballBody.velocity.setZero();
    }
    const a = this.activity;
    if (!a) return;
    a.time += dt;
    if (a.type !== 'toilet') {
      if (a.phase === 'playing') {
        a.cursor = 0.5 + Math.sin(a.time * (a.type === 'darts' ? 2.9 : 3.5)) * 0.47;
        $('#timing-cursor').style.left = a.cursor * 100 + '%';
      }
      return;
    }
    if (a.phase === 'playing') {
      const direction =
        (a.keys.has('KeyD') || a.keys.has('ArrowRight') ? 1 : 0) -
        (a.keys.has('KeyA') || a.keys.has('ArrowLeft') ? 1 : 0);
      a.aim = clamp(a.aim + direction * dt * 0.65, 0, 1);
      a.target = 0.5 + Math.sin(a.time * 1.5) * 0.17;
      const flow = a.holding || a.keys.has('Space');
      this.game.audio.waterFlow?.(flow);
      if (flow) {
        a.flow += dt;
        if (Math.abs(a.aim - a.target) < 0.12) a.hits += dt;
      }
      $('#wc-progress').value = Math.min(10, a.time);
      $('#wc-status').textContent = flow
        ? Math.abs(a.aim - a.target) < 0.12
          ? 'PSSSSCH · Voll im Ziel!'
          : 'Psssch … etwas daneben.'
        : 'Leertaste oder Knopf gedrückt halten.';
      if (a.time >= 10) {
        a.phase = 'done';
        a.score = Math.round((a.hits / 10) * 100);
        this.game.audio.waterFlow?.(false);
        $('#wc-hold').hidden = true;
        $('#wc-flush').hidden = false;
        $('#wc-status').textContent = a.score + ' % Treffgenauigkeit. Jetzt spülen!';
      }
    }
    const c = $('#wc-canvas'),
      ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 720, 390);
    ctx.fillStyle = '#d5e2dd';
    ctx.fillRect(0, 0, 720, 390);
    ctx.strokeStyle = '#b4c8c2';
    ctx.lineWidth = 1;
    for (let x = 0; x < 720; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 390);
      ctx.stroke();
    }
    for (let y = 0; y < 390; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(720, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#95aaa4';
    ctx.beginPath();
    ctx.ellipse(360, 244, 232, 146, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#f8faf0';
    ctx.beginPath();
    ctx.ellipse(360, 225, 222, 145, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#72b3c8';
    ctx.beginPath();
    ctx.ellipse(360, 230, 160, 108, 0, 0, 7);
    ctx.fill();
    if (a.phase === 'flush') {
      ctx.strokeStyle = '#dff7fa';
      ctx.lineWidth = 7;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(360, 230, 35 + i * 29, 22 + i * 18, a.time * 5 + i, 0, 4.5);
        ctx.stroke();
      }
      if (a.time > 1.8) {
        this.sim.s.bladder = 5;
        this.sim.s.wcBest = Math.max(this.sim.s.wcBest, a.score);
        this.sim.s.toiletUses++;
        this.sim.checkAchievements();
        this.sim.s.toiletPending = true;
        this.game.close();
        arrive(this.world, { x: 36.5, z: 25.4, yaw: -Math.PI / 2 });
        this.game.toast(
          'Erleichterung: ' + a.score + ' %',
          'Jetzt am Waschbecken mit E die Hände waschen.',
        );
        this.sim.save();
      }
      return;
    }
    ctx.strokeStyle = '#d0f7ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(a.target * 720, 230, 65, 42, 0, 0, 7);
    ctx.stroke();
    ctx.fillStyle = '#174e66';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ZIELBEREICH', a.target * 720, 237);
    if (a.phase === 'playing' && (a.holding || a.keys.has('Space'))) {
      ctx.strokeStyle = '#edcc66';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(360, 16);
      ctx.quadraticCurveTo(a.aim * 720, 90, a.aim * 720, 230);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const t = a.time * 12 + i;
        ctx.fillStyle = '#fff3bd';
        ctx.beginPath();
        ctx.arc(a.aim * 720 + Math.sin(t) * 25, 230 + Math.cos(t * 1.7) * 14, 2.5, 0, 7);
        ctx.fill();
      }
    }
  }
}
