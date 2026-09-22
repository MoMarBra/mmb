import * as THREE from 'three';

// A common lens response in the existing output shader: no additional render pass,
// time-varying noise, blur, framebuffer or per-frame allocation.
const marker = '// BBE Munich cinematic response v1';
const response = `${marker}
vec3 CustomToneMapping( vec3 color ) {
  color = AgXToneMapping(color);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float midtones = smoothstep(0.025, 0.22, luma);
  color = mix(vec3(luma), color, 1.06);
  color = (color - 0.18) * (1.0 + 0.035 * midtones) + 0.18;
  float shadows = 1.0 - smoothstep(0.015, 0.28, luma);
  float highlights = smoothstep(0.25, 0.85, luma);
  color *= vec3(1.0) + shadows * vec3(-0.012, 0.002, 0.018)
                         + highlights * vec3(0.023, 0.005, -0.017);
  return clamp(color, 0.0, 1.0);
}`;

export function installCinematicLook(renderer) {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (!chunk.includes(marker)) {
    const original = /vec3 CustomToneMapping\s*\(\s*vec3 color\s*\)\s*\{\s*return color;\s*\}/;
    // A future Three update can keep its native AgX output if this extension point changes.
    if (!original.test(chunk)) return false;
    THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(original, response);
  }
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.userData ||= {};
  renderer.userData.cinematicLook = 'munich-v1';
  return true;
}
