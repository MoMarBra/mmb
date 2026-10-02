import * as THREE from 'three';
import { box, label } from './world.js';

export const BLAST_PC = Object.freeze({ x: -8, z: -1.55, radius: 1.55 });
/** Dress an existing spare desk: no new floor collider or blocked walkway. */
export function installBlastPC(world) {
  const g = new THREE.Group();
  g.name = 'BBE Blast · spare office PC';
  world.groups.office.add(g);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  const bg = c.createLinearGradient(0, 0, 1024, 512);
  bg.addColorStop(0, '#102848');
  bg.addColorStop(1, '#080f23');
  c.fillStyle = bg;
  c.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 13; col++) {
      c.beginPath();
      c.arc(62 + col * 75, 320 + row * 65, 14, 0, Math.PI * 2);
      c.fillStyle = (row + col) % 3 ? '#31daca' : '#ffc469';
      c.fill();
    }
  c.textAlign = 'center';
  c.fillStyle = '#edca80';
  c.font = '600 29px Arial';
  c.fillText('DIE EINZIGE SINNVOLLE KETTENREAKTION', 512, 62);
  c.font = '900 126px Arial';
  c.fillStyle = '#f7f1de';
  c.fillText('BBE BLAST', 512, 205);
  c.font = '600 30px Arial';
  c.fillStyle = '#71ecdc';
  c.fillText('10 LEVEL · 1 KLEINE PAUSE', 512, 263);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.765, 0.39),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  screen.name = 'BBE Blast · PC display';
  screen.position.set(-8, 1.29, -3.238);
  g.add(screen);
  box(g, -8, 0.965, -2.47, 1.35, 0.17, 0.035, '#182b41', false);
  label(g, 'BBE BLAST', -8, 0.965, -2.449, 1.32, 0.165, { bg: '#182b41', fg: '#e6c37b' });
  // Headset on the spare desk identifies this as the break-time workstation.
  box(g, -8.86, 0.95, -3.15, 0.23, 0.035, 0.2, '#2c3b4b');
  box(g, -8.86, 1.11, -3.15, 0.025, 0.3, 0.035, '#536477');
  const headset = new THREE.Mesh(
    new THREE.TorusGeometry(0.135, 0.018, 8, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#263b50', roughness: 0.42, metalness: 0.2 }),
  );
  headset.position.set(-8.86, 1.23, -3.15);
  g.add(headset);
  for (const side of [-1, 1])
    box(g, -8.86 + side * 0.13, 1.185, -3.15, 0.055, 0.12, 0.095, '#dfb564');
  world.interact('office', 'bbe-blast-pc', 'BBE Blast · Arcade-PC', BLAST_PC.x, BLAST_PC.z, {
    kind: 'bbe-blast',
    radius: BLAST_PC.radius,
  });
  return { root: g, screen, anchor: BLAST_PC };
}
