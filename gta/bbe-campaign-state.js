import { CAMPAIGN_MISSIONS, CAMPAIGN_VARIANTS, RESEARCH_SHOPS } from './bbe-campaign-data.js';
const ids = CAMPAIGN_MISSIONS.map((m) => m.id);
const object = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const integer = (n, low, high, fallback = low) =>
  Number.isFinite(n) ? Math.max(low, Math.min(high, Math.floor(n))) : fallback;
const oneOf = (v, options, fallback = '') => (options.includes(v) ? v : fallback);
export const freshCampaign = () => ({
  version: 1,
  active: null,
  completed: [],
  claimed: [],
  attempts: {},
  best: {},
  choices: { priority: '', methods: {}, recommendation: '', backup: false },
  discoveries: [],
});
export function normalizeCampaign(value) {
  const v = object(value),
    s = freshCampaign();
  s.completed = ids.filter((id) => Array.isArray(v.completed) && v.completed.includes(id));
  s.claimed = ids.filter((id) => Array.isArray(v.claimed) && v.claimed.includes(id));
  // A finished chapter remains paid even if a stale save omitted its reward flag.
  s.claimed = ids.filter((id) => s.claimed.includes(id) || s.completed.includes(id));
  for (const id of ids) {
    s.attempts[id] = integer(object(v.attempts)[id], 0, 9999);
    s.best[id] = integer(object(v.best)[id], 0, 100);
  }
  const choices = object(v.choices);
  s.choices.priority = oneOf(choices.priority, ['decision', 'risks', 'numbers']);
  s.choices.recommendation = oneOf(choices.recommendation, ['pilot', 'service', 'price']);
  s.choices.backup = choices.backup === true;
  for (const id of ['dogtown', 'zitronengras'])
    s.choices.methods[id] = oneOf(object(choices.methods)[id], ['observe', 'talk']);
  s.discoveries = ['brief', 'sources', 'backup', 'average', 'client'].filter(
    (id) => Array.isArray(v.discoveries) && v.discoveries.includes(id),
  );
  const a = object(v.active),
    mission = CAMPAIGN_MISSIONS.find((m) => m.id === a.id);
  if (mission) {
    s.active = {
      id: mission.id,
      phase: oneOf(a.phase, ['intro', 'play', 'outro', 'failed'], 'intro'),
      variant: integer(a.variant, 0, CAMPAIGN_VARIANTS.length - 1),
      remaining: Number.isFinite(a.remaining)
        ? Math.max(0, Math.min(mission.seconds, a.remaining))
        : mission.seconds,
      elapsed: Number.isFinite(a.elapsed) ? Math.max(0, Math.min(86400, a.elapsed)) : 0,
      mistakes: integer(a.mistakes, 0, 100),
      step: integer(a.step, 0, 5),
      tasks: [
        'brief',
        'papers',
        'av',
        'seats',
        'dogtown',
        'zitronengras',
        'report',
        'diagnose',
        'power',
        'backup',
        'restore',
      ].filter((id) => Array.isArray(a.tasks) && a.tasks.includes(id)),
      cable: ['screen', 'sound', 'power'].filter(
        (id) => Array.isArray(a.cable) && a.cable.includes(id),
      ),
      circuits: integer(a.circuits, 0, 3),
      restore: integer(a.restore, 0, 3),
      approaches: {},
      interviews: [],
      hurry: a.hurry === true,
    };
    for (const id of ['dogtown', 'zitronengras'])
      s.active.approaches[id] = oneOf(object(a.approaches)[id], ['observe', 'talk']);
    s.active.interviews = ['dogtown', 'zitronengras'].filter(
      (id) => Array.isArray(a.interviews) && a.interviews.includes(id),
    );
  }
  return s;
}
export function campaignUnlocked(s, id) {
  const i = ids.indexOf(id);
  return i >= 0 && (i === 0 || s.completed.includes(ids[i - 1]) || s.completed.includes(id));
}
export function startCampaign(s, id) {
  if (!campaignUnlocked(s, id)) return { ok: false, reason: 'locked' };
  if (s.active) return { ok: s.active.id === id, resume: s.active.id === id, reason: 'active' };
  const m = CAMPAIGN_MISSIONS.find((m) => m.id === id),
    attempts = (s.attempts[id] || 0) + 1;
  s.attempts[id] = attempts;
  s.active = {
    id,
    phase: 'intro',
    variant: (attempts - 1) % CAMPAIGN_VARIANTS.length,
    remaining: m.seconds,
    elapsed: 0,
    mistakes: 0,
    step: 0,
    tasks: [],
    cable: [],
    circuits: 0,
    restore: 0,
    approaches: {},
    interviews: [],
    hurry: false,
  };
  return { ok: true, resume: false };
}
export const campaignVariant = (s) => CAMPAIGN_VARIANTS[s.active?.variant || 0];
export function campaignReady(s) {
  const a = s.active;
  if (!a) return false;
  const needs = {
    meeting: ['brief', 'papers', 'av', 'seats'],
    research: ['dogtown', 'zitronengras', 'report'],
    night: ['diagnose', 'power', 'backup', 'restore'],
  };
  return a.id === 'pitch' ? a.step >= 5 : needs[a.id].every((id) => a.tasks.includes(id));
}
function discover(s, id) {
  if (!s.discoveries.includes(id)) s.discoveries.push(id);
}
function task(a, id) {
  if (!a.tasks.includes(id)) a.tasks.push(id);
}
export function campaignAction(s, action) {
  const a = s.active,
    t = object(action),
    v = campaignVariant(s);
  if (!a) return { ok: false, reason: 'inactive' };
  if (t.type === 'begin' && a.phase === 'intro') {
    a.phase = 'play';
    return { ok: true };
  }
  if (t.type === 'retry' && a.phase === 'failed') {
    a.phase = 'play';
    a.remaining = CAMPAIGN_MISSIONS.find((m) => m.id === a.id).seconds;
    a.hurry = false;
    return { ok: true };
  }
  if (a.phase !== 'play') return { ok: false, reason: 'phase' };
  const wrong = (reason = 'answer') => {
    a.mistakes++;
    if (a.remaining > 0) a.remaining = Math.max(1, a.remaining - 6);
    return { ok: false, reason };
  };
  const done = () => {
    if (campaignReady(s)) a.phase = 'outro';
    return { ok: true, complete: a.phase === 'outro' };
  };
  if (a.id === 'meeting') {
    if (t.type === 'brief') {
      if (t.answer !== v.priority) return wrong();
      task(a, 'brief');
      s.choices.priority = t.answer;
      discover(s, 'brief');
      return done();
    }
    if (t.type === 'papers') {
      if (t.answer !== 'freigegeben') return wrong();
      task(a, 'papers');
      return done();
    }
    if (t.type === 'cable') {
      const pairs = { HDMI: 'screen', USB: 'sound', Netzteil: 'power' };
      if (!pairs[t.answer] || pairs[t.answer] !== t.target) return wrong('cable');
      if (!a.cable.includes(t.target)) a.cable.push(t.target);
      if (a.cable.length === 3) task(a, 'av');
      return done();
    }
    if (t.type === 'seats') {
      if (!['brief', 'papers', 'av'].every((id) => a.tasks.includes(id)))
        return { ok: false, reason: 'dependencies' };
      if (t.answer !== s.choices.priority) return wrong();
      task(a, 'seats');
      return done();
    }
  }
  if (a.id === 'research') {
    const shop = RESEARCH_SHOPS.find((p) => p.id === t.shop);
    if (
      t.type === 'approach' &&
      shop &&
      ['observe', 'talk'].includes(t.answer) &&
      !a.tasks.includes(shop.id)
    ) {
      a.approaches[shop.id] = t.answer;
      return { ok: true };
    }
    if (t.type === 'observation' && shop && a.approaches[shop.id] === 'observe') {
      if (Number(t.answer) !== shop.served + a.variant) return wrong('count');
      task(a, shop.id);
      s.choices.methods[shop.id] = 'observe';
      discover(s, 'sources');
      return done();
    }
    if (t.type === 'interview' && shop && a.approaches[shop.id] === 'talk') {
      if (t.answer !== 'statement') return wrong('source');
      task(a, shop.id);
      s.choices.methods[shop.id] = 'talk';
      if (!a.interviews.includes(shop.id)) a.interviews.push(shop.id);
      discover(s, 'sources');
      return done();
    }
    if (t.type === 'report') {
      if (!['dogtown', 'zitronengras'].every((id) => a.tasks.includes(id)))
        return { ok: false, reason: 'dependencies' };
      if (!['pilot', 'service', 'price'].includes(t.answer)) return wrong();
      s.choices.recommendation = t.answer;
      task(a, 'report');
      return done();
    }
  }
  if (a.id === 'night') {
    if (t.type === 'diagnose') {
      if (t.answer !== v.incident) return wrong();
      task(a, 'diagnose');
      return done();
    }
    if (t.type === 'circuit') {
      if (!a.tasks.includes('diagnose')) return { ok: false, reason: 'dependencies' };
      if (t.answer !== v.fuse[a.circuits]) {
        a.circuits = 0;
        return wrong('sequence');
      }
      a.circuits++;
      if (a.circuits === 3) task(a, 'power');
      return done();
    }
    if (t.type === 'backup') {
      if (!a.tasks.includes('power')) return { ok: false, reason: 'dependencies' };
      if (t.answer !== 'reviewed') return wrong('backup');
      task(a, 'backup');
      s.choices.backup = true;
      discover(s, 'backup');
      return done();
    }
    if (t.type === 'restore') {
      if (!a.tasks.includes('backup')) return { ok: false, reason: 'dependencies' };
      if (t.answer !== ['evidence', 'insight', 'action'][a.restore]) {
        a.restore = 0;
        return wrong('sequence');
      }
      a.restore++;
      if (a.restore === 3) task(a, 'restore');
      return done();
    }
  }
  if (a.id === 'pitch' && t.type === 'pitch') {
    const bothMeasured = ['dogtown', 'zitronengras'].every(
      (id) => s.choices.methods[id] === 'observe',
    );
    const expected = [
      s.choices.priority || 'decision',
      'basket',
      String(v.lift),
      bothMeasured ? 'sample' : 'mixed',
      s.choices.recommendation === 'service'
        ? 'service-test'
        : s.choices.recommendation === 'price'
          ? 'price-test'
          : 'pilot',
    ];
    if (String(t.answer) !== expected[a.step]) return wrong('pitch');
    a.step++;
    if (a.step === 3) discover(s, 'average');
    if (a.step === 5) discover(s, 'client');
    return done();
  }
  return { ok: false, reason: 'action' };
}
export function tickCampaign(s, dt, { paused = false } = {}) {
  const a = s.active;
  if (!a || a.phase !== 'play' || paused || !Number.isFinite(dt) || dt <= 0)
    return { failed: false };
  const delta = Math.min(dt, 0.25); // Hidden tabs and suspended frames cannot consume a deadline.
  a.elapsed += delta;
  const m = CAMPAIGN_MISSIONS.find((m) => m.id === a.id);
  if (m.seconds) {
    a.remaining = Math.max(0, a.remaining - delta);
    if (!a.remaining) {
      a.phase = 'failed';
      return { failed: true };
    }
  }
  return { failed: false };
}
export function campaignScore(s) {
  const a = s.active;
  return a
    ? Math.max(40, Math.min(100, Math.round(100 - a.mistakes * 6 - (a.elapsed > 600 ? 5 : 0))))
    : 0;
}
export function finishCampaign(sim) {
  const s = sim.s.bbeCampaign,
    a = s?.active;
  if (!a || a.phase !== 'outro' || !campaignReady(s)) return { ok: false, paid: 0 };
  const m = CAMPAIGN_MISSIONS.find((m) => m.id === a.id),
    score = campaignScore(s),
    paid = s.claimed.includes(a.id) ? 0 : m.reward,
    before = sim.level;
  // Claim before emitting UI/events: duplicate callbacks and reloads cannot grant another reward.
  if (!s.claimed.includes(a.id)) s.claimed.push(a.id);
  if (!s.completed.includes(a.id)) s.completed.push(a.id);
  s.best[a.id] = Math.max(s.best[a.id] || 0, score);
  s.active = null;
  if (paid) {
    sim.transaction(paid, 'BBE Kampagne · ' + m.title);
    sim.s.xp += m.xp;
    sim.change('rep', m.rep);
  }
  if (sim.level > before)
    sim.emit('promotion', 'Beförderung: ' + sim.career.name, { perk: sim.career.perk });
  sim.save();
  return { ok: true, id: m.id, paid, xp: paid ? m.xp : 0, rep: paid ? m.rep : 0, score };
}
