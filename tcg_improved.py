import random
import copy
from collections import Counter


class TCGCard:
    def __init__(self, name, card_type, attack, defense, cost, ability,
                 card_class="Mágico", attack_style=None, energy_generated=0, life=5):
        self.name = name
        self.card_type = card_type
        self.attack = attack
        self.defense = defense
        self.cost = cost
        self.ability = ability
        self.card_class = card_class
        self.attack_style = attack_style
        self.energy_generated = energy_generated
        self.life = life
        self.ja_atacou = False
        self.buff_ataque = 0
        self.buff_defesa = 0

    def atk_total(self):
        return self.attack + self.buff_ataque

    def def_total(self):
        return self.defense + self.buff_defesa

    def __str__(self):
        info = f"{self.name} | Tipo: {self.card_type} | Classe: {self.card_class}\n"
        info += f"ATK: {self.atk_total()} | DEF: {self.def_total()} | Custo: {self.cost}"
        if self.energy_generated > 0:
            info += f" | Gera: {self.energy_generated} energia"
        if self.card_type == "Líder":
            info += f" | Life: {self.life}"
        info += f"\nEstilo: {self.attack_style} | Habilidade: {self.ability}\n"
        return info


# ====================== LÍDER ======================
rogen = TCGCard(
    name="Rogen",
    card_type="Líder",
    attack=5000,
    defense=5000,
    cost=0,
    ability="Quando o líder for atacar você pode olhar as 5 primeiras cartas do seu baralho e colocar uma na sua mão (precisa de 3 energias)",
    attack_style="Especial",
    card_class="Mágico",
    life=5
)

# ====================== TERRENO ======================
biblioteca = TCGCard(
    name="A Grande Biblioteca",
    card_type="Terreno",
    attack=0,
    defense=0,
    cost=0,
    ability="Quando colocado em campo, aumenta em +1000 o dano de ataque de cartas do tipo Mágico",
    card_class="Mágico"
)

# ====================== ITENS ======================
tome = TCGCard(
    name="Tomo da Sabedoria",
    card_type="Item",
    attack=0,
    defense=0,
    cost=0,
    ability="Adiciona a classe Mágico a uma carta à escolha",
    card_class="Mágico"
)

# ====================== EFEITOS ======================
annul = TCGCard(
    name="Anular",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=4,
    ability="Quando você prever uma carta de efeito do baralho adversário, você pode jogá-la no lixo",
    card_class="Mágico"
)

assembly = TCGCard(
    name="Assembleia",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=2,
    ability="Counter: quando for atacado, pode usar para ganhar +3000 de defesa (apenas no turno do ataque)",
    card_class="Mágico"
)

graduation = TCGCard(
    name="Graduação",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=2,
    ability="Quando entregue a um Estudante de Magia, aumenta o dano dele em +2000",
    card_class="Mágico"
)

channel = TCGCard(
    name="Canalizar",
    card_type="Efeito",
    attack=0,
    defense=0,
    cost=6,
    ability="Aumenta o dano em +6000, porém o personagem deve ser colocado na pilha de descarte",
    card_class="Mágico"
)

# ====================== ESPECIAIS ======================
rodote = TCGCard(
    name="Rodote",
    card_type="Especial",
    attack=4000,
    defense=5000,
    cost=3,
    ability="Permite que você preveja as próximas 3 primeiras cartas do baralho inimigo",
    attack_style="Especial",
    card_class="Mágico"
)

mabo = TCGCard(
    name="Mabo",
    card_type="Especial",
    attack=7000,
    defense=3000,
    cost=8,
    ability="Quando em campo, anula todos os efeitos de cartas direcionados ao líder",
    attack_style="Especial",
    card_class="Mágico"
)

drogoon = TCGCard(
    name="Drogoon",
    card_type="Especial",
    attack=6000,
    defense=6000,
    cost=6,
    ability="Característica: Defensor",
    attack_style="Físico",
    card_class="Mágico"
)

bomia = TCGCard(
    name="Bomia",
    card_type="Especial",
    attack=2000,
    defense=2000,
    cost=4,
    ability="Quando você compra uma carta com ele em campo, você pode transformá-la em uma carta de vida",
    attack_style="Especial",
    card_class="Mágico"
)

# ====================== COMUNS ======================
estudante = TCGCard(
    name="Estudante de Magia",
    card_type="Comum",
    attack=3000,
    defense=2000,
    cost=2,
    ability="Com 2 cartas de Energia nele você pode comprar um Tomo da Sabedoria | Counter: 1000",
    attack_style="Especial",
    card_class="Mágico"
)

helbo = TCGCard(
    name="Helbo",
    card_type="Comum",
    attack=2000,
    defense=3000,
    cost=2,
    ability="Restaura uma carta de Energia | Característica: Defensor | Counter: 1000",
    attack_style="Físico",
    card_class="Especialista"
)

marbo = TCGCard(
    name="Marbo",
    card_type="Comum",
    attack=4000,
    defense=2000,
    cost=3,
    ability="Pode atacar no mesmo turno que for colocado em campo | Característica: Apressado | Counter: 1000",
    attack_style="Físico",
    card_class="Lutador"
)

professor = TCGCard(
    name="Professor de Magia",
    card_type="Comum",
    attack=3000,
    defense=3000,
    cost=3,
    ability="Counter: 2000",
    attack_style="Especial",
    card_class="Mágico"
)

# ====================== ENERGIAS ======================
energies = [
    TCGCard(name="Cristal de Mana", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Cristal de Mana", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Cristal de Mana", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Fonte Arcana", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 2 energias", energy_generated=2),
    TCGCard(name="Fonte Arcana", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 2 energias", energy_generated=2),
    TCGCard(name="Orbe do Conhecimento", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Relíquia Arcana", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Poço de Sabedoria", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Runa Antiga", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 1 energia", energy_generated=1),
    TCGCard(name="Estrela Cadente", card_type="Energia", attack=0, defense=0, cost=0, ability="Gera 3 energias (vai pro descarte depois de usar)", energy_generated=3),
]


def criar_deck():
    base = (
        [tome] +
        [biblioteca] +
        [annul] * 4 +
        [assembly] * 4 +
        [graduation] * 4 +
        [channel] * 4 +
        [rodote] * 2 +
        [mabo] * 2 +
        [drogoon] * 2 +
        [bomia] * 2 +
        energies +
        [estudante] * 4 +
        [helbo] * 4 +
        [marbo] * 4 +
        [professor] * 4
    )
    return [copy.deepcopy(c) for c in base]


class Jogador:
    def __init__(self, nome, deck, lider, is_ia=False, seed=None):
        self.nome = nome
        self.deck = [copy.deepcopy(c) for c in deck]
        # Use RNG local para não poluir o random global
        self.rng = random.Random(seed)
        if seed is not None:
            print(f"Seed de {nome}: {seed}")
        self.rng.shuffle(self.deck)

        self.mao = []
        self.campo = []
        self.descarte = []
        self.energia = 0
        self.lider = lider
        # Copia separada do líder como carta no campo (pode atacar e ser atacado)
        self.lider_card = copy.deepcopy(lider) if lider is not None else None
        self.life = []
        self.vivo = True
        self.is_ia = is_ia
        self._preparar_life()

        # Coloca o líder em campo para poder atacar e ser atacado
        if self.lider_card is not None:
            # garante que os atributos necessários existam
            self.lider_card.ja_atacou = False
            self.lider_card.buff_ataque = 0
            self.lider_card.buff_defesa = 0
            self.campo.append(self.lider_card)
            print(f"{self.nome} colocou o líder {self.lider_card.name} em campo.")

    def _preparar_life(self):
        for _ in range(self.lider.life):
            if self.deck:
                self.life.append(self.deck.pop(0))
        print(f"{self.nome} preparou {len(self.life)} cartas de Life.")

    def resetar_ataques(self):
        for carta in self.campo:
            carta.ja_atacou = False

    def comprar(self, quantidade=1, silencioso=False):
        compradas = 0
        for _ in range(quantidade):
            if not self.deck:
                if not silencioso:
                    print(f"❌ {self.nome}: Deck vazio!")
                break
            carta = self.deck.pop(0)
            self.mao.append(carta)
            compradas += 1
            if not silencioso:
                print(f"{self.nome} comprou: {carta.name}")
        return compradas

    def gerar_energia(self, quantidade):
        self.energia += quantidade
        print(f"{self.nome} gerou {quantidade} energia. Total: {self.energia}")

    def pode_jogar(self, carta):
        return carta in self.mao and self.energia >= carta.cost

    def jogar_carta(self, carta, oponente=None):
        if not self.pode_jogar(carta):
            print("❌ Não é possível jogar essa carta!")
            return False

        self.energia -= carta.cost
        self.mao.remove(carta)

        if carta.card_type == "Energia":
            self.energia += carta.energy_generated
            self.descarte.append(carta)
            print(f"⚡ {self.nome} usou {carta.name} e gerou {carta.energy_generated} energia!")

        elif carta.card_type == "Efeito":
            self.descarte.append(carta)
            print(f"✅ {self.nome} ativou o efeito: {carta.name}")
            if carta.name == "Anular":
                self.efeito_anular(oponente)
            elif carta.name == "Assembleia":
                self.efeito_assembleia()
            elif carta.name == "Graduação":
                self.efeito_graduacao()
            elif carta.name == "Canalizar":
                self.efeito_canalizar()

        elif carta.card_type in ["Comum", "Especial", "Terreno", "Item"]:
            carta.ja_atacou = False
            self.campo.append(carta)
            print(f"✅ {self.nome} jogou {carta.name} no campo! (Gastou {carta.cost})")

        print(f"Energia restante: {self.energia}")
        return True

    # ====================== EFEITOS ======================
    def efeito_anular(self, oponente):
        if not oponente or not oponente.deck:
            print("O oponente não tem cartas no deck.")
            return
        print("\n🔍 Você olha as 3 primeiras cartas do deck do oponente:")
        top = oponente.deck[:3]
        for i, c in enumerate(top, 1):
            print(f"  {i}. {c.name} ({c.card_type})")

        efeitos = [(i, c) for i, c in enumerate(top) if c.card_type == "Efeito"]
        if not efeitos:
            print("Nenhuma carta de efeito encontrada.")
            return

        print("\nCartas de efeito encontradas:")
        for idx, c in efeitos:
            print(f"  {idx+1}. {c.name}")

        try:
            num = int(input("Número da carta de efeito para anular (0 para cancelar): "))
            if num == 0:
                return
            if 1 <= num <= len(top) and top[num-1].card_type == "Efeito":
                carta_anulada = oponente.deck.pop(num-1)
                oponente.descarte.append(carta_anulada)
                print(f"🗑️  {carta_anulada.name} foi jogada no lixo!")
            else:
                print("Escolha inválida.")
        except:
            print("Entrada inválida.")

    def efeito_assembleia(self):
        if not self.campo:
            print("Você não tem cartas no campo.")
            return
        print("\nEscolha uma carta para +3000 DEF (Assembleia):")
        for i, c in enumerate(self.campo, 1):
            print(f"  {i}. {c.name} | DEF: {c.def_total()}")
        try:
            idx = int(input("Número: ")) - 1
            if 0 <= idx < len(self.campo):
                self.campo[idx].buff_defesa += 3000
                print(f"🛡️  {self.campo[idx].name} ganhou +3000 DEF! Agora: {self.campo[idx].def_total()}")
        except:
            print("Entrada inválida.")

    def efeito_graduacao(self):
        estudantes = [c for c in self.campo if c.name == "Estudante de Magia"]
        if not estudantes:
            print("Não há Estudante de Magia no campo.")
            return
        print("\nEscolha o Estudante de Magia para +2000 ATK:")
        for i, c in enumerate(estudantes, 1):
            print(f"  {i}. {c.name} | ATK: {c.atk_total()}")
        try:
            idx = int(input("Número: ")) - 1
            if 0 <= idx < len(estudantes):
                estudantes[idx].buff_ataque += 2000
                print(f"📚 {estudantes[idx].name} recebeu Graduação! ATK: {estudantes[idx].atk_total()}")
        except:
            print("Entrada inválida.")

    def efeito_canalizar(self):
        personagens = [c for c in self.campo if c.card_type in ["Comum", "Especial"]]
        if not personagens:
            print("Não há personagens no campo.")
            return
        print("\nEscolha o personagem para Canalizar (+6000 ATK e vai pro descarte):")
        for i, c in enumerate(personagens, 1):
            print(f"  {i}. {c.name} | ATK: {c.atk_total()}")
        try:
            idx = int(input("Número: ")) - 1
            if 0 <= idx < len(personagens):
                alvo = personagens[idx]
                alvo.buff_ataque += 6000
                print(f"🔥 {alvo.name} ganhou +6000 ATK! (ATK: {alvo.atk_total()})")
                self.campo.remove(alvo)
                self.descarte.append(alvo)
                print(f"🗑️  {alvo.name} foi para o descarte.")
        except:
            print("Entrada inválida.")

    def receber_dano(self, quantidade=1, fonte="Ataque"):
        if not self.vivo:
            return
        print(f"\n💥 {self.nome} recebeu {quantidade} de dano de {fonte}!")
        for _ in range(quantidade):
            if not self.life:
                self.vivo = False
                print(f"☠️  {self.nome} não tem mais Life! DERROTADO!")
                return
            carta_life = self.life.pop(0)
            self.mao.append(carta_life)
            print(f"❤️  Life restante: {len(self.life)} | Carta revelada: {carta_life.name}")

    def atacar_lider(self, carta_atacante, oponente):
        if carta_atacante not in self.campo:
            print("❌ Carta não está no campo!")
            return False
        if carta_atacante.atk_total() <= 0:
            print("❌ Sem poder de ataque!")
            return False
        if carta_atacante.ja_atacou:
            print(f"❌ {carta_atacante.name} já atacou neste turno!")
            return False
        if not oponente.vivo:
            return False

        print(f"\n⚔️  {self.nome} ataca o líder com {carta_atacante.name}!")
        oponente.receber_dano(1, fonte=carta_atacante.name)
        carta_atacante.ja_atacou = True
        return True

    def atacar_carta(self, carta_atacante, carta_defensora, oponente):
        if carta_atacante not in self.campo or carta_defensora not in oponente.campo:
            print("❌ Carta inválida!")
            return False
        if carta_atacante.atk_total() <= 0:
            print("❌ Sem poder de ataque!")
            return False
        if carta_atacante.ja_atacou:
            print(f"❌ {carta_atacante.name} já atacou neste turno!")
            return False

        atk = carta_atacante.atk_total()
        defesa = carta_defensora.def_total()
        print(f"\n⚔️  {carta_atacante.name} ({atk} ATK) vs {carta_defensora.name} ({defesa} DEF)")

        if atk >= defesa:
            # remove a carta defensora do campo e manda pro descarte
            try:
                oponente.campo.remove(carta_defensora)
            except ValueError:
                pass
            oponente.descarte.append(carta_defensora)
            print(f"✅ {carta_defensora.name} foi DESTRUÍDA!")
        else:
            print("❌ O ataque falhou!")

        carta_atacante.ja_atacou = True
        return True

    def mostrar_mao(self):
        print(f"\n=== Mão de {self.nome} ({len(self.mao)}) | Energia: {self.energia} ===")
        if not self.mao:
            print("  (vazia)")
            return
        for i, c in enumerate(self.mao, 1):
            print(f"  {i}. {c.name} | {c.card_type} | Custo: {c.cost} | ATK: {c.atk_total()}")

    def mostrar_campo(self, titulo=None):
        titulo = titulo or f"Campo de {self.nome}"
        print(f"\n=== {titulo} ===")
        if not self.campo:
            print("  (vazio)")
            return
        for i, c in enumerate(self.campo, 1):
            status = " (já atacou)" if c.ja_atacou else ""
            leader_tag = " [LÍDER]" if c.card_type == "Líder" else ""
            print(f"  {i}. {c.name}{leader_tag} | ATK: {c.atk_total()} | DEF: {c.def_total()}{status}")

    def mostrar_status(self):
        print(f"\n===== {self.nome} {'(IA)' if self.is_ia else ''} =====")
        print(f"❤️  Life: {len(self.life)}/{self.lider.life}")
        print(f"⚡ Energia: {self.energia}")
        print(f"🃏 Mão: {len(self.mao)} | Campo: {len(self.campo)} | Deck: {len(self.deck)}")
        if self.lider_card is not None:
            print(f"👑 Líder em campo: {self.lider_card.name} | ATK: {self.lider_card.atk_total()} | DEF: {self.lider_card.def_total()}")
        if not self.vivo:
            print("☠️  DERROTADO")

    # ====================== FASES ======================
    def fase_inicio(self):
        print(f"\n--- FASE DE INÍCIO ---")
        self.resetar_ataques()
        self.gerar_energia(2)
        compradas = self.comprar(1)
        if compradas == 0 and len(self.deck) == 0:
            self.vivo = False
            print(f"☠️  {self.nome} sofreu deck out! DERROTADO!")

    def fase_principal(self, oponente):
        print(f"\n--- FASE PRINCIPAL ---")
        while True:
            if not self.vivo or not oponente.vivo:
                break
            print("\n1. Ver mão | 2. Ver meu campo | 3. Ver campo inimigo")
            print("4. Jogar carta | 5. Ir para Fase de Ataque | 0. Status")
            escolha = input("Escolha: ").strip()

            if escolha == "1":
                self.mostrar_mao()
            elif escolha == "2":
                self.mostrar_campo()
            elif escolha == "3":
                oponente.mostrar_campo("Campo do Oponente")
            elif escolha == "4":
                self.mostrar_mao()
                if not self.mao:
                    continue
                try:
                    idx = int(input("Número da carta: ")) - 1
                    if 0 <= idx < len(self.mao):
                        self.jogar_carta(self.mao[idx], oponente)
                except:
                    print("Entrada inválida.")
            elif escolha == "5":
                break
            elif escolha == "0":
                self.mostrar_status()
                oponente.mostrar_status()
            else:
                print("Opção inválida.")

    def fase_ataque(self, oponente):
        print(f"\n--- FASE DE ATAQUE ---")
        while True:
            if not self.vivo or not oponente.vivo:
                break
            print("\n1. Ver meu campo | 2. Ver campo inimigo")
            print("3. Atacar líder | 4. Atacar carta | 5. Encerrar ataque | 0. Status")
            escolha = input("Escolha: ").strip()

            if escolha == "1":
                self.mostrar_campo()
            elif escolha == "2":
                oponente.mostrar_campo("Campo do Oponente")
            elif escolha == "3":
                self.mostrar_campo("Cartas que podem atacar")
                try:
                    idx = int(input("Qual carta ataca o líder? ")) - 1
                    if 0 <= idx < len(self.campo):
                        self.atacar_lider(self.campo[idx], oponente)
                except:
                    print("Entrada inválida.")
            elif escolha == "4":
                self.mostrar_campo()
                oponente.mostrar_campo("Campo do Oponente")
                try:
                    a = int(input("Sua carta: ")) - 1
                    d = int(input("Carta inimiga: ")) - 1
                    if 0 <= a < len(self.campo) and 0 <= d < len(oponente.campo):
                        self.atacar_carta(self.campo[a], oponente.campo[d], oponente)
                except:
                    print("Entrada inválida.")
            elif escolha == "5":
                break
            elif escolha == "0":
                self.mostrar_status()
                oponente.mostrar_status()
            else:
                print("Opção inválida.")

    def fase_final(self):
        print(f"\n--- FASE FINAL ---")
        print(f"Turno de {self.nome} encerrado.")

    def turno_jogador(self, oponente):
        print(f"\n{'='*55}")
        print(f"🎮 SEU TURNO")
        print(f"{'='*55}")
        self.fase_inicio()
        if not self.vivo or not oponente.vivo:
            return
        self.fase_principal(oponente)
        if not self.vivo or not oponente.vivo:
            return
        self.fase_ataque(oponente)
        if not self.vivo or not oponente.vivo:
            return
        self.fase_final()

    def turno_ia(self, oponente):
        if not self.vivo or not oponente.vivo:
            return
        print(f"\n{'='*55}")
        print(f"🤖 TURNO DA IA")
        print(f"{'='*55}")

        print("\n--- FASE DE INÍCIO (IA) ---")
        self.resetar_ataques()
        self.gerar_energia(2)
        if self.comprar(1) == 0 and len(self.deck) == 0:
            self.vivo = False
            print(f"☠️  IA sofreu deck out!")
            return

        print("\n--- FASE PRINCIPAL (IA) ---")
        # IA joga cartas por custo crescente (inclui líder já em campo, mas líderes não estão na mão)
        for carta in sorted([c for c in self.mao if self.pode_jogar(c)], key=lambda c: c.cost):
            if self.pode_jogar(carta) and carta.card_type in ["Comum", "Especial", "Terreno", "Item", "Energia"]:
                self.jogar_carta(carta, oponente)

        print("\n--- FASE DE ATAQUE (IA) ---")
        attackers = [c for c in self.campo if c.atk_total() > 0 and not c.ja_atacou]
        for atacante in attackers:
            if not oponente.vivo:
                break
            if not oponente.campo:
                self.atacar_lider(atacante, oponente)
            else:
                # prioriza destruir a carta com menor defesa que possa ser vencida
                alvo = min(oponente.campo, key=lambda c: c.def_total())
                if atacante.atk_total() >= alvo.def_total():
                    self.atacar_carta(atacante, alvo, oponente)
                else:
                    self.atacar_lider(atacante, oponente)

        print("\n--- FASE FINAL (IA) ---")
        self.mostrar_status()
        oponente.mostrar_status()


# ====================== INÍCIO DO JOGO ======================
if __name__ == "__main__":
    deck1 = criar_deck()
    deck2 = criar_deck()
    print(f"Deck criado com {len(deck1)} cartas!\n")

    print("Distribuição do deck (exemplo):")
    for t, q in sorted(Counter(c.card_type for c in deck1).items()):
        print(f"  {t}: {q}")

    print("\n" + "="*55)
    print("           BEM-VINDO AO TCG!")
    print("="*55)

    # Coloque seed=42 se quiser sempre o mesmo embaralhamento (cada jogador recebe sua seed)
    jogador = Jogador("Você", deck1, rogen, is_ia=False, seed=None)
    ia = Jogador("Oponente IA", deck2, rogen, is_ia=True, seed=None)

    print("\n--- Mão inicial ---")
    jogador.comprar(5)
    ia.comprar(5)
    jogador.gerar_energia(3)
    ia.gerar_energia(3)

    jogador.mostrar_status()
    ia.mostrar_status()

    turno = 1
    while jogador.vivo and ia.vivo:
        print(f"\n\n########## TURNO {turno} ##########")
        jogador.turno_jogador(ia)
        if not jogador.vivo or not ia.vivo:
            break
        ia.turno_ia(jogador)
        if not jogador.vivo or not ia.vivo:
            break
        turno += 1

    print("\n" + "="*55)
    print("              FIM DE JOGO")
    print("="*55)

    if jogador.vivo and not ia.vivo:
        print("🎉 VOCÊ VENCEU!")
    elif ia.vivo and not jogador.vivo:
        print("💀 A IA VENCEU!")
    else:
        print("Jogo encerrado.")

    jogador.mostrar_status()
    ia.mostrar_status()
