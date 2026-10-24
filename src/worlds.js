import { extentOf } from './sim.js';

function box(game, cx, cy, cz, sx, sy, sz, color, extra = {}) {
  return game.addBox({ cx, cy, cz, sx, sy, sz, color, ...extra });
}

export function buildZero(game) {
  game.defaultUp = '+y';
  game.universeName = 'Point Zéro';
  game.markSpawn(0, 2, 10, 0);
  game.setTheme('zero');
  box(game, 0, 1, 0, 36, 2, 36, '#d9d0c0');
  box(game, 0, 2.05, 0, 28, 0.08, 28, '#f0e2c4', { solid: false, emissive: '#e7d3a4', emissiveIntensity: 0.35 });
  box(game, 0, 1, -22, 10, 2, 20, '#cfc4b0');
  box(game, 9, 4, -36, 22, 8, 2, '#efe6d4', { emissive: '#d9c8a2', emissiveIntensity: 0.2 });
  box(game, 18, 1, -32, 8, 2, 12, '#d5c7a4', { emissive: '#f2d48a', emissiveIntensity: 0.45 });
  box(game, 0, 3.2, -2, 1.4, 4.4, 1.4, '#f4efe4', { emissive: '#b9a4ff', emissiveIntensity: 0.55 });
  box(game, 2, 2.08, -29, 2.2, 0.12, 2.2, '#f6e7a8', { solid: false, emissive: '#ffe08a', emissiveIntensity: 0.8 });
  game.addZone({ id: 'lesson', kind: 'lesson', min: [14, 0.4, -38], max: [22, 6, -26] });
  game.addZone({ id: 'wh', kind: 'whitehole', min: [12, 1.2, -2], max: [17.5, 5, 5] });
  game.addPickup({ id: 'pz-mote-1', x: 8, y: 3.1, z: 8, resource: 'eclat', amount: 1, kind: 'mote' });
  game.addPickup({ id: 'pz-mote-2', x: -9, y: 3.2, z: 6, resource: 'eclat', amount: 1, kind: 'mote' });
  game.addPickup({ id: 'pz-mote-3', x: 2, y: 3.3, z: 15, resource: 'eclat', amount: 1, kind: 'mote' });
  game.addInteract({ id: 'monolith', x: 0, y: 3, z: -2, radius: 3.4, label: 'Toucher le monolithe', fn: (g) => g.talkMonolith() });
  game.addInteract({ id: 'sign-north', x: 2, y: 2.4, z: -29, radius: 2.4, label: 'Lire la dalle', fn: (g) => g.say('Dalle', 'Fais face au mur pâle, au nord. Ouvre les lois (G), choisis « vers le regard » ou « vers le nord », puis pose l’ancre. Marche vers l’est une fois le mur devenu sol.') });
  game.addInteract({ id: 'wh-sign', x: 14.5, y: 2.5, z: 1, radius: 2.2, label: 'Lire l’anneau', fn: (g) => g.say('Trou blanc', 'Ici la matière s’invente toute seule. Chaque naissance coûte à la stabilité du Point Zéro. Personne ne t’oblige à prendre.') });
  game.addInteract({ id: 'portal-giants', x: 12, y: 3, z: 8, radius: 2.6, label: 'Portail — Monde des Géants', fn: (g) => g.tryStoryTravel('giants') });
  game.addInteract({ id: 'portal-inv', x: -12, y: 3, z: 8, radius: 2.6, label: 'Portail — Monde inversé', fn: (g) => g.tryStoryTravel('inverted') });
  game.addInteract({ id: 'portal-boss', x: 0, y: 3, z: -8, radius: 2.8, label: 'Noyau de l’Architecte', fn: (g) => g.tryStoryTravel('arena') });
  game.addInteract({ id: 'creator', x: 0, y: 2.6, z: 16, radius: 2.6, label: 'Atelier de création', fn: (g) => g.openCreator() });
  arch(game, 12, 2, 8, '#f0c9a0');
  arch(game, -12, 2, 8, '#8ee7dc');
  arch(game, 0, 2, -8, '#ff8f8f');
  game.addLight(0, 7, -2, '#c8b6ff', 2.2, 18);
  game.addLight(12, 4, 8, '#ffc98a', 1.2, 10);
  game.addSphere(-70, 28, -90, 16, '#c4553a', 0.15);
  game.addSphere(80, 18, -70, 8, '#7ee0d6', 0.25);
  game.addStars(700, 200, '#f4efe4');
}

function arch(game, x, y, z, color) {
  box(game, x - 1.3, y + 1.6, z, 0.35, 3.2, 0.35, color, { emissive: color, emissiveIntensity: 0.4 });
  box(game, x + 1.3, y + 1.6, z, 0.35, 3.2, 0.35, color, { emissive: color, emissiveIntensity: 0.4 });
  box(game, x, y + 3.3, z, 3, 0.35, 0.35, color, { emissive: color, emissiveIntensity: 0.45 });
}

export function buildGiants(game) {
  const ruined = game.state.flags.village === 'ruined';
  game.defaultUp = '+y';
  game.universeName = 'Monde des Géants';
  game.markSpawn(0, 2, 28, Math.PI);
  game.setTheme('giants');
  const soil = ruined ? '#4a4034' : '#3f6a3c';
  const bone = ruined ? '#8a8174' : '#e7dcc8';
  box(game, 0, 1, 18, 44, 2, 44, soil);
  box(game, -8, 1, -16, 70, 2, 60, '#315433');
  box(game, 36, 1, -30, 42, 2, 42, ruined ? '#3a322c' : '#3d5a34');
  for (let i = 0; i < 7; i++) {
    const top = 2.35 + i * 0.48;
    box(game, -2, top - 0.28, -35 - i * 2.1, 8, 0.56, 2.2, bone);
  }
  box(game, -2, 5, -52, 14, 2, 12, bone);
  box(game, 2, 7, -60, 12, 2, 10, bone);
  box(game, -34, 1, 22, 40, 2, 14, '#2e4630');
  box(game, -52, 3.55, 22, 16, 1.05, 12, '#1d2a1e');
  box(game, -62, 1, 22, 22, 2, 22, '#243028');
  const trunks = [[-22, -8], [-30, -22], [-16, -28], [-34, 2], [-8, -36], [8, -8], [-26, -36]];
  trunks.forEach(([x, z], i) => {
    game.addCylinder({ x, y: 2 + 18, z, rt: 0.6, rb: 2.4, h: 36, color: i % 2 ? '#6a4a32' : '#7b5a3a', solid: true, solidH: 8 });
    game.addCylinder({ x, y: 2 + 33, z, rt: 7, rb: 2, h: 8, color: '#234026', solid: false });
  });
  game.addZone({ id: 'silence', kind: 'silence', min: [-74, 0, 10], max: [-50, 8, 34] });
  game.addZone({ id: 'grass', kind: 'stealth', min: [-36, 1.5, -34], max: [-10, 6, -6] });
  game.addZone({ id: 'whg', kind: 'whitehole', min: [10, 1.5, 30], max: [18, 6, 38] });
  game.addPickup({ id: 'g-os-1', x: 6, y: 2.6, z: -42, resource: 'os', amount: 2 });
  game.addPickup({ id: 'g-os-2', x: 46, y: 2.6, z: -36, resource: 'os', amount: 2 });
  game.addPickup({ id: 'g-os-3', x: -4, y: 6.4, z: -52, resource: 'os', amount: 1 });
  game.addPickup({ id: 'g-seve-1', x: -22, y: 2.6, z: -12, resource: 'seve', amount: 2 });
  game.addPickup({ id: 'g-seve-2', x: -30, y: 2.6, z: -24, resource: 'seve', amount: 2 });
  game.addPickup({ id: 'g-seve-3', x: 26, y: 2.6, z: -22, resource: 'seve', amount: 2 });
  game.addPickup({ id: 'g-eclat', x: -66, y: 2.8, z: 18, resource: 'eclat', amount: 1 });
  game.addPickup({
    id: 'g-relic', x: -68, y: 2.7, z: 28, resource: 'eclat', amount: 1, kind: 'relic',
    onTake: (g) => {
      g.state.flags.silenceRelic = true;
      g.addLore('relique-silence', 'Éclat froid', 'Au fond du silence, un éclat qui ne veut pas être une arme. Il rappelle une voix : tu as déjà écrit ces lois, puis tu les as brisées pour qu’elles redeviennent libres.');
      g.gainXp(25);
    },
  });
  game.addPickup({
    id: 'g-echo-hidden', x: -18, y: 2.8, z: 24, resource: 'eclat', amount: 1, hidden: true,
    onTake: (g) => g.addLore('echo-geant', 'Écho', 'Une lumière révèle ce que la pénombre gardait : une signature, la même que la tienne.'),
  });
  game.addInteract({ id: 'kael', x: 32, y: 2.5, z: -22, radius: 3, label: ruined ? 'Lire la trace' : 'Parler à Kael', fn: (g) => ruined ? g.talkRuin() : g.talkKael() });
  game.addInteract({ id: 'mira', x: -32, y: 3, z: -4, radius: 5, label: 'Parler à Mira', fn: (g) => g.talkMira() });
  game.addInteract({ id: 'spine', x: 2, y: 8.2, z: -60, radius: 3, label: 'Éclat de la colonne', fn: (g) => g.talkSpine() });
  game.addInteract({ id: 'silence-text', x: -62, y: 2.6, z: 14, radius: 2.6, label: 'Lire l’inscription', fn: (g) => g.talkSilence() });
  game.addInteract({ id: 'back-zero', x: 0, y: 2.6, z: 34, radius: 2.8, label: 'Retour au Point Zéro', fn: (g) => g.travel('zero') });
  arch(game, 0, 2, 34, '#f0c9a0');
  game.addInteract({ id: 'harv', x: 40, y: 3, z: -44, radius: 4.4, label: 'Examiner le moissonneur', fn: (g) => g.talkHarvester() });
  if (game.state.flags.harvesterAlive) {
    game.addCreature({ species: 'harvester', x: 40, y: 2, z: -44, scale: 1.7 });
    game.addProp({ id: 'bone', x: 49, y: 3.15, z: -44, sx: 2.8, sy: 2.2, sz: 2.4, color: '#efe4d0', dynamic: true, role: 'bone' });
    box(game, 49, 2.55, -44, 3, 1.1, 3, '#b7aa96');
  } else {
    box(game, 40, 2.6, -44, 4, 1.2, 4, '#2a2422');
  }
  game.addCreature({ species: 'kael', x: ruined ? 32 : 32, y: 2, z: ruined ? -22 : -20, scale: 1 });
  if (!ruined) game.addCreature({ species: 'mira', x: -32, y: 2, z: -6, scale: 5.2 });
  if (!game.state.flags.varakDead) game.addCreature({ species: 'varak', x: -24, y: 2, z: -8, scale: 5.4, waypoints: [[-24, -8], [-24, -30], [-8, -30], [-8, -8]] });
  game.addCreature({ species: 'orm', x: -8, y: 6, z: -50, scale: 6 });
  [[-18, -16], [-28, -18], [-14, -24], [-22, -6]].forEach(([x, z], i) => {
    game.addCreature({ species: 'lucane', x, y: 2, z, scale: 1, home: [x, z] });
  });
  [[-20, 6, -14], [-26, 7, -26], [-12, 5, -20]].forEach(([x, y, z]) => game.addCreature({ species: 'spore', x, y, z, scale: 1.4 }));
  game.addLight(-20, 12, -16, '#ffd27a', 1.4, 28);
  game.addLight(36, 8, -28, ruined ? '#663322' : '#ffb060', 1.3, 24);
  game.addSphere(-90, 40, -40, 22, '#f2d2a4', 0.05);
  game.addStars(400, 180, '#fff1d6');
}

export function buildInverted(game) {
  game.defaultUp = '+y';
  game.universeName = 'Monde inversé';
  game.markSpawn(0, 8, 6, Math.PI);
  game.setTheme('inverted');
  const stone = '#2a2340';
  const edge = '#7ee0d6';
  box(game, 0, 7, 0, 26, 2, 26, stone, { emissive: edge, emissiveIntensity: 0.08 });
  box(game, 19, 7, 0, 16, 2, 12, stone);
  box(game, -18, 7, 16, 18, 2, 14, '#332848');
  box(game, 0, 7, 22, 8, 2, 22, stone);
  box(game, 0, 7, 36, 16, 2, 14, '#3a2a4a');
  box(game, -2, 45, -4, 32, 2, 30, '#241c38', { emissive: '#3de0ff', emissiveIntensity: 0.12 });
  box(game, 20, 45, 14, 16, 2, 8, '#241c38', { emissive: '#3de0ff', emissiveIntensity: 0.12 });
  box(game, 23, 78, 6, 12, 2, 14, '#1a1530');
  box(game, 30, 20, 8, 4, 40, 46, '#221a36', { emissive: '#ff4fa3', emissiveIntensity: 0.06 });
  box(game, -20, 11, 24, 12, 8, 2, '#d7c4ff', { emissive: '#d7c4ff', emissiveIntensity: 0.2 });
  game.addWater({ x: 0, y: 33, z: -2, sx: 22, sy: 22, sz: 20, color: '#3ad7ea', pressure: false });
  game.addWater({ x: 23, y: 61.5, z: 6, sx: 10, sy: 31, sz: 12, color: '#1a6cff', pressure: true });
  game.addZone({ id: 'fusion', kind: 'fusion', min: [14, 20, -20], max: [24, 40, -12] });
  game.addZone({ id: 'coral', kind: 'stealth', min: [19, 52, 1], max: [28, 74, 11] });
  game.addPickup({ id: 'i-cristal-1', x: -6, y: 8.5, z: -4, resource: 'cristal', amount: 2 });
  game.addPickup({ id: 'i-cristal-2', x: -8, y: 42.4, z: -2, resource: 'cristal', amount: 2 });
  game.addPickup({ id: 'i-ecaille-1', x: 4, y: 30, z: -2, resource: 'ecaille', amount: 2 });
  game.addPickup({ id: 'i-ecaille-2', x: -5, y: 27, z: 2, resource: 'ecaille', amount: 1 });
  game.addPickup({ id: 'i-ecaille-3', x: 2, y: 36, z: -6, resource: 'ecaille', amount: 1 });
  game.addPickup({
    id: 'i-tablet', x: 23, y: 76.3, z: 6, resource: 'eclat', amount: 1, kind: 'relic',
    onTake: (g) => {
      g.state.flags.abyssTablet = true;
      g.addLore('abysse', 'Tablette de l’abysse', 'Même ici, sous une mer qui tombe vers le ciel, la phrase est la même : la Rupture a une signature, et elle n’est pas étrangère.');
      g.gainXp(30);
    },
  });
  game.addPickup({
    id: 'i-hidden', x: 8, y: 8.6, z: -8, resource: 'cristal', amount: 1, hidden: true,
    onTake: (g) => g.addLore('echo-mur', 'Écho du mur', 'La lumière montre une ville déjà détruite, puis reconstruite à l’envers.'),
  });
  game.addInteract({ id: 'sera', x: 27.2, y: 18, z: 18, radius: 3.2, label: 'Parler à Sera', fn: (g) => g.talkSera() });
  game.addInteract({ id: 'shrine-sol', x: 0, y: 8.4, z: -8, radius: 2.4, label: 'Faille du sol', fn: (g) => g.touchShrine('shrineSol') });
  game.addInteract({ id: 'shrine-ciel', x: -10, y: 43.2, z: 2, radius: 2.6, label: 'Faille du ciel', fn: (g) => g.touchShrine('shrineCiel') });
  game.addInteract({ id: 'shrine-mur', x: 27.4, y: 26, z: 8, radius: 2.8, label: 'Faille du mur', fn: (g) => g.touchShrine('shrineMur') });
  game.addInteract({ id: 'core-city', x: 27.3, y: 16, z: 22, radius: 2.6, label: 'Noyau civique', fn: (g) => g.talkCore() });
  game.addInteract({ id: 'ivo', x: -20, y: 8.4, z: 16, radius: 2.6, label: 'Parler à Ivo', fn: (g) => g.talkIvo() });
  game.addInteract({ id: 'bell', x: -20, y: 10, z: 22.4, radius: 2.4, label: 'Atteindre la cloche', fn: (g) => g.breakLoop() });
  game.addInteract({ id: 'echo', x: 2, y: 8.4, z: 36, radius: 2.6, label: 'Parler à l’écho', fn: (g) => g.talkEcho() });
  game.addInteract({ id: 'back', x: 0, y: 8.6, z: 11, radius: 2.6, label: 'Retour au Point Zéro', fn: (g) => g.travel('zero') });
  arch(game, 0, 8, 11, '#8ee7dc');
  marker(game, 0, 8.15, -8, '#f2d48a');
  marker(game, -10, 43.1, 2, '#7ee0ff');
  marker(game, 27.2, 26, 8, '#ff8ad8');
  box(game, 2, 8.4, 36, 0.6, 1.2, 0.6, '#8fd0ff', { solid: false, emissive: '#8fd0ff', emissiveIntensity: 1.2 });
  if (!game.state.flags.fusionCalmed) {
    game.addCylinder({ x: 19, y: 30, z: -16, rt: 0.4, rb: 1.2, h: 10, color: '#e7dcc8', solid: false });
  }
  game.addCreature({ species: 'sera', x: 27.2, y: 18, z: 16, scale: 1 });
  game.addCreature({ species: 'ivo', x: -20, y: 8, z: 16, scale: 1 });
  game.addCreature({ species: 'echo', x: 2, y: 8, z: 34, scale: 1 });
  game.addCreature({ species: 'raie', x: 6, y: 14, z: 4, scale: 1.3 });
  game.addCreature({ species: 'raie', x: -8, y: 16, z: -6, scale: 1.1 });
  [[2, 30, -2], [-4, 28, 1], [3, 35, -4]].forEach(([x, y, z]) => game.addCreature({ species: 'meduse', x, y, z, scale: 1 }));
  game.addCreature({ species: 'cristal', x: 27.5, y: 14, z: 4, scale: 1.1, plane: 27.6 });
  game.addCreature({ species: 'cristal', x: 27.5, y: 22, z: 12, scale: 1, plane: 27.6 });
  game.addCreature({ species: 'deformer', x: 10, y: 20, z: -10, scale: 1.2 });
  game.addCreature({ species: 'leviathan', x: 23, y: 64, z: 6, scale: 1.4 });
  if (game.state.flags.city === 'exploited') {
    [[26.5, 12, 18], [26.8, 20, 10], [26.4, 24, 24]].forEach(([x, y, z]) => game.addCreature({ species: 'drone', x, y, z, scale: 1 }));
  }
  game.addLight(0, 12, 0, '#7ee0d6', 1.6, 26);
  game.addLight(0, 40, -4, '#3de0ff', 1.8, 24);
  game.addLight(30, 20, 12, '#ff4fa3', 1.3, 18);
  game.addSphere(60, 50, -40, 14, '#ff5ea8', 0.2);
  game.addSphere(-50, -20, -30, 10, '#7ee0ff', 0.3);
  game.addStars(600, 190, '#d7d4ff');
}

function marker(game, x, y, z, color) {
  box(game, x, y, z, 1.2, 0.15, 1.2, color, { solid: false, emissive: color, emissiveIntensity: 0.9 });
}

export function buildArena(game) {
  game.defaultUp = '+y';
  game.universeName = 'Noyau';
  game.markSpawn(0, 2, 14, Math.PI);
  game.setTheme('arena');
  box(game, 0, 1, 0, 36, 2, 36, '#2a1618');
  box(game, 14, 1, 6, 8, 2, 8, '#3a1c20', { tag: 'plate-0' });
  box(game, -14, 1, 6, 8, 2, 8, '#3a1c20', { tag: 'plate-1' });
  box(game, 0, 1, -14, 10, 2, 8, '#3a1c20', { tag: 'plate-2' });
  game.bossPlates = ['plate-0', 'plate-1', 'plate-2'];
  game.addLight(0, 10, 0, '#ffb0a8', 2, 30);
  game.addSphere(0, 30, -20, 7, '#ff5a4a', 0.4);
  game.queueBoss = true;
}

export function buildCustom(game, world) {
  const p = world.params;
  const ext = extentOf(p.size);
  game.defaultUp = '+y';
  game.universeName = world.name;
  game.markSpawn(0, 2.2, ext * 0.35, Math.PI);
  const heat = p.temperature;
  game.setTheme('custom', {
    fog: heat < 5 ? 0x9fb4c8 : heat > 35 ? 0xc46a3a : 0x87a06a,
    near: p.climate === 'brume' ? 6 : 16,
    far: p.climate === 'brume' ? 28 : 90,
    sun: heat > 35 ? 0xffb080 : 0xfff0d0,
  });
  const floorColor = { plaine: '#6f8f52', archipel: '#c2b48a', canyon: '#a8643c', cristaux: '#b7c4e6', dunes: '#e0c27a' }[p.terrain] || '#6f8f52';
  box(game, 0, 0.4, 0, ext * 2, 2, ext * 2, floorColor);
  if (p.terrain === 'canyon') {
    box(game, -ext * 0.3, 2, 0, ext * 0.35, 3, ext * 1.2, '#8a4e32');
    box(game, ext * 0.35, 2.4, -2, ext * 0.3, 4, ext, '#9a5a38');
  } else if (p.terrain === 'archipel') {
    box(game, ext * 0.4, 1.2, ext * 0.3, ext * 0.5, 1.2, ext * 0.5, floorColor);
  } else if (p.terrain === 'dunes') {
    box(game, 4, 1.6, -2, ext * 0.7, 1.4, 6, '#efd090');
    box(game, -6, 1.5, 4, ext * 0.6, 1.2, 5, '#e6c27e');
  } else if (p.terrain === 'cristaux') {
    for (let i = 0; i < 6; i++) {
      game.addCylinder({ x: Math.cos(i) * ext * 0.4, y: 3, z: Math.sin(i * 1.7) * ext * 0.4, rt: 0.2, rb: 0.8, h: 4 + (i % 3), color: '#d5e4ff', solid: true, solidH: 4 });
    }
  }
  if (p.water > 20) {
    const w = 6 + p.water / 8;
    game.addWater({ x: -ext * 0.15, y: 2.2, z: -ext * 0.1, sx: w, sy: 2.2, sz: w * 0.8, color: '#3ec2d8', pressure: false });
  }
  const nRes = p.resources === 'rich' ? 8 : p.resources === 'poor' ? 2 : 5;
  const kinds = p.terrain === 'cristaux' ? ['cristal', 'cristal', 'os'] : ['seve', 'os', 'cristal'];
  for (let i = 0; i < nRes; i++) {
    const a = (i / nRes) * Math.PI * 2;
    game.addPickup({
      id: `${world.id}-res-${i}`,
      x: Math.cos(a) * ext * 0.55,
      y: 2.4,
      z: Math.sin(a) * ext * 0.55,
      resource: kinds[i % kinds.length],
      amount: 1,
    });
  }
  const trees = Math.round(p.vegetation / 12);
  for (let i = 0; i < trees; i++) {
    const a = i * 2.3;
    game.addCylinder({
      x: Math.cos(a) * ext * 0.45,
      y: 4,
      z: Math.sin(a) * ext * 0.4,
      rt: 0.2, rb: 0.45, h: 4, color: '#3e5a32', solid: true, solidH: 4,
    });
  }
  game.addInteract({ id: 'leave-custom', x: 0, y: 2.6, z: ext * 0.35 + 2, radius: 2.5, label: 'Revenir au Point Zéro', fn: (g) => g.travel('zero') });
  arch(game, 0, 2, ext * 0.35 + 2, '#d7e7c4');
  game.custom = world;
  game.beingMeshes = new Map();
  game.lifeGroup = game.addGroup();
  game.syncCustomLife();
  game.addStars(300, 140, '#fff8ea');
}
