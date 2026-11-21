// Original ending visuals supplied by user, adapted from Claude Motion export.
// Standalone ESM. No soundtrack, tracking, network calls or globals.
export function mountEnding(container, {duration=20.423, maxFps=24}={}) {
 const host=document.createElement('div'); host.setAttribute('aria-hidden','true');
 host.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;display:none';
 container.append(host); const shadow=host.attachShadow({mode:'open'});
 const stage=document.createElement('div'); stage.className='source-stage';
 const rules=document.createElement('style');shadow.append(rules,stage);
 rules.textContent='.source-stage { --ground:#EAF6FB; --main:#1E6FA8; --second:#0B2236; --accent:#FF7A59; color:var(--ground); font-family:var(--serif, Georgia, serif) }\n.source-stage { --deep:color-mix(in srgb, var(--second) 26%, black); --night:color-mix(in srgb, var(--second) 60%, black); --mist:color-mix(in srgb, var(--main) 55%, var(--ground)) }\n.words { position:absolute; margin:0; display:flex; flex-direction:column; align-items:center; text-align:center; gap:14px } .words > * { margin:0 }\n.line { font-family:var(--display, var(--serif, Georgia, serif)); font-size:132px; line-height:1.04; font-weight:700; letter-spacing:-0.01em }\n.sub { font-size:56px; line-height:1.2; font-style:italic; font-weight:400 }\n.glowtext { color:var(--ground); text-shadow:0 3px 30px color-mix(in srgb, var(--second) 85%, transparent), 0 1px 3px color-mix(in srgb, var(--second) 70%, transparent) }\n.word { display:inline-block }\n.fill { position:absolute; left:0; top:0; width:100%; height:100%; display:block }\n.art { position:absolute; inset:0; width:100%; height:100%; overflow:visible }\n.space { position:absolute; inset:0; background:radial-gradient(70% 60% at 50% 47%, color-mix(in srgb, var(--main) 18%, var(--night)), var(--deep) 70%) }\n.scrim { position:absolute; left:0; right:0; bottom:0; height:44%; background:linear-gradient(transparent, color-mix(in srgb, var(--second) 45%, transparent) 50%, color-mix(in srgb, var(--second) 72%, transparent)) }\n.ground { position:absolute; inset:0; background:var(--ground) }\n:host,.source-stage,.sea-root,.birthday-root,.night-root{position:absolute;inset:0;display:block;overflow:hidden}\n.source-stage{--display:Georgia,serif;--serif:Georgia,serif;container-type:inline-size}\n.source-stage .words{bottom:15% !important;width:100%;box-sizing:border-box;padding:0 8%;gap:12px}\n.source-stage .line{font-size:clamp(22px,7cqw,66px)!important;line-height:1.06}\n.source-stage .sub{font-size:clamp(12px,3.55cqw,30px);line-height:1.26}\n.source-stage .art{overflow:hidden}\n';
 const scenes={};
 let current='', active=null, usable=true, last=null;
 let VW=720,VH=1280,RW=360,RH=640,shader='';
 const seg=(t,a,b)=>Math.max(0,Math.min(1,(t-a)/(b-a)));
 const kit={stage,start:36,scene:(id,obj)=>{scenes[id]=obj;},seg,
    eo:x=>1-(1-x)**3,eio:x=>x<.5?4*x*x*x:1-(-2*x+2)**3/2,
    css:css=>{const s=document.createElement('style');s.textContent=css;stage.append(s);},
    h:html=>{const t=document.createElement('template');t.innerHTML=html;return t.content;}
 };
// The world of the film: the palette, one shared WebGL engine, the snack page's warp, and the ship's voyage.
const W = (function () {
  const W = {};
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
  const TAU = Math.PI * 2;
  W.clamp = clamp; W.smooth = smooth;

  // Palette, read from the stage, so a palette change on the page reaches canvas and shaders too.
  function parse(s, d) {
    s = (s || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
    m = /rgba?\(([^)]+)\)/i.exec(s);
    if (m) { const q = m[1].split(/[ ,/]+/).map(Number); if (q.length >= 3 && !isNaN(q[0]) && !isNaN(q[1]) && !isNaN(q[2])) return [q[0] / 255, q[1] / 255, q[2] / 255]; }
    return d;
  }
  W.pal = function (kit) {
    let cs = null; try { cs = getComputedStyle(kit.stage); } catch (e) { cs = null; }
    const g = (n) => (cs ? cs.getPropertyValue(n) : '');
    return { ground: parse(g('--ground'), [0.918, 0.965, 0.984]), main: parse(g('--main'), [0.118, 0.435, 0.659]),
      second: parse(g('--second'), [0.043, 0.133, 0.212]), accent: parse(g('--accent'), [1, 0.478, 0.349]) };
  };
  W.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  W.css = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : Math.max(0, Math.min(1, a)).toFixed(3)) + ')';
  W.palU = (P) => ({ uG: P.ground, uM: P.main, uS: P.second, uA: P.accent });

  // One WebGL context for the whole film, off stage. Each scene copies the picture onto its own small canvas.
  const HDR = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  let gl = null, glc = null, buf = null; const progs = {};
  function ctx3d(w, h) {
    if (gl === null) {
      gl = false;
      try {
        glc = document.createElement('canvas'); glc.width = w; glc.height = h;
        gl = glc.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, premultipliedAlpha: false }) || false;
        if (gl) { buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); }
      } catch (e) { gl = false; }
    }
    if (gl && (glc.width !== w || glc.height !== h)) { glc.width = w; glc.height = h; }
    return gl;
  }
  function build(key, frag) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[film] shader ' + key + ': ' + gl.getShaderInfoLog(s)); return null; } return s; };
    const v = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}'), f = sh(gl.FRAGMENT_SHADER, HDR + frag);
    if (!v || !f) return false;
    const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn('[film] link ' + key + ': ' + gl.getProgramInfoLog(pr)); return false; }
    return { pr, pos: gl.getAttribLocation(pr, 'p'), loc: {}, tex: null };
  }
  function uni(P, k, v) {
    let l = P.loc[k]; if (l === undefined) l = P.loc[k] = gl.getUniformLocation(P.pr, k);
    if (l === null) return;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
  }
  // Draws one full-frame shader; returns the canvas that holds the picture, or null where WebGL is missing.
  W.shade = function (key, frag, w, h, U, layer) {
    if (!ctx3d(w, h) || gl.isContextLost()) return null;
    let P = progs[key]; if (P === undefined) P = progs[key] = build(key, frag);
    if (!P) return null;
    gl.viewport(0, 0, w, h); gl.useProgram(P.pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(P.pos); gl.vertexAttribPointer(P.pos, 2, gl.FLOAT, false, 0, 0);
    uni(P, 'uRes', [w, h]);
    for (const k in U) uni(P, k, U[k]);
    if (layer) {
      if (!P.tex) {
        P.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, P.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      const l = gl.getUniformLocation(P.pr, 'uFw'); if (l) gl.uniform1i(l, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return glc;
  };

  W.releaseGL = function () {
    if (!gl) return;
    for (const k of Object.keys(progs)) { const x=progs[k]; if(x){if(x.tex)gl.deleteTexture(x.tex);gl.deleteProgram(x.pr);}delete progs[k]; }
    if(buf)gl.deleteBuffer(buf);
    try{gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
    gl=false;glc=null;buf=null;
  };
  // The snack page's warp, ported line for line from its warp.js: the same 720 stars from the same seed, the same timing.
  W.warpStars = (function () {
    let seed = 78233; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    return Array.from({ length: 720 }, () => { const a = random() * TAU, r = .07 + Math.sqrt(random()) * 2.7; return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: random() * 4, weight: .25 + random() * .75, tint: random() }; });
  })();
  W.warp = function (kit) {
    const P = W.pal(kit), m = W.mix, ink = [0, 0, 0];
    const tone = { blue: m(P.main, P.ground, .55), white: m(P.main, P.ground, .9), warm: m(P.accent, P.ground, .72) };
    const dark = m(P.second, ink, .82), dark2 = m(P.second, ink, .86);
    let G = null;
    function grads(ctx) {
      if (G && G.ctx === ctx) return G;
      const radial = (inner, outer, stops) => { const g = ctx.createRadialGradient(0, 0, inner, 0, 0, outer); for (const s of stops) g.addColorStop(s[0], W.css(s[1], s[2])); return g; };
      const paints = [tone.blue, tone.white, tone.warm].map((c) => { const t = ctx.createLinearGradient(0, 0, 1, 0); t.addColorStop(0, W.css(c, 0)); t.addColorStop(.75, W.css(c, .45)); t.addColorStop(1, W.css(c, 1)); return { trail: t, color: W.css(c, 1) }; });
      G = { ctx, paints,
        atmosphere: radial(0, 1, [[0, P.main, .40], [.28, m(P.main, P.second, .5), .20], [1, m(P.second, ink, .5), 0]]),
        halo: radial(.65, 1.32, [[0, P.main, 0], [.44, m(P.main, P.ground, .2), .18], [.52, m(P.main, P.ground, .7), .40], [.62, m(P.main, P.ground, .3), .13], [1, m(P.main, P.second, .5), 0]]),
        wash: radial(0, 1, [[0, m(P.main, P.ground, .85), .19], [.45, m(P.main, P.ground, .3), .10], [1, m(P.second, P.main, .2), 0]]),
        ring: m(P.main, P.ground, .75), glow: W.css(m(P.main, P.ground, .55), 1) };
      return G;
    }
    // o: { p, bg, light, acceleration, distance, exit, atmo, washGain }
    function draw(ctx, o) {
      const g = grads(ctx), ratio = ctx.canvas.width / 1920, width = 1920, height = 1080, p = o.p;
      const pr = (gr, x, y, radius, alpha, extent) => { extent = extent || 1; ctx.setTransform(ratio * radius, 0, 0, ratio * radius, ratio * x, ratio * y); ctx.globalAlpha = alpha; ctx.fillStyle = gr; ctx.fillRect(-extent, -extent, extent * 2, extent * 2); };
      ctx.save();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (o.bg > 0) { ctx.fillStyle = W.css(dark, o.bg); ctx.fillRect(0, 0, width, height); }
      const cx = width * (.5 + .006 * Math.sin(p * 2.3)), cy = height * (.47 + .008 * Math.sin(p * 1.8)), span = Math.min(width, height), focal = span * .84;
      const acceleration = o.acceleration, distance = o.distance, light = o.light;
      const atmo = o.atmo == null ? 1 : o.atmo;
      if (atmo > 0) pr(g.atmosphere, cx, cy, span * .8, light * atmo);
      ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
      for (const s of W.warpStars) {
        const z = ((s.z - distance) % 4 + 4) % 4 + .19, tail = z + .007 + acceleration * acceleration * .9;
        const x = cx + s.x * focal / z, y = cy + s.y * focal / z, tx = cx + s.x * focal / tail, ty = cy + s.y * focal / tail;
        if ((x < 0 && tx < 0) || (x > width && tx > width) || (y < 0 && ty < 0) || (y > height && ty > height)) continue;
        const alpha = light * (.18 + .8 * s.weight) * smooth(4.19, 3.4, z), lineWidth = (.55 + s.weight * .95) * Math.min(1.8, 1 / z);
        const dx = x - tx, dy = y - ty, length = Math.hypot(dx, dy) || 1e-6, headRadius = Math.max(.55, lineWidth * .55);
        const paint = g.paints[s.tint < .14 ? 0 : s.tint > .94 ? 2 : 1];
        ctx.setTransform(ratio * dx, ratio * dy, -ratio * dy, ratio * dx, ratio * tx, ratio * ty);
        ctx.strokeStyle = paint.trail; ctx.globalAlpha = alpha; ctx.lineWidth = lineWidth / length;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 0); ctx.stroke();
        if (s.weight > .88) { ctx.globalAlpha = alpha * .10 * acceleration; ctx.lineWidth = lineWidth * 7 / length; ctx.stroke(); }
        ctx.fillStyle = paint.color; ctx.globalAlpha = alpha * .9;
        ctx.setTransform(ratio * headRadius, 0, 0, ratio * headRadius, ratio * x, ratio * y); ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      }
      // One continuous aperture expands past the camera; no cuts or flashing rings.
      const passage = smooth(.4, .95, p), radius = span * .028 * Math.exp(passage * 4.3), presence = smooth(.24, .48, p) * (1 - smooth(.83, .95, p)) * light;
      if (presence > .001) {
        pr(g.halo, cx, cy, radius, presence, 1.32);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .94); ctx.rotate(p * .12);
        ctx.strokeStyle = W.css(g.ring, presence * .64); ctx.lineWidth = Math.max(.8, radius * .004); ctx.shadowColor = g.glow; ctx.shadowBlur = 12 * ratio;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke(); ctx.restore();
      }
      const arrival = Math.exp(-(((p - .821) / .053) ** 2)) * light * (o.washGain || 1);
      if (arrival > .001) pr(g.wash, cx, cy, Math.hypot(width, height) * .65, arrival);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (o.exit) { ctx.fillStyle = W.css(dark2, o.exit); ctx.fillRect(0, 0, width, height); }
      ctx.restore();
    }
    return {
      // ms since the warp began, exactly as the easter egg runs it (3.8 s).
      frame(ctx, ms) {
        const p = clamp(ms / 3800), fade = smooth(0, .19, p), exit = smooth(.87, 1, p), light = (1 - exit) * fade;
        draw(ctx, { p, bg: fade, light, acceleration: smooth(.14, .78, p), distance: .17 * p + 17 * p * p * p, exit });
      },
      draw,
    };
  };

  // The voyage: one clock (film seconds) drives ship, camera, sun and dusk in every sea scene, so the cuts never jump.
  W.SEA0 = 36;
  W.FL = 1.69;
  W.voyage = function (ta) {
    const s = ta - W.SEA0, e = smooth(0, 24, s);
    const el = 0.075 - 0.1 * smooth(8, 22, s), sun = [-0.42, el, -0.9], sl = Math.hypot(sun[0], sun[1], sun[2]);
    return { s, ship: -6.6 + 0.34 * s,
      ro: [0, 0.62 + 0.012 * Math.sin(ta * 0.9), 0],
      ta: [-2.6 + 3.6 * e - .9 * (1-smooth(0,10,s)), 0.84 + 0.006 * Math.sin(ta * 0.9 + 1.0), -24],
      sun: [sun[0] / sl, sun[1] / sl, sun[2] / sl], dusk: smooth(7, 20, s) };
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // A world point to stage pixels through the shader's own camera: [x, y, depth, pixels per world unit].
  W.project = function (v, V) {
    const f = norm(sub(V.ta, V.ro)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(v, V.ro);
    const z = dot(d, f); if (z <= 0.01) return null;
    const k = W.FL / z;
    return [VW/2 + dot(d, r) * k * VH, VH/2 - dot(d, u) * k * VH + 0.067*VH, z, k * VH];
  };
  return W;
})();

(()=>{
const { seg } = kit;
// The ocean, the sky and the ship, raymarched: sharp-crested waves with sun glitter and foam, a lit cloud deck,
// and an original white cruise ship (blue funnel, coral lifeboats) with its reflection, wake and cabin lights.
Object.assign(W, {
  SEA_FS: `uniform vec2 uRes; uniform float uT;
uniform vec3 uG; uniform vec3 uM; uniform vec3 uS; uniform vec3 uA;
uniform vec3 uRo; uniform vec3 uTa; uniform vec3 uSun;
uniform float uShip; uniform float uDusk; uniform float uFade; uniform float uExpo; uniform float uFwOn;
uniform sampler2D uFw;
#define FL 1.69
#define SZ -24.0
#define AMP 0.085
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 5; i++){ s += a*n2(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p; a *= 0.5; } return s; }
float sea(vec2 p, int n){
  float f = 1.0, a = 1.0, h = 0.0, w = 0.0, ang = 0.35;
  p *= 0.9;
  for(int i = 0; i < 18; i++){
    if(i >= n) break;
    vec2 d = vec2(cos(ang), sin(ang));
    float x = dot(d, p)*f + uT*0.65*sqrt(f);
    float e = exp(sin(x) - 1.0);
    p -= d*e*cos(x)*a*0.2/f;
    h += e*a; w += a;
    a *= 0.8; f *= 1.24; ang += 2.39996;
  }
  return h/w;
}
float height(vec2 p, int n){ return AMP*(sea(p, n) - 1.0); }
float traceSea(vec3 ro, vec3 rd){
  float ta = -ro.y/rd.y;
  float tb = min((-AMP - ro.y)/rd.y, 900.0);
  float lo = ta, hi = tb;
  bool found = false;
  for(int i = 1; i <= 40; i++){
    float tt = mix(ta, tb, float(i)/40.0);
    vec3 pp = ro + rd*tt;
    if(pp.y < height(pp.xz, 6)){ hi = tt; found = true; break; }
    lo = tt;
  }
  if(!found) return tb;
  for(int i = 0; i < 7; i++){
    float m = 0.5*(lo + hi);
    vec3 pp = ro + rd*m;
    if(pp.y < height(pp.xz, 6)) hi = m; else lo = m;
  }
  return 0.5*(lo + hi);
}
vec3 seaNormal(vec2 p, float dist){
  int n = 17;
  if(dist > 25.0) n = 12;
  if(dist > 110.0) n = 8;
  float e = 0.003 + dist*0.0016;
  float h0 = height(p, n);
  return normalize(vec3(h0 - height(p + vec2(e, 0.0), n), e, h0 - height(p + vec2(0.0, e), n)));
}
vec3 skyCol(vec3 rd, bool clouds){
  float y = max(rd.y, 0.0);
  float sunUp = smoothstep(-0.05, 0.02, uSun.y);
  vec3 zen = lin(mix(uM, uS, 0.3 + 0.55*uDusk))*mix(0.75, 0.05, uDusk);
  vec3 hor = lin(mix(uG, uA, 0.3 + 0.3*uDusk))*mix(1.2, 0.22, uDusk);
  vec3 col = mix(hor, zen, pow(y, 0.42));
  float sd = max(dot(rd, uSun), 0.0);
  vec2 hz = normalize(rd.xz + vec2(1e-5));
  float az = max(dot(hz, normalize(uSun.xz)), 0.0);
  vec3 warm = lin(uA)*mix(1.0, 0.45, uDusk);
  col += warm*pow(sd, 5.0)*0.85;
  col += warm*pow(az, 3.0)*exp(-y*7.0)*0.75;
  vec3 sunC = lin(mix(uA, uG, 0.55));
  col += sunC*14.0*smoothstep(0.99955, 0.99975, sd)*sunUp;
  col += sunC*pow(sd, 350.0)*3.0*sunUp;
  col += sunC*pow(sd, 36.0)*0.55*sunUp;
  if(clouds && rd.y > 0.0){
    vec2 cp = rd.xz/(rd.y + 0.035)*1.1 + vec2(uT*0.015, 3.0);
    float c = fbm(cp);
    float cov = smoothstep(0.47, 0.78, c)*smoothstep(0.0, 0.06, rd.y)*(1.0 - smoothstep(0.3, 0.75, rd.y));
    float rim = pow(sd, 3.0);
    vec3 cc = mix(lin(mix(uA, uS, 0.4))*0.55, lin(mix(uA, uG, 0.35))*1.7, 0.25 + 0.75*rim);
    cc = mix(cc, lin(mix(uS, uM, 0.3))*0.08, uDusk*0.85);
    col = mix(col, cc, cov*0.8);
  }
  if(rd.y > 0.0){
    vec2 g = vec2(atan(rd.x, -rd.z), rd.y)*300.0;
    vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float h = h21(id);
    float st = step(0.975, h)*exp(-dot(f, f)*30.0)*(0.3 + 0.7*h21(id + 4.0));
    col += lin(uG)*st*uDusk*uDusk*0.9*smoothstep(0.02, 0.12, rd.y);
  }
  return col;
}
vec3 fwAt(vec3 dir){
  vec3 f = normalize(uTa - uRo); vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0))); vec3 u = cross(r, f);
  float z = dot(dir, f);
  if(z <= 0.0) return vec3(0.0);
  vec2 s = vec2(dot(dir, r), dot(dir, u))/z*FL;
  vec2 uv = vec2(s.x*uRes.y/uRes.x + 0.5, s.y + 0.5);
  if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
  return lin(texture2D(uFw, uv).rgb)*uFwOn;
}
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p, b - r) - r; }
float hull(vec3 q){
  float k = max(q.x - 2.6, 0.0)/3.6;
  float w = 0.78*sqrt(max(1.0 - k*k, 0.0))*(1.0 + 0.07*clamp(q.y, -0.4, 0.6));
  float dz = abs(q.z) - w;
  float dx = max(q.x - (6.2 + 0.25*(q.y - 0.62)), -6.0 - q.x);
  float dy = max(q.y - 0.62, -0.6 - q.y);
  return max(max(dz*0.75, dx), dy);
}
float upper(vec3 q){
  float d = sdRBox(q - vec3(-0.35, 0.86, 0.0), vec3(5.25, 0.25, 0.72), 0.1);
  d = min(d, sdRBox(q - vec3(-0.6, 1.3, 0.0), vec3(4.7, 0.2, 0.69), 0.1));
  d = min(d, sdRBox(q - vec3(-0.9, 1.64, 0.0), vec3(3.9, 0.15, 0.64), 0.1));
  d = min(d, sdRBox(q - vec3(3.05, 1.9, 0.0), vec3(0.45, 0.12, 0.8), 0.05));
  d = min(d, sdRBox(q - vec3(-1.2, 1.86, 0.0), vec3(2.6, 0.08, 0.5), 0.06));
  return d;
}
float funnel(vec3 q){
  vec3 f = q - vec3(-3.5, 2.15, 0.0);
  f.x += 0.18*f.y;
  float r = (length(vec2(f.x/0.36, f.z/0.24)) - 1.0)*0.24;
  return max(r, abs(f.y) - 0.42);
}
float mast(vec3 q){ return sdBox(q - vec3(3.1, 2.3, 0.0), vec3(0.035, 0.32, 0.035)); }
float boats(vec3 q){
  vec3 b = q - vec3(0.0, 0.98, 0.0);
  b.z = abs(b.z) - 0.74;
  float c = clamp(floor(b.x/0.62 + 0.5), -6.0, 5.0);
  b.x -= c*0.62;
  return sdRBox(b, vec3(0.24, 0.07, 0.075), 0.065);
}
float ship(vec3 p, out float mat){
  vec3 q = p - vec3(uShip, 0.0, SZ);
  float d = hull(q); mat = 1.0;
  float e = upper(q); if(e < d){ d = e; mat = 2.0; }
  e = funnel(q); if(e < d){ d = e; mat = 3.0; }
  e = mast(q); if(e < d){ d = e; mat = 4.0; }
  e = boats(q); if(e < d){ d = e; mat = 5.0; }
  return d;
}
float shipD(vec3 p){ float m; return ship(p, m); }
float traceShip(vec3 ro, vec3 rd, out float mat){
  mat = 0.0;
  vec3 bmin = vec3(uShip - 6.4, -0.6, SZ - 0.95), bmax = vec3(uShip + 6.5, 2.75, SZ + 0.95);
  vec3 inv = 1.0/rd;
  vec3 t0 = (bmin - ro)*inv, t1 = (bmax - ro)*inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  if(tn > tf || tf < 0.0) return -1.0;
  float t = max(tn, 0.0);
  for(int i = 0; i < 96; i++){
    float m; float d = ship(ro + rd*t, m);
    if(d < 0.0011*t){ mat = m; return t; }
    t += d*0.85;
    if(t > tf) break;
  }
  return -1.0;
}
vec3 shipN(vec3 p){
  vec2 e = vec2(0.004, -0.004);
  return normalize(e.xyy*shipD(p + e.xyy) + e.yyx*shipD(p + e.yyx) + e.yxy*shipD(p + e.yxy) + e.xxx*shipD(p + e.xxx));
}
float shadow(vec3 p, vec3 l){
  float res = 1.0, t = 0.03;
  for(int i = 0; i < 24; i++){
    float h = shipD(p + l*t);
    res = min(res, 10.0*h/t);
    t += clamp(h, 0.02, 0.4);
    if(res < 0.02 || t > 8.0) break;
  }
  return clamp(res, 0.0, 1.0);
}
vec3 shadeShip(vec3 p, vec3 rd, float mat, bool cheap){
  vec3 n = shipN(p);
  vec3 q = p - vec3(uShip, 0.0, SZ);
  float dist = length(p - uRo);
  float fw = 0.0012*dist + 0.002;
  vec3 base = lin(uG)*0.8;
  float glass = 0.0, lamp = 0.0;
  float side = smoothstep(0.4, 0.7, abs(n.z));
  if(mat < 1.5){
    float boot = 1.0 - smoothstep(0.05 - fw, 0.05 + fw, q.y);
    float band = smoothstep(0.1 - fw, 0.1 + fw, q.y)*(1.0 - smoothstep(0.17 - fw, 0.17 + fw, q.y));
    base = mix(base, lin(uM)*0.5, band);
    base = mix(base, lin(mix(uS, uM, 0.2))*0.25, boot);
    float rows = (1.0 - smoothstep(0.022, 0.022 + fw, abs(q.y - 0.3))) + (1.0 - smoothstep(0.022, 0.022 + fw, abs(q.y - 0.44)));
    glass = clamp(rows, 0.0, 1.0)*side*step(q.x, 5.0)*step(-5.7, q.x);
    float hh = h21(vec2(floor(q.x/0.2), floor(q.y*8.0)) + 3.0);
    lamp = glass*step(hh, uDusk*0.7)*0.7;
  } else if(mat < 2.5){
    float dk = (q.y - 0.62)/0.125;
    float fy = fract(dk);
    float g = smoothstep(0.1, 0.1 + fw*8.0, fy)*(1.0 - smoothstep(0.66 - fw*8.0, 0.66, fy));
    float front = smoothstep(0.5, 0.8, n.x);
    glass = g*max(side, front);
    float cell = q.x/0.16;
    float div = 1.0 - smoothstep(0.0, 0.08 + fw*6.0, abs(fract(cell) - 0.5) - 0.42);
    glass *= 1.0 - 0.5*div*side*(1.0 - smoothstep(0.02, 0.05, fw));
    float hh = h21(vec2(floor(cell), floor(dk)) + 7.0);
    lamp = glass*step(hh, uDusk*0.8 + 0.04)*(0.6 + 0.4*h21(vec2(floor(cell)*1.3, floor(dk))));
  } else if(mat < 3.5){
    vec3 fq = q - vec3(-3.5, 2.15, 0.0);
    base = lin(uM)*0.55;
    float bnd = smoothstep(-0.06, -0.05, fq.y)*(1.0 - smoothstep(0.06, 0.07, fq.y));
    base = mix(base, lin(uG)*0.8, bnd);
    base = mix(base, lin(uS)*0.12, smoothstep(0.30, 0.32, fq.y));
  } else if(mat < 4.5){
    base = lin(uG)*0.7;
  } else {
    base = lin(uA)*0.7;
  }
  float sunUp = smoothstep(-0.05, 0.02, uSun.y);
  vec3 sunC = lin(mix(uA, uG, 0.45))*3.0*sunUp;
  float dif = max(dot(n, uSun), 0.0);
  float sh = 1.0;
  if(!cheap && dif > 0.0) sh = shadow(p + n*0.01, uSun);
  float ao = clamp(0.4 + 0.6*shipD(p + n*0.1)/0.1, 0.0, 1.0);
  vec3 amb = lin(mix(uM, uG, 0.55))*mix(0.5, 0.07, uDusk)*(0.65 + 0.35*n.y)*ao;
  vec3 glow = lin(uA)*0.16*(1.0 - uDusk)*clamp(0.5 - 0.5*n.x, 0.0, 1.0)*ao;
  vec3 col = base*(sunC*dif*sh + amb + glow);
  if(glass > 0.0){
    vec3 rr = reflect(rd, n);
    float fr = 0.04 + 0.96*pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 gc = lin(uS)*0.04 + skyCol(rr, false)*mix(0.22, 0.9, fr);
    col = mix(col, gc, glass*0.9);
  }
  col += lin(mix(uA, uG, 0.5))*1.7*lamp;
  return col;
}
float hullPlan(vec2 q){
  float k = max(q.x - 2.6, 0.0)/3.6;
  float w = 0.78*sqrt(max(1.0 - k*k, 0.0));
  return max(abs(q.y) - w, max(q.x - 6.05, -6.0 - q.x));
}
vec3 shadeSea(vec3 ro, vec3 rd, float t){
  vec3 p = ro + rd*t;
  vec3 n = seaNormal(p.xz, t);
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(60.0, 600.0, t)*0.75));
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 rr = reflect(rd, n); rr.y = abs(rr.y) + 0.002;
  vec3 refl = skyCol(rr, true);
  float rm; float rt = traceShip(p, rr, rm);
  if(rt > 0.0) refl = shadeShip(p + rr*rt, rr, rm, true);
  refl += fwAt(rr)*0.85;
  float sunUp = smoothstep(-0.05, 0.02, uSun.y);
  vec3 deep = lin(mix(uS, uM, 0.45))*mix(0.09, 0.012, uDusk);
  float crest = clamp((p.y + AMP)/AMP, 0.0, 1.0);
  float back = pow(max(dot(rd, uSun), 0.0), 2.0);
  vec3 sss = lin(mix(uM, uG, 0.3))*pow(crest, 2.5)*(0.05 + 0.25*back)*sunUp*(1.0 - uDusk*0.8);
  vec3 col = mix(deep + sss, refl, fres);
  float e = mix(1600.0, 110.0, smoothstep(4.0, 420.0, t));
  col += lin(mix(uA, uG, 0.55))*pow(max(dot(rr, uSun), 0.0), e)*e*0.011*sunUp;
  vec2 q = vec2(p.x - uShip, p.z - SZ);
  float hd = hullPlan(q);
  float noise = fbm(p.xz*vec2(3.0, 6.0) + vec2(uT*0.6, 0.0));
  float foam = smoothstep(0.22, 0.0, hd)*smoothstep(-0.05, 0.02, hd)*(0.4 + 0.6*noise);
  float behind = -6.0 - q.x;
  float wide = 0.45 + behind*0.16;
  float wake = step(0.0, behind)*smoothstep(wide, wide*0.25, abs(q.y))*exp(-behind*0.07);
  foam += wake*smoothstep(0.35, 0.75, noise + 0.25*exp(-behind*0.3));
  float bow = smoothstep(0.5, 0.0, length(vec2(q.x - 5.9, q.y)*vec2(0.6, 1.0)))*(0.5 + 0.5*noise);
  foam = clamp(foam + bow, 0.0, 1.0);
  vec3 fc = lin(uG)*(0.12 + mix(0.65, 0.08, uDusk))*(0.7 + 0.3*n.y);
  col = mix(col, fc, foam*0.85);
  vec3 haze = skyCol(normalize(vec3(rd.x, 0.0, rd.z)), false);
  col = mix(col, haze, 1.0 - exp(-t*0.0035));
  return col;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  vec3 f = normalize(uTa - uRo); vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0))); vec3 u = cross(r, f);
  vec3 rd = normalize(f*FL + p.x*r + p.y*u);
  vec3 ro = uRo;
  vec3 col; vec3 fwc = vec3(0.0);
  float sm; float st = traceShip(ro, rd, sm);
  float wt = -1.0;
  if(rd.y < 0.0) wt = traceSea(ro, rd);
  if(st > 0.0 && (wt < 0.0 || st < wt)){
    col = shadeShip(ro + rd*st, rd, sm, false);
    col = mix(col, skyCol(normalize(vec3(rd.x, 0.0, rd.z)), false), 1.0 - exp(-st*0.0035));
  } else if(wt > 0.0){
    col = shadeSea(ro, rd, wt);
  } else {
    col = skyCol(rd, true);
    fwc = fwAt(rd);
  }
  col += lin(mix(uM, uG, 0.85))*uExpo*2.2;
  col = col*(1.0 - uFade) + fwc;
  col = aces(col*1.05);
  col = pow(col, vec3(1.0/2.2));
  col *= 1.0 - 0.2*dot(p, p);
  col += (h21(gl_FragCoord.xy) - 0.5)/255.0;
  gl_FragColor = vec4(col, 1.0);
}`,
  // One frame of the voyage at film second ta onto a scene's own canvas; returns the voyage state for the DOM layers.
  seaFrame(ctx, U0, ta, extra, layer) {
    const V = W.voyage(ta);
    const U = Object.assign({ uT: ta, uRo: V.ro, uTa: V.ta, uSun: V.sun, uShip: V.ship, uDusk: V.dusk, uFade: 0, uExpo: 0, uFwOn: 0 }, U0, extra || {});
    const c = W.shade('sea-'+dimsKey, shader, RW, RH, U, layer || null);
    if (c) ctx.drawImage(c, 0, 0); else usable = false;
    return V;
  },
  // Painted backdrop under the shader canvas, for a device without WebGL.
  SEA_BACK: 'position:absolute; inset:0; background:linear-gradient(color-mix(in srgb, var(--main) 55%, var(--ground)) 0%, color-mix(in srgb, var(--accent) 55%, var(--ground)) 51%, color-mix(in srgb, var(--main) 55%, var(--second)) 52%, var(--second) 100%)',
});

const SEA_HORN = 2.21;      // seconds into the scene: the ship sounds its horn
kit.scene('sea', {
  init(kit) {
    kit.css('.sea-back { ' + W.SEA_BACK + ' } .sea-puff { position:absolute; left:0; top:0; width:100px; height:100px; border-radius:50%; background:radial-gradient(closest-side, color-mix(in srgb, color-mix(in srgb, var(--ground) 88%, var(--accent)) 80%, transparent), color-mix(in srgb, var(--ground) 30%, transparent) 55%, transparent) }');
    let puffs = '';
    for (let i = 0; i < 12; i++) puffs += '<div class="sea-puff"></div>';
    kit.stage.append(kit.h('<div class="sea-root"><div class="sea-back"></div><canvas class="fill sea-view" width="360" height="640"></canvas><div class="sea-steam">' + puffs + '</div></div>'));
    this.ctx = kit.stage.querySelector('.sea-view').getContext('2d');
    this.U = W.palU(W.pal(kit));
    this.puffs = Array.from(kit.stage.querySelectorAll('.sea-puff')).map((el, i) => ({ el, te: SEA_HORN + i * 0.2 }));
  },
  render(t, kit) {
    const ta = kit.start + t;
    // we arrive out of the warp's light, then the sea settles
    const V = W.seaFrame(this.ctx, this.U, ta, { uExpo: 1 - W.smooth(0, 1.1, t) });
    // steam from the whistle on the funnel's face; each puff stays where it left the ship and drifts up and back
    for (const p of this.puffs) {
      const a = t - p.te;
      if (a < 0 || a > 2.6) { p.el.style.display = 'none'; continue; }
      const ox = W.voyage(kit.start + p.te).ship - 3.0;
      const pos = [ox - 0.06 * a, 2.45 + 0.24 * a + 0.1 * (1 - Math.exp(-3 * a)), -24];
      const s = W.project(pos, V);
      if (!s) { p.el.style.display = 'none'; continue; }
      const d = 2 * (0.05 + 0.24 * (1 - Math.exp(-1.2 * a))) * s[3];
      p.el.style.display = '';
      p.el.style.transform = 'translate(' + s[0].toFixed(1) + 'px,' + s[1].toFixed(1) + 'px) translate(-50%,-50%) scale(' + (d / 100).toFixed(3) + ')';
      p.el.style.opacity = (0.8 * Math.pow(1 - a / 2.6, 1.5) * W.smooth(0, 0.15, a)).toFixed(3);
    }
  },
});

})();
(()=>{
const { seg, eo } = kit;
// The celebration's cast: fireworks painted into the sky layer (the shader hides them behind the ship and mirrors
// them in the waves), and balloons: a stream from the top decks, big ones past the lens at both edges, a flock on the wind.
const bdRand = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
Object.assign(W, {
  rand: bdRand,
  // Burst times run on their own seeded stream, so the score can find the same moments.
  fwPlan() {
    const rt = bdRand(4242), rp = bdRand(777), out = []; let t = 45.9, k = 0;
    while (t < 63) {
      const big = k % 4 === 0;
      out.push({ t, big, x: VW*(.12 + rp()*.76), y: VH*(.12 + rp()*.24), R: VW*(big ? .22 + rp()*.08 : .15 + rp()*.10), ci: Math.floor(rp() * 6), kind: big ? 0 : (rp() < 0.35 ? 1 : (rp() < 0.5 ? 2 : 0)), seed: Math.floor(rp() * 1e9), dx: (rp() - 0.5) * 90 });
      t += 0.42 + rt() * 0.5; k++;
    }
    return out;
  },
  fireworks(kit) {
    const P = W.pal(kit), m = W.mix;
    const cols = [P.accent, m(P.accent, P.ground, .5), m(P.main, P.ground, .5), P.ground, m(P.accent, P.main, .4), m(P.accent, P.ground, .25)];
    const plan = W.fwPlan().map((b) => {
      const q = bdRand(b.seed), n = b.big ? 120 : (b.kind === 1 ? 64 : 84);
      b.c = cols[b.ci]; b.c2 = cols[(b.ci + 2) % cols.length];
      b.life = b.kind === 2 ? 3.0 : (b.big ? 2.5 : 1.9); b.drop = b.kind === 2 ? 95 : 42; b.trail = b.kind === 2 ? 0.35 : 0.13;
      b.p = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + q() * 0.25, u = 2 * q() - 1; const s = b.kind === 1 ? 0.96 + q() * 0.04 : Math.sqrt(1 - u * u) * (0.85 + q() * 0.15); return [Math.cos(a) * s, Math.sin(a) * s, q()]; });
      return b;
    });
    const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    const ease = (u) => 1 - (1 - u) * (1 - u);
    return { canvas, paint(ta, gain) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // an opaque black layer: the shader adds it as light
      ctx.setTransform(canvas.width/VW, 0, 0, canvas.height/VH, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const b of plan) {
        const age = ta - b.t;
        if (age < -0.9 || age > b.life) continue;
        if (age < 0) {
          const u1 = 1 + age / 0.9, u0 = Math.max(0, u1 - 0.14);
          ctx.strokeStyle = W.css(m(b.c, P.ground, .6), 0.85 * gain); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(b.x + b.dx * (1 - ease(u0)), VH*.55 + (b.y - VH*.55) * ease(u0)); ctx.lineTo(b.x + b.dx * (1 - ease(u1)), VH*.55 + (b.y - VH*.55) * ease(u1)); ctx.stroke();
          continue;
        }
        const life = age / b.life, fade = Math.pow(1 - life, 1.4) * gain;
        if (age < 0.4) { const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.R * 0.7); g.addColorStop(0, W.css(m(b.c, P.ground, .5), 0.5 * (1 - age / 0.4) * gain)); g.addColorStop(1, W.css(b.c, 0)); ctx.fillStyle = g; ctx.fillRect(b.x - b.R, b.y - b.R, b.R * 2, b.R * 2); }
        const a0 = Math.max(0, age - b.trail);
        const r1 = b.R * (1 - Math.exp(-3.2 * age)), r0 = b.R * (1 - Math.exp(-3.2 * a0)), d1 = b.drop * age * age, d0 = b.drop * a0 * a0;
        const c = life < 0.55 ? m(P.ground, b.c, Math.min(1, age * 3.5)) : m(b.c, b.c2, (life - 0.55) / 0.45);
        ctx.strokeStyle = W.css(c, fade); ctx.lineWidth = (b.big ? 3.2 : 2.6) * (1 - life * 0.55);
        ctx.beginPath();
        for (const q of b.p) { ctx.moveTo(b.x + q[0] * r0, b.y + q[1] * r0 + d0); ctx.lineTo(b.x + q[0] * r1, b.y + q[1] * r1 + d1); }
        ctx.stroke();
        ctx.fillStyle = W.css(m(c, P.ground, .45), fade);
        for (const q of b.p) if (q[2] < 0.45) ctx.fillRect(b.x + q[0] * r1 - 2.2, b.y + q[1] * r1 + d1 - 2.2, 4.4, 4.4);
      }
      return canvas;
    } };
  },
  balloons(kit, id) {
    const r = bdRand(909), L = [];
    for (let i = 0; i < 24; i++) L.push({ k: 0, t0: 45.5 + i * 0.22 + r() * 0.15, lx: -4 + r() * 6.4, lz: (r() - .5) * 0.9, vy: 0.24 + r() * 0.12, vx: 0.09 + r() * 0.07, ph: r() * 6.3, c: Math.floor(r() * 5), size: 0.085 + r() * 0.03 });
    for (let i = 0; i < 28; i++) { const left = i % 2 === 0, d = 0.35 + r() * 0.65; L.push({ k: 1, t0: 45.2 + i * 0.5 + r() * 0.3, x0: left ? VW*(.02 + r()*.14) : VW*(.84 + r()*.14), size: 30 + 64 * d, vy: 80 + 120 * d, ph: r() * 6.3, c: Math.floor(r() * 5) }); }
    for (let i = 0; i < 16; i++) L.push({ k: 2, t0: 45.8 + i * 0.85 + r() * 0.4, y0: VH*(.22 + r()*.33), vx: 60 + r() * 60, vy: 12 + r() * 18, size: 14 + r() * 16, ph: r() * 6.3, c: Math.floor(r() * 5) });
    const tones = ['var(--accent)', 'var(--main)', 'color-mix(in srgb, var(--accent) 55%, var(--ground))', 'color-mix(in srgb, var(--main) 50%, var(--ground))', 'color-mix(in srgb, var(--accent) 60%, var(--main))'];
    const defs = '<defs>' + tones.map((c, i) => '<radialGradient id="' + id + '-g' + i + '" cx="0.36" cy="0.3" r="0.85"><stop offset="0" style="stop-color:color-mix(in srgb, ' + c + ' 45%, var(--ground))"/><stop offset="0.5" style="stop-color:' + c + '"/><stop offset="1" style="stop-color:color-mix(in srgb, ' + c + ' 62%, var(--second))"/></radialGradient>').join('') + '</defs>';
    const body = 'M0 -1.15 C0.64 -1.15 1 -0.6 1 -0.1 C1 0.52 0.48 0.98 0.06 1.04 L-0.06 1.04 C-0.48 0.98 -1 0.52 -1 -0.1 C-1 -0.6 -0.64 -1.15 0 -1.15 Z';
    const one = (b) => '<g class="' + id + '-balloon" style="display:none"><path class="' + id + '-string" style="fill:none;stroke:color-mix(in srgb, var(--ground) 65%, var(--second));stroke-width:0.05"/><path d="' + body + '" fill="url(#' + id + '-g' + b.c + ')"/><ellipse cx="-0.38" cy="-0.52" rx="0.15" ry="0.3" transform="rotate(-24 -0.38 -0.52)" style="fill:var(--ground);opacity:0.5"/></g>';
    return {
      markup: '<svg class="art ' + id + '-balloons" viewBox="0 0 ' + VW + ' ' + VH + '">' + defs + L.map(one).join('') + '</svg>',
      bind(root) { const gs = root.querySelectorAll('.' + id + '-balloon'); L.forEach((b, i) => { b.el = gs[i]; b.str = gs[i].firstChild; }); },
      render(ta, V) {
        for (const b of L) {
          const age = ta - b.t0;
          if (age < 0) { b.el.style.display = 'none'; continue; }
          const w = Math.sin(age * 1.5 + b.ph);
          let x, y, sc, tilt;
          if (b.k === 0) {
            const s = W.project([W.voyage(b.t0).ship + b.lx + b.vx * age + 0.04 * Math.sin(age * 1.3 + b.ph), 1.95 + b.vy * age, -24 + b.lz], V);
            if (!s) { b.el.style.display = 'none'; continue; }
            x = s[0]; y = s[1]; sc = b.size * s[3]; tilt = 5 * w;
          } else if (b.k === 1) {
            y = VH + b.size * 1.6 - b.vy * age; x = b.x0 + 14 * Math.sin(age * 0.9 + b.ph); sc = b.size / 2; tilt = 6 * Math.cos(age * 0.9 + b.ph);
            if (y < -b.size * 2) { b.el.style.display = 'none'; continue; }
          } else {
            x = -60 + b.vx * age; y = b.y0 - b.vy * age + 10 * Math.sin(age * 0.7 + b.ph); sc = b.size / 2; tilt = 8 * w;
            if (x > VW+70) { b.el.style.display = 'none'; continue; }
          }
          b.el.style.display = '';
          b.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + tilt.toFixed(2) + ') scale(' + sc.toFixed(3) + ')');
          b.str.setAttribute('d', 'M0 1.06 C' + (0.3 * w).toFixed(3) + ' 1.8 ' + (-0.3 * w).toFixed(3) + ' 2.5 ' + (0.18 * w).toFixed(3) + ' 3.3');
        }
      },
    };
  },
  // Splits a line into word spans for its entrance; the line itself stays one string in the markup.
  words(el) {
    const list = el.textContent.split(' '); el.textContent = '';
    return list.map((w, i) => { if (i) el.append(' '); const s = document.createElement('span'); s.className = 'word'; s.textContent = w; el.append(s); return s; });
  },
});

kit.scene('birthday', {
  init(kit) {
    kit.css('.birthday-back { ' + W.SEA_BACK + ' } .birthday-title { font-size:124px }');
    this.balloons = W.balloons(kit, 'birthday');
    kit.stage.append(kit.h('<div class="birthday-root"><div class="birthday-back"></div><canvas class="fill birthday-view" width="360" height="640"></canvas>' + this.balloons.markup +
      '<div class="scrim birthday-scrim"></div><div class="words birthday-words" style="left:0;right:0;bottom:70px"><h1 class="line glowtext birthday-title">Happy Birthday Sanni</h1><p class="sub glowtext birthday-sub">Divided by oceans but never by heart.</p></div></div>'));
    const q = (s) => kit.stage.querySelector(s);
    this.balloons.bind(q('.birthday-balloons'));
    this.ctx = q('.birthday-view').getContext('2d');
    this.U = W.palU(W.pal(kit));
    this.fw = W.fireworks(kit);
    this.title = W.words(q('.birthday-title'));
    this.sub = W.words(q('.birthday-sub'));
    Object.assign(this, { scrim: q('.birthday-scrim'), block: q('.birthday-words') });
  },
  render(t, kit) {
    const ta = kit.start + t;
    const V = W.seaFrame(this.ctx, this.U, ta, { uFwOn: 1 }, this.fw.paint(ta, 1));
    this.balloons.render(ta, V);
    this.scrim.style.opacity = W.smooth(1.4, 2.6, t).toFixed(3);
    // the words rise into place one by one, the title first, then the line beneath it
    this.title.forEach((s, i) => { const k = eo(seg(t, 2.3 + i * 0.14, 2.9 + i * 0.14)); s.style.opacity = k.toFixed(3); s.style.transform = 'translateY(' + ((1 - k) * 30).toFixed(1) + 'px)'; });
    this.sub.forEach((s, i) => { const k = eo(seg(t, 3.8 + i * 0.11, 4.4 + i * 0.11)); s.style.opacity = k.toFixed(3); s.style.transform = 'translateY(' + ((1 - k) * 26).toFixed(1) + 'px)'; });
    this.block.style.transform = 'translateY(' + (-2 * t).toFixed(1) + 'px)';
  },
});

})();
(()=>{
const { seg, eio } = kit;
// The same moment carried on: sea, ship, balloons and words sink slowly into black, the fireworks burn on.
kit.scene('night', {
  init(kit) {
    kit.css('.night-back { ' + W.SEA_BACK + ' } .night-title { font-size:124px } .night-dark { position:absolute; inset:0; background:var(--deep); opacity:0 }');
    this.balloons = W.balloons(kit, 'night');
    kit.stage.append(kit.h('<div class="night-root"><div class="night-back"></div><div class="night-dark"></div><canvas class="fill night-view" width="360" height="640"></canvas>' + this.balloons.markup +
      '<div class="scrim night-scrim"></div><div class="words night-words" style="left:0;right:0;bottom:70px"><h1 class="line glowtext night-title">Happy Birthday Sanni</h1><p class="sub glowtext night-sub">Divided by oceans but never by heart.</p></div></div>'));
    const q = (s) => kit.stage.querySelector(s);
    this.balloons.bind(q('.night-balloons'));
    Object.assign(this, { ctx: q('.night-view').getContext('2d'), dark: q('.night-dark'), layer: q('.night-balloons'), scrim: q('.night-scrim'), block: q('.night-words') });
    this.U = W.palU(W.pal(kit));
    this.fw = W.fireworks(kit);
  },
  render(t, kit) {
    const ta = kit.start + t;
    const fade = eio(seg(t, 0.3, 5.2));
    const V = W.seaFrame(this.ctx, this.U, ta, { uFwOn: 1, uFade: fade }, this.fw.paint(ta, 1));
    this.balloons.render(ta, V);
    const keep = (1 - fade).toFixed(3);
    this.layer.style.opacity = keep; this.scrim.style.opacity = keep; this.block.style.opacity = keep;
    this.dark.style.opacity = fade.toFixed(3);   // only seen where WebGL is missing
    this.block.style.transform = 'translateY(' + (-18 - 2 * t).toFixed(1) + 'px)';
  },
});

})();
 let dimsKey='';
 function resize(){
   // Fixed pixel budget; preserve aspect and use deterministic intrinsic scene coordinates.
   const box=container.getBoundingClientRect();
   const w=box.width||720,h=box.height||1280; const ar=w/h;
   const key=Math.round(ar*95); if(dimsKey===key)return; dimsKey=key;
   VH=1080;VW=VH*ar;
   RH=Math.min(640,Math.floor(460/ar));RW=Math.max(144,Math.round(RH*ar));
   W.FL=Math.min(1.69,ar*1.29);
   shader=W.SEA_FS.replace('#define FL 1.69','#define FL '+W.FL.toFixed(5))
      .replace('p.x*r + p.y*u','p.x*r + (p.y + 0.067)*u');
   current='';last=null;
 }
 function emit(t){
   resize();
   const elapsed=Math.max(0,Math.min(duration,t));
   const frame=Math.floor(elapsed*maxFps+.002);
   if(last===frame)return usable;
   last=frame;
   const s=elapsed/duration*20.423;
   const v=s<4.60 ? s/4.6*9 : s<13.3 ? 9+(s-4.6)/8.7*9 : 18+(s-13.3)/7.123*6;
   const id=v<9?'sea':v<18?'birthday':'night';
   const offset=id==='sea'?0:id==='birthday'?9:18;
   if(current!==id){
     current=id;stage.replaceChildren();kit.start=36+offset;active=scenes[id];active.init(kit);
     const c=stage.querySelector('canvas');c.width=RW;c.height=RH;
     // Align SVG with portrait projection rather than scaling an original landscape crop.
     const art=stage.querySelector('svg.art');if(art)art.setAttribute('preserveAspectRatio','none');
   }
   active.render(v-offset,kit);
   return usable;
 }
 function draw(elapsed){
   if(!usable||!Number.isFinite(elapsed))return false;
   try{const ok=emit(elapsed);host.style.display=ok?'block':'none';return ok;}
   catch(e){console.warn('Sanni ending: using original MP4 fallback',e);usable=false;host.style.display='none';return false;}
 }
 // Verify shader compilation with a still before claiming readiness.
 try{emit(.8);last=null;}catch(e){console.warn('Sanni ending initialization failed',e);usable=false;}
 return {get ready(){return usable;},draw,dispose(){
   usable=false;
   W.releaseGL();host.remove();
 }};
}
