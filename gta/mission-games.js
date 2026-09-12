import { clamp } from './data.js';
const $ = (q) => document.querySelector(q);
export const SLIDE_TARGETS = {
  headline: { x: 10, y: 10 },
  chart: { x: 10, y: 35 },
  summary: { x: 65, y: 35 },
  logo: { x: 85, y: 85 },
  footer: { x: 10, y: 90 },
};
export function gradeSlide(draft, elapsed, focus) {
  const expected = [50, 28, 22];
  let content = 0;
  if (draft.title === 'Gartencenter dominieren den Beispielmarkt') content += 30;
  expected.forEach(
    (v, i) => (content += Math.max(0, 20 - Math.abs(Number(draft.values[i]) - v) * 2)),
  );
  if (draft.source === 'BBE Research · Fallbeispiel 2026') content += 10;
  let distance = 0;
  for (const [id, target] of Object.entries(SLIDE_TARGETS)) {
    const p = draft.positions[id];
    distance += Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
  }
  const alignment = clamp(100 - distance * 1.8);
  let layout = (draft.color === '#1e6d7d' ? 55 : 22) + clamp(45 - distance * 0.45, 0, 45);
  const speed = clamp(100 - Math.max(0, elapsed - 100) * 0.12, 55, 100);
  const score = content * 0.45 + layout * 0.25 + alignment * 0.25 + speed * 0.05;
  return {
    score: Math.round(score),
    metrics: {
      content: Math.round(content),
      layout: Math.round(layout),
      alignment: Math.round(alignment),
      speed: Math.round(speed),
    },
  };
}
export function gradeSelections(answers, correct) {
  let n = 0;
  for (let i = 0; i < correct.length; i++) if (answers[i] === correct[i]) n++;
  return Math.round((n / correct.length) * 100);
}
export function gradeMarket(selected) {
  const right = [0, 2, 4];
  const correct = right.filter((i) => selected.includes(i)).length;
  const wrong = selected.filter((i) => !right.includes(i)).length;
  return clamp(Math.round(((correct - wrong) * 100) / 3));
}
export function gradeExcel(margins, leader, sort) {
  const right = [30, 40, 25];
  let score = 0;
  right.forEach((v, i) => {
    const n = Number(margins[i]);
    if (margins[i] !== '' && Number.isFinite(n))
      score += Math.abs(n - v) < 0.15 ? 25 : Math.abs(n - v) < 2 ? 12 : 0;
  });
  if (leader === 'B') score += 15;
  if (sort === 'B,A,C') score += 10;
  return score;
}
export class Minigames {
  constructor(game) {
    this.game = game;
  }
  open(task) {
    if (task.type === 'slide' || task.type === 'revision') this.slide(task);
    else if (task.type === 'market') this.market(task);
    else if (task.type === 'excel') this.excel(task);
    else if (task.type === 'competition') this.competition(task);
    else if (task.type === 'interview') this.interview(task);
  }
  done(task, score, metrics = {}) {
    this.game.result(this.game.sim.finish(task.id, score, metrics));
  }
  slide(task) {
    const game = this.game;
    const revision = task.type === 'revision';
    let draft = task.draft || {
      title: 'Der deutsche Gartenmarkt wächst irgentwie',
      values: [42, 36, 22],
      source: 'Quelle: Bauchgefühl',
      color: '#d77547',
      positions: {
        headline: { x: 14, y: 14 },
        chart: { x: 13, y: 39 },
        summary: { x: 67, y: 32 },
        logo: { x: 81, y: 83 },
        footer: { x: 13, y: 88 },
      },
    };
    draft = JSON.parse(JSON.stringify(draft));
    let selected = 'headline',
      drag = null;
    const start = performance.now();
    const persist = () => {
      task.draft = draft;
      task.elapsed = (task.elapsed || 0) + (performance.now() - start) / 1000;
      game.sim.save();
    };
    game.open(
      revision ? `${task.title} · ${(task.revision || 0) + 1}/7` : task.title,
      `<div class="hint-inline"><b>Fallbeispiel:</b> Gartencenter 50 % · Baumärkte 28 % · Fachhandel 22 %.<br>Aussage wählen · BBE Petrol · fünf Elemente ausrichten.</div><div class="desktop"><div class="desktop-top"><span>BBE PowerPoint · ${revision ? `final_final_v${(task.revision || 0) + 1}.pptx` : 'gartenmarkt_2026.pptx'}</span><span id="slide-save-label">Entwurf</span></div><div class="desktop-nav"><b>START</b><span>Einfügen</span><span>Entwurf</span><span>Ansicht</span></div><div class="slide-workspace"><div class="slide-canvas" id="slide-canvas"><div class="slide-guide"></div><div class="slide-piece headline" data-piece="headline"></div><div class="slide-piece chart" data-piece="chart">${['Gartencenter', 'Baumärkte', 'Fachhandel'].map((name, i) => `<div class="chart-bar" data-bar="${i}"><b></b><span>${name}</span></div>`).join('')}</div><div class="slide-piece summary" data-piece="summary"><b>Wesentliche Erkenntnis</b><br>Gartencenter führen mit 50 %.<br><br>Klare Positionierung schafft Wachstum.</div><div class="slide-piece logo" data-piece="logo">BBE</div><div class="slide-piece footer" data-piece="footer"></div></div><aside class="slide-inspector"><label>Überschrift<select id="slide-title"><option>Der deutsche Gartenmarkt wächst irgentwie</option><option>Gartencenter dominieren den Beispielmarkt</option><option>Alle Anbieter sind gleich groß</option></select></label><label>Gartencenter (%)<input id="chart-0" type="number" min="0" max="100" step="1"></label><label>Baumärkte (%)<input id="chart-1" type="number" min="0" max="100" step="1"></label><label>Fachhandel (%)<input id="chart-2" type="number" min="0" max="100" step="1"></label><label>Diagrammfarbe<select id="slide-color"><option value="#d77547">Orange</option><option value="#1e6d7d">BBE Petrol</option><option value="#954b89">Violett</option></select></label><label>Quelle<select id="slide-source"><option>Quelle: Bauchgefühl</option><option>BBE Research · Fallbeispiel 2026</option><option>Internet, vermutlich</option></select></label></aside></div><div class="light-info">Ziehen oder ausrichten. <b id="selected-name">Überschrift</b><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="small" id="align-element" style="background:#1c5864;color:#fff">Ausrichten</button><button class="small" id="select-next" style="background:#d0ded6;color:#284b55">Nächstes Element</button><span id="position-readout" style="padding:6px;font-size:.75rem"></span></div></div></div><div class="editor-bottom"><p>${revision ? '„Bitte nur noch eine kleine Änderung.“' : 'Fokus bestimmt die Präzision.'}<br>Die Deadline läuft weiter.</p><div class="toolbar" style="margin:0"><button id="save-slide">Entwurf speichern</button><button class="primary" id="submit-slide">${revision ? 'Revision prüfen' : 'Folie abgeben'}</button></div></div>`,
      { eyebrow: `BBE DESKTOP · FOKUS ${Math.round(game.sim.s.focus)} %`, onClose: persist, task },
    );
    const names = {
      headline: 'Überschrift',
      chart: 'Diagramm',
      summary: 'Kernaussage',
      logo: 'Logo',
      footer: 'Quellenangabe',
    };
    const draw = () => {
      for (const [id, p] of Object.entries(draft.positions)) {
        const e = $(`[data-piece="${id}"]`);
        e.style.left = p.x + '%';
        e.style.top = p.y + '%';
        e.classList.toggle('selected', id === selected);
      }
      $('[data-piece="headline"]').textContent = draft.title;
      $('[data-piece="footer"]').textContent = draft.source;
      draft.values.forEach((v, i) => {
        const b = $(`[data-bar="${i}"]`);
        b.style.height = clamp(Number(v) || 0) * 1.25 + '%';
        b.style.background = draft.color;
        b.querySelector('b').textContent = v + ' %';
      });
      $('#selected-name').textContent = names[selected];
      const p = draft.positions[selected];
      $('#position-readout').textContent = `X ${p.x.toFixed(1)} % · Y ${p.y.toFixed(1)} %`;
    };
    $('#slide-title').value = draft.title;
    $('#slide-color').value = draft.color;
    $('#slide-source').value = draft.source;
    draft.values.forEach((v, i) => ($('#chart-' + i).value = v));
    $('#slide-title').onchange = (e) => {
      draft.title = e.target.value;
      draw();
    };
    $('#slide-color').onchange = (e) => {
      draft.color = e.target.value;
      draw();
    };
    $('#slide-source').onchange = (e) => {
      draft.source = e.target.value;
      draw();
    };
    draft.values.forEach(
      (_, i) =>
        ($('#chart-' + i).oninput = (e) => {
          draft.values[i] = clamp(Number(e.target.value) || 0);
          draw();
        }),
    );
    document.querySelectorAll('[data-piece]').forEach((el) => {
      el.onpointerdown = (e) => {
        selected = el.dataset.piece;
        const p = draft.positions[selected];
        drag = { id: selected, x: e.clientX, y: e.clientY, px: p.x, py: p.y };
        el.setPointerCapture(e.pointerId);
        e.preventDefault();
        draw();
      };
      el.onpointermove = (e) => {
        if (!drag || drag.id !== el.dataset.piece) return;
        const r = $('#slide-canvas').getBoundingClientRect(),
          p = draft.positions[selected];
        p.x = clamp(
          drag.px + ((e.clientX - drag.x) / r.width) * 100,
          0,
          selected === 'headline' ? 22 : 90,
        );
        p.y = clamp(
          drag.py + ((e.clientY - drag.y) / r.height) * 100,
          0,
          selected === 'chart' ? 49 : 94,
        );
        draw();
      };
      el.onpointerup = () => {
        if (drag && game.sim.s.focus < 30) {
          const p = draft.positions[selected];
          p.x = clamp(p.x + (Math.random() - 0.5), 0, 90);
        }
        drag = null;
        draw();
      };
      el.onpointercancel = () => (drag = null);
    });
    $('#align-element').onclick = () => {
      draft.positions[selected] = { ...SLIDE_TARGETS[selected] };
      draw();
    };
    $('#select-next').onclick = () => {
      const ids = Object.keys(SLIDE_TARGETS);
      selected = ids[(ids.indexOf(selected) + 1) % ids.length];
      draw();
    };
    $('#save-slide').onclick = () => {
      task.draft = JSON.parse(JSON.stringify(draft));
      game.sim.save();
      $('#slide-save-label').textContent = 'Gespeichert · ' + game.sim.clock;
      game.audio.play('click');
    };
    $('#submit-slide').onclick = () => {
      const r = gradeSlide(
        draft,
        (task.elapsed || 0) + (performance.now() - start) / 1000,
        game.sim.s.focus,
      );
      if (revision && r.score >= 75 && (task.revision || 0) < 6) {
        task.revision = (task.revision || 0) + 1;
        game.sim.s.revisions++;
        persist();
        game.modal.onClose = null;
        const ids = Object.keys(SLIDE_TARGETS),
          id = ids[task.revision % ids.length];
        task.draft.positions[id].x += task.revision % 2 ? 3 : -3;
        game.sim.mail(
          'Noch eine letzte Anpassung',
          `Revision ${task.revision + 1}/7: Bitte ${names[id]} noch einmal ausrichten. Danach wirklich final.`,
        );
        this.slide(task);
        return;
      }
      if (revision && r.score < 75) {
        game.toast(
          'Für die Freigabe fehlen noch Details.',
          'Mindestens 75 %. Prüfe Daten, Titel, Farbe und Ausrichtung.',
        );
        return;
      }
      if (revision) {
        game.sim.s.revisions++;
        game.sim.checkAchievements();
      }
      this.done(task, r.score, r.metrics);
    };
    draw();
  }
  market(task) {
    const facts = [
      [
        'Ein belastbares Zahlenpaar',
        'Umsatz 2025: 120 Mio. €. Umsatz 2026: 132 Mio. €. Wachstum: 10 %.',
      ],
      [
        'Eine sehr mutige Annahme',
        'Ein Interviewpartner kennt niemanden, der online kauft. Onlinehandel ist also irrelevant.',
      ],
      [
        'Ein methodisch sauberer Vergleich',
        'Wettbewerber mit gleichem Einzugsgebiet und vergleichbarer Fläche benchmarken.',
      ],
      [
        'Eine bequeme Hochrechnung',
        'Umsatz je Laden verdoppeln, weil die Zahl der PowerPoint-Folien sich verdoppelt hat.',
      ],
      [
        'Eine nachvollziehbare Einschränkung',
        'Stichprobe und Erhebungszeitraum transparent angeben; Ergebnisse vorsichtig übertragen.',
      ],
      [
        'Ein Klassiker aus der Schublade',
        'Eine Marktzahl ohne Jahr oder Quelle als aktuelle Tatsache übernehmen.',
      ],
    ];
    this.game.open(
      task.title,
      `<div class="hint-inline"><b>Drei belastbare Aussagen wählen.</b> Fehlwahl kostet Punkte.</div><div class="choice-list">${facts.map(([a, b], i) => `<label class="choice"><input type="checkbox" value="${i}" class="market-choice"><span><b>${a}</b>${b}</span></label>`).join('')}</div><div class="editor-bottom"><p>Fiktives Fallbeispiel</p><button class="primary" id="submit-market">Analyse abgeben</button></div>`,
      { task },
    );
    $('#submit-market').onclick = () => {
      const a = [...document.querySelectorAll('.market-choice:checked')].map((x) =>
        Number(x.value),
      );
      if (a.length !== 3) return this.game.toast('Bitte genau drei Aussagen auswählen.');
      this.done(task, gradeMarket(a));
    };
  }
  excel(task) {
    this.game.open(
      task.title,
      `<div class="hint-inline"><b>Marge (%) = (Umsatz − Wareneinsatz) ÷ Umsatz × 100</b></div><table class="data-table"><thead><tr><th>Standort</th><th>Umsatz (€)</th><th>Wareneinsatz (€)</th><th>Marge (%)</th></tr></thead><tbody>${[
        ['A · Schwabing', 180000, 126000],
        ['B · Maxvorstadt', 240000, 144000],
        ['C · Giesing', 120000, 90000],
      ]
        .map(
          ([n, r, c], i) =>
            `<tr><td>${n}</td><td>${r.toLocaleString('de-DE')}</td><td>${c.toLocaleString('de-DE')}</td><td><input aria-label="Marge ${n}" id="margin-${i}" type="number" step="0.1" min="-100" max="100"></td></tr>`,
        )
        .join(
          '',
        )}</tbody></table><label class="input-row"><span>Höchste Marge</span><select id="margin-leader"><option value="">Bitte wählen</option><option>A</option><option>B</option><option>C</option></select></label><label class="input-row"><span>Umsatz absteigend</span><select id="margin-sort"><option value="">Bitte wählen</option><option value="A,B,C">A → B → C</option><option value="B,A,C">B → A → C</option><option value="C,A,B">C → A → B</option></select></label><div class="editor-bottom"><button class="primary" id="submit-excel">Workbook abgeben</button></div>`,
      { task },
    );
    $('#submit-excel').onclick = () => {
      const a = [0, 1, 2].map((i) => $('#margin-' + i).value);
      if (a.some((v) => v === '') || !$('#margin-leader').value || !$('#margin-sort').value)
        return this.game.toast('Bitte alle Felder ausfüllen.');
      this.done(task, gradeExcel(a, $('#margin-leader').value, $('#margin-sort').value));
    };
  }
  classifications(task, title, rows, options, correct, quote) {
    this.game.open(
      title,
      `<div class="hint-inline">Passenden Schwerpunkt wählen. ${quote || ''}</div><div>${rows.map((row, i) => `<label class="input-row"><span>${row}</span><select id="class-${i}"><option value="">Bitte wählen</option>${options.map((o, j) => `<option value="${j}">${o}</option>`).join('')}</select></label>`).join('')}</div><div class="editor-bottom"><button class="primary" id="submit-class">Auswertung abgeben</button></div>`,
      { task },
    );
    $('#submit-class').onclick = () => {
      const a = rows.map((_, i) => $('#class-' + i).value);
      if (a.some((x) => x === '')) return this.game.toast('Bitte alle Aussagen zuordnen.');
      this.done(task, gradeSelections(a.map(Number), correct));
    };
  }
  competition(t) {
    this.classifications(
      t,
      t.title,
      [
        'GrünGut: 40 große Häuser, Garten, Möbel und Baumaterial.',
        'Pflanzwerk: Ein inhabergeführter Laden mit tiefer Pflanzenberatung.',
        'GardenClick: Ausschließlich Versand über den eigenen Webshop.',
        'Bau & Blatt: 130 Filialen mit einheitlichem Vollsortiment.',
        'Samenstube: Spezialgeschäft für seltene Saaten im Stadtviertel.',
        'BotanikDirekt: App, Versandlager und kein stationärer Verkauf.',
      ],
      ['Filialisierter Großflächenhandel', 'Spezialisierter Fachhandel', 'Online-Pure-Player'],
      [0, 1, 2, 0, 1, 2],
      'Fiktive Unternehmen.',
    );
  }
  interview(t) {
    this.classifications(
      t,
      t.title,
      [
        '„Bei der Konkurrenz zahle ich für das Gleiche zwei Euro weniger.“',
        '„Die Mitarbeiterin wusste sofort, was auf meinen Nordbalkon passt.“',
        '„Die regionalen Sorten finde ich nirgendwo sonst.“',
        '„Ohne die Rabattaktion hätte ich das nicht gekauft.“',
        '„Ich habe zehn Minuten gewartet, bis jemand Zeit hatte.“',
        '„Es gab leider keine torffreie Erde mehr.“',
      ],
      ['Preis', 'Service', 'Sortiment'],
      [0, 1, 2, 0, 1, 2],
    );
  }
  mystery(t) {
    this.game.open(
      t.title,
      `<div class="hint-inline">MAMMA BAO · Besuch auswerten</div><label class="input-row"><span>Was ist der kulinarische Schwerpunkt?</span><select id="mystery-kind"><option value="">Bitte wählen</option><option value="0">Handgezogene Nudeln & Bao</option><option value="1">Bayerische Küche</option><option value="2">Holzofenpizza</option></select></label><label class="input-row"><span>Spielpreis für gedämpfte Bao?</span><select id="mystery-price"><option value="">Bitte wählen</option><option value="0">4,20 €</option><option value="1">8,50 €</option><option value="2">18,90 €</option></select></label><div class="editor-bottom"><p>Restaurantbesuch ✓ · Servicegespräch ✓</p><button class="primary" id="submit-mystery">Bericht abgeben</button></div>`,
      { task: t },
    );
    $('#submit-mystery').onclick = () => {
      const a = $('#mystery-kind').value,
        b = $('#mystery-price').value;
      if (a === '' || b === '') return this.game.toast('Bitte beide Fragen beantworten.');
      this.done(t, 40 + (a === '0' ? 30 : 0) + (b === '1' ? 30 : 0));
    };
  }
  meeting(t) {
    const game = this.game;
    const steps = [
      {
        line: '„Wir brauchen einfach mehr Umsatz. Können Sie bis morgen eine Strategie liefern?“',
        choices: [
          '„Klar, morgen früh. Garantiert.“',
          '„Welche Zielgruppe und welches wirtschaftliche Ziel haben Priorität?“',
          '„Das steht bestimmt auf unserer Website.“',
        ],
        right: 1,
      },
      {
        line: '„Wir haben 28 Interviews. Reicht das für eine bundesweite Prognose?“',
        choices: [
          '„Für qualitative Muster ja. Für eine belastbare Hochrechnung brauchen wir weitere Daten.“',
          '„28 ist eine schöne Zahl. Das reicht.“',
          '„Ich ändere einfach die Überschrift zu repräsentativ.“',
        ],
        right: 0,
      },
      {
        line: '„Wie geht es jetzt konkret weiter?“',
        choices: [
          '„Wir melden uns irgendwann mit vielen Folien.“',
          '„Lassen Sie uns dazu ein Meeting über ein Meeting aufsetzen.“',
          '„Wir halten Ziel, Datenlücken und nächste Schritte mit Verantwortlichen und Termin fest.“',
        ],
        right: 2,
      },
    ];
    let stage = t.meetingStage || 0,
      score = t.meetingPartial || 0;
    const render = () => {
      const s = steps[stage];
      game.open(
        t.title,
        `<div class="eyebrow">FRAGE ${stage + 1}/3</div><h2>${s.line}</h2><div class="choice-list">${s.choices.map((c, i) => `<button class="choice" data-answer="${i}"><span>${c}</span></button>`).join('')}</div>`,
        { eyebrow: 'GABELSBERGERSTRASSE · KUNDENBÜRO', task: t },
      );
      document.querySelectorAll('[data-answer]').forEach(
        (b) =>
          (b.onclick = () => {
            if (Number(b.dataset.answer) === s.right) score++;
            stage++;
            t.meetingStage = stage;
            t.meetingPartial = score;
            if (stage === 3) {
              t.meetingScore = Math.round((score / 3) * 100);
              game.sim.stamp('meeting', 'met');
              game.close();
              game.toast('Kundentermin abgeschlossen.', 'Ergebnisse bei der BBE abgeben.');
            } else {
              game.sim.save();
              render();
            }
          }),
      );
    };
    render();
  }
}
