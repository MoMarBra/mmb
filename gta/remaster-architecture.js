import * as THREE from 'three';
import { remasterMaterial, metricBoxGeometry } from './remaster-materials.js';
const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
let frames, glass, shadows, metal;
function init() {
  if (frames) return;
  frames = remasterMaterial('stone', {
    color: '#e4dfd2',
    normalScale: new THREE.Vector2(0.18, 0.18),
  });
  glass = new THREE.MeshPhysicalMaterial({
    color: '#71858b',
    vertexColors: true,
    roughness: 0.19,
    metalness: 0.36,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  shadows = new THREE.MeshStandardMaterial({
    color: '#333735',
    roughness: 0.91,
    vertexColors: true,
  });
  metal = remasterMaterial('metal', { color: '#777c78', roughness: 0.57 });
}
function builder() {
  return { p: [], n: [], uv: [], c: [] };
}
function append(out, x, y, z, w, h, d, side, shade = 1, faces = null) {
  const a = cube.attributes;
  for (let i = 0; i < a.position.count; i++) {
    if (faces && !faces.includes(Math.floor(i / 6))) continue;
    let px = a.position.getX(i) * w,
      py = a.position.getY(i) * h,
      pz = a.position.getZ(i) * d;
    let nx = a.normal.getX(i),
      ny = a.normal.getY(i),
      nz = a.normal.getZ(i);
    if (side) {
      [px, pz] = [pz, -px];
      [nx, nz] = [nz, -nx];
    }
    out.p.push(px + x, py + y, pz + z);
    out.n.push(nx, ny, nz);
    const face = Math.floor(i / 6),
      sx = face < 2 ? d : w,
      sy = face === 2 || face === 3 ? d : h;
    out.uv.push(a.uv.getX(i) * sx, a.uv.getY(i) * sy);
    out.c.push(shade, shade, shade);
  }
}
function finish(g, data, mat, name) {
  if (!data.p.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.n, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data.c, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = mat !== glass && mat !== shadows;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
// Layered masonry surrounds, recesses, glazing and cornices. Door/storefront band stays free.
export function dressFacade(
  parent,
  { x, z, w, d, h, seed = 0, color = '#e2dace', body, reservedPanels = [] },
) {
  init();
  if (body?.userData.remasterFacade) return;
  if (body) {
    body.material = remasterMaterial('plaster', { color });
    body.geometry = metricBoxGeometry(w, h, d);
    body.userData.remasterFacade = true;
  }
  const group = new THREE.Group();
  group.name = 'Remaster · Münchner Fassadendetails';
  group.userData.reservedPanels = reservedPanels.map((panel) => ({ ...panel }));
  group.userData.omittedWindows = [];
  parent.add(group);
  // Local coordinates keep spatial render batches attached to the actual block.
  group.position.set(x, 0, z);
  x = 0;
  z = 0;
  const frame = builder(),
    glazing = builder(),
    recess = builder(),
    pipes = builder();
  const floorCount = Math.max(1, Math.floor((h - 4) / 3.15));
  for (let side = 0; side < 4; side++) {
    const alongX = side < 2,
      sign = side % 2 === 0 ? 1 : -1,
      length = alongX ? w : d;
    const count = Math.max(1, Math.floor((length - 1.4) / 2.8));
    const depth = (alongX ? d : w) / 2;
    const wall = depth + 0.045;
    for (let row = 0; row < floorCount; row++)
      for (let col = 0; col < count; col++) {
        const u = (col - (count - 1) / 2) * ((length - 1.6) / count),
          yy = 5.02 + row * 3.15;
        if (yy + 1.12 > h - 0.3) continue;
        const width = 1.22 + (seed % 3) * 0.055,
          height = 1.95;
        // Reserve actual masonry for signage; never paste a logo over glazing or sills.
        const reserved = reservedPanels.some((panel) => {
          const pad = panel.clearance ?? 0.08;
          return (
            panel.side === side &&
            u + (width + 0.42) / 2 > panel.u - panel.w / 2 - pad &&
            u - (width + 0.42) / 2 < panel.u + panel.w / 2 + pad &&
            yy + height / 2 + 0.13 > panel.y - panel.h / 2 - pad &&
            yy - height / 2 - 0.215 < panel.y + panel.h / 2 + pad
          );
        });
        if (reserved) {
          group.userData.omittedWindows.push({ side, u, y: yy, width, height });
          continue;
        }
        const put = (out, ox, oy, oz, bw, bh, bd, shade = 1) =>
          append(
            out,
            x + (alongX ? u + ox : sign * (wall + oz)),
            yy + oy,
            z + (alongX ? sign * (wall + oz) : u + ox),
            bw,
            bh,
            bd,
            !alongX,
            shade,
            out === glazing || out === recess || bw < 0.07 || bh < 0.07 || bd < 0.03
              ? [sign > 0 ? 4 : 5]
              : bw < bh
                ? [0, 1, sign > 0 ? 4 : 5]
                : [2, 3, sign > 0 ? 4 : 5],
          );
        put(recess, 0, 0, 0.008, width + 0.22, height + 0.22, 0.065, 0.68);
        const shade = 0.6 + ((col * 13 + row * 7 + side * 19 + seed) % 9) * 0.06;
        put(glazing, 0, 0, 0.055, width, height, 0.025, shade);
        for (const dx of [-1, 1])
          put(frame, dx * (width / 2 + 0.057), 0, 0.12, 0.115, height + 0.26, 0.19);
        for (const dy of [-1, 1])
          put(frame, 0, dy * (height / 2 + 0.055), 0.12, width + 0.23, 0.11, 0.19);
        put(frame, 0, 0, 0.15, 0.044, height, 0.08);
        put(frame, 0, 0.23, 0.15, width, 0.048, 0.08);
        put(frame, 0, -height / 2 - 0.14, 0.19, width + 0.42, 0.15, 0.44);
        // Partly drawn interior blinds behind glazing, with restrained per-window variation.
        if ((col + row * 3 + side + seed) % 4 === 0)
          put(frame, 0, 0.71, 0.087, width - 0.08, 0.42, 0.022);
      }
    const corniceY = h - 0.37;
    append(
      frame,
      x + (alongX ? 0 : sign * (depth + 0.15)),
      corniceY,
      z + (alongX ? sign * (depth + 0.15) : 0),
      length + 0.15,
      0.12,
      0.31,
      !alongX,
    );
    append(
      frame,
      x + (alongX ? 0 : sign * (depth + 0.08)),
      3.5,
      z + (alongX ? sign * (depth + 0.08) : 0),
      length,
      0.13,
      0.18,
      !alongX,
    );
    // Slender rainwater pipes, no door or pavement intrusion.
    append(
      pipes,
      x + (alongX ? length / 2 - 0.35 : sign * (depth + 0.15)),
      h * 0.49,
      z + (alongX ? sign * (depth + 0.15) : length / 2 - 0.35),
      0.085,
      h * 0.96,
      0.085,
      false,
    );
  }
  finish(group, frame, frames, 'Stone sills, window frames and cornices');
  finish(group, glazing, glass, 'Reflective recessed window glazing');
  finish(group, recess, shadows, 'Window reveal shadows');
  finish(group, pipes, metal, 'Zinc rainwater fittings');
  return group;
}
