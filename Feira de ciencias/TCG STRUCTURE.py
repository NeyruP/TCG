class TCGCard:
    def __init__(self, name, card_type, attack, defense, cost, ability,
                 card_class="Mágico", attack_style=None, energy_generated=0):
        self.name = name
        self.card_type = card_type
        self.attack = attack
        self.defense = defense
        self.cost = cost
        self.ability = ability
        self.card_class = card_class
        self.attack_style = attack_style
        self.energy_generated = energy_generated

    def __str__(self):
        info = f"{self.name} | Tipo: {self.card_type} | Classe: {self.card_class}\n"
        info += f"ATK: {self.attack} | DEF: {self.defense} | Custo: {self.cost}"

        if self.energy_generated > 0:
            info += f" | Gera: {self.energy_generated} energia"

        info += f"\nEstilo: {self.attack_style} | Habilidade: {self.ability}\n"
        return info


# ====================== LÍDER ======================

rogen = TCGCard(
    name="Rogen",
    card_type="Líder",
    attack=5000,
    defense=5000,
    cost=0,
    ability="Quando o lider for atacar vc pode olhar as 5 primeiras cartas do seu baralho e colocar uma a sua mão 'o lider precisa estar com 3 energias'",
    attack_style="Especial"
)


# ====================== ITEM ======================

tome = TCGCard(
    name="Tomo da Sabedoria",
    card_type="Item",
    attack=0,
    defense=0,
    cost=0,
    ability="Adiciona a classe magico a uma carta a escolha"
)


# ====================== EFEITOS ORIGINAIS (4 DE CADA) ======================

annul = TCGCard(
    name="Anular",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Quando vc prever uma carta de efeito do baralho adversario vc pode jogar ela no lixo"
)

assembly = TCGCard(
    name="Assembleia",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="'counter' quando for atacado pode usar o efeito dessa carta para ganhar +3000 de defesa 'apenas no turno do ataque'"
)

graduation = TCGCard(
    name="Graduação",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Escolha uma carta em campo. Ela ganha +2000 de dano"
)

channel = TCGCard(
    name="Canalizar",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Aumenta o dano em +6000 porem o personagem deve ser colocado na pilha de descarte"
)


# ====================== ESPECIAIS ORIGINAIS (2 DE CADA) ======================

rodote = TCGCard(
    name="Rodote",
    card_type="Especial",
    attack=4000,
    defense=5000,
    cost=4,
    ability="Permite com que vc preveja as proximas 3 primeiras cartas do baralho inimigo",
    attack_style="Especial"
)

mabo = TCGCard(
    name="Mabo",
    card_type="Especial",
    attack=7000,
    defense=3000,
    cost=8,
    ability="Quando em campo anula todos os efeitos de cartas direcionado ao lider",
    attack_style="Especial"
)

drogoon = TCGCard(
    name="Drogoon",
    card_type="Especial",
    attack=1000,
    defense=9000,
    cost=5,
    ability="Nenhuma",
    attack_style="Fisico"
)

bomia = TCGCard(
    name="Bomia",
    card_type="Especial",
    attack=2000,
    defense=2000,
    cost=6,
    ability="Quando vc compra uma carta com ele em campo você pode transformala em uma carta de vida",
    attack_style="Especial"
)


# ====================== ENERGIAS (10 NO TOTAL) ======================

energies = [
    TCGCard(
        name="Cristal de Mana",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Cristal de Mana",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Cristal de Mana",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Fonte Arcana",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 2 energias",
        energy_generated=2
    ),

    TCGCard(
        name="Fonte Arcana",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 2 energias",
        energy_generated=2
    ),

    TCGCard(
        name="Orbe do Conhecimento",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Relíquia Arcana",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Poço de Sabedoria",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Runa Antiga",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 1 energia",
        energy_generated=1
    ),

    TCGCard(
        name="Estrela Cadente",
        card_type="Energia",
        attack=0,
        defense=0,
        cost=0,
        ability="Gera 3 energias (vai pro descarte depois de usar)",
        energy_generated=3
    ),
]


# ====================== NOVAS CARTAS (28) ======================

# Novos Efeitos (2 de cada)

arcane_echo = TCGCard(
    name="Eco Arcano",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Quando uma carta sua for pro descarte vc pode comprar 1 carta"
)

seal_of_knowledge = TCGCard(
    name="Selo do Saber",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Escolha uma carta do oponente em campo e vire ela pra baixo ate o proximo turno"
)

inversion = TCGCard(
    name="Inversão",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Troque o poder e a defesa de uma carta em campo ate o final do turno"
)

mental_barrier = TCGCard(
    name="Barreira Mental",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=0,
    ability="Counter: Negue o efeito de uma carta de efeito do oponente"
)


# Novos Especiais (2 de cada)

lyra = TCGCard(
    name="Lyra",
    card_type="Especial",
    attack=3500,
    defense=4000,
    cost=3,
    ability="Quando entra em campo vc pode olhar as 2 primeiras cartas do seu baralho",
    attack_style="Especial"
)

kairo = TCGCard(
    name="Kairo",
    card_type="Especial",
    attack=5500,
    defense=2500,
    cost=5,
    ability="Quando ataca pode pagar 1 energia para atacar novamente",
    attack_style="Especial"
)

selene = TCGCard(
    name="Selene",
    card_type="Especial",
    attack=2000,
    defense=6000,
    cost=4,
    ability="Enquanto estiver em campo todas as suas cartas ganham +1000 de defesa",
    attack_style="Especial"
)

vortex = TCGCard(
    name="Vortex",
    card_type="Especial",
    attack=4500,
    defense=3000,
    cost=6,
    ability="Quando entra em campo destroi uma carta de energia do oponente",
    attack_style="Especial"
)


# Comuns (2 de cada)

apprentice = TCGCard(
    name="Aprendiz Arcano",
    card_type="Comum",
    attack=2500,
    defense=1500,
    cost=2,
    ability="Nenhuma",
    attack_style="Especial"
)

guardian = TCGCard(
    name="Guardião da Biblioteca",
    card_type="Comum",
    attack=1500,
    defense=3500,
    cost=3,
    ability="Nenhuma",
    attack_style="Fisico"
)

novice_mage = TCGCard(
    name="Mago Novato",
    card_type="Comum",
    attack=3000,
    defense=2000,
    cost=2,
    ability="Nenhuma",
    attack_style="Especial"
)

mystic_scribe = TCGCard(
    name="Escriba Místico",
    card_type="Comum",
    attack=2000,
    defense=2500,
    cost=2,
    ability="Quando entra em campo vc pode comprar 1 carta",
    attack_style="Especial"
)

runist = TCGCard(
    name="Runista",
    card_type="Comum",
    attack=2800,
    defense=1800,
    cost=3,
    ability="Nenhuma",
    attack_style="Especial"
)

lesser_oracle = TCGCard(
    name="Oráculo Menor",
    card_type="Comum",
    attack=1000,
    defense=3000,
    cost=2,
    ability="Quando entra em campo vc pode prever a proxima carta do seu baralho",
    attack_style="Especial"
)

    
# ====================== FULL DECK (64) ======================

deck = (
    [rogen] +
    [tome] +

    [annul] * 4 +
    [assembly] * 4 +
    [graduation] * 4 +
    [channel] * 4 +

    [rodote] * 2 +
    [mabo] * 2 +
    [drogoon] * 2 +
    [bomia] * 2 +

    energies +

    [arcane_echo] * 2 +
    [seal_of_knowledge] * 2 +
    [inversion] * 2 +
    [mental_barrier] * 2 +

    [lyra] * 2 +
    [kairo] * 2 +
    [selene] * 2 +
    [vortex] * 2 +

    [apprentice] * 2 +
    [guardian] * 2 +
    [novice_mage] * 2 +
    [mystic_scribe] * 2 +
    [runist] * 2 +
    [lesser_oracle] * 2
)


print(f"Deck criado com {len(deck)} cartas!\n")

from collections import Counter

print("Distribuição por tipo:")

for card_type, quantity in sorted(
    Counter(card.card_type for card in deck).items()
):
    print(f"  {card_type}: {quantity}")
