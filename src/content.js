export const RESOURCE_LABEL = {
  eclat: 'Éclat',
  os: 'Os ancien',
  seve: 'Sève',
  cristal: 'Cristal',
  ecaille: 'Écaille',
};

export const CATEGORY_LABEL = {
  terrestrial: 'Terrestre',
  aquatic: 'Aquatique',
  flying: 'Volante',
  luminous: 'Lumineuse',
  crystal: 'Cristalline',
  energy: 'Énergétique',
  giant: 'Géante',
  intelligent: 'Intelligente',
  machine: 'Machine',
};

export function costText(cost) {
  if (!cost || !Object.keys(cost).length) return 'aucun coût';
  return Object.entries(cost).map(([k, v]) => `${v} ${RESOURCE_LABEL[k] || k}`).join(' · ');
}

export const SPECIES = {
  lucane: { name: 'Lucane des racines', category: 'terrestrial', temperament: 'calme', locomotion: 'ground', habitat: 'Forêt des géants', behavior: 'Broute la mousse. Il ne quitte pas le sol.', hp: 24, color: '#6f8f45', w: 1.5, h: 0.8, d: 1.9, damage: 0 },
  spore: { name: 'Sporelanterne', category: 'luminous', temperament: 'fuite', locomotion: 'fly', habitat: 'Forêt des géants', behavior: 'S’élève dès qu’on approche. Sa lueur marque les échos.', hp: 14, color: '#dff26a', w: 0.7, h: 0.7, d: 0.7, damage: 0 },
  varak: { name: 'Varak', category: 'giant', temperament: 'territorial', locomotion: 'giant', habitat: 'Forêt des géants', behavior: 'Garde les troncs. L’herbe haute et la posture basse le trompent.', hp: 150, color: '#8d5b3a', w: 2.1, h: 3.2, d: 1.6, damage: 26, vision: 20 },
  orm: { name: 'Orm', category: 'giant', temperament: 'dormant', locomotion: 'dormant', habitat: 'Crête osseuse', behavior: 'La montagne respire. Voler l’éclat de sa colonne le réveille.', hp: 220, color: '#d2c2a4', w: 2.4, h: 3.4, d: 1.8, damage: 34, vision: 16 },
  mira: { name: 'Mira', category: 'giant', temperament: 'calme', locomotion: 'giant', habitat: 'Lisière', behavior: 'Échange quatre sèves contre son aide. Son pas écrase le moissonneur.', hp: 170, color: '#e0a45e', w: 2, h: 3.1, d: 1.5, damage: 0, vision: 10 },
  kael: { name: 'Kael', category: 'intelligent', temperament: 'calme', locomotion: 'npc', habitat: 'Village des racines', behavior: 'Veilleur des racines. Il veut que la machine cesse de boire la sève.', hp: 30, color: '#efd7ae', w: 0.7, h: 1.7, d: 0.4, damage: 0 },
  harvester: { name: 'Moissonneur', category: 'machine', temperament: 'hostile', locomotion: 'machine', habitat: 'Bord du village', behavior: 'Aspire la sève. Le noyau cède aux coups, à l’os qui glisse, ou au pied de Mira.', hp: 96, color: '#667984', w: 2.4, h: 2.6, d: 2.4, damage: 16, vision: 18 },
  raie: { name: 'Raie de verre', category: 'flying', temperament: 'calme', locomotion: 'fly', habitat: 'Monde inversé', behavior: 'Plane entre les îles. Le sens de la chute ne la concerne pas.', hp: 18, color: '#9fd8ff', w: 2.2, h: 0.25, d: 1.4, damage: 0 },
  meduse: { name: 'Méduse prisme', category: 'aquatic', temperament: 'calme', locomotion: 'swim', habitat: 'Mer suspendue', behavior: 'Hors de l’eau, elle s’effondre. Elle ne marche pas.', hp: 16, color: '#79f0e4', w: 0.9, h: 1.3, d: 0.9, damage: 0 },
  cristal: { name: 'Cristallin piquant', category: 'crystal', temperament: 'territorial', locomotion: 'wall', habitat: 'Mur des Murmurants', behavior: 'Ne circule que sur le mur. Au contact, il pique.', hp: 32, color: '#d7b6ff', w: 0.8, h: 1.4, d: 0.8, damage: 12 },
  faille: { name: 'Entité de faille', category: 'energy', temperament: 'hostile', locomotion: 'fly', habitat: 'Instabilité', behavior: 'Se nourrit des lois tordues. Une lumière franche la déchire.', hp: 40, color: '#ffd56a', w: 1, h: 1, d: 1, damage: 12 },
  sera: { name: 'Sera', category: 'intelligent', temperament: 'calme', locomotion: 'npc', habitat: 'Cité murale', behavior: 'Porte la voix des Murmurants. Elle distingue l’aide et le drainage.', hp: 30, color: '#f3c7a4', w: 0.7, h: 1.75, d: 0.4, damage: 0 },
  ivo: { name: 'Ivo', category: 'intelligent', temperament: 'calme', locomotion: 'npc', habitat: 'La Boucle', behavior: 'Répète la même heure tant que la cloche du sud n’est pas atteinte.', hp: 20, color: '#f4f4f4', w: 0.7, h: 1.7, d: 0.4, damage: 0 },
  drone: { name: 'Drone de mur', category: 'machine', temperament: 'hostile', locomotion: 'fly', habitat: 'Cité exploitée', behavior: 'Envoyé contre qui draine la cité. Une impulsion d’énergie l’arrête.', hp: 30, color: '#ff7d64', w: 0.9, h: 0.5, d: 0.9, damage: 10 },
  leviathan: { name: 'Léviathan de verre', category: 'giant', temperament: 'territorial', locomotion: 'swim', habitat: 'Abysse suspendu', behavior: 'Patrouille la colonne d’eau. Les coraux cassent son attention. La pression exige une combinaison.', hp: 90, color: '#6ec8ff', w: 3.2, h: 1.4, d: 6, damage: 20, vision: 15 },
  deformer: { name: 'Déformateur', category: 'energy', temperament: 'hostile', locomotion: 'fly', habitat: 'Zones instables', behavior: 'Impose une chute étrangère. Une ancre personnelle tient autour de toi.', hp: 52, color: '#ff5bd2', w: 1.3, h: 1.8, d: 1.3, damage: 14 },
  guardian: { name: 'Gardien de loi', category: 'energy', temperament: 'territorial', locomotion: 'fly', habitat: 'Stabilité basse', behavior: 'Naît quand un univers est trop réécrit. Il se retire si la stabilité remonte.', hp: 60, color: '#ffe6a8', w: 1.2, h: 2.2, d: 1.2, damage: 15, vision: 18 },
  echo: { name: 'Kael-écho', category: 'intelligent', temperament: 'calme', locomotion: 'npc', habitat: 'Monde copié', behavior: 'Copie presque fidèle. Il affirme que les racines poussent vers le haut.', hp: 20, color: '#b7d6ff', w: 0.7, h: 1.7, d: 0.4, damage: 0 },
  ruin: { name: 'Trace de veilleur', category: 'intelligent', temperament: 'calme', locomotion: 'npc', habitat: 'Village ruiné', behavior: 'Il ne reste qu’une phrase gravée après l’exploitation.', hp: 1, color: '#6a6258', w: 0.4, h: 1.2, d: 0.3, damage: 0 },
};

export const BUILDINGS = {
  abri: { name: 'Abri', cost: { os: 4 }, size: [3.4, 2.5, 3.2], color: '#cbb892', blurb: 'Soigne quiconque reste près de lui.' },
  extracteur: { name: 'Extracteur', cost: { os: 3, seve: 2 }, size: [2.2, 2.8, 2.2], color: '#8d6b3c', blurb: 'Produit la ressource du lieu tant qu’un générateur l’alimente.', power: true },
  generateur: { name: 'Générateur', cost: { cristal: 6, os: 4 }, size: [2.6, 2.3, 2.6], color: '#2f5966', blurb: 'Un éclat le fait tourner trois minutes. Il alimente les machines proches.' },
  portail: { name: 'Portail', cost: { cristal: 8, eclat: 2 }, size: [3.2, 3.6, 1], color: '#243248', blurb: 'Ouvre un passage vers un univers déjà connu. Exige la loi Espace.', need: 'space' },
  jardin: { name: 'Jardin', cost: { seve: 6 }, size: [3.6, 1.1, 3.6], color: '#3f6e46', blurb: 'Pousse la vie. Dans un jardin créé, les plantes gagnent du terrain.' },
  atelier: { name: 'Atelier', cost: { os: 6, cristal: 4 }, size: [3.5, 2.7, 3], color: '#6d5646', blurb: 'Fabrique les outils de récolte, de stabilité et de pression.' },
  laboratoire: { name: 'Laboratoire', cost: { cristal: 6, os: 4 }, size: [3.8, 2.9, 3.3], color: '#4c608a', blurb: 'Réduit d’un quart le coût des recherches.' },
  recherche: { name: 'Centre de recherche', cost: { ecaille: 4, seve: 4, eclat: 1 }, size: [4, 3.1, 3.5], color: '#6c4e7a', blurb: 'Révèle le comportement des espèces. Nécessaire à la loi Temps.', power: true },
};

export const CRAFTS = [
  { id: 'gauntlet', name: 'Gantelet de récolte', cost: { os: 3, seve: 3 }, text: 'Chaque gisement donne une unité de plus.' },
  { id: 'beacon', name: 'Balise de stabilité', cost: { cristal: 4, eclat: 1 }, text: 'Les ancres durent plus longtemps et la stabilité revient plus vite.' },
  { id: 'suit', name: 'Combinaison de pression', cost: { ecaille: 5, cristal: 3 }, text: 'Permet de rester dans l’abysse suspendu.' },
];

export const RESEARCH = [
  { law: 'light', name: 'Lumière', cost: { seve: 6, eclat: 2 }, need: (s) => s.flags.visited.giants, why: 'Après le Monde des Géants', text: 'Pose une lueur : les échos deviennent visibles, les entités d’énergie brûlent.' },
  { law: 'matter', name: 'Matière', cost: { cristal: 4, os: 4 }, need: (s) => s.flags.visited.inverted, why: 'Après le Monde inversé', text: 'Change un gisement en son matériau jumeau : os et sève, cristal et écaille.' },
  { law: 'life', name: 'Vie', cost: (s) => ({ seve: s.flags.village === 'saved' || s.flags.seed ? 6 : 14, eclat: 1 }), need: (s) => s.flags.visited.giants, why: 'Le village sauvé allège le coût', text: 'Fait pousser et apaise les territoriaux quelques instants.' },
  { law: 'energy', name: 'Énergie', cost: { cristal: 6, eclat: 2 }, need: (s) => s.flags.visited.inverted, why: 'Après le Monde inversé', text: 'Fige les machines et relance un générateur proche.' },
  { law: 'space', name: 'Espace', cost: { cristal: 6, eclat: 2 }, need: (s) => s.flags.city === 'stabilized' || s.flags.city === 'exploited', why: 'Après le choix des Murmurants', text: 'Un pas plus loin que le corps, et les portails construits s’ouvrent.' },
  { law: 'time', name: 'Temps', cost: { eclat: 4, ecaille: 4 }, need: (s, hasLab) => s.flags.fragments.giants && s.flags.fragments.inverted && hasLab, why: 'Deux fragments et un centre de recherche alimenté', text: 'Retient brièvement tout ce qui n’est pas toi.' },
];

export const UNIVERSE_INFO = [
  { id: 'zero', name: 'Point Zéro', open: true, line: 'Le vide où tu t’es réveillé. Les portails anciens y tiennent.' },
  { id: 'giants', name: 'A — Monde des Géants', open: true, line: 'Tout est trop grand. Avancer, c’est choisir d’être vu.' },
  { id: 'ocean', name: 'B — Océan infini', open: false, line: 'La Rupture noie encore le passage. Cette réalité n’est pas amarrée.' },
  { id: 'inverted', name: 'C — Monde inversé', open: true, line: 'La chute change de visage. Les cités tiennent aux murs.' },
  { id: 'eternal', name: 'D — Civilisation éternelle', open: false, line: 'Une société close, encore hors de portée.' },
  { id: 'dream', name: 'E — Royaume des rêves', open: false, line: 'Les pensées y deviennent des lieux. Le lien est rompu.' },
  { id: 'timeless', name: 'F — Monde sans temps', open: false, line: 'Rien n’y arrive tant que le temps n’y est pas rapporté.' },
  { id: 'voidgarden', name: 'G — Jardin du néant', open: false, line: 'Presque aucune matière. L’atelier de création en est l’esquisse, pas le monde.' },
  { id: 'shattered', name: 'H — Infini brisé', open: false, line: 'Fragments incompatibles. Les stabiliser demandera d’autres lois.' },
  { id: 'arena', name: 'Noyau de l’Architecte', open: true, line: 'S’ouvre avec deux fragments. Les lois y sont des armes.' },
];

export const ENDINGS = {
  balance: {
    title: 'Fin de l’équilibre',
    text: 'Tu rends aux réalités leurs lois propres. La Rupture se referme comme une couture, non comme une cage. Les géants restent immenses. La cité reste verticale. Rien n’est unifié : tout peut de nouveau diverger.',
  },
  creation: {
    title: 'Fin de la création',
    text: 'Tu dépenses les fragments pour semer d’autres jardins. Le multivers ne redevient pas celui d’avant : il devient une pépinière. Ce que tu as déjà fait pousser en décide le visage.',
  },
  independence: {
    title: 'Fin de l’indépendance',
    text: 'Tu brises le noyau qui permettait à une seule volonté d’écrire pour toutes les réalités. Plus personne, pas même toi, ne tiendra le volant du tout. Les univers continueront, maladroits et libres.',
  },
  architect: {
    title: 'Fin de l’Architecte',
    text: 'Tu poses la main sur la structure. Une seule grammaire pour toutes les réalités : la tienne. L’ancienne version de toi sourit, parce que c’est ainsi qu’elle avait commencé.',
  },
  secret: {
    title: 'Fin secrète — la divergence',
    text: 'L’Origine n’a pas créé le multivers pour qu’il soit tenu. Les copies infidèles, le silence, les villages laissés vivants et le trou blanc que tu n’as pas pillé disent la même chose : les lois sont un langage, pas un propriétaire. Tu refermes le noyau sans le prendre, et tu laisses les réalités apprendre à s’écrire seules.',
  },
};

export function levelInfo(xp) {
  const steps = [0, 50, 120, 210, 320, 460, 640];
  let level = 1;
  for (let i = 1; i < steps.length; i++) if (xp >= steps[i]) level = i + 1;
  const prev = steps[level - 1] || 0;
  const next = steps[level] ?? null;
  return { level, next, prev, into: xp - prev, span: next ? next - prev : 1 };
}
