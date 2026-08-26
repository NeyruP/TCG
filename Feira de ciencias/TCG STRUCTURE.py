import random

class CartaTCG:
    def __init__(self, nome, tipo, ataque, defesa, custo, habilidade, energia, terreno, elemento, item=None):
        self.nome = nome
        self.tipo = tipo
        self.ataque = ataque
        self.defesa = defesa
        self.custo = custo
        self.habilidade = habilidade
        self.energia = energia
        self.terreno = terreno
        self.elemento = elemento
        self.item = item

    @staticmethod
    def criar_terreno(nome, energia, elemento="Roxo"):
        return CartaTCG(
            nome=nome,
            tipo="Terreno",
            ataque=0,
            defesa=0,
            custo=0,
            habilidade="Fornece energia roxa",
            energia=energia,
            terreno="Base Futurista",
            elemento=elemento,
            item=None
        )

# Criando 10 terrenos com a função
terrenos = [CartaTCG.criar_terreno(f"Fábrica Roxa {i+1}", energia=2) for i in range(10)]

# Líder
lider = CartaTCG("Rogen", "Líder", 12, 12, 0, "Controla todos os robôs roxos", 5, None, "Roxo")

# Co-líderes
coliders = [
    CartaTCG("Sentinela Roxo", "Co-líder", 8, 10, 3, "Defende aliados robóticos", 4, None, "Roxo"),
    CartaTCG("Tecno-Mago Roxo", "Co-líder", 7, 7, 4, "Lança feitiços digitais", 5, None, "Roxo"),
    CartaTCG("Gladiador Mecânico Roxo", "Co-líder", 10, 6, 2, "Ataque extra contra líderes", 3, None, "Roxo"),
    CartaTCG("Oráculo Cibernético Roxo", "Co-líder", 6, 9, 3, "Prevê jogadas inimigas", 4, None, "Roxo")
]

# Deck inicial
deck = [lider] + coliders + terrenos

# Restante até 64 cartas (criaturas robóticas, feitiços digitais, itens tecnológicos)
tipos = ["Criatura Robótica", "Feitiço Digital", "Item Tecnológico"]
habilidades = ["Sobrecarga", "Hack Invasivo", "Escudo de Plasma", "Ataque Aéreo", "Reparo Automático"]

while len(deck) < 64:
    tipo = random.choice(tipos)
    nome = f"{tipo} Roxo {len(deck)+1}"
    ataque = random.randint(1, 10) if "Criatura" in tipo else 0
    defesa = random.randint(1, 10) if "Criatura" in tipo else 0
    custo = random.randint(1, 5)
    habilidade = random.choice(habilidades)
    energia = random.randint(1, 5)
    deck.append(CartaTCG(nome, tipo, ataque, defesa, custo, habilidade, energia, None, "Roxo"))

print(f"Deck criado com {len(deck)} cartas!")
