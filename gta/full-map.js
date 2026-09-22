import { mapRoute } from './map-routing.js';
import { STREET_ROADS, CIRCULAR_STREETS } from './city-streets.js';
import { CITY_LAYOUT, CITY_WALKS } from './city-layout.js';
import { CITY_STOPS, HELIPADS } from './city-expansion.js';
import { RESTAURANTS } from './data.js';
import { EXTRA_PLACES } from './extras-state.js';
export class FullMap {
  constructor(game) {
    this.g = game;
    this.zoom = 1;
    this.center = { x: 155, z: 65 };
    this.filter = 'all';
    this.selected = null;
  }
  places() {
    return [
      ...new Map(
        [
          { id: 'hq', name: 'BBE Handelsberatung', type: 'work', ...CITY_LAYOUT.hq },
          { id: 'origin-home', name: 'Zuhause', type: 'city', x: -14.4, z: 110 },
          ...RESTAURANTS.map((r) => ({ ...r, type: 'food' })),
          ...Object.values(EXTRA_PLACES).map((r) => ({ ...r, type: 'food' })),
          ...CITY_STOPS.map((p) => ({ ...p, type: 'city' })),
          ...HELIPADS.map((p) => ({ ...p, type: 'flight' })),
        ].map((p) => [p.id, p]),
      ).values(),
    ];
  }
  open() {
    const g = this.g;
    if (g.cinematic) return;
    g.open(
      'München',
      `<div class="atlas"><div class="atlas-top"><span>MAXVORSTADT / ALTSTADT</span><b>KARTE</b><span>ESC · ZURÜCK</span></div><div class="atlas-view"><canvas id="atlas-canvas" aria-label="Interaktive Stadtkarte. Ziehen zum Verschieben, Mausrad zum Zoomen. Klick setzt ein Ziel." tabindex="0"></canvas><div class="atlas-tools"><button id="atlas-in" aria-label="Vergrößern">+</button><button id="atlas-out" aria-label="Verkleinern">−</button><button id="atlas-player" aria-label="Eigene Position">⌖</button></div><div class="atlas-north">N ↑</div><span class="atlas-scale" id="atlas-scale"></span></div><aside class="atlas-sidebar"><div class="atlas-filters"><button data-map-filter="all">Alle</button><button data-map-filter="work">Arbeit</button><button data-map-filter="food">Essen</button><button data-map-filter="city">Orte</button></div><div id="atlas-places"></div><div class="atlas-destination"><small>ZIEL</small><strong id="atlas-destination">${g.waypoint?.name || 'Ort auswählen'}</strong><button id="atlas-clear">Ziel entfernen</button><button id="atlas-go" class="primary">Zurück ins Spiel</button></div></aside><footer>Ziehen · Verschieben <span>Mausrad / + − · Zoom</span><span>Klick · Ziel setzen</span></footer></div>`,
      {
        pause: true,
        onClose: () => {
          this.observer?.disconnect();
          document.body.classList.remove('atlas-open');
        },
      },
    );
    document.body.classList.add('atlas-open');
    this.canvas = document.getElementById('atlas-canvas');
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this.canvas);
    document.querySelectorAll('[data-map-filter]').forEach(
      (b) =>
        (b.onclick = () => {
          this.filter = b.dataset.mapFilter;
          this.list();
          this.draw();
        }),
    );
    document.getElementById('atlas-in').onclick = () => this.scale(1.35);
    document.getElementById('atlas-out').onclick = () => this.scale(1 / 1.35);
    document.getElementById('atlas-player').onclick = () => {
      this.center = this.player();
      this.zoom = 3;
      this.draw();
    };
    document.getElementById('atlas-clear').onclick = () => {
      g.waypoint = null;
      this.selected = null;
      document.getElementById('atlas-destination').textContent = 'Ort auswählen';
      this.draw();
    };
    document.getElementById('atlas-go').onclick = () => g.close();
    this.canvas.onwheel = (e) => {
      e.preventDefault();
      this.scale(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    this.canvas.onpointerdown = (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      this.canvas.setPointerCapture(e.pointerId);
    };
    this.canvas.onpointermove = (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x,
        dz = e.clientY - this.drag.y;
      this.drag.moved += Math.abs(dx) + Math.abs(dz);
      this.center.x -= dx / this.unit;
      this.center.z -= dz / this.unit;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.draw();
    };
    this.canvas.onpointerup = (e) => {
      if (this.drag?.moved < 7) {
        const b = this.canvas.getBoundingClientRect(),
          x = this.center.x + (e.clientX - b.left - b.width / 2) / this.unit,
          z = this.center.z + (e.clientY - b.top - b.height / 2) / this.unit;
        const near = this.places().sort(
          (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
        )[0];
        this.select(
          Math.hypot(near.x - x, near.z - z) < 18 / this.unit
            ? near
            : { name: 'Markiertes Ziel', x, z },
        );
      }
      this.drag = null;
    };
    this.canvas.onkeydown = (e) => {
      if (e.key === '+' || e.key === '=') this.scale(1.2);
      else if (e.key === '-') this.scale(1 / 1.2);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        this.center.x +=
          (e.key === 'ArrowRight' ? 25 : e.key === 'ArrowLeft' ? -25 : 0) / this.zoom;
        this.center.z += (e.key === 'ArrowDown' ? 25 : e.key === 'ArrowUp' ? -25 : 0) / this.zoom;
        this.draw();
      }
    };
    this.list();
    this.draw();
  }
  player() {
    const w = this.g.world;
    return w.zone === 'city'
      ? { x: w.player.position.x, z: w.player.position.z }
      : w.zone === 'brewery'
        ? { ...EXTRA_PLACES.brewery }
        : ['restaurant', 'home', 'zitronengras'].includes(w.zone)
          ? { x: w.currentRestaurant.x, z: w.currentRestaurant.z }
          : { ...CITY_LAYOUT.hq };
  }
  list() {
    const root = document.getElementById('atlas-places');
    root.replaceChildren();
    for (const p of this.places().filter((p) => this.filter === 'all' || p.type === this.filter)) {
      const b = document.createElement('button');
      b.className = 'atlas-place';
      b.textContent = p.name;
      b.onclick = () => {
        this.center = { x: p.x, z: p.z };
        this.select(p);
      };
      root.append(b);
    }
    document
      .querySelectorAll('[data-map-filter]')
      .forEach((b) => b.classList.toggle('selected', b.dataset.mapFilter === this.filter));
  }
  select(p) {
    this.g.waypoint = { name: p.name, x: p.x, z: p.z };
    this.selected = p;
    document.getElementById('atlas-destination').textContent = p.name;
    this.draw();
  }
  scale(f) {
    this.zoom = Math.min(7, Math.max(0.6, this.zoom * f));
    this.draw();
  }
  draw() {
    const canvas = this.canvas;
    if (!canvas?.isConnected) return;
    const b = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    if (!b.width || !b.height) return;
    canvas.width = Math.round(b.width * dpr);
    canvas.height = Math.round(b.height * dpr);
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    const W = b.width,
      H = b.height;
    this.unit = Math.min(W / 690, H / 590) * this.zoom;
    const u = this.unit,
      X = (x) => W / 2 + (x - this.center.x) * u,
      Z = (z) => H / 2 + (z - this.center.z) * u;
    c.fillStyle = '#c7c9c7';
    c.fillRect(0, 0, W, H);
    const rect = (x, z, w, d, color) => {
      c.fillStyle = color;
      c.fillRect(X(x - w / 2), Z(z - d / 2), w * u, d * u);
    };
    for (const b of [...(this.g.world.cityBlocks || []), ...(this.g.world.expansionBlocks || [])])
      rect(b.x, b.z, b.w, b.d, '#969b99');
    for (const r of STREET_ROADS) {
      rect(r.x, r.z, r.w + 2, r.d + 2, '#eeeeeb');
      rect(r.x, r.z, r.w, r.d, '#626969');
    }
    for (const r of CIRCULAR_STREETS) {
      c.beginPath();
      c.arc(X(r.x), Z(r.z), ((r.innerRadius + r.outerRadius) / 2) * u, 0, Math.PI * 2);
      c.lineWidth = (r.outerRadius - r.innerRadius) * u;
      c.strokeStyle = '#626969';
      c.stroke();
    }
    rect(131, 14, 76, 42, '#b0b7a9');
    for (const t of this.g.world.treeObstacles || []) {
      c.fillStyle = '#8e9c89';
      c.beginPath();
      c.arc(X(t.x), Z(t.z), Math.max(1, 1.4 * u), 0, Math.PI * 2);
      c.fill();
    }
    c.font = '600 11px Arial';
    c.fillStyle = '#454d4e';
    c.fillText('BRIENNER STRASSE', X(63), Z(35));
    c.save();
    c.translate(X(-3), Z(-106));
    c.rotate(Math.PI / 2);
    c.fillText('AUGUSTENSTRASSE', 0, 0);
    c.restore();
    const player = this.player(),
      waypoint = this.g.waypoint;
    if (waypoint) {
      const route = mapRoute(player, waypoint);
      c.strokeStyle = '#9270ca';
      c.lineWidth = 5;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.beginPath();
      route.road.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](X(p.x), Z(p.z)));
      c.stroke();
      c.setLineDash([4, 6]);
      c.lineWidth = 2;
      c.beginPath();
      if (route.road.length) {
        c.moveTo(X(player.x), Z(player.z));
        c.lineTo(X(route.road[0].x), Z(route.road[0].z));
        c.moveTo(X(waypoint.x), Z(waypoint.z));
        const last = route.road.at(-1);
        c.lineTo(X(last.x), Z(last.z));
      } else {
        c.moveTo(X(player.x), Z(player.z));
        c.lineTo(X(waypoint.x), Z(waypoint.z));
      }
      c.stroke();
      c.setLineDash([]);
    }
    for (const p of this.places().filter((p) => this.filter === 'all' || p.type === this.filter)) {
      c.beginPath();
      c.arc(X(p.x), Z(p.z), p.id === 'hq' ? 8 : 6, 0, Math.PI * 2);
      c.fillStyle = p.id === 'hq' ? '#1d667d' : p.type === 'food' ? '#dd9957' : '#f6f6f2';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#263435';
      c.stroke();
      if (this.zoom > 1.8 || p.id === 'hq') {
        c.fillStyle = '#142326';
        c.font = '600 11px Arial';
        c.fillText(p.id === 'hq' ? 'BBE' : p.name, X(p.x) + 11, Z(p.z) + 4);
      }
    }
    if (waypoint) {
      c.strokeStyle = '#9270ca';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(X(waypoint.x), Z(waypoint.z), 12, 0, Math.PI * 2);
      c.stroke();
    }
    c.save();
    c.translate(X(player.x), Z(player.z));
    c.rotate(-this.g.world.player.rotation.y);
    c.beginPath();
    c.moveTo(0, 9);
    c.lineTo(-6, -7);
    c.lineTo(0, -4);
    c.lineTo(6, -7);
    c.closePath();
    c.fillStyle = '#fff';
    c.fill();
    c.strokeStyle = '#172a31';
    c.lineWidth = 2;
    c.stroke();
    c.restore();
    document.getElementById('atlas-scale').textContent = Math.round(100 / u) + ' m ━━━━━';
  }
}
