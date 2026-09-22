// Original fictional host dialogue and question readings. Local Windows speech synthesis.
export const QUIZ_LINES = Object.freeze({
  intro: {
    asset: 'quiz_host_intro',
    text: 'Willkommen im Quizssoir. Der einzige Ort, an dem Sie unter Druck eine Million machen können.',
    duration: 7.442,
  },
  welcome: {
    asset: 'quiz_host_welcome',
    text: 'Fünfzehn Fragen. Drei Joker. Eine Million. Und ausnahmsweise keine Rückfragen vom Kunden.',
    duration: 8.9513,
  },
  lock: {
    asset: 'quiz_host_lock',
    text: 'Eingeloggt. Die Entscheidung steht.',
    duration: 2.522,
  },
  correct: {
    asset: 'quiz_host_correct',
    text: 'Richtig. Das war analytisch sauber. Und überraschend ohne Excel.',
    duration: 6.4111,
  },
  wrong: {
    asset: 'quiz_host_wrong',
    text: 'Leider falsch. Die Annahme war mutig. Die Daten waren anderer Meinung.',
    duration: 6.8856,
  },
  safety: {
    asset: 'quiz_host_safety',
    text: 'Sicherheitsstufe erreicht. Dieses Budget nimmt Ihnen jetzt keiner mehr weg.',
    duration: 5.9269,
  },
  million: {
    asset: 'quiz_host_million',
    text: 'Eine Million! Sie haben den Business Case Ihres Lebens gewonnen!',
    duration: 5.2848,
  },
  exit: {
    asset: 'quiz_host_exit',
    text: 'Sie steigen aus. Vernünftiges Risikomanagement. Das Geld geht auf Ihr Konto.',
    duration: 7.2165,
  },
  telephone: {
    asset: 'quiz_host_telephone',
    text: 'Benjamin ist in der Leitung. Immer da fürs Team. Auch wenn das Team gerade im Pissoir steht.',
    duration: 8.1499,
  },
  fifty: {
    asset: 'quiz_host_fifty',
    text: 'Fünfzig zu fünfzig. Zwei falsche Antworten haben wir aus dem Scope genommen.',
    duration: 6.5301,
  },
  audience: {
    asset: 'quiz_host_audience',
    text: 'Wir fragen das Publikum. Mehr Meinungen als im Steering Committee. Aber heute zählt die Mehrheit.',
    duration: 8.2745,
  },
  next: {
    asset: 'quiz_host_next',
    text: 'Die nächste Frage. Bitte kurz konzentrieren. Die Kaffeemaschine wartet.',
    duration: 6.852,
  },
  question_q01a: {
    asset: 'quiz_question_q01a',
    text: 'In welcher Stadt liegt die BBE-Zentrale in der Brienner Straße 45?',
    duration: 5.8968,
  },
  question_q01b: {
    asset: 'quiz_question_q01b',
    text: 'Was füllt im BBE-Büro des Spiels Energie und Fokus auf?',
    duration: 4.661,
  },
  question_q01c: {
    asset: 'quiz_question_q01c',
    text: 'Welches Programm ist typischerweise mit .pptx-Dateien verbunden?',
    duration: 5.3266,
  },
  question_q02a: {
    asset: 'quiz_question_q02a',
    text: 'In welcher Straße sitzt die BBE Handelsberatung in München?',
    duration: 4.7953,
  },
  question_q02b: {
    asset: 'quiz_question_q02b',
    text: 'Wer heißt in unserer Spielwelt Lukas Fleischmann?',
    duration: 3.8038,
  },
  question_q02c: {
    asset: 'quiz_question_q02c',
    text: 'Was bringt der Trinkvogel im Büro der Spielwelt regelmäßig zum Nicken?',
    duration: 4.9673,
  },
  question_q03a: {
    asset: 'quiz_question_q03a',
    text: 'Auf welche Branche konzentriert sich die BBE Handelsberatung?',
    duration: 4.7902,
  },
  question_q03b: {
    asset: 'quiz_question_q03b',
    text: 'Welcher Gegenstand wird in der Spielstory zum Marienplatz gebracht?',
    duration: 4.8957,
  },
  question_q03c: {
    asset: 'quiz_question_q03c',
    text: 'Was ist eine Deadline?',
    duration: 2.1702,
  },
  question_q04a: {
    asset: 'quiz_question_q04a',
    text: 'Welche Hausnummer gehört zur Münchner BBE-Adresse?',
    duration: 4.1387,
  },
  question_q04b: {
    asset: 'quiz_question_q04b',
    text: 'In welchem Restaurant beginnt die Küchenkarriere der Spielstory?',
    duration: 4.5986,
  },
  question_q04c: {
    asset: 'quiz_question_q04c',
    text: 'Was prüft man beim Korrekturlesen einer Präsentation zuerst?',
    duration: 4.8863,
  },
  question_q05a: {
    asset: 'quiz_question_q05a',
    text: 'Welche Leistung bietet die BBE ausdrücklich an?',
    duration: 3.8324,
  },
  question_q05b: {
    asset: 'quiz_question_q05b',
    text: 'Wer löscht in der IT-Story den brennenden Laptop?',
    duration: 3.5592,
  },
  question_q05c: {
    asset: 'quiz_question_q05c',
    text: 'Welcher Dateiname garantiert tatsächlich eine freigegebene Endfassung?',
    duration: 5.212,
  },
  question_q06a: {
    asset: 'quiz_question_q06a',
    text: 'Womit erfasst die BBE unter anderem Besucherströme an einem Standort?',
    duration: 5.4176,
  },
  question_q06b: {
    asset: 'quiz_question_q06b',
    text: 'Ein Laden verkauft 20 Artikel für je 15 €. Wie hoch ist sein Umsatz?',
    duration: 7.1195,
  },
  question_q06c: {
    asset: 'quiz_question_q06c',
    text: 'Was untersucht Mystery Shopping?',
    duration: 2.8791,
  },
  question_q07a: {
    asset: 'quiz_question_q07a',
    text: 'Welche Gesellschaft ist laut BBE Teil ihres Firmenverbunds?',
    duration: 4.7808,
  },
  question_q07b: {
    asset: 'quiz_question_q07b',
    text: 'Ein Anteil steigt von 20 % auf 25 %. Wie groß ist der Anstieg in Prozentpunkten?',
    duration: 8.7284,
  },
  question_q07c: {
    asset: 'quiz_question_q07c',
    text: 'Welche Grafik eignet sich meist für Umsätze im Zeitverlauf?',
    duration: 4.57,
  },
  question_q08a: {
    asset: 'quiz_question_q08a',
    text: 'Welcher Bereich gehört ausdrücklich zum BBE-Leistungsangebot?',
    duration: 4.8909,
  },
  question_q08b: {
    asset: 'quiz_question_q08b',
    text: 'Ein Artikel kostet netto 80 € und wird netto für 100 € verkauft. Wie hoch ist die Handelsspanne bezogen auf den Verkaufspreis?',
    duration: 10.6255,
  },
  question_q08c: {
    asset: 'quiz_question_q08c',
    text: 'Was bedeutet „Benchmarking“?',
    duration: 2.4867,
  },
  question_q09a: {
    asset: 'quiz_question_q09a',
    text: 'Welche Methode nennt die BBE neben Frequenzanalysen für die Standortberatung?',
    duration: 5.911,
  },
  question_q09b: {
    asset: 'quiz_question_q09b',
    text: 'Ein Standort zählt 1.000 Besucher und 120 Käufe. Wie hoch ist die Conversionrate?',
    duration: 7.9913,
  },
  question_q09c: {
    asset: 'quiz_question_q09c',
    text: 'Welche Aussage ist eine überprüfbare Hypothese?',
    duration: 4.2158,
  },
  question_q10a: {
    asset: 'quiz_question_q10a',
    text: 'Wobei unterstützt die BBE mit Filialnetzoptimierung?',
    duration: 4.3878,
  },
  question_q10b: {
    asset: 'quiz_question_q10b',
    text: 'Der Umsatz steigt von 200.000 € auf 250.000 €. Wie hoch ist das Wachstum?',
    duration: 8.7095,
  },
  question_q10c: {
    asset: 'quiz_question_q10c',
    text: 'Was trennt eine gute Management-Zusammenfassung von einer Datensammlung?',
    duration: 4.9245,
  },
  question_q11a: {
    asset: 'quiz_question_q11a',
    text: 'Welcher Partner ergänzt laut BBE-Firmenverbund die Digitalexpertise?',
    duration: 5.6283,
  },
  question_q11b: {
    asset: 'quiz_question_q11b',
    text: 'Fixkosten: 30.000 €. Deckungsbeitrag pro Stück: 15 €. Wo liegt die Gewinnschwelle?',
    duration: 9.8121,
  },
  question_q11c: {
    asset: 'quiz_question_q11c',
    text: 'Was droht, wenn eine Kundenbefragung nur treue Stammkunden erreicht?',
    duration: 5.4514,
  },
  question_q12a: {
    asset: 'quiz_question_q12a',
    text: 'Welche Perspektiven verbindet die BBE laut eigener Immobilienberatung?',
    duration: 5.461,
  },
  question_q12b: {
    asset: 'quiz_question_q12b',
    text: 'Ein Preis sinkt um 20 % und steigt danach um 20 %. Wo liegt er relativ zum Ausgangspreis?',
    duration: 8.8868,
  },
  question_q12c: {
    asset: 'quiz_question_q12c',
    text: 'Welche Aussage ist bei einer Korrelation methodisch korrekt?',
    duration: 4.466,
  },
  question_q13a: {
    asset: 'quiz_question_q13a',
    text: 'Welche Standortaufgabe nennt die BBE ausdrücklich neben Umsatzprognosen?',
    duration: 5.5565,
  },
  question_q13b: {
    asset: 'quiz_question_q13b',
    text: 'Der Umsatz wächst zwei Jahre lang jeweils um 10 %. Wie groß ist das gesamte Wachstum?',
    duration: 7.3776,
  },
  question_q13c: {
    asset: 'quiz_question_q13c',
    text: 'Welche Formel beschreibt die Lagerumschlagshäufigkeit bei einheitlicher Bewertung?',
    duration: 5.6476,
  },
  question_q14a: {
    asset: 'quiz_question_q14a',
    text: 'Welche Aufgabe gehört laut BBE zum Bereich Immobilienberatung?',
    duration: 5.2406,
  },
  question_q14b: {
    asset: 'quiz_question_q14b',
    text: 'Eine Filiale erzielt 100 € Umsatz je Kauf bei 20 Käufen, eine zweite 40 € bei 80 Käufen. Wie hoch ist der gemeinsame Durchschnittsbon?',
    duration: 12.2013,
  },
  question_q14c: {
    asset: 'quiz_question_q14c',
    text: 'Ein Markt hat 10 Mio. € Kaufkraft, davon bindet ein Standort 30 %. Welcher gebundene Betrag ergibt sich im vereinfachten Modell?',
    duration: 11.3868,
  },
  question_q15a: {
    asset: 'quiz_question_q15a',
    text: 'Welche Kombination nennt die BBE als Basis guter Standortberatung?',
    duration: 5.5136,
  },
  question_q15b: {
    asset: 'quiz_question_q15b',
    text: 'Ein Projekt kostet heute 100.000 € und liefert in einem Jahr 110.000 €. Welchen Kapitalwert hat es bei 10 % Diskontsatz?',
    duration: 11.5834,
  },
  question_q15c: {
    asset: 'quiz_question_q15c',
    text: 'Ein Test zeigt mehr Umsatz nach einem Umbau. Was stärkt die Aussage, dass der Umbau die Ursache war?',
    duration: 8.1928,
  },
});

export const QUIZ_VOICE_ASSETS = Object.freeze({
  quiz_host_intro: {
    path: './assets/audio/quiz_host_intro.mp3',
    group: 'voice',
    duration: 7.442,
  },
  quiz_host_welcome: {
    path: './assets/audio/quiz_host_welcome.mp3',
    group: 'voice',
    duration: 8.9513,
  },
  quiz_host_lock: {
    path: './assets/audio/quiz_host_lock.mp3',
    group: 'voice',
    duration: 2.522,
  },
  quiz_host_correct: {
    path: './assets/audio/quiz_host_correct.mp3',
    group: 'voice',
    duration: 6.4111,
  },
  quiz_host_wrong: {
    path: './assets/audio/quiz_host_wrong.mp3',
    group: 'voice',
    duration: 6.8856,
  },
  quiz_host_safety: {
    path: './assets/audio/quiz_host_safety.mp3',
    group: 'voice',
    duration: 5.9269,
  },
  quiz_host_million: {
    path: './assets/audio/quiz_host_million.mp3',
    group: 'voice',
    duration: 5.2848,
  },
  quiz_host_exit: {
    path: './assets/audio/quiz_host_exit.mp3',
    group: 'voice',
    duration: 7.2165,
  },
  quiz_host_telephone: {
    path: './assets/audio/quiz_host_telephone.mp3',
    group: 'voice',
    duration: 8.1499,
  },
  quiz_host_fifty: {
    path: './assets/audio/quiz_host_fifty.mp3',
    group: 'voice',
    duration: 6.5301,
  },
  quiz_host_audience: {
    path: './assets/audio/quiz_host_audience.mp3',
    group: 'voice',
    duration: 8.2745,
  },
  quiz_host_next: {
    path: './assets/audio/quiz_host_next.mp3',
    group: 'voice',
    duration: 6.852,
  },
  quiz_question_q01a: {
    path: './assets/audio/quiz_question_q01a.mp3',
    group: 'voice',
    duration: 5.8968,
  },
  quiz_question_q01b: {
    path: './assets/audio/quiz_question_q01b.mp3',
    group: 'voice',
    duration: 4.661,
  },
  quiz_question_q01c: {
    path: './assets/audio/quiz_question_q01c.mp3',
    group: 'voice',
    duration: 5.3266,
  },
  quiz_question_q02a: {
    path: './assets/audio/quiz_question_q02a.mp3',
    group: 'voice',
    duration: 4.7953,
  },
  quiz_question_q02b: {
    path: './assets/audio/quiz_question_q02b.mp3',
    group: 'voice',
    duration: 3.8038,
  },
  quiz_question_q02c: {
    path: './assets/audio/quiz_question_q02c.mp3',
    group: 'voice',
    duration: 4.9673,
  },
  quiz_question_q03a: {
    path: './assets/audio/quiz_question_q03a.mp3',
    group: 'voice',
    duration: 4.7902,
  },
  quiz_question_q03b: {
    path: './assets/audio/quiz_question_q03b.mp3',
    group: 'voice',
    duration: 4.8957,
  },
  quiz_question_q03c: {
    path: './assets/audio/quiz_question_q03c.mp3',
    group: 'voice',
    duration: 2.1702,
  },
  quiz_question_q04a: {
    path: './assets/audio/quiz_question_q04a.mp3',
    group: 'voice',
    duration: 4.1387,
  },
  quiz_question_q04b: {
    path: './assets/audio/quiz_question_q04b.mp3',
    group: 'voice',
    duration: 4.5986,
  },
  quiz_question_q04c: {
    path: './assets/audio/quiz_question_q04c.mp3',
    group: 'voice',
    duration: 4.8863,
  },
  quiz_question_q05a: {
    path: './assets/audio/quiz_question_q05a.mp3',
    group: 'voice',
    duration: 3.8324,
  },
  quiz_question_q05b: {
    path: './assets/audio/quiz_question_q05b.mp3',
    group: 'voice',
    duration: 3.5592,
  },
  quiz_question_q05c: {
    path: './assets/audio/quiz_question_q05c.mp3',
    group: 'voice',
    duration: 5.212,
  },
  quiz_question_q06a: {
    path: './assets/audio/quiz_question_q06a.mp3',
    group: 'voice',
    duration: 5.4176,
  },
  quiz_question_q06b: {
    path: './assets/audio/quiz_question_q06b.mp3',
    group: 'voice',
    duration: 7.1195,
  },
  quiz_question_q06c: {
    path: './assets/audio/quiz_question_q06c.mp3',
    group: 'voice',
    duration: 2.8791,
  },
  quiz_question_q07a: {
    path: './assets/audio/quiz_question_q07a.mp3',
    group: 'voice',
    duration: 4.7808,
  },
  quiz_question_q07b: {
    path: './assets/audio/quiz_question_q07b.mp3',
    group: 'voice',
    duration: 8.7284,
  },
  quiz_question_q07c: {
    path: './assets/audio/quiz_question_q07c.mp3',
    group: 'voice',
    duration: 4.57,
  },
  quiz_question_q08a: {
    path: './assets/audio/quiz_question_q08a.mp3',
    group: 'voice',
    duration: 4.8909,
  },
  quiz_question_q08b: {
    path: './assets/audio/quiz_question_q08b.mp3',
    group: 'voice',
    duration: 10.6255,
  },
  quiz_question_q08c: {
    path: './assets/audio/quiz_question_q08c.mp3',
    group: 'voice',
    duration: 2.4867,
  },
  quiz_question_q09a: {
    path: './assets/audio/quiz_question_q09a.mp3',
    group: 'voice',
    duration: 5.911,
  },
  quiz_question_q09b: {
    path: './assets/audio/quiz_question_q09b.mp3',
    group: 'voice',
    duration: 7.9913,
  },
  quiz_question_q09c: {
    path: './assets/audio/quiz_question_q09c.mp3',
    group: 'voice',
    duration: 4.2158,
  },
  quiz_question_q10a: {
    path: './assets/audio/quiz_question_q10a.mp3',
    group: 'voice',
    duration: 4.3878,
  },
  quiz_question_q10b: {
    path: './assets/audio/quiz_question_q10b.mp3',
    group: 'voice',
    duration: 8.7095,
  },
  quiz_question_q10c: {
    path: './assets/audio/quiz_question_q10c.mp3',
    group: 'voice',
    duration: 4.9245,
  },
  quiz_question_q11a: {
    path: './assets/audio/quiz_question_q11a.mp3',
    group: 'voice',
    duration: 5.6283,
  },
  quiz_question_q11b: {
    path: './assets/audio/quiz_question_q11b.mp3',
    group: 'voice',
    duration: 9.8121,
  },
  quiz_question_q11c: {
    path: './assets/audio/quiz_question_q11c.mp3',
    group: 'voice',
    duration: 5.4514,
  },
  quiz_question_q12a: {
    path: './assets/audio/quiz_question_q12a.mp3',
    group: 'voice',
    duration: 5.461,
  },
  quiz_question_q12b: {
    path: './assets/audio/quiz_question_q12b.mp3',
    group: 'voice',
    duration: 8.8868,
  },
  quiz_question_q12c: {
    path: './assets/audio/quiz_question_q12c.mp3',
    group: 'voice',
    duration: 4.466,
  },
  quiz_question_q13a: {
    path: './assets/audio/quiz_question_q13a.mp3',
    group: 'voice',
    duration: 5.5565,
  },
  quiz_question_q13b: {
    path: './assets/audio/quiz_question_q13b.mp3',
    group: 'voice',
    duration: 7.3776,
  },
  quiz_question_q13c: {
    path: './assets/audio/quiz_question_q13c.mp3',
    group: 'voice',
    duration: 5.6476,
  },
  quiz_question_q14a: {
    path: './assets/audio/quiz_question_q14a.mp3',
    group: 'voice',
    duration: 5.2406,
  },
  quiz_question_q14b: {
    path: './assets/audio/quiz_question_q14b.mp3',
    group: 'voice',
    duration: 12.2013,
  },
  quiz_question_q14c: {
    path: './assets/audio/quiz_question_q14c.mp3',
    group: 'voice',
    duration: 11.3868,
  },
  quiz_question_q15a: {
    path: './assets/audio/quiz_question_q15a.mp3',
    group: 'voice',
    duration: 5.5136,
  },
  quiz_question_q15b: {
    path: './assets/audio/quiz_question_q15b.mp3',
    group: 'voice',
    duration: 11.5834,
  },
  quiz_question_q15c: {
    path: './assets/audio/quiz_question_q15c.mp3',
    group: 'voice',
    duration: 8.1928,
  },
});
