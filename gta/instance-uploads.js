// Three.js r180 uses its original full-buffer upload when updateRanges is empty.
// Remember color ownership/version only; unchanged Float32 colors skip uploads.
const ranges = new WeakMap();
const colors = new WeakMap();

export function setInstanceColorIfChanged(mesh, index, color) {
  // This path owns Three's ordinary Float32 instanceColor attributes, with valid
  // instance indices/counts. It does not replace a generic normalized-attribute setter.
  const offset = index * 3;
  let attribute = mesh.instanceColor;
  if (!attribute) {
    mesh.setColorAt(index, color);
    attribute = mesh.instanceColor;
  } else {
    const array = attribute.array;
    const r = Math.fround(color.r), g = Math.fround(color.g), b = Math.fround(color.b);
    if (Object.is(array[offset], r) && Object.is(array[offset + 1], g) && Object.is(array[offset + 2], b))
      return false;
    array[offset] = r;
    array[offset + 1] = g;
    array[offset + 2] = b;
  }
  let pending = colors.get(attribute);
  if (!pending) {
    pending = { start: Infinity, end: 0 };
    colors.set(attribute, pending);
  }
  pending.start = Math.min(pending.start, offset);
  pending.end = Math.max(pending.end, offset + 3);
  return true;
}

// A full request deliberately leaves updateRanges EMPTY: Three then uses the
// original three-argument bufferSubData call, not a full-size partial-range call.
function fullAttributeUpload(attribute) {
  if (attribute.updateRanges.length) attribute.clearUpdateRanges();
  attribute.needsUpdate = true;
}

export function flushInstanceUploads(mesh, count = mesh.count) {
  // Preserve the old full-buffer driver path for continuously changing matrices.
  if (count > 0) fullAttributeUpload(mesh.instanceMatrix);
  const attribute = mesh.instanceColor;
  const pending = colors.get(attribute), state = ranges.get(attribute);
  const changed = pending && pending.end > pending.start;
  const foreignVersion = state && state.version !== attribute.version;
  if (changed || foreignVersion) {
    // Only skip UNCHANGED colors. Changed colors also retain full-buffer upload.
    // Full transfer subsumes all previous/external partial ranges conservatively.
    fullAttributeUpload(attribute);
    if (state) state.version = attribute.version;
    else ranges.set(attribute, { version: attribute.version, range: { start: 0, count: 0 } });
    if (pending) { pending.start = Infinity; pending.end = 0; }
  }
  // Context creation/restoration still gets Three's full bufferData automatically.
}
