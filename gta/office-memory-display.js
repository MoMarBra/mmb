import * as THREE from 'three';
import { paintStarterNote } from './office-memory-starter.js';
import { MEMORY_IDS, OFFICE_MEMORIES, officeMemoryMask } from './office-memory-state.js';
import { MEMORY_BOARD_LOCATION } from './office-memory.js';

const W = 1024, H = 640;
const placements = MEMORY_IDS.map((id, index) => ({
  id, x: -0.62 + (index % 3) * 0.62, y: index < 3 ? 0.255 : -0.255,
}));
const COLORS = { frame: '#8b6c4e', edge: '#b29871', paper: '#f4ebd7', ink: '#244b52', teal: '#547b77', brass: '#c0a262', clay: '#b67555' };

/** Cheap, small, genuinely three-dimensional keepsakes; two draw calls, no lights. */
export class OfficeMemoryDisplay {
  constructor(parent, { document = globalThis.document, location = MEMORY_BOARD_LOCATION } = {}) {
    this.root = new THREE.Group();
    this.root.name = 'BBE · Erinnerungen am Arbeitsplatz';
    // The contents change at six milestones. Never merge into the global static room batches.
    this.root.userData.dynamic = true;
    this.root.userData.officeMemoryBoard = true;
    this.root.position.set(location.x, location.y, location.z);
    this.root.rotation.y = location.yaw;
    parent.add(this.root);
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 2;
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 });
    this.faceMaterial = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.91, metalness: 0 });
    this.geometryMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.geometryMesh.name = 'Memory board · opaque frame and keepsakes';
    this.geometryMesh.castShadow = false;
    this.geometryMesh.receiveShadow = true;
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(1.90, 1.18), this.faceMaterial);
    this.face.name = 'Memory board · printed cards';
    this.face.position.z = 0.037;
    this.face.receiveShadow = true;
    this.root.add(this.geometryMesh, this.face);
    // Late addition: establish real world matrices before the first render/raycast.
    // Parent zones stay scheduler-owned; this new subtree retains Three's live flags.
    this.root.updateWorldMatrix(true, true);
    this.mask = -1;
  }
  paint(memory) {
    const c = this.canvas.getContext('2d');
    c.fillStyle = '#cfbfa1'; c.fillRect(0, 0, W, H);
    // Deterministic cork texture: no noise per frame, no random visual changes at unlock.
    for (let i = 0; i < 850; i++) {
      const x = (i * 179) % W, y = (i * 97) % H;
      c.fillStyle = i % 2 ? '#c3b294' : '#d6c7aa';
      c.fillRect(x, y, 2 + (i % 3), 2);
    }
    for (const [index, def] of OFFICE_MEMORIES.entries()) {
      const x = 21 + (index % 3) * 333, y = index < 3 ? 26 : 300;
      if (!memory.unlocked.includes(def.id)) {
        paintStarterNote(c, index, x, y);
        continue;
      }
      c.fillStyle = '#ad987a'; c.fillRect(x + 4, y + 5, 310, 244);
      c.fillStyle = COLORS.paper; c.fillRect(x, y, 310, 244);
      c.fillStyle = COLORS.ink; c.textAlign = 'center';
      c.font = '600 22px Arial';
      const labels = { workshop: ['MARIENPLATZ', 'Koffer angekommen.'], fire: ['IT-GEPRÜFT', 'Läuft. Brennt nicht.'],
        origin: ['ZITRONENGRAS', 'Hier fing es an.'], bird: ['DR. DIP', 'Management bewässert.'],
        regular: ['WIE IMMER?', 'Stammplatz gesichert.'], recycling: ['10 ZURÜCK', 'Kreislauf geschlossen.'] };
      c.fillText(labels[def.id][0], x + 155, y + 38);
      c.font = '18px Arial'; c.fillText(labels[def.id][1], x + 155, y + 224);
      if (def.id === 'workshop') {
        c.strokeStyle = '#8c9c91'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x + 55, y + 165); c.lineTo(x + 255, y + 165);
        for (let j = 0; j < 5; j++) { const px = x + 82 + j * 36; c.moveTo(px, y + 165); c.lineTo(px, y + 112 - (j % 2) * 18); c.lineTo(px + 15, y + 93 - (j % 2) * 18); c.lineTo(px + 30, y + 112 - (j % 2) * 18); c.lineTo(px + 30, y + 165); }
        c.stroke();
      }
      if (def.id === 'regular') {
        c.strokeStyle = COLORS.teal; c.lineWidth = 4;
        for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + 88 + j * 66, y + 127, 23, 0, Math.PI * 2); c.stroke(); c.font = '28px Arial'; c.fillText('✓', x + 88 + j * 66, y + 137); }
      }
    }
    this.texture.needsUpdate = true;
  }
  buildGeometry(memory) {
    const parts = [];
    const add = (geometry, color, position, rotation = [0, 0, 0]) => {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
      flat.applyMatrix4(matrix);
      const tint = new THREE.Color(color), colors = new Float32Array(flat.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = tint.r; colors[i + 1] = tint.g; colors[i + 2] = tint.b; }
      flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(flat);
    };
    const box = (p, scale, color, rotation) => add(new THREE.BoxGeometry(...scale), color, p, rotation);
    const cylinder = (p, radius, height, color, rotation) => add(new THREE.CylinderGeometry(radius, radius, height, 12), color, p, rotation);
    box([0, 0, 0], [2, 1.28, 0.06], COLORS.frame);
    for (const x of [-0.976, 0.976]) box([x, 0, 0.047], [0.048, 1.28, 0.035], COLORS.edge);
    for (const y of [-0.615, 0.615]) box([0, y, 0.047], [1.94, 0.05, 0.035], COLORS.edge);
    for (const p of placements) {
      if (!memory.unlocked.includes(p.id)) continue;
      // A brass pin with its face directed out of the wall.
      cylinder([p.x, p.y + 0.168, 0.046], 0.019, 0.026, COLORS.brass, [Math.PI / 2, 0, 0]);
      if (p.id === 'workshop') {
        box([p.x + 0.14, p.y - 0.064, 0.07], [0.13, 0.10, 0.055], COLORS.clay, [0, 0, -0.12]);
        add(new THREE.TorusGeometry(0.028, 0.007, 5, 10, Math.PI), COLORS.brass, [p.x + 0.14, p.y - 0.008, 0.07]);
      } else if (p.id === 'fire') {
        cylinder([p.x, p.y - 0.02, 0.085], 0.056, 0.17, '#a75343');
        box([p.x, p.y + 0.08, 0.087], [0.078, 0.02, 0.039], COLORS.ink);
        box([p.x + 0.067, p.y + 0.025, 0.085], [0.021, 0.12, 0.02], COLORS.ink, [0, 0, -0.3]);
      } else if (p.id === 'origin') {
        box([p.x, p.y, 0.06], [0.29, 0.14, 0.019], COLORS.teal, [0, 0, -0.11]);
        box([p.x, p.y + 0.065, 0.078], [0.048, 0.085, 0.013], COLORS.brass);
        box([p.x, p.y - 0.015, 0.074], [0.21, 0.038, 0.013], COLORS.paper, [0, 0, -0.11]);
      } else if (p.id === 'bird') {
        cylinder([p.x - 0.02, p.y - 0.012, 0.095], 0.055, 0.11, COLORS.teal);
        cylinder([p.x + 0.075, p.y + 0.014, 0.095], 0.014, 0.16, COLORS.teal, [0, 0, -0.92]);
        add(new THREE.TorusGeometry(0.062, 0.01, 5, 12), COLORS.teal, [p.x - 0.077, p.y - 0.008, 0.095]);
      } else if (p.id === 'recycling') {
        cylinder([p.x, p.y - 0.04, 0.086], 0.042, 0.15, '#477469');
        cylinder([p.x, p.y + 0.068, 0.086], 0.021, 0.064, '#477469');
        cylinder([p.x, p.y + 0.105, 0.086], 0.022, 0.014, COLORS.brass);
        cylinder([p.x, p.y - 0.02, 0.086], 0.043, 0.049, COLORS.paper);
      }
    }
    const combined = new THREE.BufferGeometry();
    const size = parts.reduce((n, geo) => n + geo.attributes.position.count, 0);
    for (const attribute of ['position', 'normal', 'color']) {
      const values = new Float32Array(size * 3); let offset = 0;
      for (const part of parts) { values.set(part.attributes[attribute].array, offset); offset += part.attributes[attribute].array.length; }
      combined.setAttribute(attribute, new THREE.BufferAttribute(values, 3));
    }
    for (const part of parts) part.dispose();
    combined.computeBoundingBox(); combined.computeBoundingSphere();
    this.geometryMesh.geometry.dispose();
    this.geometryMesh.geometry = combined;
  }
  refresh(memory) {
    const mask = officeMemoryMask(memory);
    if (mask === this.mask) return false;
    this.mask = mask;
    this.paint(memory);
    this.buildGeometry(memory);
    return true;
  }
  dispose() {
    this.root.removeFromParent();
    this.geometryMesh.geometry.dispose(); this.face.geometry.dispose();
    this.material.dispose(); this.faceMaterial.dispose(); this.texture.dispose();
  }
}
