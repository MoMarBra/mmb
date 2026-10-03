// Existing fictional game characters. Plain data owns no DOM, audio or scene.
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const COLLEAGUES = freeze([
  {
    id: 'benjamin',
    actor: 'benjamin',
    name: 'Benjamin',
    role: 'IT',
    interaction: 'it-benjamin',
    support: {
      title: 'Neustart im Kopf',
      stats: { focus: 12, energy: 6 },
      line: 'Einmal tief durchatmen. Dich starte ich ohne Datenverlust neu.',
      voiceId: 'colleague_benjamin_support',
    },
    moments: [
      {
        id: 'benjamin-method',
        title: 'Gleiche Sprache',
        source: ['discovery', 'benjamin'],
        line: 'Endlich fragt jemand nach der Ursache. Sonst heißt die immer: IT.',
      },
      {
        id: 'benjamin-fire',
        title: 'Feuerprobe bestanden',
        source: ['fire'],
        line: 'Du hast den Laptop gerettet. Seine Karriere als Heizlüfter ist beendet.',
      },
      {
        id: 'benjamin-night',
        title: 'Auch nach Feierabend',
        source: ['campaign', 'night'],
        line: 'System wieder da. Team noch da. Nur der Feierabend ist weiterhin vermisst.',
      },
    ],
    banter: [
      'Ein Ticket ist ein Hilferuf mit Vorgangsnummer.',
      'Mein Heiligenschein hat jetzt einen Energiesparmodus.',
      'Vor dem Neustart speichern. Gilt auch für große Lebensentscheidungen.',
    ],
  },
  {
    id: 'tobias',
    actor: 'Tobias',
    name: 'Tobias',
    role: 'Research',
    interaction: 'colleague-Tobias · Research',
    support: {
      title: 'Vier Augen',
      stats: { focus: 16 },
      line: 'Wir schauen gemeinsam drauf. Vier Augen, eine belastbare Zahl.',
      voiceId: 'colleague_tobias_support',
    },
    moments: [
      {
        id: 'tobias-board',
        title: 'Gleiche Datenbasis',
        source: ['discovery', 'board'],
        line: 'Du liest die Notizen. Damit liegst du schon vor der Hälfte der Verteilerliste.',
      },
      {
        id: 'tobias-menu',
        title: 'Rechnen mit Geschmack',
        source: ['discovery', 'menu'],
        line: 'Du hast die Marge verstanden. Das ist mehr als nur die halbe Miete.',
      },
      {
        id: 'tobias-research',
        title: 'Saubere Quellen',
        source: ['campaign', 'research'],
        line: 'Echte Beobachtungen. Endlich eine Quelle, die nicht „fühlt sich so an“ heißt.',
      },
    ],
    banter: [
      'Mein Bauchgefühl kommt erst nach der Plausibilitätsprüfung dran.',
      'Die Stichprobe war klein. Der Kaffee leider auch.',
      'Ich vertraue dir. Bei Excel prüfe ich trotzdem den Nenner.',
    ],
  },
  {
    id: 'mara',
    actor: 'Mara',
    name: 'Mara',
    role: 'Consulting',
    interaction: 'colleague-Mara · Consulting',
    support: {
      title: 'Kurz durchatmen',
      stats: { happy: 12, focus: 6 },
      line: 'Schultern runter. Wir beraten Unternehmen, nicht den Weltuntergang.',
      voiceId: 'colleague_mara_support',
    },
    moments: [
      {
        id: 'mara-meeting',
        title: 'Rücken frei',
        source: ['campaign', 'meeting'],
        line: 'Alles vorbereitet. Sogar der Beamer hatte heute eine klare Strategie.',
      },
      {
        id: 'mara-workshop',
        title: 'Verlass auf die Übergabe',
        source: ['workshop'],
        line: 'Tobias sagt, der Koffer war pünktlich. Von euch hat er nichts Gegenteiliges erzählt.',
      },
      {
        id: 'mara-pitch',
        title: 'Eingespieltes Team',
        source: ['campaign', 'pitch'],
        line: 'Der Kunde nickt. Ich nicke. Die letzte Änderung muss heute warten.',
      },
    ],
    banter: [
      'Eine Pause ist keine Scope-Erweiterung. Die gehört dazu.',
      'Ich halte dir den Rücken frei. Für den Folienmaster ist Tobias zuständig.',
      'Eine gute Storyline hat auch mal einen Punkt.',
    ],
  },
]);

export const COLLEAGUE_STAGES = Object.freeze([
  'Im selben Team',
  'Auf einer Wellenlänge',
  'Verlässlich',
  'Eingespielt',
]);

export const COLLEAGUE_MOMENTS = freeze(
  COLLEAGUES.flatMap((colleague) =>
    colleague.moments.map((moment) => ({
      ...moment,
      colleague: colleague.id,
      actor: colleague.actor,
      voiceId: 'colleague_' + moment.id.replaceAll('-', '_'),
    })),
  ),
);

// Original new script for later production of matched dialogue assets. These
// IDs are deliberately NOT added to the live audio registry by this candidate.
export const COLLEAGUE_VOICE_SCRIPT = freeze(
  COLLEAGUES.flatMap((colleague) => [
    { id: colleague.support.voiceId, actor: colleague.actor, text: colleague.support.line },
    ...COLLEAGUE_MOMENTS.filter((moment) => moment.colleague === colleague.id).map((moment) => ({
      id: moment.voiceId,
      actor: colleague.actor,
      text: moment.line,
    })),
    ...colleague.banter.map((text, index) => ({
      id: `colleague_${colleague.id}_banter_${index + 1}`,
      actor: colleague.actor,
      text,
    })),
  ]),
);
