import { STREET_ROADS } from './city-streets.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const axes = STREET_ROADS.filter((r) => !r.service).map((r) => ({
  horizontal: r.w > r.d,
  x: r.x,
  z: r.z,
  start: r.w > r.d ? r.x - r.w / 2 : r.z - r.d / 2,
  end: r.w > r.d ? r.x + r.w / 2 : r.z + r.d / 2,
}));
/** Road-centre route. First/last short segments are explicitly pedestrian access. */
export function mapRoute(from, to) {
  const project = (p, r) =>
    r.horizontal
      ? { x: clamp(p.x, r.start, r.end), z: r.z }
      : { x: r.x, z: clamp(p.z, r.start, r.end) };
  const nearest = (p) =>
    axes
      .map((r, i) => ({ p: project(p, r), road: i }))
      .sort((a, b) => distance(a.p, p) - distance(b.p, p))[0];
  const start = nearest(from),
    end = nearest(to),
    nodes = [],
    edges = [],
    roads = axes.map(() => []);
  const node = (p, road) => {
    let i = nodes.findIndex((n) => distance(n, p) < 0.001);
    if (i < 0) {
      i = nodes.length;
      nodes.push(p);
      edges.push([]);
    }
    if (!roads[road].includes(i)) roads[road].push(i);
    return i;
  };
  for (let i = 0; i < axes.length; i++) {
    const a = axes[i];
    node(project(a.horizontal ? { x: a.start, z: a.z } : { x: a.x, z: a.start }, a), i);
    node(project(a.horizontal ? { x: a.end, z: a.z } : { x: a.x, z: a.end }, a), i);
    for (let j = 0; j < i; j++) {
      const b = axes[j];
      if (a.horizontal === b.horizontal) continue;
      const h = a.horizontal ? a : b,
        v = a.horizontal ? b : a;
      if (v.x >= h.start && v.x <= h.end && h.z >= v.start && h.z <= v.end) {
        const p = { x: v.x, z: h.z };
        node(p, i);
        node(p, j);
      }
    }
  }
  const s = node(start.p, start.road),
    e = node(end.p, end.road);
  roads.forEach((list, i) => {
    list.sort((a, b) => (axes[i].horizontal ? nodes[a].x - nodes[b].x : nodes[a].z - nodes[b].z));
    for (let j = 1; j < list.length; j++) {
      const a = list[j - 1],
        b = list[j];
      edges[a].push(b);
      edges[b].push(a);
    }
  });
  const costs = nodes.map(() => Infinity),
    previous = [],
    visited = new Set();
  costs[s] = 0;
  while (visited.size < nodes.length) {
    let n = -1;
    costs.forEach((c, i) => {
      if (!visited.has(i) && (n < 0 || c < costs[n])) n = i;
    });
    if (n < 0 || !Number.isFinite(costs[n]) || n === e) break;
    visited.add(n);
    for (const next of edges[n]) {
      const c = costs[n] + distance(nodes[n], nodes[next]);
      if (c < costs[next]) {
        costs[next] = c;
        previous[next] = n;
      }
    }
  }
  if (!Number.isFinite(costs[e]))
    return { road: [], access: [from, to], distance: distance(from, to) };
  const chain = [e];
  while (chain[0] !== s) chain.unshift(previous[chain[0]]);
  return {
    road: chain.map((i) => nodes[i]),
    access: [from, to],
    distance: costs[e] + distance(from, start.p) + distance(to, end.p),
  };
}
