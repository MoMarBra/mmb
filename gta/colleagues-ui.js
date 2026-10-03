import { COLLEAGUES } from './colleagues-data.js';
import {
  syncColleagues,
  colleagueStatus,
  acknowledgeColleagueMoment,
  claimColleagueSupport,
  previewColleagueSupport,
  nextColleagueBanter,
} from './colleagues-state.js';

const statNames = { focus: 'Fokus', energy: 'Energie', happy: 'Zufriedenheit' };
const gains = (effects) =>
  Object.entries(effects)
    .map(([key, amount]) => `+${Math.round(amount * 10) / 10} ${statNames[key]}`)
    .join(' · ');

/** One compact row inside the existing dialogue; never creates another modal,
 * interaction, actor, render callback, preload batch or app. Returns true when
 * the displayed greeting was replaced by a matching contextual spoken line.
 */
export function mountColleagueConversation(
  game,
  id,
  {
    host = document.querySelector('[data-colleague-support]'),
    answer = document.getElementById('dialogue-answer'),
  } = {},
) {
  const colleague = COLLEAGUES.find((entry) => entry.id === id);
  if (!colleague || !host || !answer || !game.modal) return false;
  const owner = game.modal;
  const npc = game.world.zoneData.office.npcs.find(
    (entry) => entry.name === `${colleague.name} · ${colleague.role}`,
  );
  if (!npc?.mesh?.position) return false;
  const liveContext = () => ({
    zone: game.world.zone,
    interactingWith: id,
    distance: Math.hypot(
      game.world.player.position.x - npc.mesh.position.x,
      game.world.player.position.z - npc.mesh.position.z,
    ),
    ready:
      game.modal === owner &&
      !!game.started &&
      !game.busy &&
      !game.cinematic &&
      !owner.locked &&
      !game.fireStory?.running &&
      !npc.down &&
      !npc.storyAway &&
      npc.mesh.visible !== false,
  });
  const context = liveContext();
  if (
    !context.ready ||
    context.zone !== 'office' ||
    !Number.isFinite(context.distance) ||
    context.distance > 2.3
  )
    return false;
  syncColleagues(game.sim.s);
  const status = colleagueStatus(game.sim.s.colleagues, id);
  const document = host.ownerDocument;
  const row = document.createElement('div');
  row.className = 'toolbar';
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = status.label;
  row.append(tag);
  const feedback = document.createElement('p');
  feedback.className = 'muted';
  feedback.hidden = true;
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  function present(line) {
    if (!line || game.modal !== owner) return;
    answer.textContent = line.text || line.line;
    // Uses the normal dialogue bus, volume/subtitle settings and cancellation
    // token. New registry contains matching text, actual duration and clip ID.
    // Replace the owned conversation, including a queued answer to an earlier
    // topic. say(force) alone stops the current voice but keeps that old queue.
    game.audio.voices.sequence([
      { actor: colleague.actor, event: 'colleague', id: line.voiceId, npc, preview: true },
    ]);
  }
  if (status.offerId) {
    const offerId = status.offerId; // stable for this button, including double events
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'small';
    const preview = previewColleagueSupport(game.sim.s, id);
    button.textContent =
      status.support.title + (preview.ok ? ' · ' + gains(preview.effects) : ' · für später');
    button.onclick = () => {
      const result = claimColleagueSupport(game.sim.s, id, offerId, liveContext());
      if (!result.ok) {
        if (game.modal !== owner) return;
        feedback.textContent =
          result.reason === 'already-rested'
            ? 'Alles im grünen Bereich. Die Hilfe bleibt für später.'
            : result.reason === 'already-used'
              ? 'Diese Hilfe hast du schon erhalten.'
              : 'Wir sprechen später weiter.';
        feedback.hidden = false;
        return;
      }
      // Commit before voice/UI callbacks; a detached or duplicate button cannot
      // consume the next available milestone or restore these stats twice.
      button.disabled = true;
      button.textContent = 'Hilfe erhalten';
      feedback.textContent = gains(result.effects);
      feedback.hidden = false;
      game.sim.save();
      present(result);
    };
    row.append(button);
  }
  host.replaceChildren(row, feedback);
  const moment = status.nextMoment
    ? acknowledgeColleagueMoment(game.sim.s, id, status.nextMoment, context)
    : null;
  const line = moment || nextColleagueBanter(game.sim.s, id, context);
  if (!line) return false;
  game.sim.save();
  present(line);
  return true;
}
