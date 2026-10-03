import { AddEquation, CustomBlending, DstAlphaFactor, DstColorFactor, ZeroFactor } from 'three';

const installations = new WeakMap();
const diffuseDeclaration = 'uniform sampler2D tDiffuse;';
const diffuseSample = 'gl_FragColor = texture2D( tDiffuse, vUv );';

/**
 * Fold SSAOPass's final multiply into OutputPass before tone mapping. The AO
 * kernel, normal/depth pass, blur, resolution and multisampled colour buffer
 * remain unchanged. In particular alpha is multiplied too, just like the
 * original DstAlphaFactor/ZeroFactor blend (blurred AO normally has alpha 1).
 *
 * Other pass chains, debug outputs, masks and direct SSAOPass.render() calls
 * retain the vendor behaviour. No vendor file or global shader is changed.
 */
export function fuseSSAOComposite(composer, ssao, output) {
  const installed = installations.get(ssao);
  if (installed) {
    if (installed.composer !== composer || installed.output !== output)
      throw new Error('SSAO composite is already attached to another output pass.');
    return installed.controller;
  }
  const shader = output.material.fragmentShader;
  if (!shader.includes(diffuseDeclaration) || !shader.includes(diffuseSample))
    throw new Error('Unsupported OutputPass shader for SSAO composition.');

  const original = {
    composerRender: composer.render,
    ssaoRender: ssao.render,
    outputRender: output.render,
    shader,
  };
  const uniforms = {
    bbeAOComposite: { value: false },
    bbeAOTexture: { value: ssao.blurRenderTarget.texture },
    bbeAOOpacity: { value: 1 },
  };
  Object.assign(output.uniforms, uniforms);
  const fusedShader = shader
    .replace(
      diffuseDeclaration,
      `${diffuseDeclaration}
      uniform bool bbeAOComposite;
      uniform sampler2D bbeAOTexture;
      uniform float bbeAOOpacity;`,
    )
    .replace(
      diffuseSample,
      `${diffuseSample}
      if ( bbeAOComposite ) {
        gl_FragColor *= bbeAOOpacity * texture2D( bbeAOTexture, vUv );
      }`,
    );
  output.material.fragmentShader = fusedShader;
  output.material.needsUpdate = true;

  let inComposer = false;
  let pendingBuffer = null;
  let interceptBuffer = null;
  let previousRenderPass = null;
  let disposed = false;
  const controller = {
    enabled: true,
    dispose() {
      if (disposed) return;
      disposed = true;
      this.enabled = false;
      pendingBuffer = null;
      uniforms.bbeAOComposite.value = false;
      if (composer.render === renderComposer) composer.render = original.composerRender;
      if (ssao.render === renderSSAO) ssao.render = original.ssaoRender;
      if (output.render === renderOutput) output.render = original.outputRender;
      if (output.material.fragmentShader === fusedShader) {
        output.material.fragmentShader = original.shader;
        output.material.needsUpdate = true;
        for (const name of Object.keys(uniforms)) delete output.uniforms[name];
      }
      installations.delete(ssao);
    },
  };

  function outputFollowsSSAO() {
    const index = composer.passes.indexOf(ssao);
    if (index < 0) return false;
    for (let i = index + 1; i < composer.passes.length; i++) {
      const pass = composer.passes[i];
      if (pass.enabled !== false) return pass === output;
    }
    return false;
  }

  function interceptCopy(renderer, material, target, clearColor, clearAlpha) {
    const copy = ssao.copyMaterial;
    // These conditions describe precisely the vendor Default multiply. Future
    // changes to its blend contract automatically keep the original draw.
    if (
      material === copy &&
      target === interceptBuffer &&
      copy.blending === CustomBlending &&
      copy.blendSrc === DstColorFactor &&
      copy.blendDst === ZeroFactor &&
      copy.blendSrcAlpha === DstAlphaFactor &&
      copy.blendDstAlpha === ZeroFactor &&
      copy.blendEquation === AddEquation &&
      copy.blendEquationAlpha === AddEquation &&
      copy.uniforms.tDiffuse.value === ssao.blurRenderTarget.texture &&
      Number.isFinite(copy.uniforms.opacity.value) &&
      clearColor == null
    ) {
      pendingBuffer = target;
      uniforms.bbeAOTexture.value = copy.uniforms.tDiffuse.value;
      uniforms.bbeAOOpacity.value = copy.uniforms.opacity.value;
      return;
    }
    return previousRenderPass.call(this, renderer, material, target, clearColor, clearAlpha);
  }

  function renderSSAO(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    pendingBuffer = null;
    if (
      disposed ||
      !controller.enabled ||
      !inComposer ||
      ssao.enabled === false ||
      output.enabled === false ||
      ssao.output !== 0 ||
      ssao.renderToScreen ||
      ssao.needsSwap ||
      maskActive ||
      !outputFollowsSSAO()
    )
      return original.ssaoRender.call(
        this,
        renderer,
        writeBuffer,
        readBuffer,
        deltaTime,
        maskActive,
      );

    previousRenderPass = this._renderPass;
    interceptBuffer = readBuffer;
    this._renderPass = interceptCopy;
    let completed = false;
    try {
      const result = original.ssaoRender.call(
        this,
        renderer,
        writeBuffer,
        readBuffer,
        deltaTime,
        maskActive,
      );
      completed = true;
      return result;
    } finally {
      this._renderPass = previousRenderPass;
      previousRenderPass = null;
      interceptBuffer = null;
      if (!completed) pendingBuffer = null;
    }
  }

  function renderOutput(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    uniforms.bbeAOComposite.value = pendingBuffer !== null && pendingBuffer === readBuffer;
    try {
      return original.outputRender.call(
        this,
        renderer,
        writeBuffer,
        readBuffer,
        deltaTime,
        maskActive,
      );
    } finally {
      uniforms.bbeAOComposite.value = false;
      pendingBuffer = null;
    }
  }

  function renderComposer(deltaTime) {
    inComposer = true;
    pendingBuffer = null;
    try {
      return original.composerRender.call(this, deltaTime);
    } finally {
      inComposer = false;
      pendingBuffer = null;
      uniforms.bbeAOComposite.value = false;
    }
  }

  composer.render = renderComposer;
  ssao.render = renderSSAO;
  output.render = renderOutput;
  installations.set(ssao, { composer, output, controller });
  return controller;
}
