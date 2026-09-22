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
  lock_02: {
    asset: 'quiz_host_lock_02',
    text: 'Eingeloggt. Jetzt zählen Fakten.',
    duration: 2.5405,
  },
  lock_03: {
    asset: 'quiz_host_lock_03',
    text: 'Die Antwort steht. Keine neue Version.',
    duration: 2.8515,
  },
  lock_04: {
    asset: 'quiz_host_lock_04',
    text: 'Entschieden. Jetzt wird geprüft.',
    duration: 2.4636,
  },
  correct_02: {
    asset: 'quiz_host_correct_02',
    text: 'Richtig! Dafür braucht es keine zweite Meinung.',
    duration: 3.8942,
  },
  correct_03: {
    asset: 'quiz_host_correct_03',
    text: 'Genau! Die Folie können wir so lassen.',
    duration: 3.2319,
  },
  correct_04: {
    asset: 'quiz_host_correct_04',
    text: 'Volltreffer. Sogar der Kunde hätte nichts zu ändern.',
    duration: 4.0648,
  },
  correct_05: {
    asset: 'quiz_host_correct_05',
    text: 'Das stimmt. Ein Ergebnis ohne drei Abstimmungsrunden.',
    duration: 4.2297,
  },
  correct_06: {
    asset: 'quiz_host_correct_06',
    text: 'Richtig! Ihr Bauchgefühl hat offenbar Quellen.',
    duration: 3.7338,
  },
  correct_07: {
    asset: 'quiz_host_correct_07',
    text: 'Sehr gut. Diese Antwort ist wirklich final.',
    duration: 3.775,
  },
  wrong_02: {
    asset: 'quiz_host_wrong_02',
    text: 'Leider falsch. Das kommt auf die Lernkurve.',
    duration: 3.4293,
  },
  wrong_03: {
    asset: 'quiz_host_wrong_03',
    text: 'Das war es nicht. Auch ein schöner Titel rettet keine falsche Zahl.',
    duration: 4.898,
  },
  wrong_04: {
    asset: 'quiz_host_wrong_04',
    text: 'Leider daneben. Beim nächsten Mal prüfen wir die Annahme zuerst.',
    duration: 5.0293,
  },
  safety_02: {
    asset: 'quiz_host_safety_02',
    text: 'Die Sicherheitsstufe steht. Dieses Budget ist freigegeben.',
    duration: 4.4901,
  },
  safety_03: {
    asset: 'quiz_host_safety_03',
    text: 'Geschafft! Ein Polster, das keine Nachkalkulation mehr schrumpft.',
    duration: 5.4237,
  },
  million_02: {
    asset: 'quiz_host_million_02',
    text: 'Eine Million! Das nennen wir ein belastbares Ergebnis.',
    duration: 4.2407,
  },
  million_03: {
    asset: 'quiz_host_million_03',
    text: 'Sie haben die Million! Dafür gibt es ausnahmsweise Standing Ovations statt Feedback.',
    duration: 6.1142,
  },
  exit_02: {
    asset: 'quiz_host_exit_02',
    text: 'Gewinn gesichert. Eine Entscheidung mit positiver Bilanz.',
    duration: 4.2395,
  },
  exit_03: {
    asset: 'quiz_host_exit_03',
    text: 'Sie nehmen das Geld mit. Endlich mal ein sauberer Projektabschluss.',
    duration: 4.7909,
  },
  telephone_02: {
    asset: 'quiz_host_telephone_02',
    text: 'Benjamin ist dran. Hoffentlich hat er diesmal mehr als einen Neustart im Angebot.',
    duration: 6.0194,
  },
  telephone_03: {
    asset: 'quiz_host_telephone_03',
    text: 'Wir rufen Benjamin an. Kurze Frage, großer Unterstützungsbedarf.',
    duration: 5.7285,
  },
  fifty_02: {
    asset: 'quiz_host_fifty_02',
    text: 'Zwei Antworten fallen weg. So sieht eine echte Priorisierung aus.',
    duration: 4.9383,
  },
  fifty_03: {
    asset: 'quiz_host_fifty_03',
    text: 'Wir halbieren die Auswahl. Der Schwierigkeitsgrad bleibt Verhandlungssache.',
    duration: 5.3207,
  },
  audience_02: {
    asset: 'quiz_host_audience_02',
    text: 'Das Publikum stimmt ab. Heute bekommen wir die Marktforschung sofort.',
    duration: 5.0837,
  },
  audience_03: {
    asset: 'quiz_host_audience_03',
    text: 'Eine kurze Umfrage im Saal. Mal sehen, ob die Mehrheit eine Quelle hat.',
    duration: 5.8879,
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
  quiz_host_lock_02: {
    path: './assets/audio/quiz_host_lock_02.mp3',
    group: 'voice',
    duration: 2.5405,
  },
  quiz_host_lock_03: {
    path: './assets/audio/quiz_host_lock_03.mp3',
    group: 'voice',
    duration: 2.8515,
  },
  quiz_host_lock_04: {
    path: './assets/audio/quiz_host_lock_04.mp3',
    group: 'voice',
    duration: 2.4636,
  },
  quiz_host_correct_02: {
    path: './assets/audio/quiz_host_correct_02.mp3',
    group: 'voice',
    duration: 3.8942,
  },
  quiz_host_correct_03: {
    path: './assets/audio/quiz_host_correct_03.mp3',
    group: 'voice',
    duration: 3.2319,
  },
  quiz_host_correct_04: {
    path: './assets/audio/quiz_host_correct_04.mp3',
    group: 'voice',
    duration: 4.0648,
  },
  quiz_host_correct_05: {
    path: './assets/audio/quiz_host_correct_05.mp3',
    group: 'voice',
    duration: 4.2297,
  },
  quiz_host_correct_06: {
    path: './assets/audio/quiz_host_correct_06.mp3',
    group: 'voice',
    duration: 3.7338,
  },
  quiz_host_correct_07: {
    path: './assets/audio/quiz_host_correct_07.mp3',
    group: 'voice',
    duration: 3.775,
  },
  quiz_host_wrong_02: {
    path: './assets/audio/quiz_host_wrong_02.mp3',
    group: 'voice',
    duration: 3.4293,
  },
  quiz_host_wrong_03: {
    path: './assets/audio/quiz_host_wrong_03.mp3',
    group: 'voice',
    duration: 4.898,
  },
  quiz_host_wrong_04: {
    path: './assets/audio/quiz_host_wrong_04.mp3',
    group: 'voice',
    duration: 5.0293,
  },
  quiz_host_safety_02: {
    path: './assets/audio/quiz_host_safety_02.mp3',
    group: 'voice',
    duration: 4.4901,
  },
  quiz_host_safety_03: {
    path: './assets/audio/quiz_host_safety_03.mp3',
    group: 'voice',
    duration: 5.4237,
  },
  quiz_host_million_02: {
    path: './assets/audio/quiz_host_million_02.mp3',
    group: 'voice',
    duration: 4.2407,
  },
  quiz_host_million_03: {
    path: './assets/audio/quiz_host_million_03.mp3',
    group: 'voice',
    duration: 6.1142,
  },
  quiz_host_exit_02: {
    path: './assets/audio/quiz_host_exit_02.mp3',
    group: 'voice',
    duration: 4.2395,
  },
  quiz_host_exit_03: {
    path: './assets/audio/quiz_host_exit_03.mp3',
    group: 'voice',
    duration: 4.7909,
  },
  quiz_host_telephone_02: {
    path: './assets/audio/quiz_host_telephone_02.mp3',
    group: 'voice',
    duration: 6.0194,
  },
  quiz_host_telephone_03: {
    path: './assets/audio/quiz_host_telephone_03.mp3',
    group: 'voice',
    duration: 5.7285,
  },
  quiz_host_fifty_02: {
    path: './assets/audio/quiz_host_fifty_02.mp3',
    group: 'voice',
    duration: 4.9383,
  },
  quiz_host_fifty_03: {
    path: './assets/audio/quiz_host_fifty_03.mp3',
    group: 'voice',
    duration: 5.3207,
  },
  quiz_host_audience_02: {
    path: './assets/audio/quiz_host_audience_02.mp3',
    group: 'voice',
    duration: 5.0837,
  },
  quiz_host_audience_03: {
    path: './assets/audio/quiz_host_audience_03.mp3',
    group: 'voice',
    duration: 5.8879,
  },
});

// Each category keeps its original key first. Host selection is owned by the quiz controller.
export const QUIZ_HOST_VARIANTS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      lock: ['lock', 'lock_02', 'lock_03', 'lock_04'],
      correct: [
        'correct',
        'correct_02',
        'correct_03',
        'correct_04',
        'correct_05',
        'correct_06',
        'correct_07',
      ],
      wrong: ['wrong', 'wrong_02', 'wrong_03', 'wrong_04'],
      safety: ['safety', 'safety_02', 'safety_03'],
      million: ['million', 'million_02', 'million_03'],
      exit: ['exit', 'exit_02', 'exit_03'],
      telephone: ['telephone', 'telephone_02', 'telephone_03'],
      fifty: ['fifty', 'fifty_02', 'fifty_03'],
      audience: ['audience', 'audience_02', 'audience_03'],
    }).map(([key, values]) => [key, Object.freeze(values)]),
  ),
);
