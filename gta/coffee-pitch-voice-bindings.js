/** Exact existing character names; script/audio assets owned by the audio candidate.
 * Missing/unapproved clips stay silent. No speech synthesis or subtitle substitute.
 */
export const COFFEE_PITCH_VOICE_BINDINGS = Object.freeze(
  Object.fromEntries(
    [
      ['coffee_pitch_start', 'Mara'],
      ['coffee_pitch_round2', 'Mara'],
      ['coffee_pitch_round3', 'Mara'],
      ['coffee_pitch_spill', 'player'],
      ['coffee_pitch_recover', 'player'],
      ['coffee_pitch_refill', 'Mara'],
      ['coffee_pitch_success', 'Mara'],
      ['coffee_pitch_perfect', 'player'],
    ].map(([id, character]) => [id, Object.freeze({ character, event: 'coffee_pitch' })]),
  ),
);
