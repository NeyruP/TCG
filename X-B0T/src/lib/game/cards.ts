import type { CardDef, CardInstance, Faction, TargetNeed } from "./types";

// Cartas e efeitos seguem o README do repositório TCG (Deck Roxo: Mágico e
// Deck Amarelo: Especialista). As cartas de Energia foram removidas: a energia
// agora vem do ganho passivo de cada turno.

let seq = 1;
export function nextId(): string {
  seq += 1;
  return `c${seq.toString(36)}`;
}

export function resetIds() {
  seq = 1;
}

type Spec = Pick<CardDef, "defId" | "name" | "cardType" | "ability" | "cardClass" | "faction"> &
  Partial<CardDef>;

function card(spec: Spec): CardDef {
  return {
    attack: 0,
    defense: 0,
    cost: 0,
    counter: 0,
    attackStyle: null,
    life: 0,
    speed: "Sorcery",
    keywords: [],
    image: `cards/${spec.defId}.jpg`,
    ...spec,
  };
}

export const CARD_DEFS: Record<string, CardDef> = {
  // ---------------------------------------------------------------
  // DECK ROXO — MÁGICO
  // ---------------------------------------------------------------
  rogen: card({
    defId: "rogen",
    name: "Rogen",
    cardType: "Líder",
    attack: 5000,
    defense: 5000,
    life: 5,
    cardClass: "Mágico",
    attackStyle: "Especial",
    ability:
      "Ao declarar um ataque tendo pelo menos 3 energias, olhe as 5 cartas do topo do seu baralho: adicione 1 à mão e coloque as outras no fundo do baralho.",
    faction: "magic",
  }),
  biblioteca: card({
    defId: "biblioteca",
    name: "A Grande Biblioteca",
    cardType: "Terreno",
    cardClass: "Mágico",
    ability: "Contínuo: todas as suas cartas da classe Mágico em campo ganham +1000 de ataque.",
    faction: "magic",
  }),
  tomo: card({
    defId: "tomo",
    name: "Tomo da Sabedoria",
    cardType: "Item",
    cardClass: "Mágico",
    ability: "Escolha um aliado em campo: ele passa a ter também a classe Mágico.",
    faction: "magic",
  }),
  anular: card({
    defId: "anular",
    name: "Anular",
    cardType: "Efeito",
    cost: 4,
    speed: "Instant",
    cardClass: "Mágico",
    ability:
      "Olhe as 3 cartas do topo do baralho inimigo. Se houver uma carta de Efeito, envie-a direto para a pilha de descarte.",
    faction: "magic",
  }),
  assembleia: card({
    defId: "assembleia",
    name: "Assembleia",
    cardType: "Efeito",
    cost: 2,
    speed: "Counter",
    cardClass: "Mágico",
    ability:
      "Counter: quando um aliado for alvo de um ataque, use da mão para dar +3000 de defesa a ele até o fim do combate.",
    faction: "magic",
  }),
  graduacao: card({
    defId: "graduacao",
    name: "Graduação",
    cardType: "Efeito",
    cost: 2,
    cardClass: "Mágico",
    ability: "Equipamento: anexe a um Estudante de Magia. Ele ganha +2000 de ataque.",
    faction: "magic",
  }),
  canalizar: card({
    defId: "canalizar",
    name: "Canalizar",
    cardType: "Efeito",
    cost: 6,
    speed: "Instant",
    cardClass: "Mágico",
    ability:
      "O aliado alvo ganha +6000 de ataque neste turno. No fim do turno, ele vai para a pilha de descarte.",
    faction: "magic",
  }),
  rodote: card({
    defId: "rodote",
    name: "Rodote",
    cardType: "Especial",
    attack: 4000,
    defense: 5000,
    cost: 3,
    cardClass: "Mágico",
    attackStyle: "Especial",
    ability: "Ao entrar em campo, você vê as 3 cartas do topo do baralho do oponente.",
    faction: "magic",
  }),
  mabo: card({
    defId: "mabo",
    name: "Mabo",
    cardType: "Especial",
    attack: 7000,
    defense: 3000,
    cost: 8,
    cardClass: "Mágico",
    attackStyle: "Especial",
    ability:
      "Contínuo: enquanto Mabo estiver em campo, o seu líder fica imune a todos os efeitos de cartas do adversário.",
    faction: "magic",
  }),
  drogoon: card({
    defId: "drogoon",
    name: "Drogoon",
    cardType: "Especial",
    attack: 6000,
    defense: 6000,
    cost: 6,
    cardClass: "Mágico",
    attackStyle: "Físico",
    keywords: ["Defender"],
    ability: "Defensor: o inimigo precisa derrotá-lo antes de atacar suas outras cartas ou o seu líder.",
    faction: "magic",
  }),
  bomia: card({
    defId: "bomia",
    name: "Bomia",
    cardType: "Especial",
    attack: 2000,
    defense: 2000,
    cost: 4,
    cardClass: "Mágico",
    attackStyle: "Especial",
    ability:
      "Sempre que você comprar uma carta com Bomia em campo, pode colocá-la virada na Zona de Vida (+1 vida) em vez da mão.",
    faction: "magic",
  }),
  estudante: card({
    defId: "estudante",
    name: "Estudante de Magia",
    cardType: "Comum",
    attack: 3000,
    defense: 2000,
    cost: 2,
    counter: 1000,
    cardClass: "Mágico",
    attackStyle: "Especial",
    ability:
      "Habilidade (1x por turno): pague 2 energias para buscar 1 Tomo da Sabedoria no baralho e colocá-lo na mão.",
    faction: "magic",
  }),
  helbo: card({
    defId: "helbo",
    name: "Helbo",
    cardType: "Comum",
    attack: 2000,
    defense: 3000,
    cost: 2,
    counter: 1000,
    cardClass: "Especialista",
    attackStyle: "Físico",
    keywords: ["Defender"],
    ability: "Defensor. Ao entrar em campo, recupera 1 energia.",
    faction: "magic",
  }),
  marbo: card({
    defId: "marbo",
    name: "Marbo",
    cardType: "Comum",
    attack: 4000,
    defense: 2000,
    cost: 3,
    counter: 1000,
    cardClass: "Lutador",
    attackStyle: "Físico",
    keywords: ["Haste"],
    ability: "Apressado: pode atacar no mesmo turno em que entra em campo.",
    faction: "magic",
  }),
  professor: card({
    defId: "professor",
    name: "Professor de Magia",
    cardType: "Comum",
    attack: 3000,
    defense: 3000,
    cost: 3,
    counter: 2000,
    cardClass: "Mágico",
    attackStyle: "Especial",
    ability: "Unidade base sem efeitos adicionais.",
    faction: "magic",
  }),

  // ---------------------------------------------------------------
  // DECK AMARELO — ESPECIALISTA
  // ---------------------------------------------------------------
  bobo: card({
    defId: "bobo",
    name: "Bobo",
    cardType: "Líder",
    attack: 5000,
    life: 2,
    cardClass: "Especialista",
    attackStyle: "Projétil",
    ability:
      "Passivo: você joga cartas de custo 4 ou menos sem pagar energia. Cartas de custo 5 ou mais custam metade (arredondado para cima).",
    faction: "machine",
  }),
  oficina: card({
    defId: "oficina",
    name: "Oficina",
    cardType: "Terreno",
    cardClass: "Especialista",
    ability: "Contínuo: todas as suas cartas aliadas em campo ganham +1000 de defesa (vida máxima).",
    faction: "machine",
  }),
  chave: card({
    defId: "chave",
    name: "Chave Inglesa",
    cardType: "Item",
    cardClass: "Especialista",
    ability: "Equipe um aliado em campo: ele ganha +1000 de defesa (vida).",
    faction: "machine",
  }),
  overclock: card({
    defId: "overclock",
    name: "Overclock",
    cardType: "Efeito",
    cost: 3,
    speed: "Instant",
    cardClass: "Especialista",
    ability: "Todas as suas cartas em campo (e o líder) ganham +2000 de ataque até o fim do turno.",
    faction: "machine",
  }),
  restaurar: card({
    defId: "restaurar",
    name: "Restaurar",
    cardType: "Efeito",
    cost: 5,
    speed: "Instant",
    cardClass: "Especialista",
    ability: "Recupera até 3000 de defesa (vida) de cada carta aliada danificada em campo.",
    faction: "machine",
  }),
  firewall: card({
    defId: "firewall",
    name: "Firewall",
    cardType: "Efeito",
    cost: 3,
    speed: "Counter",
    cardClass: "Especialista",
    ability:
      "Counter: quando um aliado for alvo de um ataque, ele ganha +3000 de ataque e defesa durante o combate.",
    faction: "machine",
  }),
  reiniciar: card({
    defId: "reiniciar",
    name: "Reiniciar",
    cardType: "Efeito",
    cost: 7,
    cardClass: "Especialista",
    ability:
      "Restaura totalmente a defesa (vida) de um aliado e concede a ele +2000 de ataque permanente.",
    faction: "machine",
  }),
  engibot: card({
    defId: "engibot",
    name: "Engibot",
    cardType: "Especial",
    attack: 4000,
    defense: 3000,
    cost: 4,
    cardClass: "Especialista",
    attackStyle: "Físico",
    ability: "Habilidade (1x por turno): cria 1 ficha de Torreta no campo com 1000 de ataque e 3000 de defesa.",
    faction: "machine",
  }),
  servidor: card({
    defId: "servidor",
    name: "Servidor",
    cardType: "Especial",
    attack: 1000,
    defense: 7000,
    cost: 7,
    cardClass: "Especialista",
    attackStyle: "Físico",
    keywords: ["Defender"],
    ability:
      "Defensor. Contínuo: suas cartas com o mesmo nome em campo ganham +1000 de ataque por cada cópia adicional.",
    faction: "machine",
  }),
  hackbot: card({
    defId: "hackbot",
    name: "H4kB0T",
    cardType: "Especial",
    attack: 5000,
    defense: 4000,
    cost: 6,
    cardClass: "Especialista",
    attackStyle: "Projétil",
    ability: "Habilidade (1x por turno): troca os valores base de ataque e defesa de uma unidade alvo no campo.",
    faction: "machine",
  }),
  mecha: card({
    defId: "mecha",
    name: "Mecha",
    cardType: "Especial",
    attack: 8000,
    defense: 7000,
    cost: 8,
    cardClass: "Especialista",
    attackStyle: "Físico",
    ability: "Temporizado: é destruído e vai para o descarte automaticamente no fim do seu 3º turno em campo.",
    faction: "machine",
  }),
  gatorreta: card({
    defId: "gatorreta",
    name: "Gatorreta",
    cardType: "Comum",
    attack: 1000,
    defense: 3000,
    cost: 2,
    counter: 1000,
    cardClass: "Especialista",
    attackStyle: "Projétil",
    keywords: ["Defender"],
    ability: "Defensor. Enquanto estiver em campo, recupera 1 energia no início de cada turno seu.",
    faction: "machine",
  }),
  rorai: card({
    defId: "rorai",
    name: "Rorai",
    cardType: "Comum",
    attack: 4000,
    defense: 2000,
    cost: 3,
    counter: 1000,
    cardClass: "Espadachim",
    attackStyle: "Corte",
    keywords: ["Haste", "DoubleAttack"],
    ability: "Apressado. Ao atacar, realiza 2 ataques consecutivos no mesmo turno.",
    faction: "machine",
  }),
  lectrabo: card({
    defId: "lectrabo",
    name: "Lectrabo",
    cardType: "Comum",
    attack: 3000,
    defense: 2000,
    cost: 2,
    counter: 1000,
    cardClass: "Especialista",
    attackStyle: "Especial",
    ability: "Enquanto estiver em campo, recupera 2 energias no início de cada turno seu.",
    faction: "machine",
  }),
  tetabot: card({
    defId: "tetabot",
    name: "Tetabot",
    cardType: "Comum",
    attack: 4000,
    defense: 1000,
    cost: 3,
    counter: 2000,
    cardClass: "Especialista",
    attackStyle: "Físico",
    ability: "Unidade base sem efeitos adicionais.",
    faction: "machine",
  }),
  torreta: card({
    defId: "torreta",
    name: "Torreta",
    cardType: "Ficha",
    attack: 1000,
    defense: 3000,
    cardClass: "Especialista",
    attackStyle: "Projétil",
    image: "",
    ability: "Ficha criada pelo Engibot. Se sair do campo, desaparece.",
    faction: "machine",
  }),
};

export function instantiate(defId: string, owner: 0 | 1): CardInstance {
  const def = CARD_DEFS[defId];
  if (!def) throw new Error(`Unknown card ${defId}`);
  return {
    ...def,
    keywords: [...def.keywords],
    id: nextId(),
    owner,
    jaAtacou: false,
    attacksUsed: 0,
    summonedThisTurn: false,
    buffAtaque: 0,
    buffDefesa: 0,
    tempAtk: 0,
    damage: 0,
    countdown: 0,
    sacrificeEnd: false,
    usedActivated: false,
  };
}

const MAGIC_LIST: Array<[string, number]> = [
  ["tomo", 1],
  ["biblioteca", 1],
  ["anular", 4],
  ["assembleia", 4],
  ["graduacao", 4],
  ["canalizar", 3],
  ["rodote", 2],
  ["mabo", 2],
  ["drogoon", 2],
  ["bomia", 2],
  ["estudante", 4],
  ["helbo", 3],
  ["marbo", 4],
  ["professor", 4],
];

const MACHINE_LIST: Array<[string, number]> = [
  ["oficina", 1],
  ["chave", 2],
  ["firewall", 4],
  ["overclock", 3],
  ["restaurar", 3],
  ["reiniciar", 3],
  ["engibot", 2],
  ["servidor", 2],
  ["hackbot", 2],
  ["mecha", 2],
  ["gatorreta", 4],
  ["rorai", 4],
  ["lectrabo", 3],
  ["tetabot", 5],
];

export function buildDeck(faction: Faction, owner: 0 | 1): CardInstance[] {
  const list = faction === "magic" ? MAGIC_LIST : MACHINE_LIST;
  const deck: CardInstance[] = [];
  for (const [id, n] of list) {
    for (let i = 0; i < n; i++) deck.push(instantiate(id, owner));
  }
  return deck;
}

export function leaderFor(faction: Faction, owner: 0 | 1): CardInstance {
  return instantiate(faction === "magic" ? "rogen" : "bobo", owner);
}

export const FACTION_META: Record<
  Faction,
  { title: string; school: string; leader: string; leaderId: string; blurb: string }
> = {
  magic: {
    title: "Escola Arcana",
    school: "Mágico",
    leader: "Rogen",
    leaderId: "rogen",
    blurb: "Feitiços, o Tomo e a Grande Biblioteca. Rogen tem 5 vidas e busca cartas ao atacar.",
  },
  machine: {
    title: "Oficina Especialista",
    school: "Especialista",
    leader: "Bobo",
    leaderId: "bobo",
    blurb: "Robôs, torretas e o Servidor. Bobo joga cartas de graça, mas só tem 2 vidas: proteja-o com Defensores.",
  },
};

export function targetNeedFor(card: CardInstance): TargetNeed {
  switch (card.defId) {
    case "tomo":
    case "chave":
    case "canalizar":
    case "reiniciar":
      return "ally-unit";
    case "graduacao":
      return "estudante";
    default:
      return "none";
  }
}

/** Unidades com habilidade ativável (botão "Habilidade"). */
export function hasActivated(card: CardInstance): boolean {
  return card.defId === "estudante" || card.defId === "engibot" || card.defId === "hackbot";
}

export function abilityTargetNeed(card: CardInstance): TargetNeed {
  return card.defId === "hackbot" ? "any-unit" : "none";
}
