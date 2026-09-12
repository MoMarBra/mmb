/** Compact, contextual overlays; game state and phone navigation keep their original owners. */
export function hudIcon(name) {
  const paths = {
    phone: '<rect x="6.5" y="2" width="11" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

export function updateCinematicHUD(game) {
  const vehicle = game.arcade?.vehicle;
  const type = vehicle?.type || 'foot';
  document.body.classList.toggle('is-driving', !!vehicle);
  document.body.classList.toggle('hud-modal', !!game.modal);
  const controls = document.getElementById('context-controls');
  if (!controls || controls.dataset.mode === type) return;
  controls.dataset.mode = type;
  const pairs = vehicle
    ? type === 'helicopter'
      ? [['WASD', 'Fliegen'], ['SPACE / C', 'Höhe'], ['E', 'Aussteigen']]
      : [['WASD', type === 'bike' ? 'Radfahren' : 'Fahren'], ['SPACE', 'Bremse'], ['E', 'Aussteigen']]
    : [['WASD', 'Bewegen'], ['E', 'Benutzen'], ['P', 'Smartphone']];
  controls.innerHTML = pairs.map(([key, text]) => `<span class="control-pair"><kbd>${key}</kbd>${text}</span>`).join('');
}
