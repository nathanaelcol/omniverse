import { worldToLocal, localToWorld, moveBody, upVector } from '../src/collision.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function near(a, b, e = 0.05) {
  return Math.abs(a - b) < e;
}

const ups = ['+y', '-y', '+x', '-x', '+z', '-z'];
for (const up of ups) {
  for (const p of [[1, 2, 3], [-4, 0.5, 8], [0, -3, 0]]) {
    const back = localToWorld(worldToLocal(p, up), up);
    assert(near(back[0], p[0]) && near(back[1], p[1]) && near(back[2], p[2]), `roundtrip ${up} ${p}`);
  }
  const localUp = worldToLocal(upVector(up), up);
  assert(near(localUp[0], 0) && near(localUp[1], 1) && near(localUp[2], 0), `up axis ${up} -> ${localUp}`);
}

const floor = { min: [-10, 0, -10], max: [10, 1, 10] };
let pos = [0, 5, 0];
let vel = [0, 0, 0];
for (let i = 0; i < 60; i++) {
  vel = [vel[0], vel[1] - 22 * 0.05, vel[2]];
  const step = moveBody(pos, vel, '+y', [floor], 0.05, 0.4, 1.7);
  pos = step.pos;
  vel = step.vel;
  if (step.grounded) break;
}
assert(near(pos[1], 1, 0.08), `lands on floor, y=${pos[1]}`);

pos = [0, 1, 0];
vel = [4, 0, 0];
for (let i = 0; i < 20; i++) {
  const step = moveBody(pos, vel, '+y', [floor], 0.05, 0.4, 1.7);
  pos = step.pos;
  vel = [4, step.vel[1], 0];
}
assert(pos[0] > 2 && pos[0] < 5, `walks on floor, x=${pos[0]}`);
assert(near(pos[1], 1, 0.1), `stays on floor while walking, y=${pos[1]}`);

const wall = { min: [2, 1, -2], max: [3.2, 4, 2] };
pos = [1.2, 1, 0];
vel = [6, 0, 0];
for (let i = 0; i < 30; i++) {
  const step = moveBody(pos, vel, '+y', [floor, wall], 0.05, 0.4, 1.7);
  pos = step.pos;
  vel = [6, step.vel[1], 0];
}
assert(pos[0] < 2, `blocked by wall, x=${pos[0]}`);

const stepBox = { min: [1, 1, -2], max: [4, 1.4, 2] };
pos = [0.2, 1, 0];
vel = [3, 0, 0];
for (let i = 0; i < 40; i++) {
  const step = moveBody(pos, vel, '+y', [floor, stepBox], 0.05, 0.4, 1.7);
  pos = step.pos;
  vel = [3, 0, 0];
}
assert(pos[1] > 1.2, `steps up, y=${pos[1]} x=${pos[0]}`);
assert(pos[0] > 1.5, `crosses the step, x=${pos[0]}`);

const side = { min: [0, 0, -5], max: [2, 10, 5] };
pos = [-3, 3, 0];
vel = [0, 0, 0];
let grounded = false;
for (let i = 0; i < 80; i++) {
  const fall = localToWorld([0, -18 * 0.05, 0], '-x');
  vel = [vel[0] + fall[0], vel[1] + fall[1], vel[2] + fall[2]];
  const step = moveBody(pos, vel, '-x', [side], 0.05, 0.4, 1.7);
  pos = step.pos;
  vel = step.vel;
  grounded = step.grounded;
  if (grounded) break;
}
assert(grounded, 'wall-walk finds the face');
assert(near(pos[0], 0, 0.15), `stands on min X, x=${pos[0]}`);

console.log('collision ok');
