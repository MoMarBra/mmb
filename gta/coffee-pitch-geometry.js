/** Shared authored cup geometry, in metres. No renderer dependency. */
export const COFFEE_CUP_GEOMETRY = Object.freeze({
  cupHeight: 0.115,
  spillRim: 0.115,
  liquidFloor: 0.021,
  liquidTop: 0.113,
  innerBottomHeight: 0.020,
  innerTopHeight: 0.108,
  innerBottomRadius: 0.034,
  innerTopRadius: 0.044,
  liquidInset: 0.001,
  visualRim: 0.1145,
});
const D = COFFEE_CUP_GEOMETRY;
const bounded = (v, fallback, low, high) => Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : fallback;
export const coffeeLiquidHeight = (fill) => D.liquidFloor + bounded(fill, 0, 0, 1) * (D.liquidTop - D.liquidFloor);
export const coffeeInnerRadius = (height) => D.innerBottomRadius +
  bounded((height - D.innerBottomHeight) / (D.innerTopHeight - D.innerBottomHeight), 0, 0, 1) *
  (D.innerTopRadius - D.innerBottomRadius);
/** Radius at the lower tilted edge keeps the visible disk inside the tapered wall. */
export function coffeeLiquidRadius(fill, angle = 0) {
  const height = coffeeLiquidHeight(fill), base = coffeeInnerRadius(height) - D.liquidInset;
  return coffeeInnerRadius(height - base * Math.sin(bounded(Math.abs(angle), 0, 0, Math.PI / 2))) - D.liquidInset;
}
