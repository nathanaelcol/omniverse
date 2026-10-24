import * as THREE from 'three';
import { AudioBus } from './audio.js';
import {
  add, basis, containsPoint, dist3, fallLabel, fallVector, len, lerp, moveBody, norm, scale, snapUpFromDirection, sub, upVector,
} from './collision.js';
import {
  BUILDINGS, CATEGORY_LABEL, CRAFTS, ENDINGS, RESEARCH, RESOURCE_LABEL, SPECIES, UNIVERSE_INFO, costText, levelInfo,
} from './content.js';
import { CATEGORIES, emptyWorld, normalizeParams, seedWorld, simulateTick } from './sim.js';
import {
  defaultState, deleteSlot, exportState, importState, listSaves, loadSettings, loadSlot, saveSettings, saveSlot,
} from './save.js';
import { buildArena, buildCustom, buildGiants, buildInverted, buildZero } from './worlds.js';
import { mountUI } from './ui.js';

const UPS = ['+y', '-y', '+x', '-x', '+z', '-z'];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.audio = new AudioBus();
    this.audio.setVolume(this.settings.volume);
    this.state = defaultState();
    this.mode = 'title';
    this.panel = null;
    this.confirming = false;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.clock = new THREE.Clock();
    this.time = 0;
    this.mats = new Map();
    this.input = new Input(canvas);
    this.player = {
      pos: [0, 2, 10], vel: [0, 0, 0], yaw: 0, pitch: -0.2, up: '+y',
      hp: 100, energy: 100, oxygen: 100, grounded: true, crouch: false,
      hitFlash: 0, inWater: false, inSilence: false, inFusion: false,
    };
    this.draftUp = '+y';
    this.armed = 'abri';
    this.buildRot = 0;
    this.anchors = [];
    this.orbs = [];
    this.prompt = '';
    this.fallText = 'vers le bas';
    this.level = 1;
    this.gravityScale = 1;
    this.defaultUp = '+y';
    this.universeId = 'zero';
    this.universeName = 'Point Zéro';
    this.spawn = [0, 2, 10];
    this.spawnYaw = 0;
    this.safe = [0, 2, 10];
    this.fallT = 0;
    this.safeT = 0;
    this.attackCd = 0;
    this.forcedUp = null;
    this.forcedTimer = 0;
    this.slowUntil = 0;
    this.fusionTime = 0;
    this.whTimer = 0;
    this.civTimer = 0;
    this.simAcc = 0;
    this.climateT = 0;
    this.shake = 0;
    this.transition = false;
    this.introI = 0;
    this.custom = null;
    this.boss = null;
    this.hasContinue = !!listSaves().auto && !listSaves().auto.broken;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.08, 500);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.settings.quality === 'high' ? 1.5 : 1));
    this.renderer.shadowMap.enabled = this.settings.quality !== 'low';
    if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    this.playerMesh = this.makePlayer();
    this.scene.add(this.playerMesh);
    this.solids = [];
    this.zones = [];
    this.waters = [];
    this.pickups = [];
    this.interacts = [];
    this.creatures = [];
    this.props = [];
    this.built = [];
    this.ui = mountUI(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('click', () => {
      this.audio.resume();
      if (this.mode === 'play' && !this.panel && !this.transition) canvas.requestPointerLock?.();
    });
    this.loadUniverse('zero');
    this.ui.sync(this);
  }

  start() {
    this.clock.getDelta();
    const loop = () => {
      const dt = Math.min(0.05, this.clock.getDelta());
      try { this.tick(dt); }
      catch (err) {
        console.error(err);
        this.ui.fatal(`${err.message || err}`);
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
  }

  tick(dt) {
    this.time += dt;
    if (this.mode === 'play') this.state.playtime += dt;
    this.handleKeys();
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    const frozen = this.mode !== 'play' || this.transition || typing && this.panel === 'creator';
    if (!frozen) {
      this.updatePlayer(dt);
      this.updateCreatures(dt);
      this.updateProps(dt);
      this.updateAnchors(dt);
      this.updateOrbs(dt);
      this.updateBuildings(dt);
      this.updateZones(dt);
      this.updateQuests(dt);
      this.updateCustom(dt);
      this.updateBoss(dt);
    } else if (this.mode === 'title' || this.mode === 'intro') {
      this.playerMesh.visible = false;
    }
    if (this.player.hitFlash > 0) this.player.hitFlash = Math.max(0, this.player.hitFlash - dt);
    this.updateCamera(dt);
    this.updatePrompt();
    this.ui.hud(this);
    this.updateArrow();
    if (this.debug && this.mode === 'play') {
      const p = this.player.pos;
      this.ui.debug(`${this.universeId} ${p.map((n) => n.toFixed(1)).join(' ')} up ${this.player.up} sol ${this.player.grounded ? 'oui' : 'non'}`);
    }
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  handleKeys() {
    const i = this.input;
    if (i.pressed('Escape')) {
      if (this.confirming) this.confirming = false;
      else if (this.mode === 'dialogue') this.closeTalk();
      else if (this.panel) this.closePanel();
      else if (document.pointerLockElement) document.exitPointerLock();
      else if (this.mode === 'play') this.setMode('pause');
      else if (this.mode === 'pause') this.setMode('play');
    }
    if (this.mode !== 'play' || this.panel === 'creator') return;
    const press = (code) => i.pressed(code);
    if (press('KeyG')) this.togglePanel('reality');
    if (press('KeyB')) this.togglePanel('build');
    if (press('KeyI')) this.togglePanel('inventory');
    if (press('KeyJ')) this.togglePanel('journal');
    if (press('KeyM')) this.togglePanel('map');
    if (press('KeyC')) this.togglePanel('codex');
    if (press('Tab')) this.togglePanel('progression');
    if (press('KeyH')) this.togglePanel('help');
    if (press('KeyE') || press('KeyF')) {
      if (press('KeyE')) this.interact();
      if (press('KeyF')) this.attack();
    }
    if (this.panel === 'reality') {
      const map = { Digit1: '+y', Digit2: '-y', Digit3: '-x', Digit4: '+x', Digit5: '+z', Digit6: '-z' };
      for (const [code, up] of Object.entries(map)) if (press(code)) this.draftUp = up;
      if (press('Enter')) this.placeAnchor();
    }
  }

  onAction(act, arg) {
    if (act === 'confirm-yes') { const fn = this.confirmYes; this.confirming = false; this.confirmYes = null; this.ui.sync(this); fn?.(); return; }
    if (act === 'confirm-no') { this.confirming = false; this.ui.sync(this); return; }
    if (act === 'new') return this.askNew();
    if (act === 'continue') return this.continueGame();
    if (act === 'credits') return this.say('Omniverse', 'Version jouable dans le navigateur. Les Géants et le Monde inversé sont ouverts. Les six autres réalités sont encore coupées : elles sont nommées, pas simulées. Les jardins créés ont une écologie simple.');
    if (act === 'quit-info') return this.say('Quitter', 'Ferme cet onglet pour quitter. La partie automatique reste dans ce navigateur.');
    if (act === 'intro-next') return this.advanceIntro();
    if (act === 'resume') return this.setMode('play');
    if (act === 'pause') return this.setMode('pause');
    if (act === 'to-title') { this.autosave(); this.mode = 'title'; this.panel = null; this.loadUniverse('zero'); this.ui.sync(this); return; }
    if (act === 'close' || act === 'close-panel') {
      if (this.mode === 'dialogue') this.closeTalk();
      else this.closePanel();
      return;
    }
    if (act === 'open-saves') return this.openPanel('saves');
    if (act === 'open-settings') return this.openPanel('settings');
    if (act === 'open-help') return this.openPanel('help');
    if (act.startsWith('toggle-')) return this.togglePanel(act.slice(7));
    if (act === 'interact') return this.interact();
    if (act === 'attack') return this.attack();
    if (act === 'retreat') { this.closePanel(); this.setMode('play'); return this.travel('zero'); }
    if (act === 'dir') { this.draftUp = arg; this.toast(`Ancre : chute ${fallLabel(arg)}.`); this.refreshReality(); return; }
    if (act === 'rel') return this.setRelative(arg);
    if (act === 'place-anchor') return this.placeAnchor();
    if (act === 'cast') return this.castLaw(arg);
    if (act === 'research') return this.research(arg);
    if (act === 'arm') { this.armed = arg; this.refreshBuild(); return; }
    if (act === 'build-place') return this.placeBuilding();
    if (act === 'build-rotate') { this.buildRot = (this.buildRot + 1) % 4; this.toast('Orientation tournée.'); return; }
    if (act === 'warp') return this.warp(arg);
    if (act === 'save-slot') return this.manualSave(Number(arg));
    if (act === 'load-slot') return this.manualLoad(arg === 'auto' ? 'auto' : Number(arg));
    if (act === 'load-auto') return this.manualLoad('auto');
    if (act === 'del-slot') return this.ask(`Effacer l'emplacement ${Number(arg) + 1} ?`, () => { deleteSlot(Number(arg)); this.refreshSaves(); });
    if (act === 'export-save') return this.exportSave();
    if (act === 'import-save') { document.getElementById('import-file').click(); return; }
    if (act === 'gen-world') return this.generateWorld();
    if (act === 'apply-world') return this.applyWorld();
    if (act === 'respawn') return this.respawn();
    if (act === 'ending') return this.chooseEnding(arg);
    if (act === 'craft') {
      const keep = this.craft(arg);
      if (!keep && this.mode === 'dialogue') this.closeTalk();
      return;
    }
    if (this.mode === 'dialogue') this.applyEffect(act, arg);
  }

  ask(text, yes) {
    this.confirming = true;
    this.confirmYes = yes;
    document.getElementById('confirm-text').textContent = text;
    this.ui.sync(this);
  }

  askNew() {
    if (this.hasContinue) this.ask('Une partie automatique existe. Commencer efface seulement la partie en cours à l\'écran, pas les emplacements, jusqu\'à la prochaine sauvegarde.', () => this.newGame());
    else this.newGame();
  }

  newGame() {
    this.state = defaultState();
    this.player.hp = 100;
    this.player.energy = 100;
    this.player.oxygen = 100;
    this.level = 1;
    this.introI = 0;
    this.panel = null;
    this.boss = null;
    this.loadUniverse('zero');
    this.addLore('eveil', 'Éveil', 'Je me réveille sans nom propre, au Point Zéro. L\'Origine a semé les lois. La Grande Rupture les a coupées. La signature, au fond, me ressemble.');
    this.mode = 'intro';
    this.showIntro();
    this.ui.sync(this);
  }

  showIntro() {
    const lines = [
      ['L\'Origine', 'Avant le temps, une seule conscience a écrit les premières lois, puis les premières réalités. Elles ont divergé jusqu\'à ne plus se comprendre.'],
      ['La Rupture', 'La Grande Rupture a détruit les passages. Des univers se sont tus. D\'autres ont laissé entrer des bêtes qui ne devraient pas tenir dans une géométrie.'],
      ['Le Dernier Créateur', 'Tu n\'as pas de mémoire. Tu peux déjà marcher, ramasser, frapper. Bientôt tu pourras changer la chute d\'un lieu. Pas d\'un monde entier : la portée est le prix.'],
    ];
    const line = lines[Math.min(this.introI, lines.length - 1)];
    document.getElementById('intro-title').textContent = line[0];
    document.getElementById('intro-text').textContent = line[1];
  }

  advanceIntro() {
    this.introI += 1;
    if (this.introI >= 3) {
      this.mode = 'play';
      this.ui.sync(this);
      this.toast('Ramasse trois éclats. E, ou le bouton Interagir.');
      this.autosave();
      return;
    }
    this.showIntro();
  }

  continueGame() {
    try {
      this.state = loadSlot('auto');
      this.bootFromState();
    } catch (err) {
      this.toast(err.message || 'Sauvegarde impossible à lire.');
    }
  }

  bootFromState() {
    this.refreshVitals(false);
    this.player.hp = this.state.player.hp;
    this.player.energy = this.state.player.energy;
    this.player.oxygen = 100;
    this.panel = null;
    this.mode = 'play';
    this.loadUniverse(this.state.universe || 'zero', [this.state.player.x, this.state.player.y, this.state.player.z], this.state.player.yaw);
    this.ui.sync(this);
    this.toast('Partie reprise.');
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'play') this.panel = null;
    if (mode !== 'play' && document.pointerLockElement) document.exitPointerLock();
    this.ui.sync(this);
  }

  togglePanel(name) {
    if (this.mode !== 'play' && this.mode !== 'pause' && this.mode !== 'title') return;
    if (this.mode === 'title' && !['settings', 'saves', 'help'].includes(name)) return;
    if (this.mode === 'pause') this.mode = 'play';
    if (this.panel === name) this.closePanel();
    else this.openPanel(name);
  }

  openPanel(name) {
    if (this.mode === 'title' && !['settings', 'saves', 'help'].includes(name)) this.mode = 'play';
    if (this.mode !== 'play' && this.mode !== 'title') this.mode = 'play';
    this.panel = name;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.sync(this);
    this.refreshPanel(name);
  }

  closePanel() {
    this.panel = null;
    this.ui.sync(this);
  }

  refreshPanel(name) {
    if (name === 'inventory') this.refreshInventory();
    if (name === 'reality') this.refreshReality();
    if (name === 'progression') this.refreshResearch();
    if (name === 'codex') this.refreshCodex();
    if (name === 'map') this.refreshMap();
    if (name === 'build') this.refreshBuild();
    if (name === 'journal') this.refreshJournal();
    if (name === 'saves') this.refreshSaves();
    if (name === 'settings') this.ui.syncSettings(this.settings);
  }

  say(who, text, choices) {
    if (this.mode !== 'dialogue') this.modeBefore = this.mode === 'pause' ? 'play' : this.mode;
    this.mode = 'dialogue';
    this.panel = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.dialogue(who, text, choices || [{ label: 'Continuer', act: 'close' }]);
    this.ui.sync(this);
  }

  closeTalk() {
    this.mode = this.modeBefore && this.modeBefore !== 'dialogue' ? this.modeBefore : 'play';
    this.modeBefore = null;
    this.ui.sync(this);
  }

  applyEffect(act) {
    const keep = this.effect(act);
    if (!keep && this.mode === 'dialogue') this.closeTalk();
  }

  effect(act) {
    if (act === 'exploitVillage') return this.exploitVillage();
    if (act === 'giveMira') return this.giveMira();
    if (act === 'callMira') { this.destroyHarvester('Mira pose le pied. La machine se tait.'); return false; }
    if (act === 'wakeOrm') return this.wakeOrm();
    if (act === 'exploitCity') return this.exploitCity();
    if (act === 'noteCopy') return this.noteCopy();
    if (act === 'giftRoots') return this.giftCiv('roots');
    if (act === 'giftMurmur') return this.giftCiv('murmur');
    return false;
  }

  toast(text) { this.ui.toast(text); this.audio.blip(); }

  setSetting(key, value) {
    if (key === 'sensitivity') this.settings.sensitivity = Number(value);
    else if (key === 'volume') { this.settings.volume = Number(value); this.audio.setVolume(this.settings.volume); }
    else if (key === 'quality') {
      this.settings.quality = value;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, value === 'high' ? 1.5 : 1));
      this.renderer.shadowMap.enabled = value !== 'low';
    } else if (key === 'invertY') this.settings.invertY = !!value;
    else if (key === 'shake') this.settings.shake = !!value;
    saveSettings(this.settings);
  }

  /* ---------- world building ---------- */

  loadUniverse(id, pos, yaw) {
    this.clearWorld();
    this.universeId = id;
    this.state.universe = id;
    this.boss = null;
    this.custom = null;
    this.gravityScale = 1;
    if (id === 'zero') buildZero(this);
    else if (id === 'giants') buildGiants(this);
    else if (id === 'inverted') buildInverted(this);
    else if (id === 'arena') buildArena(this);
    else if (String(id).startsWith('custom:')) {
      const found = this.state.worlds.find((w) => `custom:${w.id}` === id);
      if (!found) buildZero(this);
      else {
        buildCustom(this, found);
        this.gravityScale = found.params.gravity;
      }
    } else buildZero(this);
    if (this.queueBoss) { this.startBoss(); this.queueBoss = false; }
    this.player.pos = (pos || this.spawn).slice();
    this.player.yaw = yaw ?? this.spawnYaw ?? 0;
    this.player.vel = [0, 0, 0];
    this.player.up = this.defaultUp;
    this.player.grounded = true;
    this.fallT = 0;
    this.safe = this.player.pos.slice();
    this.spawnBuildings();
    if (!this.state.flags.visited) this.state.flags.visited = {};
    if (['zero', 'giants', 'inverted', 'arena'].includes(id)) this.state.flags.visited[id] = true;
    this.playerMesh.visible = this.mode !== 'title' && this.mode !== 'intro';
  }

  clearWorld() {
    this.worldRoot.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
    this.worldRoot.clear();
    this.solids = [];
    this.zones = [];
    this.waters = [];
    this.pickups = [];
    this.interacts = [];
    this.creatures = [];
    this.props = [];
    this.built = [];
    this.anchors = [];
    this.orbs = [];
    this.sun = null;
    this.lifeGroup = null;
    this.beingMeshes = new Map();
  }

  setTheme(name, override = {}) {
    const themes = {
      zero: { fog: 0x07060f, near: 36, far: 220, amb: 0x2a2340, sun: 0xffe2b8, hemi: 0x6e5c98, ground: 0x100e14 },
      giants: { fog: 0xd3924a, near: 20, far: 150, amb: 0x6a4630, sun: 0xffc27a, hemi: 0xffe0b0, ground: 0x314628 },
      inverted: { fog: 0x140712, near: 16, far: 180, amb: 0x2a1430, sun: 0x9af0ff, hemi: 0x4a2060, ground: 0x140810 },
      arena: { fog: 0x1a0608, near: 14, far: 100, amb: 0x3a1416, sun: 0xffb0a0, hemi: 0x501820, ground: 0x140608 },
      custom: { fog: 0x87a06a, near: 16, far: 100, amb: 0x3d4a30, sun: 0xfff0d0, hemi: 0xd0e0b0, ground: 0x243018 },
    };
    const theme = { ...(themes[name] || themes.zero), ...override };
    this.scene.background = new THREE.Color(theme.fog);
    this.scene.fog = new THREE.Fog(theme.fog, theme.near, theme.far);
    this.worldRoot.add(new THREE.AmbientLight(theme.amb, 0.62));
    this.worldRoot.add(new THREE.HemisphereLight(theme.hemi, theme.ground, 0.78));
    const sun = new THREE.DirectionalLight(theme.sun, 1.45);
    sun.position.set(30, 60, 20);
    sun.castShadow = this.settings.quality !== 'low';
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.near = 1; cam.far = 180; cam.left = -45; cam.right = 45; cam.top = 45; cam.bottom = -45;
    this.worldRoot.add(sun, sun.target);
    this.sun = sun;
    this.audio.setTheme(name);
  }

  material(color, opt = {}) {
    const key = [color, opt.emissive || '', opt.emissiveIntensity || 0, opt.transparent ? 1 : 0, opt.opacity ?? 1].join('|');
    if (!this.mats.has(key)) {
      this.mats.set(key, new THREE.MeshStandardMaterial({
        color,
        roughness: opt.roughness ?? 0.84,
        metalness: 0.04,
        emissive: new THREE.Color(opt.emissive || '#000000'),
        emissiveIntensity: opt.emissiveIntensity || 0,
        flatShading: true,
        transparent: !!opt.transparent,
        opacity: opt.opacity ?? 1,
        depthWrite: !opt.transparent,
      }));
    }
    return this.mats.get(key);
  }

  addBox(spec) {
    const sx = spec.sx, sy = spec.sy, sz = spec.sz;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), this.material(spec.color || '#888888', spec));
    mesh.position.set(spec.cx, spec.cy, spec.cz);
    mesh.castShadow = spec.solid !== false && this.settings.quality !== 'low';
    mesh.receiveShadow = true;
    mesh.userData.tag = spec.tag || '';
    this.worldRoot.add(mesh);
    if (spec.solid !== false) {
      this.solids.push({
        min: [spec.cx - sx / 2, spec.cy - sy / 2, spec.cz - sz / 2],
        max: [spec.cx + sx / 2, spec.cy + sy / 2, spec.cz + sz / 2],
        tag: spec.tag || '',
      });
    }
    return mesh;
  }

  addCylinder(spec) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(spec.rt, spec.rb, spec.h, 7), this.material(spec.color || '#777', {}));
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.castShadow = this.settings.quality !== 'low';
    mesh.receiveShadow = true;
    this.worldRoot.add(mesh);
    if (spec.solid) {
      const base = spec.y - spec.h / 2;
      const h = spec.solidH || spec.h;
      this.solids.push({ min: [spec.x - spec.rb, base, spec.z - spec.rb], max: [spec.x + spec.rb, base + h, spec.z + spec.rb] });
    }
    return mesh;
  }

  addWater(spec) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(spec.sx, spec.sy, spec.sz),
      this.material(spec.color || '#7ee7f0', { transparent: true, opacity: 0.38, emissive: spec.color || '#7ee7f0', emissiveIntensity: 0.2, roughness: 0.1 }),
    );
    mesh.position.set(spec.x, spec.y, spec.z);
    this.worldRoot.add(mesh);
    const zone = {
      min: [spec.x - spec.sx / 2, spec.y - spec.sy / 2, spec.z - spec.sz / 2],
      max: [spec.x + spec.sx / 2, spec.y + spec.sy / 2, spec.z + spec.sz / 2],
      pressure: !!spec.pressure,
      mesh,
      baseY: spec.y,
    };
    this.waters.push(zone);
    return zone;
  }

  addZone(zone) { this.zones.push(zone); }
  addLight(x, y, z, color, intensity, distance) {
    const light = new THREE.PointLight(color, intensity, distance);
    light.position.set(x, y, z);
    this.worldRoot.add(light);
  }

  addSphere(x, y, z, r, color, emissive) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), this.material(color, { emissive: color, emissiveIntensity: emissive || 0.1 }));
    mesh.position.set(x, y, z);
    this.worldRoot.add(mesh);
    return mesh;
  }

  addStars(count, radius, color) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius * 0.6 + 20;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.worldRoot.add(new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.55, sizeAttenuation: true })));
  }

  addGroup() {
    const group = new THREE.Group();
    this.worldRoot.add(group);
    return group;
  }

  markSpawn(x, y, z, yaw = 0) { this.spawn = [x, y, z]; this.spawnYaw = yaw; }

  addPickup(spec) {
    if (this.state.picked[spec.id]) return;
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), this.material(colorOfResource(spec.resource), { emissive: colorOfResource(spec.resource), emissiveIntensity: 0.7 }));
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.visible = !spec.hidden;
    this.worldRoot.add(mesh);
    this.pickups.push({ ...spec, pos: [spec.x, spec.y, spec.z], mesh, taken: false, radius: spec.radius || 1.8 });
  }

  addInteract(spec) { this.interacts.push({ ...spec, pos: [spec.x, spec.y, spec.z] }); }

  addProp(spec) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.sx, spec.sy, spec.sz), this.material(spec.color || '#ddd', { emissive: '#d9c8a0', emissiveIntensity: 0.15 }));
    mesh.position.set(spec.x, spec.y + spec.sy / 2, spec.z);
    mesh.castShadow = true;
    this.worldRoot.add(mesh);
    this.props.push({ ...spec, pos: [spec.x, spec.y, spec.z], vel: [0, 0, 0], mesh, awake: false });
  }

  addCreature(opts) {
    const spec = SPECIES[opts.species];
    if (!spec) return null;
    const scaleN = opts.scale || 1;
    const mesh = this.makeCreature(spec, scaleN);
    mesh.position.set(opts.x, opts.y, opts.z);
    this.worldRoot.add(mesh);
    const creature = {
      ...opts,
      spec,
      mesh,
      pos: [opts.x, opts.y, opts.z],
      hp: spec.hp,
      yaw: Math.random() * 6,
      t: Math.random() * 8,
      attackT: 1.5,
      calm: 0,
      stun: 0,
      dead: false,
      scanned: !!this.state.codex[opts.species],
      wp: 0,
      home: opts.home || [opts.x, opts.z],
      baseY: opts.y,
      blocks: spec.category === 'giant' || opts.species === 'harvester',
      radius: (spec.w || 1) * scaleN * 0.45,
      bodyH: (spec.h || 1.6) * scaleN,
    };
    this.creatures.push(creature);
    return creature;
  }

  makeCreature(spec, scaleN) {
    const group = new THREE.Group();
    const mat = this.material(spec.color, { emissive: spec.color, emissiveIntensity: spec.category === 'luminous' || spec.category === 'energy' ? 0.45 : 0.05 });
    const w = (spec.w || 0.8) * scaleN;
    const h = (spec.h || 1.6) * scaleN;
    const d = (spec.d || 0.5) * scaleN;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.55, d), mat);
    torso.position.y = h * 0.48;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h * 0.22, d * 0.8), mat);
    head.position.y = h * 0.86;
    group.add(head);
    if (spec.category === 'giant' || spec.category === 'machine') {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.48, d * 0.4), mat);
      arm.position.set(-w * 0.62, h * 0.48, 0);
      group.add(arm);
      const other = arm.clone();
      other.position.x *= -1;
      group.add(other);
    }
    return group;
  }

  makePlayer() {
    const group = new THREE.Group();
    const cloth = this.material('#f3efe6', {});
    const trim = this.material('#8ee7dc', { emissive: '#14564f', emissiveIntensity: 0.5 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), cloth);
    torso.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), cloth);
    head.position.y = 1.68;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), trim);
    legL.position.set(-0.14, 0.4, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    group.add(torso, head, legL, legR);
    group.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
    return group;
  }

  /* ---------- simulation ---------- */

  frameSolids() {
    const list = this.solids.filter((s) => !s.disabled);
    for (const creature of this.creatures) {
      if (!creature.blocks || creature.dead) continue;
      const r = creature.radius;
      list.push({
        min: [creature.pos[0] - r, creature.pos[1], creature.pos[2] - r],
        max: [creature.pos[0] + r, creature.pos[1] + creature.bodyH * 0.72, creature.pos[2] + r],
      });
    }
    return list;
  }

  upAt(pos) {
    if (this.zoneAt(pos, 'silence')) return this.defaultUp;
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const anchor = this.anchors[i];
      if (dist3(anchor.pos, pos) <= anchor.radius) return anchor.up;
    }
    if (this.forcedTimer > 0 && this.forcedUp && !this.insideAnchor(pos)) return this.forcedUp;
    return this.defaultUp;
  }

  insideAnchor(pos) {
    return this.anchors.some((a) => dist3(a.pos, pos) <= a.radius);
  }

  waterAt(pos) {
    return this.waters.find((w) => containsPoint(w, pos)) || null;
  }

  zoneAt(pos, kind) {
    return this.zones.find((z) => z.kind === kind && containsPoint(z, pos, 0.2));
  }

  stability() {
    const key = this.universeId || 'zero';
    if (this.state.stability[key] === undefined) this.state.stability[key] = 100;
    return this.state.stability[key];
  }

  addStability(n) {
    const key = this.universeId || 'zero';
    this.state.stability[key] = Math.max(0, Math.min(100, this.stability() + n));
  }

  updatePlayer(dt) {
    const input = this.input;
    const body = this.player;
    body.crouch = input.down('ControlLeft') || input.down('ControlRight');
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const height = body.crouch ? 0.95 : 1.7;
    const radius = 0.38;
    body.yaw += input.mouseX * this.settings.sensitivity;
    const invert = this.settings.invertY ? -1 : 1;
    body.pitch -= input.mouseY * this.settings.sensitivity * invert;
    if (input.down('ArrowLeft')) body.yaw -= 1.7 * dt;
    if (input.down('ArrowRight')) body.yaw += 1.7 * dt;
    if (input.down('ArrowUp')) body.pitch += 1.15 * dt;
    if (input.down('ArrowDown')) body.pitch -= 1.15 * dt;
    body.pitch = Math.max(-1.15, Math.min(1.15, body.pitch));

    const up = this.upAt(body.pos);
    body.up = up;
    this.fallText = fallLabel(up);
    const upVec = upVector(up);
    const forward = this.flatLook();
    const right = norm(cross(forward, upVec));
    const wishF = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const wishR = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    let wish = add(scale(forward, wishF), scale(right, wishR));
    if (len(wish) > 0) wish = norm(wish);
    const water = this.waterAt(add(body.pos, scale(upVec, 0.8)));
    body.inWater = !!water;
    body.inSilence = !!this.zoneAt(body.pos, 'silence');
    if (water) {
      const swim = add(wish, scale(upVec, (input.down('Space') ? 1 : 0) - (body.crouch ? 1 : 0)));
      const speed = (len(swim) > 0 ? 4.3 : 0) * (sprint ? 1.3 : 1);
      body.vel = len(swim) > 0 ? scale(norm(swim), speed) : scale(fallVector(up), 1.4 * this.gravityScale);
      const depth = water.pressure ? Math.max(0, dot(sub(body.pos, water.min), fallVector(up))) : 0;
      body.oxygen = Math.max(0, body.oxygen - (6 + (depth > 12 ? 4 : 0)) * dt);
      if (depth > 12 && !this.state.tools.suit) this.damage(9 * dt, 'la pression');
      if (body.oxygen <= 0) this.damage(14 * dt, 'le manque d\'air');
    } else {
      body.oxygen = Math.min(100, body.oxygen + 28 * dt);
      const speed = (body.crouch ? 3.1 : sprint ? 8.4 : 5.35);
      const vertical = dot(body.vel, upVec);
      body.vel = add(scale(wish, speed), scale(upVec, vertical));
      if (!body.grounded) body.vel = add(body.vel, scale(fallVector(up), 22 * this.gravityScale * dt));
      else if (vertical < 0) body.vel = add(body.vel, scale(upVec, -vertical));
      if (input.pressed('Space') && body.grounded) {
        body.vel = add(body.vel, scale(upVec, 8.1 / Math.sqrt(this.gravityScale)));
        body.grounded = false;
      }
    }
    const step = moveBody(body.pos, body.vel, up, this.frameSolids(), dt, radius, height);
    body.pos = step.pos;
    body.vel = step.vel;
    body.grounded = step.grounded;
    if (body.grounded && !water) {
      this.safeT += dt;
      if (this.safeT > 0.7) this.safe = body.pos.slice();
    } else this.safeT = 0;
    if (!body.grounded && !water && this.mode === 'play') this.fallT += dt;
    else this.fallT = 0;
    if (this.fallT > 4.2 || (body.pos[1] < -30 && up === '+y')) {
      this.fallT = 0;
      body.pos = (this.safe || this.spawn).slice();
      body.vel = [0, 0, 0];
      this.damage(22, 'le vide');
      if (this.mode === 'play') this.toast('Le vide te renvoie au dernier sol.');
    }
    let regen = 2.15;
    if (this.universeId === 'zero' && dist3(body.pos, [0, 2, -2]) < 8) regen += 3.5;
    if (this.nearBuilding('abri', 6)) regen += 1.5;
    body.energy = Math.min(this.state.player.maxEnergy, body.energy + regen * dt);
    if (this.attackCd > 0) this.attackCd -= dt;
    this.orientPlayer(upVec, height);
  }

  flatLook() {
    const up = this.player.up || this.defaultUp || '+y';
    const b = basis(up);
    const yaw = this.player.yaw;
    return norm(add(scale(b.forward, -Math.cos(yaw)), scale(b.right, Math.sin(yaw))));
  }

  lookDir() {
    const up = upVector(this.player.up || '+y');
    return norm(add(scale(this.flatLook(), Math.cos(this.player.pitch)), scale(up, Math.sin(this.player.pitch))));
  }

  orientPlayer(upVec) {
    const qUp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...upVec));
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...upVec), this.player.yaw);
    this.playerMesh.quaternion.copy(qYaw).multiply(qUp);
    this.playerMesh.position.set(this.player.pos[0], this.player.pos[1], this.player.pos[2]);
    this.playerMesh.visible = true;
    const leg = Math.sin(this.time * (this.player.grounded ? 8 : 2)) * 0.25;
    if (this.playerMesh.children[2]) this.playerMesh.children[2].rotation.x = leg;
    if (this.playerMesh.children[3]) this.playerMesh.children[3].rotation.x = -leg;
  }

  updateCamera(dt) {
    if (this.mode === 'title' || this.mode === 'intro') {
      const angle = this.time * 0.12;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(Math.sin(angle) * 20, 8, Math.cos(angle) * 20);
      this.camera.lookAt(0, 2, 0);
      this.playerMesh.visible = false;
      return;
    }
    const up = upVector(this.player.up || '+y');
    const look = this.flatLook();
    const eye = add(this.player.pos, scale(up, this.player.crouch ? 0.75 : 1.3));
    let dist = 5.8;
    const want = add(eye, add(scale(look, -dist), scale(up, 0.75)));
    for (const solid of this.frameSolids()) {
      if (containsPoint(solid, lerp(eye, want, 0.7))) { dist = 2.2; break; }
    }
    const cam = add(eye, add(scale(look, -dist), scale(up, 0.65)));
    if (this.shake > 0) {
      this.shake -= dt;
      cam[0] += (Math.random() - 0.5) * 0.2;
      cam[1] += (Math.random() - 0.5) * 0.12;
    }
    this.camera.up.set(up[0], up[1], up[2]);
    this.camera.position.set(cam[0], cam[1], cam[2]);
    const focus = add(add(eye, scale(look, 6)), scale(up, Math.sin(this.player.pitch) * 5));
    this.camera.lookAt(focus[0], focus[1], focus[2]);
    if (this.sun) {
      this.sun.position.set(this.player.pos[0] + 26, this.player.pos[1] + 48, this.player.pos[2] + 14);
      this.sun.target.position.set(this.player.pos[0], this.player.pos[1], this.player.pos[2]);
      this.sun.target.updateMatrixWorld();
    }
  }

  updateCreatures(dt) {
    const slow = this.state.playtime < this.slowUntil ? 0.35 : 1;
    const stepDt = dt * slow;
    for (const creature of this.creatures) {
      if (creature.dead) continue;
      creature.t += stepDt;
      if (creature.stun > 0) { creature.stun -= stepDt; continue; }
      if (creature.calm > 0) creature.calm -= stepDt;
      const spec = creature.spec;
      if (!creature.scanned && dist3(creature.pos, this.player.pos) < (spec.category === 'giant' ? 16 : 7)) this.discover(creature);
      if (creature.species === 'orm' && this.state.flags.ormAwake) spec.temperament = 'territorial';
      if (creature.species === 'mira' && this.state.flags.mira === 'ally') spec.temperament = 'calme';
      if (creature.species === 'harvester') {
        if (!this.state.flags.harvesterAlive) { this.killCreature(creature, false); continue; }
        creature.attackT -= stepDt;
        const distance = dist3(creature.pos, this.player.pos);
        if (creature.attackT <= 0) {
          creature.attackT = 4.6;
          const hidden = this.player.crouch && this.zoneAt(this.player.pos, 'stealth');
          if (distance < 12 && !hidden) this.damage(spec.damage, spec.name);
        }
      }
      if (creature.species === 'deformer') {
        creature.attackT -= stepDt;
        if (creature.attackT <= 0 && dist3(creature.pos, this.player.pos) < 16) {
          creature.attackT = 5.5;
          this.forcedUp = UPS[Math.floor(Math.random() * UPS.length)];
          this.forcedTimer = 1.35;
          this.toast('Le déformateur tord la chute. Une ancre te garde.');
        }
      }
      if (spec.locomotion === 'npc' || (spec.locomotion === 'dormant' && !(creature.species === 'orm' && this.state.flags.ormAwake))) {
        creature.mesh.position.y = creature.baseY + Math.sin(creature.t * 2) * 0.05;
        continue;
      }
      this.moveCreature(creature, stepDt);
      const reach = spec.category === 'giant' ? 7 : creature.species === 'leviathan' ? 8 : 2.5;
      const hostile = (spec.temperament === 'hostile' || spec.temperament === 'territorial') && creature.calm <= 0;
      if (creature.species === 'leviathan' && this.zoneAt(this.player.pos, 'stealth')) continue;
      if (hostile && dist3(creature.pos, this.player.pos) < reach) {
        creature.attackT -= stepDt;
        if (creature.attackT <= 0) {
          creature.attackT = spec.category === 'giant' ? 1.8 : 1.15;
          this.damage(spec.damage || 8, spec.name);
        }
      }
      if (this.orbs.some((orb) => dist3(orb.pos, creature.pos) < orb.radius) && (spec.category === 'energy' || creature.species === 'deformer')) {
        creature.hp -= 16 * dt;
      }
      if (creature.hp <= 0) this.killCreature(creature, true);
    }
  }

  moveCreature(creature, dt) {
    const spec = creature.spec;
    let target = null;
    if (spec.locomotion === 'swim') {
      const water = this.waterAt(creature.pos) || this.waters[0];
      if (!this.waterAt(creature.pos)) {
        creature.hp -= 10 * dt;
        if (water) target = [(water.min[0] + water.max[0]) / 2, (water.min[1] + water.max[1]) / 2, (water.min[2] + water.max[2]) / 2];
      } else {
        creature.pos[0] += Math.sin(creature.t) * dt * 1.4;
        creature.pos[1] += Math.cos(creature.t * 0.7) * dt * 0.8;
        creature.pos[2] += Math.cos(creature.t) * dt * 1.2;
        creature.pos[0] = Math.max(water.min[0] + 1, Math.min(water.max[0] - 1, creature.pos[0]));
        creature.pos[1] = Math.max(water.min[1] + 1, Math.min(water.max[1] - 1, creature.pos[1]));
        creature.pos[2] = Math.max(water.min[2] + 1, Math.min(water.max[2] - 1, creature.pos[2]));
      }
    } else if (spec.locomotion === 'wall' && creature.plane) {
      creature.pos[0] = creature.plane;
      creature.pos[1] += Math.sin(creature.t * 0.8) * dt * 1.5;
      creature.pos[2] += Math.cos(creature.t * 0.5) * dt * 1.5;
    } else if (spec.locomotion === 'fly' || spec.category === 'energy') {
      creature.pos[0] += Math.sin(creature.t * 0.6 + creature.yaw) * dt * 2.2;
      creature.pos[2] += Math.cos(creature.t * 0.6) * dt * 2.2;
      creature.pos[1] = creature.baseY + Math.sin(creature.t) * 1.2;
    } else if (creature.waypoints?.length) {
      const wp = creature.waypoints[creature.wp % creature.waypoints.length];
      const dx = wp[0] - creature.pos[0];
      const dz = wp[1] - creature.pos[2];
      if (Math.hypot(dx, dz) < 1.4) creature.wp += 1;
      else {
        creature.pos[0] += (dx / Math.hypot(dx, dz)) * dt * 2.2;
        creature.pos[2] += (dz / Math.hypot(dx, dz)) * dt * 2.2;
      }
    } else if (spec.temperament === 'fuite' && dist3(creature.pos, this.player.pos) < 8) {
      target = [creature.pos[0] * 2 - this.player.pos[0], creature.pos[1], creature.pos[2] * 2 - this.player.pos[2]];
    } else {
      const hx = creature.home[0] + Math.sin(creature.t * 0.45) * 4;
      const hz = creature.home[1] + Math.cos(creature.t * 0.4) * 4;
      target = [hx, creature.baseY, hz];
    }
    if (target) {
      const dx = target[0] - creature.pos[0];
      const dz = target[2] - creature.pos[2];
      const mag = Math.hypot(dx, dz) || 1;
      creature.pos[0] += (dx / mag) * dt * 2;
      creature.pos[2] += (dz / mag) * dt * 2;
      if (target[1]) creature.pos[1] += (target[1] - creature.pos[1]) * Math.min(1, dt * 2);
    }
    const sees = spec.temperament === 'territorial' && creature.calm <= 0 && dist3(creature.pos, this.player.pos) < (spec.vision || 12) * (this.player.crouch ? 0.55 : 1) * (this.zoneAt(this.player.pos, 'stealth') ? 0.4 : 1);
    if (sees && spec.locomotion !== 'swim') {
      creature.pos[0] += Math.sign(this.player.pos[0] - creature.pos[0]) * dt * 3.2;
      creature.pos[2] += Math.sign(this.player.pos[2] - creature.pos[2]) * dt * 3.2;
    }
    creature.mesh.position.set(creature.pos[0], creature.pos[1], creature.pos[2]);
    creature.mesh.rotation.y = creature.t;
  }

  killCreature(creature, reward) {
    if (creature.dead) return;
    creature.dead = true;
    creature.blocks = false;
    creature.mesh.rotation.z = 1.1;
    if (creature.species === 'harvester') this.state.flags.harvesterAlive = false;
    if (creature.species === 'varak') {
      this.state.flags.varakDead = true;
      this.state.relations.roots = Math.max(0, this.state.relations.roots - 20);
      this.addLore('varak', 'Varak tombé', 'Le gardien des troncs est à terre. La forêt est plus sûre, et les Veilleurs plus froids.');
    }
    if (creature.species === 'deformer') this.addStability(12);
    if (creature.species === 'guardian') this.addStability(8);
    if (reward && creature.spec.category !== 'intelligent') {
      this.state.inventory.eclat += 1;
      this.gainXp(8);
    }
  }

  updateProps(dt) {
    for (const prop of this.props) {
      if (!prop.dynamic) continue;
      const up = this.upAt(prop.pos);
      if (up !== '+y') prop.awake = true;
      if (prop.awake) {
        prop.vel = add(prop.vel, scale(fallVector(up), 16 * dt));
        const solids = this.solids.filter((s) => !s.disabled);
        const step = moveBody(prop.pos, prop.vel, up, solids, dt, Math.max(prop.sx, prop.sz) * 0.35, prop.sy);
        prop.pos = step.pos;
        prop.vel = step.vel;
      }
      const center = add(prop.pos, scale(upVector(up), prop.sy / 2));
      prop.mesh.position.set(center[0], center[1], center[2]);
      if (prop.role === 'bone' && this.state.flags.harvesterAlive && Math.hypot(center[0] - 40, center[2] + 44) < 5.2 && len(prop.vel) > 1.5) {
        this.destroyHarvester('L\'os colossal écrase la machine.');
      }
      if (prop.pos[1] < -12) {
        prop.pos = [prop.x, prop.y, prop.z];
        prop.vel = [0, 0, 0];
        prop.awake = false;
      }
    }
  }

  updateAnchors(dt) {
    const beacon = this.state.tools.beacon ? 1.45 : 1;
    for (const anchor of this.anchors) anchor.life -= dt / beacon;
    const before = this.anchors.length;
    this.anchors = this.anchors.filter((a) => a.life > 0);
    if (before && !this.anchors.length) this.toast('L\'ancre se dissout.');
    if (this.anchors.length) this.addStability(-3.2 * dt);
    else this.addStability((this.state.tools.beacon ? 7 : 4.5) * dt);
    if (this.stability() < 34) this.ensureGuardian();
    if (this.stability() > 75) {
      const guardian = this.creatures.find((c) => c.species === 'guardian' && !c.dead);
      if (guardian) { this.toast('Le gardien se retire : le lieu se tient.'); this.killCreature(guardian, false); }
    }
    if (this.forcedTimer > 0) this.forcedTimer -= dt;
    this.drawAnchorPreview();
  }

  drawAnchorPreview() {
    if (this.anchorMesh) { this.worldRoot.remove(this.anchorMesh); this.anchorMesh.geometry.dispose(); this.anchorMesh = null; }
    if (this.panel !== 'reality' || this.mode !== 'play') return;
    const pos = this.player.pos;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.state.upgrades.anchorRadius, 18, 12),
      this.material('#8ee7dc', { transparent: true, opacity: 0.14, emissive: '#8ee7dc', emissiveIntensity: 0.4 }),
    );
    mesh.position.set(pos[0], pos[1] + 1, pos[2]);
    this.worldRoot.add(mesh);
    this.anchorMesh = mesh;
  }

  updateOrbs(dt) {
    this.orbs = this.orbs.filter((orb) => {
      orb.life -= dt;
      if (orb.life <= 0) { this.worldRoot.remove(orb.mesh); if (orb.light) this.worldRoot.remove(orb.light); return false; }
      return true;
    });
    for (const pickup of this.pickups) {
      if (!pickup.hidden || pickup.taken) continue;
      if (this.orbs.some((orb) => dist3(orb.pos, pickup.pos) < orb.radius + 1)) {
        pickup.hidden = false;
        pickup.mesh.visible = true;
        this.toast('Un écho devient visible.');
      }
    }
  }

  updateBuildings(dt) {
    for (const built of this.built) {
      const data = this.state.buildings.find((b) => b.id === built.id);
      if (!data) continue;
      if (built.type === 'abri' && dist3(this.player.pos, built.pos) < 6) this.player.hp = Math.min(this.state.player.maxHp, this.player.hp + 7 * dt);
      if (built.type === 'extracteur' && this.nearPower(built.pos)) {
        built.acc = (built.acc || 0) + dt;
        if (built.acc > 16) {
          built.acc = 0;
          const key = this.localResource();
          this.state.inventory[key] += 1;
          this.toast(`Extracteur : +1 ${RESOURCE_LABEL[key]}.`);
        }
      }
      if (built.type === 'jardin' && this.custom) this.custom.garden = true;
    }
  }

  updateZones(dt) {
    const pos = this.player.pos;
    const hole = this.zoneAt(pos, 'whitehole');
    if (hole && this.state.flags.whiteHoleUses < 3) {
      this.whTimer += dt;
      if (this.whTimer > 14) {
        this.whTimer = 0;
        this.state.flags.whiteHoleUses += 1;
        this.addStability(-10);
        const id = `wh-${this.universeId}-${this.state.flags.whiteHoleUses}`;
        this.addPickup({ id, x: pos[0] + 1, y: pos[1] + 1.2, z: pos[2], resource: 'eclat', amount: 1, kind: 'mote' });
        this.toast('Le trou blanc enfante un éclat. La stabilité se fend.');
      }
    }
    const fusion = this.zoneAt(pos, 'fusion');
    this.player.inFusion = !!fusion && !this.state.flags.fusionCalmed;
    if (fusion && !this.state.flags.fusionCalmed) {
      const center = fusionCenter(fusion);
      if (this.anchors.some((a) => dist3(a.pos, center) < a.radius)) this.fusionTime += dt;
      else this.fusionTime = Math.max(0, this.fusionTime - dt * 0.5);
      this.damage(4 * dt, 'la fusion');
      if (this.fusionTime > 12) {
        this.state.flags.fusionCalmed = true;
        this.state.inventory.eclat += 2;
        this.gainXp(24);
        this.addLore('fusion', 'Fusion calmée', 'Deux matières qui ne devaient pas se toucher ont accepté une chute unique, le temps d\'une ancre.');
        this.toast('La fusion se tait.');
      }
    }
    if (this.zoneAt(pos, 'lesson') && !this.state.laws.gravity) {
      this.state.laws.gravity = true;
      this.state.flags.gravityLesson = true;
      this.state.flags.gravityUnlocked = true;
      this.gainXp(40);
      this.addLore('loi-g', 'Loi de gravité', 'Une ancre change la chute dans un rayon court. Une planète entière reste hors de portée : il manque un cœur, et c\'est volontaire.');
      this.toast('La gravité t\'obéit. Les portails s\'ouvrent.');
      this.audio.law();
    }
    if (!this.state.flags.regions) this.state.flags.regions = {};
    const region = this.zones.find((z) => containsPoint(z, pos, 0.2) && z.kind !== 'lesson');
    if (region && !this.state.flags.regions[region.id]) {
      this.state.flags.regions[region.id] = true;
      this.player.energy = Math.min(this.state.player.maxEnergy, this.player.energy + 16);
      this.gainXp(6);
    }
  }

  updateQuests(dt) {
    const flags = this.state.flags;
    if (!flags.regions) flags.regions = {};
    if (flags.tutorialMotes >= 3 && !flags.motesNoted) {
      flags.motesNoted = true;
      this.toast('Les éclats vibrent. Va au monolithe.');
    }
    if (this.state.laws.gravity && this.universeId === 'zero' && !this.solids.some((s) => s.tag === 'bridge')) {
      this.addBox({ cx: 9, cy: 1, cz: -30, sx: 10, sy: 2, sz: 8, color: '#e7d7b1', tag: 'bridge' });
    }
    this.checkBoss();
    this.civTimer += dt;
    if (this.civTimer > 40) {
      this.civTimer = 0;
      if (this.universeId === 'giants' && flags.village === 'saved') flags.civProgress.roots += 1;
      if (this.universeId === 'inverted' && flags.city === 'stabilized') flags.civProgress.murmur += 1;
    }
  }

  updateCustom(dt) {
    if (!this.custom || this.mode !== 'play') return;
    this.simAcc += dt;
    if (this.simAcc >= 1) {
      this.simAcc = 0;
      const events = simulateTick(this.custom);
      if (this.custom.garden) this.custom.plants.forEach((plant) => { plant.size = Math.min(1.5, plant.size + 0.06); });
      if (events.length) this.toast(events[0]);
      this.syncCustomLife();
      this.drawSpark();
    }
    const climate = this.custom.params.climate;
    this.climateT += dt;
    if (climate === 'tempete' && this.climateT > 8) {
      this.climateT = 0;
      if (!this.nearBuilding('abri', 8)) this.damage(4, 'la tempête');
      this.player.vel = add(this.player.vel, [6, 0, 2]);
    } else if (climate === 'orage' && this.climateT > 11) {
      this.climateT = 0;
      if (!this.nearBuilding('abri', 8)) this.damage(6, 'l\'orage');
      this.player.hitFlash = 0.4;
    } else if (climate === 'calme') {
      this.player.hp = Math.min(this.state.player.maxHp, this.player.hp + dt * 0.4);
    }
    for (const being of this.custom.beings) {
      if (!being.hostile) continue;
      const mesh = this.beingMeshes?.get(being.id);
      if (!mesh) continue;
      if (dist3([mesh.position.x, mesh.position.y, mesh.position.z], this.player.pos) < 2.2) this.damage(7 * dt, 'une bête du jardin');
    }
  }

  syncCustomLife() {
    if (!this.custom || !this.lifeGroup) return;
    const world = this.custom;
    const ids = new Set(world.beings.map((b) => b.id));
    for (const [id, mesh] of this.beingMeshes) {
      if (!ids.has(id)) { this.lifeGroup.remove(mesh); this.beingMeshes.delete(id); }
    }
    const colors = { terrestrial: '#8d6b3c', aquatic: '#3ec2d8', flying: '#d7e7ff', luminous: '#e7f08a', crystal: '#d5c6ff', energy: '#ffd56a', giant: '#c47a4a', intelligent: '#f0d2b0' };
    for (const being of world.beings) {
      let mesh = this.beingMeshes.get(being.id);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, being.cat === 'giant' ? 3 : 1, 0.7), this.material(colors[being.cat] || '#ccc', { emissive: colors[being.cat] || '#000', emissiveIntensity: 0.15 }));
        this.lifeGroup.add(mesh);
        this.beingMeshes.set(being.id, mesh);
      }
      const y = being.cat === 'aquatic' ? 2.8 : being.cat === 'flying' || being.cat === 'luminous' || being.cat === 'energy' ? 4.2 : 2.4;
      mesh.position.set(being.x, y, being.z);
    }
    this.lifeGroup.children.filter((child) => child.userData.plant).forEach((child) => this.lifeGroup.remove(child));
    for (const plant of world.plants) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4 + plant.size, 5), this.material('#3f7a3a', {}));
      mesh.position.set(plant.x, 2.2, plant.z);
      mesh.userData.plant = true;
      this.lifeGroup.add(mesh);
    }
  }

  drawSpark() {
    const canvas = document.getElementById('spark');
    if (!canvas || !this.custom) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hist = this.custom.history;
    if (hist.length < 2) return;
    const max = Math.max(1, ...hist.map((h) => Math.max(h.plants, h.herb, h.aqua)));
    const draw = (key, color) => {
      ctx.beginPath();
      hist.forEach((h, i) => {
        const x = (i / (hist.length - 1)) * canvas.width;
        const y = canvas.height - (h[key] / max) * (canvas.height - 4) - 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    draw('plants', '#8dcc6a');
    draw('herb', '#e2c27a');
    draw('aqua', '#7ee0ff');
  }

  /* ---------- actions ---------- */

  updatePrompt() {
    this.prompt = '';
    this.nearest = this.findNearest();
    if (this.nearest) this.prompt = `E — ${this.nearest.label}`;
  }

  findNearest() {
    let best = null;
    let bestD = 99;
    const consider = (distance, item) => { if (distance < bestD) { bestD = distance; best = item; } };
    for (const item of this.interacts) {
      const distance = dist3(item.pos, this.player.pos);
      if (distance <= item.radius) consider(distance, item);
    }
    for (const pickup of this.pickups) {
      if (pickup.taken || pickup.hidden) continue;
      const distance = dist3(pickup.pos, this.player.pos);
      if (distance <= pickup.radius) consider(distance, { label: `Ramasser ${RESOURCE_LABEL[pickup.resource] || ''}`, fn: () => this.takePickup(pickup) });
    }
    for (const built of this.built) {
      const distance = dist3(built.pos, this.player.pos);
      if (distance < 3.3) consider(distance, { label: BUILDINGS[built.type].name, fn: () => this.useBuilding(built) });
    }
    return best;
  }

  interact() {
    if (this.mode !== 'play') return;
    if (!this.nearest) { this.toast('Rien à portée.'); return; }
    this.audio.ok();
    this.nearest.fn(this);
  }

  takePickup(pickup) {
    if (pickup.taken) return;
    pickup.taken = true;
    pickup.mesh.visible = false;
    this.state.picked[pickup.id] = true;
    const bonus = this.state.tools.gauntlet && pickup.kind !== 'mote' && pickup.kind !== 'relic' ? 1 : 0;
    const amount = (pickup.amount || 1) + bonus;
    this.state.inventory[pickup.resource] = (this.state.inventory[pickup.resource] || 0) + amount;
    this.state.stats.harvests += 1;
    if (pickup.kind === 'mote' && String(pickup.id).startsWith('pz-mote')) this.state.flags.tutorialMotes += 1;
    if (pickup.onTake) pickup.onTake(this);
    this.toast(`+${amount} ${RESOURCE_LABEL[pickup.resource]}`);
    this.gainXp(4);
  }

  attack() {
    if (this.mode !== 'play' || this.attackCd > 0) return;
    this.attackCd = 0.48;
    const look = this.lookDir();
    let hit = false;
    for (const creature of this.creatures) {
      if (creature.dead || creature.spec.locomotion === 'npc') continue;
      const center = add(creature.pos, [0, creature.bodyH * 0.45, 0]);
      const to = sub(center, this.player.pos);
      const distance = len(to);
      if (distance > 2.8 + creature.radius * 0.4) continue;
      if (distance > 2 && dot(norm(to), look) < 0.05) continue;
      creature.hp -= this.state.tools.gauntlet ? 16 : 12;
      hit = true;
      if (creature.hp <= 0) this.killCreature(creature, true);
    }
    if (this.boss) hit = this.hitBoss(look) || hit;
    if (hit) this.audio.hit();
    else this.audio.blip();
  }

  placeAnchor() {
    if (!this.state.flags.gravityUnlocked && !this.state.laws.gravity) {
      this.toast('La loi est encore close. Parle au monolithe.');
      return;
    }
    if (this.player.inSilence) { this.toast('La zone de silence avale les lois.'); return; }
    const cost = 26;
    if (this.player.energy < cost) { this.toast('Pas assez d\'Énergie d\'Origine.'); return; }
    this.player.energy -= cost;
    const radius = this.state.upgrades.anchorRadius;
    const life = this.state.upgrades.anchorDuration * (this.state.tools.beacon ? 1.5 : 1);
    this.anchors.push({ pos: this.player.pos.slice(), up: this.draftUp, radius, life, owner: 'player' });
    const cap = this.state.upgrades.anchorCount;
    while (this.anchors.length > cap) this.anchors.shift();
    this.addStability(-12);
    this.state.stats.edits += 1;
    this.state.stats.anchors += 1;
    this.audio.law();
    this.toast(`Ancre posée : chute ${fallLabel(this.draftUp)}.`);
  }

  setRelative(kind) {
    if (kind === 'look') this.draftUp = snapUpFromDirection(this.flatLook());
    else if (kind === 'back') this.draftUp = snapUpFromDirection(scale(this.flatLook(), -1));
    else if (kind === 'flip') this.draftUp = flipUp(this.player.up);
    else this.draftUp = this.defaultUp;
    this.toast(`Ancre : chute ${fallLabel(this.draftUp)}.`);
    this.refreshReality();
  }

  castLaw(law) {
    if (!this.state.laws[law]) { this.toast('Cette loi n\'est pas encore à toi.'); return; }
    if (this.player.inSilence) { this.toast('Le silence refuse la loi.'); return; }
    const costs = { light: 18, matter: 22, life: 20, energy: 24, space: 16, time: 34 };
    const cost = costs[law] || 20;
    if (this.player.energy < cost) { this.toast('Pas assez d\'Énergie d\'Origine.'); return; }
    this.player.energy -= cost;
    this.state.stats.edits += 1;
    this.addStability(-6);
    if (law === 'light') {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), this.material('#fff4c4', { emissive: '#fff1b0', emissiveIntensity: 1 }));
      const pos = add(this.player.pos, scale(this.flatLook(), 2));
      pos[1] += 1.4;
      mesh.position.set(pos[0], pos[1], pos[2]);
      this.worldRoot.add(mesh);
      const light = new THREE.PointLight('#fff1b0', 2.2, 14);
      light.position.set(pos[0], pos[1], pos[2]);
      this.worldRoot.add(light);
      this.orbs.push({ pos, life: 16, radius: 9, mesh, light });
      this.toast('Une lueur tient seize secondes.');
    } else if (law === 'matter') {
      const node = this.pickups.filter((p) => !p.taken && !p.hidden && ['os', 'seve', 'cristal', 'ecaille'].includes(p.resource) && dist3(p.pos, this.player.pos) < 8)
        .sort((a, b) => dist3(a.pos, this.player.pos) - dist3(b.pos, this.player.pos))[0];
      if (!node) { this.player.energy += cost; this.addStability(6); this.state.stats.edits -= 1; this.toast('Aucun gisement proche.'); return; }
      const pair = { os: 'seve', seve: 'os', cristal: 'ecaille', ecaille: 'cristal' };
      node.resource = pair[node.resource];
      node.mesh.material = this.material(colorOfResource(node.resource), { emissive: colorOfResource(node.resource), emissiveIntensity: 0.7 });
      this.toast(`Le gisement devient ${RESOURCE_LABEL[node.resource]}.`);
    } else if (law === 'life') {
      this.creatures.forEach((c) => { if (c.spec.temperament === 'territorial' && c.species !== 'leviathan') c.calm = 14; });
      if (this.custom) {
        this.custom.plants.forEach((plant) => { plant.size = Math.min(1.5, plant.size + 0.35); });
        if (this.custom.plants.length < 4) this.custom.plants.push({ x: this.player.pos[0], z: this.player.pos[2], size: 0.6 });
        this.syncCustomLife();
      } else this.state.inventory.seve += 1;
      this.toast('La vie pousse, et les territoriaux s\'apaisent un moment.');
    } else if (law === 'energy') {
      this.creatures.forEach((c) => {
        if (c.spec.category === 'machine' || c.species === 'drone' || c.species === 'harvester') c.stun = 5;
        if (c.species === 'deformer' || c.species === 'drone') c.hp -= 18;
      });
      for (const b of this.state.buildings) {
        if (b.type === 'generateur' && b.universe === this.universeId && dist3([b.x, b.y, b.z], this.player.pos) < 12) {
          b.fuelUntil = Math.max(b.fuelUntil || 0, this.state.playtime + 45);
        }
      }
      this.toast('Les machines se figent. Les générateurs proches reprennent.');
    } else if (law === 'space') {
      const dest = add(this.player.pos, scale(this.flatLook(), 8));
      if (this.blocked(dest)) { this.player.energy += cost; this.addStability(6); this.state.stats.edits -= 1; this.toast('Le pas bute sur la matière.'); return; }
      this.player.pos = dest;
      this.toast('Tu poses le pied plus loin.');
    } else if (law === 'time') {
      this.slowUntil = this.state.playtime + 8;
      this.toast('Huit secondes où le reste du lieu hésite.');
    }
    this.audio.law();
  }

  blocked(pos) {
    const up = upVector(this.upAt(pos));
    const head = add(pos, scale(up, 1));
    return this.frameSolids().some((s) => containsPoint(s, add(pos, scale(up, 0.2)), -0.05) || containsPoint(s, head, -0.05));
  }

  research(law) {
    const entry = RESEARCH.find((r) => r.law === law);
    if (!entry || this.state.laws[law]) return;
    const ok = entry.need(this.state, this.hasPoweredResearch());
    if (!ok) { this.toast(entry.why); return; }
    const cost = this.costOf(entry);
    if (!this.canAfford(cost)) { this.toast(`Il faut ${costText(cost)}.`); return; }
    this.pay(cost);
    this.state.laws[law] = true;
    this.gainXp(30);
    this.addLore(`loi-${law}`, `Loi ${entry.name}`, entry.text);
    this.toast(`${entry.name} est à toi.`);
    this.audio.law();
    this.refreshResearch();
    this.refreshReality();
  }

  costOf(entry) {
    const raw = typeof entry.cost === 'function' ? entry.cost(this.state) : entry.cost;
    if (!this.hasBuilding('laboratoire')) return { ...raw };
    const out = {};
    for (const [k, v] of Object.entries(raw)) out[k] = Math.max(1, Math.ceil(v * 0.75));
    return out;
  }

  canAfford(cost) {
    return Object.entries(cost || {}).every(([k, v]) => (this.state.inventory[k] || 0) >= v);
  }

  pay(cost) {
    for (const [k, v] of Object.entries(cost || {})) this.state.inventory[k] -= v;
  }

  placeBuilding() {
    if ((this.player.up || '+y') !== '+y') { this.toast('Les structures ne tiennent que si la chute va vers le bas.'); return; }
    const spec = BUILDINGS[this.armed];
    if (!spec) return;
    if (spec.need && !this.state.laws[spec.need]) { this.toast(`Il faut d'abord la loi ${spec.need}.`); return; }
    if (!this.canAfford(spec.cost)) { this.toast(`Il faut ${costText(spec.cost)}.`); return; }
    const spot = this.groundInFront(3.4);
    if (!spot) { this.toast('Pas de sol devant toi.'); return; }
    if (this.state.buildings.some((b) => b.universe === this.universeId && Math.hypot(b.x - spot[0], b.z - spot[2]) < 2.8)) {
      this.toast('Trop près d\'une autre structure.');
      return;
    }
    this.pay(spec.cost);
    const building = {
      id: `b_${Math.random().toString(36).slice(2, 8)}`,
      type: this.armed,
      universe: this.universeId,
      x: spot[0], y: spot[1], z: spot[2],
      rot: this.buildRot,
      fuelUntil: 0,
    };
    this.state.buildings.push(building);
    this.spawnBuilding(building);
    this.toast(`${spec.name} construit.`);
    this.gainXp(10);
    this.refreshBuild();
  }

  groundInFront(distance) {
    const up = this.player.up || '+y';
    const target = add(this.player.pos, scale(this.flatLook(), distance));
    let bestY = null;
    for (const solid of this.frameSolids()) {
      if (target[0] < solid.min[0] || target[0] > solid.max[0] || target[2] < solid.min[2] || target[2] > solid.max[2]) continue;
      if (solid.max[1] > target[1] + 1.5) continue;
      if (bestY === null || solid.max[1] > bestY) bestY = solid.max[1];
    }
    if (bestY === null || up !== '+y') return null;
    return [target[0], bestY, target[2]];
  }

  spawnBuildings() {
    for (const building of this.state.buildings) if (building.universe === this.universeId) this.spawnBuilding(building);
  }

  spawnBuilding(building) {
    const spec = BUILDINGS[building.type];
    if (!spec) return;
    const [sx, sy, sz] = spec.size;
    const mesh = this.addBox({
      cx: building.x, cy: building.y + sy / 2, cz: building.z, sx, sy, sz,
      color: spec.color, emissive: spec.color, emissiveIntensity: 0.12, tag: building.id,
    });
    this.built.push({ ...building, pos: [building.x, building.y, building.z], mesh, acc: 0 });
  }

  useBuilding(built) {
    const data = this.state.buildings.find((b) => b.id === built.id);
    if (!data) return;
    if (data.type === 'generateur') {
      if ((this.state.inventory.eclat || 0) < 1) { this.say('Générateur', 'Il lui faut un éclat d\'Origine pour trois minutes.'); return; }
      this.state.inventory.eclat -= 1;
      data.fuelUntil = this.state.playtime + 180;
      this.toast('Le générateur tourne.');
      return;
    }
    if (data.type === 'atelier') return this.openCraft();
    if (data.type === 'laboratoire' || data.type === 'recherche') return this.openPanel('progression');
    if (data.type === 'portail') {
      if (!this.state.laws.space) { this.say('Portail', 'La loi Espace n\'est pas encore étudiée. Les arches anciennes du Point Zéro, elles, marchent sans elle.'); return; }
      return this.openPanel('map');
    }
    this.say(BUILDINGS[data.type].name, BUILDINGS[data.type].blurb);
  }

  openCraft() {
    const choices = CRAFTS.filter((c) => !this.state.tools[c.id]).map((c) => ({ label: `${c.name} — ${costText(c.cost)}`, act: 'craft', arg: c.id }));
    if (!choices.length) { this.say('Atelier', 'Tout ce qui se fabrique ici est déjà dans tes mains.'); return; }
    choices.push({ label: 'Fermer', act: 'close' });
    this.say('Atelier', 'Les outils changent la façon de récolter, de tenir une ancre, ou de survivre à la pression.', choices);
  }

  craft(id) {
    const item = CRAFTS.find((c) => c.id === id);
    if (!item || this.state.tools[id]) return false;
    if (!this.canAfford(item.cost)) { this.toast(`Il faut ${costText(item.cost)}.`); return true; }
    this.pay(item.cost);
    this.state.tools[id] = true;
    this.toast(`${item.name} assemblé. ${item.text}`);
    this.gainXp(12);
    return false;
  }

  nearBuilding(type, radius) {
    return this.built.some((b) => b.type === type && dist3(b.pos, this.player.pos) < radius);
  }

  nearPower(pos) {
    return this.state.buildings.some((g) => g.type === 'generateur' && g.universe === this.universeId && g.fuelUntil > this.state.playtime && dist3([g.x, g.y, g.z], pos) < 14);
  }

  hasBuilding(type) { return this.state.buildings.some((b) => b.type === type); }

  hasPoweredResearch() {
    return this.state.buildings.some((b) => b.type === 'recherche' && this.state.buildings.some((g) => g.type === 'generateur' && g.universe === b.universe && g.fuelUntil > this.state.playtime && dist3([g.x, g.y, g.z], [b.x, b.y, b.z]) < 14));
  }

  localResource() {
    if (this.universeId === 'giants') return 'seve';
    if (this.universeId === 'inverted') return 'cristal';
    if (this.universeId === 'zero') return 'eclat';
    if (this.custom?.params.terrain === 'cristaux') return 'cristal';
    return 'os';
  }

  travel(id) {
    if (this.transition) return;
    if (this.universeId === 'giants' && id !== 'giants' && this.state.flags.village === 'exploited') {
      this.state.flags.village = 'ruined';
      this.addLore('ruine', 'Village tu', 'Tu es parti avec le fragment. La machine a fini ce que tu as commencé.');
    }
    this.transition = true;
    this.panel = null;
    this.ui.fade(1, () => {
      this.loadUniverse(id);
      this.mode = 'play';
      this.ui.sync(this);
      this.ui.fade(0, () => { this.transition = false; });
      this.autosave();
    });
  }

  tryStoryTravel(id) {
    if (!this.state.laws.gravity) { this.say('Portail', 'Il est froid. Pose d\'abord la loi de gravité.'); return; }
    if (id === 'arena' && !this.state.flags.bossUnlocked) { this.say('Noyau', 'Deux fragments de l\'Origine doivent répondre avant que le noyau s\'ouvre.'); return; }
    if (id === 'arena' && this.state.flags.ending) { this.say('Noyau', 'Le choix est déjà inscrit dans la structure.'); return; }
    this.travel(id);
  }

  warp(id) {
    if (id === 'zero') return this.travel('zero');
    if (!this.state.laws.space && !String(id).startsWith('custom:')) {
      this.toast('Sans la loi Espace, marche jusqu\'aux arches du Point Zéro.');
      return;
    }
    if (id === 'arena' && !this.state.flags.bossUnlocked) { this.toast('Le noyau est encore clos.'); return; }
    this.travel(id);
  }

  openCreator() {
    if (!this.state.laws.gravity) { this.say('Atelier', 'Apprends d\'abord à poser une chute. Le jardin attendra.'); return; }
    this.openPanel('creator');
  }

  readWorldForm() {
    const creatures = {};
    CATEGORIES.forEach((cat) => { creatures[cat] = false; });
    document.querySelectorAll('#w-creatures input').forEach((box) => { creatures[box.value] = box.checked; });
    return normalizeParams({
      size: document.getElementById('w-size').value,
      terrain: document.getElementById('w-terrain').value,
      gravity: document.getElementById('w-gravity').value,
      temperature: document.getElementById('w-temperature').value,
      water: document.getElementById('w-water').value,
      vegetation: document.getElementById('w-vegetation').value,
      danger: document.getElementById('w-danger').value,
      resources: document.getElementById('w-resources').value,
      climate: document.getElementById('w-climate').value,
      creatures,
    });
  }

  generateWorld() {
    const name = document.getElementById('w-name').value.trim() || 'Jardin sans nom';
    const world = emptyWorld(this.readWorldForm(), name);
    seedWorld(world);
    this.state.worlds.push(world);
    this.addLore(`jardin-${world.id}`, world.name, 'Un jardin semé de ta main. Ses bêtes mangent, marchent et meurent selon le climat. Ce n\'est pas le Jardin du Néant : c\'est une esquisse que tu peux revoir.');
    this.gainXp(20);
    this.closePanel();
    this.travel(`custom:${world.id}`);
  }

  applyWorld() {
    if (!this.custom) { this.toast('Entre d\'abord dans un jardin.'); return; }
    this.custom.params = this.readWorldForm();
    this.gravityScale = this.custom.params.gravity;
    this.toast('Le jardin encaisse les nouvelles conditions.');
  }

  /* ---------- story ---------- */

  talkMonolith() {
    const flags = this.state.flags;
    if (flags.tutorialMotes < 3) {
      this.say('Monolithe', 'Trois éclats dorment encore sur la dalle. Ramasse-les. La loi ne s\'ouvre pas les mains vides.');
      return;
    }
    if (!flags.gravityUnlocked) {
      flags.gravityUnlocked = true;
      this.addLore('monolithe', 'Le monolithe', 'L\'Origine a semé des lois puis des réalités. La Grande Rupture a défait les liens. La signature au fond du monolithe ressemble à la tienne.');
      this.gainXp(15);
      this.say('Monolithe', 'Tu peux plier la chute d\'un lieu, pas d\'une planète. Va au nord, fais face au mur pâle, ouvre les lois et pose une ancre. Puis marche vers l\'est.');
      return;
    }
    if (!this.state.laws.gravity) {
      this.say('Monolithe', 'Le mur pâle est au nord. Choisis la chute vers le regard, ou vers le nord, et pose l\'ancre sous tes pieds.');
      return;
    }
    this.say('Monolithe', flags.bossUnlocked
      ? 'Le noyau est ouvert, derrière moi. Ce que tu décideras là-bas dira si les réalités restent plusieurs.'
      : 'Deux réalités répondent : les géants, et l\'envers du sol. Chaque fragment parlera un peu plus de qui a signé la Rupture.');
  }

  talkKael() {
    const flags = this.state.flags;
    if (flags.village === 'saved' && flags.civProgress.roots >= 3 && !flags.civGift.roots) {
      return this.say('Kael', 'On a greffé la sève sans toi. Le village tient. Prends ces éclats, ils ne nous servent pas à boire.', [{ label: 'Accepter', act: 'giftRoots' }, { label: 'Plus tard', act: 'close' }]);
    }
    if (flags.fragments.giants && flags.village === 'saved') {
      this.say('Kael', 'La machine est morte et les racines vivent. Reste discret avec Varak : il n\'aime pas les pas.');
      return;
    }
    if (flags.village === 'exploited') { this.say('Kael', 'Tu as pris le cœur et la sève. Ne me demande plus le chemin.'); return; }
    if (!flags.harvesterAlive && !flags.fragments.giants) {
      flags.village = 'saved';
      flags.fragments.giants = true;
      flags.seed = true;
      this.state.relations.roots = 85;
      this.state.inventory.eclat += 1;
      this.gainXp(50);
      this.addLore('fragment-g', 'Fragment des géants', 'La Rupture a une signature. Elle ressemble à la tienne, en plus ancien.');
      this.checkBoss();
      this.say('Kael', 'Elle s\'est tue. Le fragment était sous nos racines. Regarde-le : la coupure porte ta main, ou celle d\'un toi d\'avant.');
      return;
    }
    this.say('Kael', 'Le moissonneur boit la sève qui nous tient. Tu peux le briser, faire glisser l\'os vers l\'ouest, ou appeler Mira si elle t\'aime. Tu peux aussi nous prendre le fragment tout de suite.', [
      { label: 'Je vais arrêter la machine.', act: 'close' },
      { label: 'Je prends le fragment et la sève.', act: 'exploitVillage' },
    ]);
  }

  exploitVillage() {
    if (this.state.flags.fragments.giants) { this.say('Kael', 'Le fragment n\'est plus là.'); return true; }
    this.state.flags.village = 'exploited';
    this.state.flags.fragments.giants = true;
    this.state.inventory.seve += 8;
    this.state.relations.roots = 0;
    this.gainXp(20);
    this.addLore('exploit-roots', 'Racines coupées', 'Le fragment est à toi. Le village, non. En partant, la machine finira le travail.');
    this.checkBoss();
    this.toast('Fragment dérobé.');
    return false;
  }

  talkRuin() {
    this.say('Trace', 'Ils ont écrit, avant la fin : le créateur a choisi la sève plutôt que les gens. La phrase s\'arrête là.');
  }

  talkMira() {
    if (this.state.flags.mira === 'ally') { this.say('Mira', 'Appelle-moi près de la machine. Un pas me suffit.'); return; }
    if ((this.state.inventory.seve || 0) < 4) { this.say('Mira', 'Quatre sèves, et je marche avec toi. Je suis lourde : les petits pas ne me paient pas.'); return; }
    this.say('Mira', 'Quatre sèves. Ensuite, si la machine te gêne, je poserai le pied.', [
      { label: 'Donner quatre sèves', act: 'giveMira' },
      { label: 'Garder la sève', act: 'close' },
    ]);
  }

  giveMira() {
    if ((this.state.inventory.seve || 0) < 4) return false;
    this.state.inventory.seve -= 4;
    this.state.flags.mira = 'ally';
    this.state.relations.roots += 10;
    this.toast('Mira est avec toi.');
    return false;
  }

  talkHarvester() {
    if (!this.state.flags.harvesterAlive) { this.say('Moissonneur', 'Il ne boit plus.'); return; }
    const choices = [{ label: 'Le frapper au noyau', act: 'close' }];
    if (this.state.flags.mira === 'ally') choices.unshift({ label: 'Appeler Mira', act: 'callMira' });
    this.say('Moissonneur', 'Le noyau encaisse les coups. Un os, sur le socle à l\'est, glisse si la chute va vers l\'ouest. Mira, si tu l\'as nourrie, peut simplement poser le pied.', choices);
  }

  destroyHarvester(message) {
    if (!this.state.flags.harvesterAlive) return;
    this.state.flags.harvesterAlive = false;
    const creature = this.creatures.find((c) => c.species === 'harvester' && !c.dead);
    if (creature) this.killCreature(creature, false);
    this.toast(message);
    this.addLore('moisson', 'Machine arrêtée', 'Le moissonneur ne boit plus. Parle à Kael avant de partir, si tu veux que le village vive.');
    this.audio.ok();
  }

  talkSpine() {
    if (this.state.flags.ormAwake) { this.say('Orm', 'Il est réveillé. Éloigne-toi, ou apaise-le plus tard avec la loi Vie.'); return; }
    this.say('Colonne', 'L\'éclat est planté dans le dormeur. Le prendre, c\'est le lever.', [
      { label: 'Extraire', act: 'wakeOrm' },
      { label: 'Laisser dormir', act: 'close' },
    ]);
  }

  wakeOrm() {
    if (this.state.picked['spine-eclat']) return false;
    this.state.picked['spine-eclat'] = true;
    this.state.flags.ormAwake = true;
    this.state.inventory.eclat += 1;
    this.state.relations.roots = Math.max(0, this.state.relations.roots - 8);
    this.toast('Orm ouvre un œil trop grand.');
    this.gainXp(10);
    return false;
  }

  talkSilence() {
    this.state.flags.silenceRead = true;
    this.addLore('silence', 'Zone de silence', 'Les lois se taisent ici. L\'inscription dit : tu as déjà écrit ces lois. Tu les as brisées pour qu\'elles redeviennent libres. L\'Origine ne voulait pas un propriétaire.');
    this.say('Inscription', 'Tu as déjà écrit ces lois. Tu les as brisées pour qu\'elles redeviennent libres. Ici, aucune ancre ne tient : le silence est plus vieux que toi.');
    this.gainXp(20);
  }

  touchShrine(id) {
    const need = { shrineSol: '+y', shrineCiel: '-y', shrineMur: '-x' }[id];
    if (this.player.up !== need) {
      this.say('Faille', `Elle ne se ferme que si la chute va ${fallLabel(need)}.`);
      return;
    }
    if (this.state.flags[id]) { this.say('Faille', 'Celle-ci tient déjà.'); return; }
    this.state.flags[id] = true;
    this.toast('Faille stabilisée.');
    this.audio.ok();
    this.gainXp(12);
    const done = ['shrineSol', 'shrineCiel', 'shrineMur'].filter((key) => this.state.flags[key]).length;
    if (done === 3) this.say('Faille', 'Les trois orientations tiennent. Sera peut te remettre ce que la cité gardait.');
  }

  talkSera() {
    const flags = this.state.flags;
    if (flags.city === 'stabilized' && flags.civProgress.murmur >= 3 && !flags.civGift.murmur) {
      return this.say('Sera', 'La cité a repris ses murs. Tiens, des écailles que la mer nous laisse depuis que les failles se taisent.', [{ label: 'Accepter', act: 'giftMurmur' }]);
    }
    if (flags.city === 'exploited') { this.say('Sera', 'Tu as bu le noyau. Les drones connaissent ta chute. Ne me parle plus comme à une alliée.'); return; }
    const ready = flags.shrineSol && flags.shrineCiel && flags.shrineMur;
    if (ready && !flags.fragments.inverted) {
      flags.city = 'stabilized';
      flags.fragments.inverted = true;
      this.state.relations.murmur = 88;
      this.state.inventory.cristal += 3;
      this.gainXp(50);
      this.addLore('fragment-i', 'Fragment inversé', 'Une version antérieure de toi a tenté d\'unifier les lois. Le fragment le dit sans colère, comme un souvenir.');
      this.checkBoss();
      this.say('Sera', 'Tu as tenu trois sols différents sans nous réduire à un seul. Prends le fragment. Il parle d\'un architecte qui te ressemble.');
      return;
    }
    this.say('Sera', 'Nous vivons sur le mur parce que le sol ment. Trois failles crient : le sol d\'ici, le ciel de la mer, et ce mur. Stabilise-les. Ou vole le noyau, et nous apprendrons à te craindre.');
  }

  talkCore() {
    if (this.state.flags.fragments.inverted) { this.say('Noyau civique', 'Il n\'a plus rien à donner, ou plus rien à te pardonner.'); return; }
    this.say('Noyau civique', 'Le drainer donne le fragment, du cristal, et une cité qui te traitera comme une menace.', [
      { label: 'Drainer', act: 'exploitCity' },
      { label: 'Reculer', act: 'close' },
    ]);
  }

  exploitCity() {
    if (this.state.flags.fragments.inverted) return false;
    this.state.flags.city = 'exploited';
    this.state.flags.fragments.inverted = true;
    this.state.inventory.cristal += 8;
    this.state.inventory.eclat += 2;
    this.state.relations.murmur = 0;
    this.gainXp(20);
    this.addLore('exploit-mur', 'Cité drainée', 'Le fragment est à toi. Les Murmurants arment des drones. Une aide refusée devient une défense.');
    this.checkBoss();
    [[26.5, 12, 18], [26.8, 20, 10], [26.4, 24, 24]].forEach(([x, y, z]) => this.addCreature({ species: 'drone', x, y, z, scale: 1 }));
    this.toast('La cité se ferme.');
    return false;
  }

  talkIvo() {
    if (this.state.flags.loopBroken) {
      this.say('Ivo', 'L\'heure ne recommence plus. Ce n\'était pas le temps qui manquait : c\'était une copie trop fidèle, donc fausse.');
      return;
    }
    this.say('Ivo', 'L\'heure recommence. La cloche est au sud, là où le sol n\'est pas le sol. Je le redirai. Je l\'ai déjà dit.');
  }

  breakLoop() {
    if (this.player.up !== '-z') { this.say('Cloche', 'Pour rester sur cette paroi, la chute doit aller vers le sud.'); return; }
    if (this.state.flags.loopBroken) { this.say('Cloche', 'Elle s\'est tue.'); return; }
    this.state.flags.loopBroken = true;
    this.gainXp(22);
    this.addLore('boucle', 'La Boucle', 'Ivo répétait parce que le lieu était une copie. La cloche, atteinte par une chute vers le sud, a cassé la répétition.');
    this.say('Ivo', 'Ah. Merci. Une copie n\'est jamais tout à fait le lieu, même quand elle en a la voix.');
  }

  talkEcho() {
    this.say('Kael-écho', 'Les racines poussent vers le haut, comme toujours. Tout est en ordre, Créateur.', [
      { label: 'Noter que c\'est faux', act: 'noteCopy' },
      { label: 'Le laisser dire', act: 'close' },
    ]);
  }

  noteCopy() {
    this.state.flags.copyNoted = true;
    this.gainXp(18);
    this.addLore('copie', 'Monde copié', 'Le village est presque vrai. Le feu est froid, et Kael affirme que les racines poussent vers le haut. L\'Origine n\'écrit pas deux fois la même phrase.');
    this.toast('La différence est notée.');
    return false;
  }

  giftCiv(which) {
    if (which === 'roots') {
      this.state.flags.civGift.roots = true;
      this.state.inventory.eclat += 2;
    } else {
      this.state.flags.civGift.murmur = true;
      this.state.inventory.ecaille += 4;
    }
    this.toast('Un présent, plus tard que l\'urgence.');
    return false;
  }

  checkBoss() {
    const flags = this.state.flags;
    if (flags.fragments.giants && flags.fragments.inverted && !flags.bossUnlocked) {
      flags.bossUnlocked = true;
      this.gainXp(40);
      this.addLore('noyau', 'Le Noyau', 'Deux fragments, la même signature. Une version antérieure de toi a voulu une seule loi pour toutes les réalités. Le noyau s\'ouvre au Point Zéro.');
      this.toast('Le noyau de l\'Architecte est visible au Point Zéro.');
    }
  }

  ensureGuardian() {
    if (this.universeId === 'arena' || this.universeId === 'zero') return;
    if (this.creatures.some((c) => c.species === 'guardian' && !c.dead)) return;
    const pos = this.player.pos;
    this.addCreature({ species: 'guardian', x: pos[0] + 7, y: pos[1] + 2, z: pos[2] - 4, scale: 1.2 });
    this.toast('Un gardien naît : ce lieu est trop réécrit.');
  }

  /* ---------- boss ---------- */

  startBoss() {
    this.boss = {
      cores: [
        { up: '-y', hits: 0, color: '#ff5a4a', angle: 0 },
        { up: '-x', hits: 0, color: '#ffd36a', angle: 2.1 },
        { up: '+z', hits: 0, color: '#7ee0ff', angle: 4.2 },
      ],
      pulse: 6,
      removed: 0,
    };
    for (const core of this.boss.cores) {
      core.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), this.material(core.color, { emissive: core.color, emissiveIntensity: 0.9 }));
      this.worldRoot.add(core.mesh);
    }
    const body = this.makeCreature({ color: '#2a1216', category: 'giant', w: 1.2, h: 2.4, d: 0.6 }, 1.8);
    body.position.set(0, 2, -2);
    this.worldRoot.add(body);
    this.boss.body = body;
    this.say('Architecte', 'Tu es en retard. J\'ai déjà choisi la loi unique. Prouve que tu sais encore en changer : chaque cœur n\'écoute qu\'une chute.');
  }

  updateBoss(dt) {
    if (!this.boss || this.state.flags.ending) return;
    const boss = this.boss;
    boss.pulse -= dt;
    if (boss.pulse <= 0) {
      boss.pulse = 9;
      const options = UPS.filter((up) => up !== this.player.up);
      this.forcedUp = options[Math.floor(Math.random() * options.length)];
      this.forcedTimer = 2.4;
      this.toast('L\'Architecte retire une loi. Ton ancre, si tu es dedans, tient.');
    }
    boss.cores.forEach((core) => {
      if (core.hits >= 3) { core.mesh.visible = false; return; }
      core.angle += dt * 0.7;
      const vuln = this.player.up === core.up;
      const orbit = [Math.cos(core.angle) * 6, 6.5, Math.sin(core.angle) * 6 - 1];
      const goal = vuln ? add(this.player.pos, [0, 1.3, 0]) : orbit;
      const cur = [core.mesh.position.x, core.mesh.position.y, core.mesh.position.z];
      const next = lerp(cur, goal, 1 - Math.exp(-dt * (vuln ? 2.4 : 1.1)));
      core.mesh.position.set(next[0], next[1], next[2]);
    });
    if (boss.cores.every((core) => core.hits >= 3)) this.winBoss();
  }

  hitBoss(look) {
    for (const core of this.boss.cores) {
      if (core.hits >= 3 || this.player.up !== core.up) continue;
      const pos = [core.mesh.position.x, core.mesh.position.y, core.mesh.position.z];
      const to = sub(pos, this.player.pos);
      if (len(to) < 3.4 && dot(norm(to), look) > -0.2) {
        core.hits += 1;
        this.audio.hit();
        this.toast(`Cœur touché, ${core.hits} sur 3. Il voulait la chute ${fallLabel(core.up)}.`);
        if (core.hits >= 3) this.removePlate();
        return true;
      }
    }
    return false;
  }

  removePlate() {
    const tags = ['plate-0', 'plate-1', 'plate-2'];
    const tag = tags[this.boss.removed] || null;
    this.boss.removed += 1;
    if (!tag) return;
    this.solids.forEach((s) => { if (s.tag === tag) s.disabled = true; });
    this.worldRoot.traverse((obj) => { if (obj.userData?.tag === tag) obj.visible = false; });
    this.toast('Une dalle se détache du noyau.');
  }

  winBoss() {
    if (this.mode === 'ending') return;
    this.boss = null;
    this.mode = 'ending';
    this.panel = null;
    document.getElementById('ending-title').textContent = 'L\'Architecte plie';
    document.getElementById('ending-text').textContent = 'La voix est la tienne, plus ancienne. Elle voulait une seule grammaire pour toutes les réalités. Les fragments sont dans ta main. Le noyau attend de savoir ce que tu en fais.';
    const box = document.getElementById('ending-choices');
    const buttons = [
      ['balance', 'Restaurer les lois de chaque réalité'],
      ['creation', 'Semer des réalités nouvelles'],
      ['independence', 'Briser le pouvoir central'],
      ['architect', 'Prendre le contrôle du noyau'],
    ];
    if (this.secretOk()) buttons.push(['secret', 'Laisser le multivers diverger']);
    box.innerHTML = buttons.map(([id, label]) => `<button class="btn choice" data-act="ending" data-arg="${id}">${label}</button>`).join('');
    document.getElementById('ending-done').classList.add('hidden');
    this.ui.sync(this);
    this.audio.ok();
  }

  secretOk() {
    const flags = this.state.flags;
    return flags.silenceRead && flags.copyNoted && flags.loopBroken && flags.village === 'saved' && flags.city === 'stabilized' && flags.whiteHoleUses === 0 && flags.fragments.giants && flags.fragments.inverted;
  }

  chooseEnding(id) {
    if (id === 'secret' && !this.secretOk()) return;
    const ending = ENDINGS[id];
    if (!ending) return;
    this.state.flags.ending = id;
    let extra = '';
    if (id === 'creation') extra = this.state.worlds.length ? ` Tu as déjà ${this.state.worlds.length} jardin${this.state.worlds.length > 1 ? 's' : ''}. Ils seront les premières pousses.` : ' Tu n\'as encore semé aucun jardin : la pépinière s\'ouvre sur une terre nue.';
    if (id === 'balance' && (this.state.flags.village === 'ruined' || this.state.flags.city === 'exploited')) extra = ' L\'équilibre revient, avec les dettes que tu as laissées dans les cités.';
    if (id === 'architect' && this.state.flags.city === 'exploited') extra = ' Les drones des Murmurants reconnaissent déjà cette manière de prendre.';
    document.getElementById('ending-title').textContent = ending.title;
    document.getElementById('ending-text').textContent = ending.text + extra;
    document.getElementById('ending-choices').innerHTML = '';
    document.getElementById('ending-done').classList.remove('hidden');
    this.addLore(`fin-${id}`, ending.title, ending.text);
    this.autosave();
  }

  /* ---------- meta ---------- */

  discover(creature) {
    creature.scanned = true;
    if (this.state.codex[creature.species]) return;
    const spec = creature.spec;
    this.state.codex[creature.species] = {
      name: spec.name,
      category: spec.category,
      temperament: spec.temperament,
      habitat: spec.habitat,
      behavior: spec.behavior,
      world: this.universeName,
    };
    this.state.stats.scans += 1;
    this.player.energy = Math.min(this.state.player.maxEnergy, this.player.energy + 18);
    this.gainXp(12);
    this.toast(`Codex : ${spec.name}`);
  }

  gainXp(amount) {
    const before = levelInfo(this.state.player.xp).level;
    this.state.player.xp += amount;
    this.refreshVitals(before);
  }

  refreshVitals(before) {
    const info = levelInfo(this.state.player.xp);
    this.level = info.level;
    const hp = 100 + (info.level - 1) * 8;
    const energy = 100 + (info.level - 1) * 10;
    if (before && info.level > before) {
      this.player.hp = hp;
      this.player.energy = energy;
      this.toast(`Niveau ${info.level}. Le corps et l'énergie s'élargissent.`);
    }
    this.state.player.maxHp = hp;
    this.state.player.maxEnergy = energy;
  }

  damage(amount, source) {
    if (this.mode !== 'play' || amount <= 0) return;
    this.player.hp -= amount;
    this.player.hitFlash = Math.min(0.7, (this.player.hitFlash || 0) + 0.35);
    if (this.settings.shake) this.shake = 0.16;
    this.audio.hurt();
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.die(source);
    }
  }

  die(source) {
    if (this.mode === 'defeat') return;
    this.mode = 'defeat';
    this.panel = null;
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('defeat-text').textContent = source ? `${source} a eu raison du corps. Le fil de l'histoire, lui, tient.` : 'Le corps lâche.';
    this.ui.sync(this);
    this.syncPlayer();
    this.autosave();
  }

  respawn() {
    this.player.hp = Math.max(70, Math.min(this.state.player.maxHp, 80));
    this.player.energy = Math.max(this.player.energy, 40);
    this.mode = 'play';
    if (this.universeId === 'arena') this.loadUniverse('arena');
    else {
      this.player.pos = (this.safe || this.spawn).slice();
      this.player.vel = [0, 0, 0];
    }
    this.ui.sync(this);
  }

  addLore(id, title, body) {
    if (this.state.journal.some((entry) => entry.id === id)) return;
    this.state.journal.unshift({ id, title, body });
  }

  objectiveText() {
    const flags = this.state.flags;
    if (!this.state.laws.gravity) {
      if (flags.tutorialMotes < 3) return 'Ramasser trois éclats sur la dalle.';
      if (!flags.gravityUnlocked) return 'Parler au monolithe.';
      return 'Au nord, changer la chute et atteindre la plateforme dorée.';
    }
    if (!flags.fragments.giants) return 'Monde des Géants : le village et son fragment.';
    if (!flags.fragments.inverted) return 'Monde inversé : trois failles, ou le noyau des Murmurants.';
    if (!flags.ending) return 'Entrer dans le noyau de l\'Architecte.';
    return 'Le choix est inscrit. Le multivers continue.';
  }

  objectivePoint() {
    const flags = this.state.flags;
    const here = this.universeId;
    if (!this.state.laws.gravity && here === 'zero') {
      if (flags.tutorialMotes < 3) return [8, 3, 8];
      if (!flags.gravityUnlocked) return [0, 3, -2];
      return [18, 3, -32];
    }
    if (!flags.fragments.giants) return here === 'giants' ? (flags.harvesterAlive && flags.village !== 'exploited' ? [40, 3, -44] : [32, 3, -22]) : [12, 3, 8];
    if (!flags.fragments.inverted) {
      if (here !== 'inverted') return [-12, 4, 8];
      if (!flags.shrineCiel) return [-10, 43, 2];
      if (!flags.shrineMur) return [27, 26, 8];
      return [27, 18, 16];
    }
    if (!flags.ending) return here === 'arena' ? [0, 4, -2] : [0, 3, -8];
    return null;
  }

  updateArrow() {
    const el = document.getElementById('arrow');
    const point = this.mode === 'play' ? this.objectivePoint() : null;
    if (!point) { el.classList.add('hidden'); return; }
    const projected = new THREE.Vector3(point[0], point[1], point[2]).project(this.camera);
    if (projected.z > 1) { el.classList.add('hidden'); return; }
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const ang = Math.atan2(y - cy, x - cx);
    const margin = 70;
    el.classList.remove('hidden');
    el.style.left = `${Math.max(margin, Math.min(window.innerWidth - margin, x))}px`;
    el.style.top = `${Math.max(margin, Math.min(window.innerHeight - 120, y))}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${ang + Math.PI / 2}rad)`;
  }

  resourceLine() {
    return Object.entries(RESOURCE_LABEL).map(([key, name]) => `${name} ${this.state.inventory[key] || 0}`).join('   ');
  }

  refreshInventory() {
    const tools = Object.entries(this.state.tools).filter(([, on]) => on).map(([id]) => CRAFTS.find((c) => c.id === id)?.name).filter(Boolean);
    document.getElementById('inv-list').innerHTML = `
      ${Object.entries(RESOURCE_LABEL).map(([k, n]) => `<div class="entry"><b>${n}</b> — ${this.state.inventory[k] || 0}</div>`).join('')}
      <div class="entry">Outils : ${tools.length ? tools.join(', ') : 'aucun'}</div>
      <div class="entry">Niveau ${this.level} · ${this.state.player.xp} d'expérience</div>`;
  }

  refreshReality() {
    const laws = [['gravity', 'Gravité'], ['light', 'Lumière'], ['matter', 'Matière'], ['energy', 'Énergie'], ['life', 'Vie'], ['space', 'Espace'], ['time', 'Temps']];
    document.getElementById('reality-status').textContent = `Ancre préparée : chute ${fallLabel(this.draftUp)}. Rayon ${this.state.upgrades.anchorRadius} m. Coût 26. Les autres lois sont des gestes, pas des planètes.`;
    document.getElementById('law-row').innerHTML = laws.map(([id, name]) => {
      const on = id === 'gravity' ? this.state.laws.gravity || this.state.flags.gravityUnlocked : this.state.laws[id];
      if (id === 'gravity') return `<button class="btn small" disabled>${name} : ${this.state.laws.gravity ? 'tenue' : 'à éveiller'}</button>`;
      return `<button class="btn small" data-act="cast" data-arg="${id}" ${on ? '' : 'disabled'}>${name}${on ? '' : ' close'}</button>`;
    }).join('');
  }

  refreshResearch() {
    const discount = this.hasBuilding('laboratoire') ? 'Le laboratoire allège les coûts.' : 'Un laboratoire, bâti quelque part, allégera les coûts.';
    document.getElementById('research-list').innerHTML = `<p>${discount} ${this.hasPoweredResearch() ? 'Le centre de recherche est alimenté.' : 'Le centre de recherche doit être alimenté pour le Temps, et pour lire les comportements.'}</p>` + RESEARCH.map((entry) => {
      const owned = this.state.laws[entry.law];
      const cost = this.costOf(entry);
      const open = entry.need(this.state, this.hasPoweredResearch());
      return `<div class="entry"><b>${entry.name}</b> — ${owned ? 'acquise' : costText(cost)}<br>${entry.text}<br><span class="muted">${open ? '' : entry.why}</span>${owned ? '' : `<div><button class="btn small" data-act="research" data-arg="${entry.law}">Étudier</button></div>`}</div>`;
    }).join('') + `<div class="entry"><b>Gravité</b> — ${this.state.laws.gravity ? 'acquise au Point Zéro' : 's\'éveille en traversant le mur'}</div>`;
  }

  refreshCodex() {
    const entries = Object.values(this.state.codex);
    const detailed = this.hasPoweredResearch();
    document.getElementById('codex-list').innerHTML = entries.length ? entries.map((e) => `<div class="entry"><b>${e.name}</b> · ${CATEGORY_LABEL[e.category] || e.category} · ${e.temperament}<br>${e.habitat} — ${e.world}<br>${detailed ? e.behavior : 'Comportement illisible tant qu\'un centre de recherche n\'est pas alimenté.'}</div>`).join('') : '<p>Aucune espèce observée. Approche-toi.</p>';
  }

  refreshMap() {
    const custom = this.state.worlds.map((w) => ({ id: `custom:${w.id}`, name: w.name, open: true, line: `Jardin créé · ${w.params.terrain}, ${w.params.climate}` }));
    const rows = [...UNIVERSE_INFO, ...custom];
    document.getElementById('map-list').innerHTML = rows.map((u) => {
      const known = u.open && (u.id === 'zero' || u.id === 'giants' || u.id === 'inverted' || this.state.flags.visited[u.id] || String(u.id).startsWith('custom:') || (u.id === 'arena' && this.state.flags.bossUnlocked));
      const locked = !u.open || (u.id === 'arena' && !this.state.flags.bossUnlocked);
      return `<div class="entry"><b>${u.name}</b><br>${u.line}<br>${locked ? '<span class="muted">Rupture non stabilisée</span>' : `<button class="btn small" data-act="warp" data-arg="${u.id}">${known ? 'Y aller' : 'Y aller'}</button>`}</div>`;
    }).join('');
  }

  refreshBuild() {
    document.getElementById('build-list').innerHTML = Object.entries(BUILDINGS).map(([id, spec]) => `<div class="entry"><button class="btn small" data-act="arm" data-arg="${id}">${this.armed === id ? '● ' : ''}${spec.name}</button> ${costText(spec.cost)}<br><span class="muted">${spec.blurb}</span></div>`).join('');
    document.getElementById('build-hint').textContent = 'La pose se fait devant toi, uniquement quand la chute va vers le bas. Les extracteurs et le centre de recherche exigent un générateur proche, nourri d\'un éclat.';
  }

  refreshJournal() {
    const flags = this.state.flags;
    const missions = [
      ['Éveil', this.state.laws.gravity ? 'fait' : 'en cours', 'Éclats, monolithe, traversée par la gravité.'],
      ['Les géants', flags.fragments.giants ? 'fait' : flags.visited.giants ? 'en cours' : 'fermé', 'Arrêter ou dépouiller. Le fragment suit.'],
      ['L\'envers', flags.fragments.inverted ? 'fait' : flags.visited.inverted ? 'en cours' : 'fermé', 'Trois failles, ou le noyau drainé.'],
      ['Le noyau', flags.ending ? 'fait' : flags.bossUnlocked ? 'ouvert' : 'clos', 'L\'Architecte teste la chute, pas seulement les coups.'],
      ['Mira', flags.mira === 'ally' ? 'alliée' : 'libre', 'Quatre sèves, puis son pied.'],
      ['Silence', flags.silenceRead ? 'lu' : 'non lu', 'Une grotte où les lois se taisent.'],
      ['Boucle', flags.loopBroken ? 'brisée' : 'en boucle', 'La cloche au sud du petit îlot.'],
      ['Copie', flags.copyNoted ? 'notée' : 'non vue', 'Un village presque vrai.'],
      ['Jardins', `${this.state.worlds.length}`, 'Créés depuis l\'atelier du Point Zéro.'],
    ];
    document.getElementById('journal-list').innerHTML = `<p>Veilleurs ${this.state.relations.roots} · Murmurants ${this.state.relations.murmur} · Trou blanc ${flags.whiteHoleUses}</p>`
      + missions.map(([t, s, d]) => `<div class="entry"><b>${t}</b> — ${s}<br>${d}</div>`).join('')
      + this.state.journal.map((e) => `<div class="entry"><b>${e.title}</b><br>${e.body}</div>`).join('');
  }

  refreshSaves() {
    const data = listSaves();
    const line = (entry, index) => {
      if (!entry) return `<div class="entry">Emplacement ${index + 1} vide <button class="btn small" data-act="save-slot" data-arg="${index}">Sauver</button></div>`;
      if (entry.broken) return `<div class="entry">Emplacement ${index + 1} illisible <button class="btn small" data-act="del-slot" data-arg="${index}">Effacer</button></div>`;
      const when = new Date(entry.savedAt).toLocaleString('fr-FR');
      return `<div class="entry"><b>Emplacement ${index + 1}</b> — ${entry.universe}, ${Math.round(entry.playtime)} s, ${when}<br>
        <button class="btn small" data-act="save-slot" data-arg="${index}">Sauver</button>
        <button class="btn small" data-act="load-slot" data-arg="${index}">Charger</button>
        <button class="btn small" data-act="del-slot" data-arg="${index}">Effacer</button></div>`;
    };
    const auto = data.auto && !data.auto.broken ? `Automatique : ${data.auto.universe}, ${new Date(data.auto.savedAt).toLocaleString('fr-FR')}` : 'Pas encore de sauvegarde automatique.';
    document.getElementById('save-list').innerHTML = `<p>${auto}</p>${data.broken ? '<p>La mémoire du navigateur a renvoyé une sauvegarde abîmée. Les emplacements sains restent utilisables.</p>' : ''}${data.slots.map(line).join('')}`;
  }

  syncPlayer() {
    const p = this.state.player;
    p.x = this.player.pos[0]; p.y = this.player.pos[1]; p.z = this.player.pos[2];
    p.yaw = this.player.yaw; p.pitch = this.player.pitch;
    p.hp = this.player.hp; p.energy = this.player.energy;
    p.maxHp = p.maxHp || 100; p.maxEnergy = p.maxEnergy || 100;
    this.state.safe = this.safe;
  }

  autosave() {
    try {
      this.syncPlayer();
      saveSlot('auto', this.state);
      this.hasContinue = true;
    } catch {
      this.toast('La sauvegarde automatique a échoué. Exporte une copie.');
    }
  }

  manualSave(index) {
    try {
      this.syncPlayer();
      saveSlot(index, this.state);
      saveSlot('auto', this.state);
      this.toast(`Emplacement ${index + 1} inscrit.`);
      this.refreshSaves();
    } catch {
      this.toast('Impossible d\'écrire la sauvegarde.');
    }
  }

  manualLoad(index) {
    try {
      this.state = loadSlot(index);
      this.bootFromState();
    } catch (err) {
      this.toast(err.message || 'Cette sauvegarde est illisible.');
    }
  }

  exportSave() {
    this.syncPlayer();
    const blob = new Blob([exportState(this.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'omniverse-sauvegarde.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  importSave(text) {
    try {
      this.state = importState(text);
      this.bootFromState();
      this.toast('Sauvegarde importée.');
    } catch {
      this.toast('Ce fichier n\'est pas une sauvegarde du jeu.');
    }
  }
}

function colorOfResource(id) {
  return { eclat: '#f2d48a', os: '#e7dcc8', seve: '#8dcc6a', cristal: '#b7d4ff', ecaille: '#7ee0d6' }[id] || '#ffffff';
}

function fusionCenter(zone) {
  return [
    (zone.min[0] + zone.max[0]) / 2,
    (zone.min[1] + zone.max[1]) / 2,
    (zone.min[2] + zone.max[2]) / 2,
  ];
}

function flipUp(up) {
  return { '+y': '-y', '-y': '+y', '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z' }[up] || '+y';
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.once = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat || this.keys.has(e.code)) return;
      this.keys.add(e.code);
      this.once.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseX += e.movementX;
        this.mouseY += e.movementY;
      }
    });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.once.has(code); }
  endFrame() { this.once.clear(); this.mouseX = 0; this.mouseY = 0; }
}
