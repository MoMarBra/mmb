import { label } from './world.js';

export const QUIZ_DISCOVERIES = Object.freeze({
  board: {
    title: 'Der Bon macht den Unterschied',
    text: 'Umsatz = Anzahl der Käufe × Durchschnittsbon. Veränderungen wirken miteinander, nicht nebeneinander.',
    speaker: 'BBE · Research',
  },
  benjamin: {
    title: 'Erst vergleichen. Dann behaupten.',
    text: 'Ein Umsatzplus nach einem Umbau beweist noch keine Ursache. Vergleichsstandorte helfen, Saison und andere Einflüsse zu trennen.',
    speaker: 'Benjamin · IT',
  },
  menu: {
    title: 'Die Marge sitzt im Nenner',
    text: 'Handelsspanne: (Nettoverkaufspreis − Nettoeinkaufspreis) / Nettoverkaufspreis. Beim Aufschlag teilst du dagegen durch den Einkaufspreis.',
    speaker: 'Augustenstraße · Marktbeobachtung',
  },
});

export class QuizDiscoveries {
  constructor(game) {
    this.g = game;
    const w = game.world;
    w.interact('office', 'quiz-clue-board', 'Research-Notiz ansehen', 7, 2.55, {
      kind: 'quiz-clue',
      data: 'board',
      radius: 1.15,
    });
    w.interact('office', 'quiz-clue-benjamin', 'Benjamins Methodentipp', -36.3, 2.7, {
      kind: 'quiz-clue',
      data: 'benjamin',
      radius: 1.15,
    });
    w.interact('restaurant', 'quiz-clue-menu', 'Kalkulationskarte ansehen', -3, -3.8, {
      kind: 'quiz-clue',
      data: 'menu',
      radius: 1.15,
    });
    label(w.groups.office, 'RESEARCH · NOTIZ', 7, 2.64, 3.86, 1.8, 0.22, {
      rotation: Math.PI,
      bg: '#173e4c',
      fg: '#d5bd79',
    });
    label(w.groups.office, 'METHODIK > BAUCHGEFÜHL', -39.8, 1.85, 3.3, 2.2, 0.25, {
      rotation: Math.PI / 2,
      bg: '#173e4c',
      fg: '#d5bd79',
    });
  }
  interact(item) {
    if (item?.kind !== 'quiz-clue') return false;
    const clue = QUIZ_DISCOVERIES[item.data];
    if (!clue) return true;
    const s = this.g.sim.s;
    s.quizDiscoveries ||= [];
    const fresh = !s.quizDiscoveries.includes(item.data);
    if (fresh) {
      s.quizDiscoveries.push(item.data);
      this.g.sim.save();
    }
    this.g.open(
      clue.title,
      `<div class="discovery-card"><span>${clue.speaker}</span><p>${clue.text}</p><small>${fresh ? 'Wissen entdeckt' : 'Wissen gespeichert'} · Hinweis im Quizssoir verfügbar</small><button id="quiz-clue-close" class="primary">Merken</button></div>`,
      { pause: true },
    );
    document.getElementById('quiz-clue-close').onclick = () => this.g.close();
    return true;
  }
}
