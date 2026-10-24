import { emptyWorld, seedWorld, simulateTick } from '../src/sim.js';

let n = 0;
const rng = () => {
  n += 1;
  return (n * 17 % 100) / 100;
};

const lush = emptyWorld({
  size: 'small', temperature: 18, water: 70, vegetation: 80, danger: 10,
  creatures: { terrestrial: true, aquatic: true, crystal: true },
}, 'Lush');
seedWorld(lush, rng);
const plantsBefore = lush.plants.length;
for (let i = 0; i < 12; i++) simulateTick(lush, rng);
if (lush.plants.length < plantsBefore) throw new Error('temperate garden should not lose all plants immediately');
if (!lush.beings.some((b) => b.cat === 'terrestrial')) throw new Error('terrestrial missing');

const dry = emptyWorld({
  size: 'small', temperature: 48, water: 5, vegetation: 20, danger: 10,
  creatures: { aquatic: true, crystal: false, terrestrial: false },
}, 'Dry');
seedWorld(dry, rng);
const aqua = dry.beings.filter((b) => b.cat === 'aquatic').length;
for (let i = 0; i < 8; i++) simulateTick(dry, rng);
const aquaAfter = dry.beings.filter((b) => b.cat === 'aquatic').length;
if (aquaAfter >= aqua) throw new Error('aquatic life should decline without water');

const cold = emptyWorld({
  temperature: -5, water: 10, vegetation: 10, danger: 5,
  creatures: { crystal: true },
}, 'Cold');
seedWorld(cold, rng);
const crystal = cold.beings.find((b) => b.cat === 'crystal');
const energyBefore = crystal.energy;
for (let i = 0; i < 6; i++) simulateTick(cold, rng);
const crystalAfter = cold.beings.find((b) => b.cat === 'crystal');
if (!crystalAfter || crystalAfter.energy <= energyBefore) {
  throw new Error('crystal life should thrive in the cold');
}

console.log('sim ok');
