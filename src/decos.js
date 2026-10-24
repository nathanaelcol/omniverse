import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const NAMES = [
  'monolith', 'arch', 'tree', 'planet', 'crystal', 'bone', 'rock', 'fern',
  'ruin', 'ring', 'shrine', 'coral', 'bell', 'console', 'mote', 'vertebra',
];

const cache = new Map();

export function preloadDecos() {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  return Promise.all(NAMES.map((name) => new Promise((resolve) => {
    loader.load(
      `${base}models/${name}.glb`,
      (gltf) => { cache.set(name, gltf.scene); resolve(); },
      undefined,
      () => resolve(),
    );
  })));
}

function tintMaterial(source, opt) {
  const mat = source.clone();
  mat.userData.deco = true;
  const name = source.name || '';
  if (opt.tint && name === 'Glow') {
    mat.color.set(opt.tint);
    mat.emissive.set(opt.tint);
    mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 1.8);
  }
  if (opt.body && (name === 'Body' || name === 'Stone')) mat.color.set(opt.body);
  if (opt.leaf && name === 'Leaf') mat.color.set(opt.leaf);
  if (opt.trunk && name === 'Trunk') mat.color.set(opt.trunk);
  return mat;
}

export function spawnDeco(name, opt = {}) {
  const source = cache.get(name);
  if (!source) return null;
  const root = source.clone(true);
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry = obj.geometry.clone();
    const sources = Array.isArray(obj.material) ? obj.material : [obj.material];
    const cloned = sources.map((mat) => tintMaterial(mat, opt));
    obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.userData.deco = true;
  });
  if (opt.yaw) root.rotation.y = opt.yaw;
  if (opt.rx) root.rotation.x = opt.rx;
  if (opt.rz) root.rotation.z = opt.rz;
  const scale = opt.scale ?? 1;
  root.scale.set(opt.sx ?? scale, opt.sy ?? scale, opt.sz ?? scale);
  return root;
}
