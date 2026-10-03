import { euro } from './data.js';
import { resolveMealAdvice } from './meal-advice.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const amount = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const STATS = [['focus', 'Fokus'], ['hunger', 'Sättigung'], ['energy', 'Energie'], ['happy', 'Zufriedenheit']];
const signed = value => (value > 0 ? '+' : '−') +
  (Math.abs(value) < .05 ? '<0,1' : amount.format(Math.abs(value)));

export function renderMealAdvice(sim, advice = resolveMealAdvice(sim)) {
  const cards = [];
  for (const meal of [advice.focus, advice.budget]) {
    if (!meal) continue;
    const same = cards.find(card => card.meal.restaurantId === meal.restaurantId && card.meal.foodIndex === meal.foodIndex);
    if (same) same.labels.push(meal.label);
    else cards.push({ meal, labels: [meal.label] });
  }
  if (!cards.length) return '';
  return `<section class="meal-advice" aria-label="Passende Pausen"><div class="meal-advice-heading"><h3>Deine Pause</h3><small>Vor Ort bestellen</small></div>${cards.map(({ meal, labels }) => {
    const effects = STATS.filter(([stat]) => meal.effects[stat].delta !== 0 || meal.effects[stat].nominal < 0).map(([stat, label]) => {
      const effect = meal.effects[stat];
      const loss = effect.nominal < 0;
      const text = loss && effect.delta === 0 ? `${label}: bereits 0 (Gericht ${signed(effect.nominal)})`
        : `${signed(effect.delta)} ${label}`;
      return `<span class="meal-effect${loss ? ' is-loss' : ''}">${escapeHTML(text)}</span>`;
    }).join('');
    return `<article class="meal-advice-card"><div class="meal-advice-kind">${labels.map(escapeHTML).join(' · ')}${meal.discounted ? '<span class="meal-discount">Happy Hour</span>' : ''}</div><h4>${escapeHTML(meal.foodName)}</h4><div class="meal-advice-meta"><span>${escapeHTML(meal.restaurantName)}</span><strong>${euro(meal.price)}</strong></div><div class="meal-effects" aria-label="Wirkung mit deinen aktuellen Werten">${effects}</div><button type="button" class="small meal-route" data-route="${escapeHTML(meal.restaurantId)}" aria-label="${escapeHTML(meal.restaurantName)} · Ziel markieren">Ziel markieren <span aria-hidden="true">↗</span></button></article>`;
  }).join('')}</section>`;
}
