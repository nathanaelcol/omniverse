const HTML = `
<div id="fade"></div>
<div id="vignette"></div>
<section id="title" class="screen">
  <div class="panel" style="text-align:center">
    <div class="eyebrow">Multivers</div>
    <h1>OMNIVERSE</h1>
    <div class="eyebrow" style="margin-top:10px">Le Dernier Créateur</div>
    <p>Les réalités ont été séparées. Les lois attendent une main qui sache les poser sans les enfermer.</p>
    <div class="stack">
      <button class="btn primary" data-act="new">Nouvelle partie</button>
      <button class="btn" data-act="continue" id="btn-continue">Continuer</button>
      <button class="btn" data-act="open-saves">Sauvegardes</button>
      <button class="btn" data-act="open-settings">Paramètres</button>
      <button class="btn" data-act="open-help">Comment jouer</button>
      <button class="btn" data-act="credits">Crédits</button>
      <button class="btn" data-act="quit-info">Quitter</button>
    </div>
  </div>
</section>
<section id="intro" class="screen hidden">
  <div class="panel">
    <div class="eyebrow">Avant le temps</div>
    <h2 id="intro-title">L'Origine</h2>
    <p id="intro-text"></p>
    <button class="btn primary" data-act="intro-next">Continuer</button>
  </div>
</section>
<div id="hud" class="hidden">
  <div class="bars">
    <div><div class="bar-label"><span>Vie</span><span id="hp-num"></span></div><div class="bar"><span id="hp-fill"></span></div></div>
    <div><div class="bar-label"><span>Énergie d'Origine</span><span id="en-num"></span></div><div class="bar"><span id="en-fill"></span></div></div>
    <div><div class="bar-label"><span>Stabilité</span><span id="st-num"></span></div><div class="bar"><span id="st-fill"></span></div></div>
    <div id="ox-wrap" class="hidden"><div class="bar-label"><span>Oxygène</span><span id="ox-num"></span></div><div class="bar"><span id="ox-fill"></span></div></div>
    <div class="bar-label"><span id="lvl"></span><span id="fall-label"></span></div>
  </div>
  <div class="quest"><strong id="universe-name"></strong><span id="objective"></span></div>
  <div class="res" id="res-mini"></div>
  <div id="prompt" class="hidden"></div>
  <div id="crosshair"></div>
  <div id="arrow" class="hidden"></div>
  <canvas id="spark" class="hidden" width="220" height="64"></canvas>
  <div id="debug-line" class="hidden"></div>
  <div class="dock">
    <button class="btn small" data-act="interact">Interagir</button>
    <button class="btn small" data-act="attack">Frapper</button>
    <button class="btn small" data-act="toggle-reality">Lois</button>
    <button class="btn small" data-act="toggle-build">Bâtir</button>
    <button class="btn small" data-act="toggle-inventory">Sac</button>
    <button class="btn small" data-act="toggle-journal">Journal</button>
    <button class="btn small" data-act="toggle-codex">Codex</button>
    <button class="btn small" data-act="toggle-map">Carte</button>
    <button class="btn small" data-act="toggle-progression">Progrès</button>
    <button class="btn small" data-act="pause">Pause</button>
  </div>
</div>
<section id="dialogue" class="screen hidden" style="background:linear-gradient(transparent, rgba(0,0,0,0.78)); align-items:end">
  <div class="panel wide">
    <div class="eyebrow" id="dlg-who"></div>
    <p id="dlg-text" style="color:var(--ink); font-size:18px"></p>
    <div class="stack" id="dlg-choices"></div>
  </div>
</section>
<section id="pause" class="screen hidden">
  <div class="panel">
    <div class="eyebrow">Pause</div>
    <h2>Le temps se tient</h2>
    <div class="stack">
      <button class="btn primary" data-act="resume">Reprendre</button>
      <button class="btn" data-act="toggle-inventory">Inventaire</button>
      <button class="btn" data-act="toggle-reality">Éditeur de réalité</button>
      <button class="btn" data-act="toggle-progression">Arbre de progression</button>
      <button class="btn" data-act="toggle-codex">Codex</button>
      <button class="btn" data-act="toggle-map">Carte des univers</button>
      <button class="btn" data-act="toggle-build">Construction</button>
      <button class="btn" data-act="toggle-journal">Journal</button>
      <button class="btn" data-act="open-saves">Sauvegarder</button>
      <button class="btn" data-act="open-settings">Paramètres</button>
      <button class="btn" data-act="retreat">Se replier au Point Zéro</button>
      <button class="btn" data-act="open-help">Aide</button>
      <button class="btn danger" data-act="to-title">Menu principal</button>
    </div>
  </div>
</section>
<section id="panel-inventory" class="screen hidden"><div class="panel"><div class="eyebrow">Inventaire</div><h2>Ce que tu portes</h2><div id="inv-list"></div><button class="btn" data-act="close-panel">Fermer</button></div></section>
<section id="panel-reality" class="screen hidden"><div class="panel wide"><div class="eyebrow">Éditeur de réalité</div><h2>Lois locales</h2><p id="reality-status"></p><div class="row" id="dir-row"></div><div class="row" id="rel-row"></div><div class="row" id="law-row"></div><button class="btn primary" data-act="place-anchor">Poser l'ancre de gravité</button><button class="btn" data-act="close-panel">Fermer</button></div></section>
<section id="panel-progression" class="screen hidden"><div class="panel wide"><div class="eyebrow">Progression</div><h2>Ce que tu peux apprendre</h2><div id="research-list"></div><button class="btn" data-act="close-panel">Fermer</button></div></section>
<section id="panel-codex" class="screen hidden"><div class="panel wide"><div class="eyebrow">Codex</div><h2>Espèces observées</h2><div id="codex-list"></div><button class="btn" data-act="close-panel">Fermer</button></div></section>
<section id="panel-map" class="screen hidden"><div class="panel wide"><div class="eyebrow">Carte</div><h2>Univers</h2><div id="map-list"></div><button class="btn" data-act="close-panel">Fermer</button></div></section>
<section id="panel-build" class="screen hidden"><div class="panel wide"><div class="eyebrow">Construction</div><h2>Poser une structure</h2><div id="build-list"></div><p id="build-hint"></p><div class="row"><button class="btn primary" data-act="build-place">Poser devant moi</button><button class="btn" data-act="build-rotate">Tourner</button><button class="btn" data-act="close-panel">Fermer</button></div></div></section>
<section id="panel-journal" class="screen hidden"><div class="panel wide"><div class="eyebrow">Journal</div><h2>Missions et traces</h2><div id="journal-list"></div><button class="btn" data-act="close-panel">Fermer</button></div></section>
<section id="panel-settings" class="screen hidden"><div class="panel"><div class="eyebrow">Paramètres</div><h2>Réglages</h2>
  <div class="stack">
    <label class="slider">Sensibilité du regard <input data-setting="sensitivity" type="range" min="0.0008" max="0.006" step="0.0001"></label>
    <label class="slider">Volume <input data-setting="volume" type="range" min="0" max="1" step="0.01"></label>
    <label class="slider">Qualité <select data-setting="quality"><option value="high">Élevée</option><option value="low">Légère</option></select></label>
    <label><input data-setting="invertY" type="checkbox"> Inverser l'axe vertical</label>
    <label><input data-setting="shake" type="checkbox"> Secousse à l'impact</label>
    <button class="btn" data-act="close-panel">Fermer</button>
  </div>
</div></section>
<section id="panel-saves" class="screen hidden"><div class="panel"><div class="eyebrow">Mémoire</div><h2>Sauvegardes</h2><div id="save-list"></div><div class="row"><button class="btn" data-act="export-save">Exporter</button><button class="btn" data-act="import-save">Importer</button><button class="btn" data-act="close-panel">Fermer</button></div><input id="import-file" type="file" accept="application/json,.json" hidden></div></section>
<section id="panel-help" class="screen hidden"><div class="panel wide"><div class="eyebrow">Geste</div><h2>Comment jouer</h2>
  <p><span class="kbd">ZQSD</span> ou <span class="kbd">WASD</span> marcher · <span class="kbd">souris</span> ou <span class="kbd">flèches</span> regarder · <span class="kbd">Espace</span> sauter · <span class="kbd">Ctrl</span> se baisser · <span class="kbd">Maj</span> courir</p>
  <p><span class="kbd">E</span> interagir · <span class="kbd">F</span> frapper · <span class="kbd">G</span> lois · <span class="kbd">B</span> bâtir · <span class="kbd">Échap</span> fermer ou pause</p>
  <p>La gravité ne change qu'à l'intérieur d'une ancre, et l'ancre est petite. C'est le cœur du jeu : poser la bonne chute au bon endroit. Les machines, les failles et l'Architecte se lisent de la même façon.</p>
  <p>Deux univers sont ouverts : les Géants et le Monde inversé. Les autres sont encore coupés par la Rupture. L'atelier crée des jardins plus simples, avec une écologie lisible, pas une évolution complète.</p>
  <button class="btn" data-act="close-panel">Fermer</button>
</div></section>
<section id="panel-creator" class="screen hidden"><div class="panel wide"><div class="eyebrow">Création</div><h2>Semer un jardin</h2>
  <div class="stack" id="creator-form">
    <label>Nom <input id="w-name" type="text" maxlength="32" value="Jardin premier" style="width:100%;background:#14120f;border:1px solid var(--line);padding:8px"></label>
    <div class="grid-2">
      <label>Taille <select id="w-size"><option value="small">Petite</option><option value="medium">Moyenne</option><option value="large">Grande</option></select></label>
      <label>Terrain <select id="w-terrain"><option>plaine</option><option>archipel</option><option>canyon</option><option>cristaux</option><option>dunes</option></select></label>
      <label class="slider">Gravité <b id="w-gravity-v">1</b><input id="w-gravity" type="range" min="0.4" max="2" step="0.1" value="1"></label>
      <label class="slider">Température <b id="w-temperature-v">18</b><input id="w-temperature" type="range" min="-20" max="60" step="1" value="18"></label>
      <label class="slider">Eau <b id="w-water-v">40</b><input id="w-water" type="range" min="0" max="100" step="1" value="40"></label>
      <label class="slider">Végétation <b id="w-vegetation-v">45</b><input id="w-vegetation" type="range" min="0" max="100" step="1" value="45"></label>
      <label class="slider">Danger <b id="w-danger-v">15</b><input id="w-danger" type="range" min="0" max="100" step="1" value="15"></label>
      <label>Ressources <select id="w-resources"><option value="poor">Pauvres</option><option value="balanced" selected>Équilibrées</option><option value="rich">Riches</option></select></label>
      <label>Climat <select id="w-climate"><option value="calme">Calme</option><option value="tempete">Tempête</option><option value="brume">Brume</option><option value="orage">Orage</option></select></label>
    </div>
    <div class="row" id="w-creatures"></div>
    <p>Les bêtes marchent, mangent et disparaissent si le climat ne leur va pas. Une aquatique sans eau meurt. Ce n'est pas une évolution biologique complète.</p>
    <div class="row">
      <button class="btn primary" data-act="gen-world">Générer et entrer</button>
      <button class="btn" data-act="apply-world">Appliquer au jardin actuel</button>
      <button class="btn" data-act="close-panel">Fermer</button>
    </div>
  </div>
</div></section>
<section id="ending" class="screen hidden"><div class="panel wide"><div class="eyebrow">Conséquence</div><h2 class="ending-title" id="ending-title"></h2><p id="ending-text" style="color:var(--ink)"></p><div class="stack" id="ending-choices"></div><button class="btn hidden" id="ending-done" data-act="to-title">Retour au menu</button></div></section>
<section id="defeat" class="screen hidden"><div class="panel"><div class="eyebrow">Chute</div><h2>Le corps lâche</h2><p id="defeat-text">L'énergie du lieu te rejette, pas l'histoire. Tu peux revenir au dernier sol sûr.</p><div class="row"><button class="btn primary" data-act="respawn">Reprendre ici</button><button class="btn" data-act="load-auto">Dernière sauvegarde</button><button class="btn" data-act="to-title">Menu</button></div></div></section>
<section id="confirm" class="screen hidden"><div class="panel"><p id="confirm-text" style="color:var(--ink)"></p><div class="row"><button class="btn primary" data-act="confirm-yes">Confirmer</button><button class="btn" data-act="confirm-no">Annuler</button></div></div></section>
<div id="toast"></div>
<div id="fatal" class="screen hidden"><div class="panel"><h2>Le monde n'a pas pu se tenir</h2><p id="fatal-text"></p></div></div>
`;

export function mountUI(game) {
  const root = document.getElementById('overlay');
  root.innerHTML = HTML;
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    event.preventDefault();
    game.audio.resume();
    game.onAction(btn.dataset.act, btn.dataset.arg || '');
  });
  root.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset.setting) game.setSetting(el.dataset.setting, el.type === 'checkbox' ? el.checked : el.value);
    if (el.id && el.id.startsWith('w-') && el.type === 'range') {
      const label = document.getElementById(`${el.id}-v`);
      if (label) label.textContent = el.value;
    }
  });
  root.addEventListener('change', (event) => {
    if (event.target.id === 'import-file' && event.target.files[0]) {
      const file = event.target.files[0];
      file.text().then((text) => game.importSave(text)).catch(() => game.toast('Fichier illisible.'));
      event.target.value = '';
    }
  });
  const ui = new UI(root);
  ui.fillStatic();
  ui.syncSettings(game.settings);
  return ui;
}

const DIRS = [
  ['+y', 'Chuter vers le bas'],
  ['-y', 'Chuter vers le haut'],
  ['-x', "Chuter vers l'est"],
  ['+x', "Chuter vers l'ouest"],
  ['+z', 'Chuter vers le nord'],
  ['-z', 'Chuter vers le sud'],
];

class UI {
  constructor(root) { this.root = root; this.toastTimer = 0; }

  fillStatic() {
    document.getElementById('dir-row').innerHTML = DIRS.map(([id, label]) => `<button class="btn small" data-act="dir" data-arg="${id}">${label}</button>`).join('');
    document.getElementById('rel-row').innerHTML = [
      ['look', 'Vers le regard'],
      ['back', 'Dans le dos'],
      ['flip', 'Renverser'],
      ['world', 'Gravité du lieu'],
    ].map(([id, label]) => `<button class="btn small" data-act="rel" data-arg="${id}">${label}</button>`).join('');
    const cats = ['terrestrial', 'aquatic', 'flying', 'luminous', 'crystal', 'energy', 'giant', 'intelligent'];
    const names = { terrestrial: 'Terrestres', aquatic: 'Aquatiques', flying: 'Volantes', luminous: 'Lumineuses', crystal: 'Cristallines', energy: 'Énergétiques', giant: 'Géantes', intelligent: 'Intelligentes' };
    document.getElementById('w-creatures').innerHTML = cats.map((c) => `<label><input type="checkbox" value="${c}" ${c === 'terrestrial' ? 'checked' : ''}> ${names[c]}</label>`).join('');
  }

  syncSettings(settings) {
    this.root.querySelectorAll('[data-setting]').forEach((el) => {
      const v = settings[el.dataset.setting];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (v !== undefined) el.value = v;
    });
  }

  sync(game) {
    const mode = game.mode;
    const panel = game.panel;
    const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);
    show('title', mode === 'title');
    show('intro', mode === 'intro');
    show('dialogue', mode === 'dialogue');
    show('pause', mode === 'pause');
    show('defeat', mode === 'defeat');
    show('ending', mode === 'ending');
    show('confirm', !!game.confirming);
    show('hud', mode === 'play' || mode === 'dialogue');
    ['inventory', 'reality', 'progression', 'codex', 'map', 'build', 'journal', 'settings', 'saves', 'help', 'creator'].forEach((name) => {
      show(`panel-${name}`, panel === name && mode === 'play');
    });
    document.getElementById('btn-continue').disabled = !game.hasContinue;
  }

  dialogue(who, text, choices) {
    document.getElementById('dlg-who').textContent = who;
    document.getElementById('dlg-text').textContent = text;
    document.getElementById('dlg-choices').innerHTML = choices.map((c) => `<button class="btn choice" data-act="${c.act}" data-arg="${c.arg || ''}">${c.label}</button>`).join('');
  }

  toast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3200);
  }

  fade(opacity, done) {
    const el = document.getElementById('fade');
    el.style.opacity = String(opacity);
    if (done) setTimeout(done, 380);
  }

  hud(game) {
    const p = game.state.player;
    const hp = game.player.hp;
    const en = game.player.energy;
    setBar('hp', hp, p.maxHp);
    setBar('en', en, p.maxEnergy);
    const st = game.stability();
    setBar('st', st, 100);
    document.getElementById('hp-num').textContent = `${Math.ceil(hp)}`;
    document.getElementById('en-num').textContent = `${Math.ceil(en)}`;
    document.getElementById('st-num').textContent = `${Math.round(st)}`;
    const ox = game.player.oxygen;
    document.getElementById('ox-wrap').classList.toggle('hidden', ox > 99 && !game.player.inWater);
    setBar('ox', ox, 100);
    document.getElementById('ox-num').textContent = `${Math.ceil(ox)}`;
    document.getElementById('lvl').textContent = `Niveau ${game.level}`;
    document.getElementById('fall-label').textContent = `Chute ${game.fallText}`;
    document.getElementById('universe-name').textContent = game.universeName || '';
    document.getElementById('objective').textContent = game.objectiveText();
    document.getElementById('res-mini').textContent = game.resourceLine();
    const prompt = document.getElementById('prompt');
    if (game.prompt) { prompt.classList.remove('hidden'); prompt.textContent = game.prompt; }
    else prompt.classList.add('hidden');
    document.getElementById('spark').classList.toggle('hidden', !game.custom);
    const vig = document.getElementById('vignette');
    vig.style.background = `radial-gradient(ellipse at center, transparent 45%, rgba(90,0,0,${game.player.hitFlash || 0}) 100%)`;
    const canvas = document.getElementById('view');
    canvas.style.filter = game.player.inSilence ? 'grayscale(0.85)' : game.player.inFusion ? 'contrast(1.25) saturate(1.3)' : '';
  }

  debug(text) {
    const el = document.getElementById('debug-line');
    el.classList.remove('hidden');
    el.textContent = text;
  }

  fatal(message) {
    document.getElementById('fatal').classList.remove('hidden');
    document.getElementById('fatal-text').textContent = message;
  }
}

function setBar(id, value, max) {
  const el = document.getElementById(`${id}-fill`);
  el.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}
