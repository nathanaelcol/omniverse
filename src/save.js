const KEY = 'omniverse.save.v1';

export function defaultState() {
  return {
    version: 1,
    playtime: 0,
    universe: 'zero',
    player: {
      x: 0, y: 2, z: 10, yaw: 0, pitch: -0.25,
      hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, oxygen: 100, xp: 0,
    },
    inventory: { eclat: 0, os: 0, seve: 0, cristal: 0, ecaille: 0 },
    laws: { gravity: false, light: false, matter: false, energy: false, life: false, space: false, time: false },
    upgrades: { anchorRadius: 16, anchorCount: 1, anchorDuration: 42 },
    tools: { gauntlet: false, beacon: false, suit: false },
    codex: {},
    quests: { awakening: { step: 0 } },
    flags: {
      gravityUnlocked: false,
      gravityLesson: false,
      tutorialMotes: 0,
      visited: {},
      regions: {},
      village: 'intact',
      mira: 'neutral',
      ormAwake: false,
      varakDead: false,
      harvesterAlive: true,
      city: 'intact',
      shrineSol: false,
      shrineCiel: false,
      shrineMur: false,
      loopBroken: false,
      fusionCalmed: false,
      copyNoted: false,
      silenceRead: false,
      silenceRelic: false,
      abyssTablet: false,
      whiteHoleUses: 0,
      fragments: { giants: false, inverted: false },
      bossUnlocked: false,
      ending: null,
      civProgress: { roots: 0, murmur: 0 },
      civGift: { roots: false, murmur: false },
      seed: false,
    },
    relations: { roots: 20, murmur: 15 },
    stability: { zero: 100, giants: 100, inverted: 100, arena: 100 },
    buildings: [],
    worlds: [],
    picked: {},
    journal: [],
    stats: { edits: 0, scans: 0, harvests: 0, anchors: 0 },
    safe: null,
  };
}

export function defaultSettings() {
  return { sensitivity: 0.0022, volume: 0.4, quality: 'high', invertY: false, shake: true };
}

function merge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base.slice();
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], extra && typeof extra === 'object' ? extra[k] : undefined);
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      for (const k of Object.keys(extra)) if (!(k in out)) out[k] = extra[k];
    }
    return out;
  }
  return extra === undefined ? base : extra;
}

export function sanitize(data) {
  if (!data || typeof data !== 'object') throw new Error('vide');
  const state = merge(defaultState(), data.state || data);
  if (state.version !== 1) throw new Error('version');
  return state;
}

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { slots: [null, null, null], auto: null };
    const parsed = JSON.parse(raw);
    return {
      slots: Array.isArray(parsed.slots) ? parsed.slots.slice(0, 3) : [null, null, null],
      auto: parsed.auto || null,
    };
  } catch {
    return { slots: [null, null, null], auto: null, broken: true };
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function slotSummary(entry) {
  if (!entry) return null;
  try {
    const state = sanitize(entry);
    return {
      savedAt: entry.savedAt,
      universe: state.universe,
      playtime: state.playtime,
      ending: state.flags.ending,
    };
  } catch {
    return { broken: true, savedAt: entry.savedAt };
  }
}

export function listSaves() {
  const all = readAll();
  return { slots: all.slots.map(slotSummary), auto: slotSummary(all.auto), broken: !!all.broken };
}

export function saveSlot(index, state) {
  const all = readAll();
  const entry = { savedAt: new Date().toISOString(), version: 1, state };
  if (index === 'auto') all.auto = entry;
  else all.slots[index] = entry;
  writeAll(all);
  return entry;
}

export function loadSlot(index) {
  const all = readAll();
  const entry = index === 'auto' ? all.auto : all.slots[index];
  if (!entry) throw new Error('Aucune sauvegarde dans cet emplacement.');
  return sanitize(entry);
}

export function deleteSlot(index) {
  const all = readAll();
  if (index === 'auto') all.auto = null;
  else all.slots[index] = null;
  writeAll(all);
}

export function exportState(state) {
  return JSON.stringify({ savedAt: new Date().toISOString(), version: 1, state }, null, 2);
}

export function importState(text) {
  return sanitize(JSON.parse(text));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem('omniverse.settings');
    return merge(defaultSettings(), raw ? JSON.parse(raw) : {});
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings) {
  localStorage.setItem('omniverse.settings', JSON.stringify(settings));
}
