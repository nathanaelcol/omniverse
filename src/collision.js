const EPS = 0.001;

export function worldToLocal(v, up) {
  const x = v[0], y = v[1], z = v[2];
  switch (up) {
    case '+y': return [x, y, z];
    case '-y': return [x, -y, -z];
    case '+x': return [z, x, -y];
    case '-x': return [z, -x, -y];
    case '+z': return [x, z, -y];
    case '-z': return [x, -z, y];
    default: return [x, y, z];
  }
}

export function localToWorld(v, up) {
  const x = v[0], y = v[1], z = v[2];
  switch (up) {
    case '+y': return [x, y, z];
    case '-y': return [x, -y, -z];
    case '+x': return [y, -z, x];
    case '-x': return [-y, -z, x];
    case '+z': return [x, -z, y];
    case '-z': return [x, z, -y];
    default: return [x, y, z];
  }
}

export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function len(a) { return Math.hypot(a[0], a[1], a[2]); }
export function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
export function norm(a) {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export function lerp(a, b, t) { return add(a, scale(sub(b, a), t)); }

export function upVector(up) { return localToWorld([0, 1, 0], up); }
export function fallVector(up) { return localToWorld([0, -1, 0], up); }

export function basis(up) {
  return {
    right: localToWorld([1, 0, 0], up),
    up: upVector(up),
    forward: localToWorld([0, 0, 1], up),
  };
}

export function fallLabel(up) {
  switch (up) {
    case '+y': return 'vers le bas';
    case '-y': return 'vers le haut';
    case '-x': return "vers l'est";
    case '+x': return "vers l'ouest";
    case '+z': return 'vers le nord';
    case '-z': return 'vers le sud';
    default: return 'inconnue';
  }
}

export function upFromFallAxis(axis, sign) {
  if (axis === 'y') return sign > 0 ? '-y' : '+y';
  if (axis === 'x') return sign > 0 ? '-x' : '+x';
  return sign > 0 ? '-z' : '+z';
}

export function snapUpFromDirection(dir) {
  const ax = Math.abs(dir[0]);
  const ay = Math.abs(dir[1]);
  const az = Math.abs(dir[2]);
  if (ay >= ax && ay >= az) return dir[1] > 0 ? '-y' : '+y';
  if (ax >= az) return dir[0] > 0 ? '-x' : '+x';
  return dir[2] > 0 ? '-z' : '+z';
}

export function transformAabb(box, up) {
  const xs = [box.min[0], box.max[0]];
  const ys = [box.min[1], box.max[1]];
  const zs = [box.min[2], box.max[2]];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const p = worldToLocal([x, y, z], up);
        for (let i = 0; i < 3; i++) {
          if (p[i] < min[i]) min[i] = p[i];
          if (p[i] > max[i]) max[i] = p[i];
        }
      }
    }
  }
  return { min, max };
}

function overlap(p, s, r, h) {
  return p[0] + r > s.min[0] && p[0] - r < s.max[0]
    && p[2] + r > s.min[2] && p[2] - r < s.max[2]
    && p[1] + h > s.min[1] && p[1] < s.max[1];
}

function overlapHoriz(p, s, r, h) {
  if (p[1] >= s.max[1] - 0.03) return false;
  if (p[1] + h <= s.min[1] + 0.03) return false;
  return overlap(p, s, r, h);
}

function tryStep(p, s, solids, r, h) {
  const step = s.max[1] - p[1];
  if (step <= 0.001 || step > 0.5) return false;
  const np = [p[0], s.max[1], p[2]];
  for (const o of solids) {
    if (o === s) continue;
    if (overlap(np, o, r, h)) return false;
  }
  p[1] = s.max[1];
  return true;
}

function resolveHorizontal(p, v, axis, solids, r, h) {
  for (let iter = 0; iter < 4; iter++) {
    let hit = false;
    for (const s of solids) {
      if (!overlapHoriz(p, s, r, h)) continue;
      hit = true;
      if (tryStep(p, s, solids, r, h)) continue;
      if (v[axis] > 0) p[axis] = s.min[axis] - r - EPS;
      else if (v[axis] < 0) p[axis] = s.max[axis] + r + EPS;
      else {
        const pushMin = p[axis] + r - s.min[axis];
        const pushMax = s.max[axis] - (p[axis] - r);
        p[axis] = pushMin < pushMax ? s.min[axis] - r - EPS : s.max[axis] + r + EPS;
      }
      v[axis] = 0;
    }
    if (!hit) break;
  }
}

function resolveVertical(p, v, solids, r, h) {
  let grounded = false;
  for (let iter = 0; iter < 4; iter++) {
    let hit = false;
    for (const s of solids) {
      if (!overlap(p, s, r, h)) continue;
      hit = true;
      if (v[1] > 0.02) {
        p[1] = s.min[1] - h - EPS;
        v[1] = 0;
      } else {
        p[1] = s.max[1];
        v[1] = 0;
        grounded = true;
      }
    }
    if (!hit) break;
  }
  if (!grounded && v[1] <= 0.02) {
    for (const s of solids) {
      const dist = p[1] - s.max[1];
      if (dist < -EPS || dist > 0.18) continue;
      if (p[0] + r <= s.min[0] || p[0] - r >= s.max[0]) continue;
      if (p[2] + r <= s.min[2] || p[2] - r >= s.max[2]) continue;
      const np = [p[0], s.max[1], p[2]];
      let blocked = false;
      for (const o of solids) {
        if (o === s) continue;
        if (overlap(np, o, r, h)) { blocked = true; break; }
      }
      if (!blocked) {
        p[1] = s.max[1];
        v[1] = 0;
        grounded = true;
        break;
      }
    }
  }
  return grounded;
}

export function moveBody(pos, vel, up, solids, dt, radius, height) {
  const p = worldToLocal(pos, up);
  const v = worldToLocal(vel, up);
  const localSolids = solids.map((s) => transformAabb(s, up));
  p[0] += v[0] * dt;
  resolveHorizontal(p, v, 0, localSolids, radius, height);
  p[2] += v[2] * dt;
  resolveHorizontal(p, v, 2, localSolids, radius, height);
  p[1] += v[1] * dt;
  const grounded = resolveVertical(p, v, localSolids, radius, height);
  return { pos: localToWorld(p, up), vel: localToWorld(v, up), grounded };
}

export function aabbAt(cx, cy, cz, sx, sy, sz) {
  return {
    min: [cx - sx / 2, cy - sy / 2, cz - sz / 2],
    max: [cx + sx / 2, cy + sy / 2, cz + sz / 2],
  };
}

export function containsPoint(box, p, pad = 0) {
  return p[0] >= box.min[0] - pad && p[0] <= box.max[0] + pad
    && p[1] >= box.min[1] - pad && p[1] <= box.max[1] + pad
    && p[2] >= box.min[2] - pad && p[2] <= box.max[2] + pad;
}

export function overlapsAabb(a, b) {
  return a.min[0] < b.max[0] && a.max[0] > b.min[0]
    && a.min[1] < b.max[1] && a.max[1] > b.min[1]
    && a.min[2] < b.max[2] && a.max[2] > b.min[2];
}
