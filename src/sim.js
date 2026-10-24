export const CATEGORIES = [
  'terrestrial', 'aquatic', 'flying', 'luminous', 'crystal', 'energy', 'giant', 'intelligent',
];

export function emptyWorld(params, name) {
  return {
    id: `w_${Math.random().toString(36).slice(2, 8)}`,
    name: name || 'Jardin sans nom',
    params: normalizeParams(params),
    plants: [],
    beings: [],
    history: [],
    tick: 0,
    irrigation: 0,
    progress: 0,
    events: [],
  };
}

export function normalizeParams(p = {}) {
  return {
    size: p.size || 'small',
    terrain: p.terrain || 'plaine',
    gravity: clamp(num(p.gravity, 1), 0.4, 2),
    temperature: clamp(num(p.temperature, 18), -20, 60),
    water: clamp(num(p.water, 40), 0, 100),
    vegetation: clamp(num(p.vegetation, 40), 0, 100),
    danger: clamp(num(p.danger, 20), 0, 100),
    creatures: {
      terrestrial: true,
      aquatic: false,
      flying: false,
      luminous: false,
      crystal: false,
      energy: false,
      giant: false,
      intelligent: false,
      ...(p.creatures || {}),
    },
    resources: p.resources || 'balanced',
    climate: p.climate || 'calme',
  };
}

function num(v, d) { return Number.isFinite(+v) ? +v : d; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function extentOf(size) {
  if (size === 'large') return 52;
  if (size === 'medium') return 36;
  return 22;
}

export function seedWorld(world, rng = Math.random) {
  const p = world.params;
  const nPlants = Math.round((p.vegetation / 100) * (p.size === 'large' ? 18 : p.size === 'medium' ? 12 : 8));
  world.plants = [];
  for (let i = 0; i < nPlants; i++) {
    world.plants.push({ x: (rng() - 0.5) * extentOf(p.size) * 1.4, z: (rng() - 0.5) * extentOf(p.size) * 1.4, size: 0.6 + rng() * 0.8 });
  }
  world.beings = [];
  const counts = { terrestrial: 4, aquatic: 3, flying: 3, luminous: 2, crystal: 3, energy: 2, giant: 1, intelligent: 2 };
  for (const cat of CATEGORIES) {
    if (!p.creatures[cat]) continue;
    const n = p.size === 'small' ? Math.max(1, counts[cat] - 1) : counts[cat];
    for (let i = 0; i < n; i++) world.beings.push(makeBeing(cat, p, rng));
  }
  world.events = ['Le jardin vient d\'être semé.'];
}

function makeBeing(cat, p, rng) {
  return {
    id: `${cat}_${Math.random().toString(36).slice(2, 7)}`,
    cat,
    x: (rng() - 0.5) * extentOf(p.size),
    z: (rng() - 0.5) * extentOf(p.size),
    energy: 0.55,
    hostile: p.danger > 65 && (cat === 'terrestrial' || cat === 'giant' || cat === 'energy'),
  };
}

export function simulateTick(world, rng = Math.random) {
  const p = world.params;
  const events = [];
  const water = clamp(p.water + world.irrigation, 0, 120);
  const plantCap = Math.round(6 + p.vegetation / 8);
  const temperate = p.temperature >= 0 && p.temperature <= 34 && water >= 22;

  if (temperate && world.plants.length < plantCap && p.vegetation > 8 && rng() < 0.22) {
    const parent = world.plants[Math.floor(rng() * world.plants.length)];
    const x = parent ? parent.x + (rng() - 0.5) * 4 : (rng() - 0.5) * 10;
    const z = parent ? parent.z + (rng() - 0.5) * 4 : (rng() - 0.5) * 10;
    world.plants.push({ x, z, size: 0.35 });
    events.push('Une pousse apparaît.');
  }
  for (const plant of world.plants) {
    if (temperate) plant.size = Math.min(1.4, plant.size + 0.04);
    else plant.size -= 0.08;
  }
  const before = world.plants.length;
  world.plants = world.plants.filter((pl) => pl.size > 0.2);
  if (world.plants.length < before) events.push('Des plantes dépérissent.');

  const next = [];
  const caps = { terrestrial: 8, aquatic: 6, flying: 6, luminous: 5, crystal: 6, energy: 4, giant: 2, intelligent: 4 };
  for (const b of world.beings) {
    const diet = dietOf(b.cat, p, water);
    if (diet.eats && world.plants.length) {
      let nearest = world.plants[0];
      let best = Infinity;
      for (const pl of world.plants) {
        const d = (pl.x - b.x) ** 2 + (pl.z - b.z) ** 2;
        if (d < best) { best = d; nearest = pl; }
      }
      const dx = nearest.x - b.x;
      const dz = nearest.z - b.z;
      const mag = Math.hypot(dx, dz) || 1;
      const step = diet.speed;
      b.x += (dx / mag) * step;
      b.z += (dz / mag) * step;
      if (mag < 1.6) {
        nearest.size -= diet.bite;
        b.energy = Math.min(1.4, b.energy + 0.18);
      }
    } else if (!diet.static) {
      b.x += (rng() - 0.5) * diet.speed;
      b.z += (rng() - 0.5) * diet.speed;
    }
    b.energy += diet.delta;
    if (b.cat === 'energy' && p.danger > 50) {
      const prey = world.beings.find((o) => o !== b && (o.cat === 'terrestrial' || o.cat === 'flying'));
      if (prey) prey.energy -= 0.12;
    }
    if (b.energy <= 0) {
      events.push(label(b.cat) + ' disparaît.');
      continue;
    }
    next.push(b);
    const count = world.beings.filter((o) => o.cat === b.cat).length;
    if (b.energy > 1.05 && count < (caps[b.cat] || 6) && diet.reproduces && rng() < 0.35) {
      b.energy = 0.4;
      next.push({ ...makeBeing(b.cat, p, rng), x: b.x + 1, z: b.z + 1, energy: 0.4, hostile: b.hostile });
      events.push(label(b.cat) + ' se multiplie.');
    }
  }
  world.beings = next;

  const people = world.beings.filter((b) => b.cat === 'intelligent').length;
  const herbs = world.beings.filter((b) => b.cat === 'terrestrial' || b.cat === 'flying').length;
  if (people && herbs >= 2 && world.plants.length >= 4 && p.danger < 70) {
    world.progress += 1;
    world.irrigation = Math.min(20, world.irrigation + 1);
    if (world.progress === 3) events.push('La société du jardin irrigue le sol.');
  } else if (people && p.danger > 75) {
    world.progress = Math.max(0, world.progress - 1);
    world.irrigation = Math.max(0, world.irrigation - 1);
  }

  world.tick += 1;
  if (world.tick % 2 === 0) {
    world.history.push({
      t: world.tick,
      plants: world.plants.length,
      herb: herbs,
      aqua: world.beings.filter((b) => b.cat === 'aquatic').length,
    });
    if (world.history.length > 48) world.history.shift();
  }
  world.events = events.slice(-6);
  return events;
}

function dietOf(cat, p, water) {
  switch (cat) {
    case 'aquatic':
      return { eats: water >= 30, speed: 1.1, bite: 0.12, delta: water >= 30 ? -0.02 : -0.4, reproduces: water >= 30, static: false };
    case 'crystal':
      return { eats: false, speed: 0, bite: 0, delta: p.temperature < 10 && water < 50 ? 0.08 : water > 70 ? -0.28 : -0.03, reproduces: false, static: true };
    case 'energy':
      return { eats: false, speed: 1.4, bite: 0, delta: p.danger > 55 ? 0.06 : -0.08, reproduces: false, static: false };
    case 'giant':
      return { eats: true, speed: 0.7, bite: 0.35, delta: -0.04, reproduces: false, static: false };
    case 'flying':
      return { eats: true, speed: 1.8, bite: 0.1, delta: -0.03, reproduces: true, static: false };
    case 'luminous':
      return { eats: true, speed: 1.3, bite: 0.08, delta: p.vegetation > 35 ? -0.02 : -0.2, reproduces: true, static: false };
    case 'intelligent':
      return { eats: true, speed: 0.9, bite: 0.1, delta: -0.03, reproduces: false, static: false };
    default:
      return { eats: true, speed: 1.15, bite: 0.14, delta: -0.04, reproduces: true, static: false };
  }
}

export function label(cat) {
  return {
    terrestrial: 'Un rampeur',
    aquatic: 'Une forme aquatique',
    flying: 'Un planeur',
    luminous: 'Un organisme lumineux',
    crystal: 'Une forme cristalline',
    energy: 'Une entité énergétique',
    giant: 'Un géant',
    intelligent: 'Une personne',
  }[cat] || 'Une créature';
}
