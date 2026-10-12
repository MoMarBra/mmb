/** One duration policy for generated dialogue and cinematic edits. */
export function measuredVoiceLine(line, bank, assetId = line.asset || 'voice_' + line.id) {
  const decoded = bank?.buffers?.get(assetId)?.duration;
  const duration = Number.isFinite(decoded) && decoded > 0
    ? decoded
    : Number.isFinite(line.duration) && line.duration > 0
      ? line.duration
      : Math.max(0.5, String(line.text || '').length / 13);
  return { ...line, duration };
}

/** Audio owns audible cuts; bounded caption time owns silent/failed clips. */
export function quizVoiceFinished(session, now = session.clock) {
  if (session.voiceStatus === 'playing')
    return !session.voice || !!(session.voice.ended || session.voice.stopped);
  const captionFinished = !Number.isFinite(session.voiceUntil) || now >= session.voiceUntil;
  if (session.voiceStatus === 'loading')
    return captionFinished && now - session.voiceRequestedAt >= 3;
  if (session.voiceStatus === 'silent') return captionFinished;
  if (session.voiceStatus === 'idle') return true;
  return !session.voiceLine;
}

export function quizIntroVoiceFinished(session, now = session.clock) {
  if (!session.welcomeSpoken) return session.shortIntro === true;
  return quizVoiceFinished(session, now);
}
