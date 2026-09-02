import random
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

    def __str__(self):
        info = f"{self.name} | Tipo: {self.card_type} | Classe: {self.card_class}\n"
        info += f"ATK: {self.attack} | DEF: {self.defense} | Custo: {self.cost}"
        if self.energy_generated > 0:
            info += f" | Gera: {self.energy_generated} energia"
        if self.card_type == "Líder":
            info += f" | Life: {self.life}"
        info += f"\nEstilo: {self.attack_style} | Habilidade: {self.ability}\n"
        return info


# ====================== LÍDER ======================
rogen = TCGCard(
    name="Rogen", card_type="Líder", attack=5000, defense=5000, cost=0,
    ability="Quando o lider for atacar vc pode olhar as 5 primeiras cartas do seu baralho e colocar uma a sua mão 'o lider precisa estar com 3 energias'",
    attack_style="Especial", life=5
)

# ====================== ITENS ======================
tome = TCGCard(name="Tomo da Sabedoria", card_type="Item", attack=0, defense=0, cost=0, ability="Adiciona a classe magico a uma carta a escolha")
cristal_poder = TCGCard(name="Cristal de Poder", card_type="Item", attack=0, defense=0, cost=1, ability="Uma carta em campo ganha +1000 de ATK até o final do turno")
amuleto = TCGCard(name="Amuleto Arcano", card_type="Item", attack=0, defense=0, cost=2, ability="Protege o líder de 1 efeito do adversário")
grimorio = TCGCard(name="Grimório Antigo", card_type="Item", attack=0, defense=0, cost=0, ability="Compre 1 carta")
cajado = TCGCard(name="Cajado do Oráculo", card_type="Item", attack=0, defense=0, cost=3, ability="Preveja as 2 próximas cartas do seu baralho")

# ====================== TERRENOS ======================
biblioteca = TCGCard(name="Biblioteca Arcana", card_type="Terreno", attack=0, defense=0, cost=0, ability="Enquanto estiver em campo, todas as cartas Mágicas ganham +500 de ATK")
torre = TCGCard(name="Torre de Magia", card_type="Terreno", attack=0, defense=0, cost=0, ability="Uma vez por turno, você pode gerar 1 energia extra")
ruinas = TCGCard(name="Ruínas Antigas", card_type="Terreno", attack=0, defense=0, cost=0, ability="Quando entra em campo, olhe as 3 primeiras cartas do baralho adversário")
jardim = TCGCard(name="Jardim Místico", card_type="Terreno", attack=0, defense=0, cost=0, ability="No início do seu turno, recupere 1000 de DEF do líder")
portal = TCGCard(name="Portal Dimensional", card_type="Terreno", attack=0, defense=0, cost=0, ability="Você pode invocar 1 carta Comum do descarte pagando 1 energia a menos")

# ====================== EFEITOS ======================
annul = TCGCard(name="Anular", card_type="Efeito", attack=0, defense=0, cost=0, ability="Quando vc prever uma carta de efeito do baralho adversario vc pode jogar ela no lixo")
assembly = TCGCard(name="Assembleia", card_type="Efeito", attack=0, defense=0, cost=0, ability="'counter' quando for atacado pode usar o efeito dessa carta para ganhar +3000 de defesa 'apenas no turno do ataque'")
graduation = TCGCard(name="Graduação", card_type="Efeito", attack=0, defense=0, cost=0, ability="Escolha uma carta em campo. Ela ganha +2000 de dano")
channel = TCGCard(name="Canalizar", card_type="Efeito", attack=0, defense=0, cost=0, ability="Aumenta o dano em +6000 porem o personagem deve ser colocado na pilha de descarte")

# ====================== ESPECIAIS ======================
rodote = TCGCard(name="Rodote", card_type="Especial", attack=4000, defense=5000, cost=4, ability="Permite com que vc preveja as proximas 3 primeiras cartas do baralho inimigo", attack_style="Especial")
mabo = TCGCard(name="Mabo", card_type="Especial", attack=7000, defense=3000, cost=8, ability="Quando em campo anula todos os efeitos de cartas direcionado ao lider", attack_style="Especial")
drogoon = TCGCard(name="Drogoon", card_type="Especial", attack=1000, defense=9000, cost=5, ability="Nenhuma", attack_style="Fisico")
bomia = TCGCard(name="Bomia", card_type="Especial", attack=2000, defense=2000, cost=6, ability="Quando vc compra uma carta com ele em campo você pode transformala em uma carta de vida", attack_style="Especial")

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

# ====================== COMUNS ======================
apprentice = TCGCard(name="Aprendiz Arcano", card_type="Comum", attack=3000, defense=2000, cost=2, ability="Nenhuma", attack_style="Especial")
guardian = TCGCard(name="Guardião da Biblioteca", card_type="Comum", attack=2000, defense=4000, cost=3, ability="Nenhuma", attack_style="Fisico")
novice_mage = TCGCard(name="Mago Novato", card_type="Comum", attack=3000, defense=2000, cost=2, ability="Nenhuma", attack_style="Especial")
mystic_scribe = TCGCard(name="Escriba Místico", card_type="Comum", attack=2000, defense=3000, cost=2, ability="Quando entra em campo vc pode comprar 1 carta", attack_style="Especial")
runist = TCGCard(name="Runista", card_type="Comum", attack=3000, defense=2000, cost=3, ability="Nenhuma", attack_style="Especial")
lesser_oracle = TCGCard(name="Oráculo Menor", card_type="Comum", attack=1000, defense=3000, cost=2, ability="Quando entra em campo vc pode prever a proxima carta do seu baralho", attack_style="Especial")

# ====================== DECK ======================
deck = (
    [tome, cristal_poder, amuleto, grimorio, cajado] +
    [biblioteca, torre, ruinas, jardim, portal] +
    [annul] * 4 + [assembly] * 4 + [graduation] * 4 + [channel] * 4 +
    [rodote] * 2 + [mabo] * 2 + [drogoon] * 2 + [bomia] * 2 +
    energies +
    [apprentice] * 3 + [guardian] * 3 + [novice_mage] * 3 +
    [mystic_scribe] * 3 + [runist] * 2 + [lesser_oracle] * 2
)

print(f"Deck criado com {len(deck)} cartas (sem o Líder)!\n")


class Jogador:
    def __init__(self, nome, deck, lider, is_ia=False):
        self.nome = nome
        self.deck = deck.copy()
        random.shuffle(self.deck)
        self.mao = []
        self.campo = []
        self.descarte = []
        self.energia = 0
        self.lider = lider
        self.life = []
        self.vivo = True
        self.is_ia = is_ia
        self._preparar_life()

    def _preparar_life(self):
        for _ in range(self.lider.life):
            if self.deck:
                self.life.append(self.deck.pop(0))
        print(f"{self.nome} preparou {len(self.life)} cartas de Life.")

    def resetar_ataques(self):
        for carta in self.campo:
            carta.ja_atacou = False

    def comprar(self, quantidade=1):
        compradas = 0
        for _ in range(quantidade):
            if not self.deck:
                print(f"❌ {self.nome}: Deck vazio!")
                break
            carta = self.deck.pop(0)
            self.mao.append(carta)
            compradas += 1
            print(f"{self.nome} comprou: {carta.name}")
        return compradas

    def gerar_energia(self, quantidade):
        self.energia += quantidade
        print(f"{self.nome} gerou {quantidade} energia. Total: {self.energia}")

    def pode_jogar(self, carta):
        return carta in self.mao and self.energia >= carta.cost

    def jogar_carta(self, carta):
        if not self.pode_jogar(carta):
            print("❌ Não é possível jogar essa carta!")
            return False

        self.energia -= carta.cost
        self.mao.remove(carta)

        if carta.card_type == "Energia":
            self.energia += carta.energy_generated
            self.descarte.append(carta)
            print(f"⚡ {self.nome} usou {carta.name} e gerou {carta.energy_generated} energia!")
        elif carta.card_type in ["Comum", "Especial", "Terreno", "Item"]:
            carta.ja_atacou = False
            self.campo.append(carta)
            print(f"✅ {self.nome} jogou {carta.name} no campo! (Gastou {carta.cost} energia)")
        else:
            self.descarte.append(carta)
            print(f"✅ {self.nome} usou o efeito {carta.name}!")

        print(f"Energia restante: {self.energia}")
        return True

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
        if carta_atacante.attack <= 0:
            print("❌ Essa carta não tem poder de ataque!")
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
            print("❌ Carta inválida para combate!")
            return False
        if carta_atacante.attack <= 0:
            print("❌ Essa carta não tem poder de ataque!")
            return False
        if carta_atacante.ja_atacou:
            print(f"❌ {carta_atacante.name} já atacou neste turno!")
            return False

        print(f"\n⚔️  {carta_atacante.name} ({carta_atacante.attack} ATK) vs {carta_defensora.name} ({carta_defensora.defense} DEF)")
        if carta_atacante.attack >= carta_defensora.defense:
            oponente.campo.remove(carta_defensora)
            oponente.descarte.append(carta_defensora)
            print(f"✅ {carta_defensora.name} foi DESTRUÍDA!")
        else:
            print(f"❌ O ataque falhou!")

        carta_atacante.ja_atacou = True
        return True

    def mostrar_mao(self):
        print(f"\n=== Sua Mão ({len(self.mao)} cartas) | Energia: {self.energia} ===")
        if not self.mao:
            print("  (vazia)")
            return
        for i, carta in enumerate(self.mao, 1):
            print(f"  {i}. {carta.name} | Tipo: {carta.card_type} | Custo: {carta.cost} | ATK: {carta.attack}")

    def mostrar_campo(self, titulo="Seu Campo"):
        print(f"\n=== {titulo} ===")
        if not self.campo:
            print("  (vazio)")
            return
        for i, carta in enumerate(self.campo, 1):
            status = " (já atacou)" if carta.ja_atacou else ""
            print(f"  {i}. {carta.name} | ATK: {carta.attack} | DEF: {carta.defense}{status}")

    def mostrar_status(self):
        print(f"\n===== {self.nome} {'(IA)' if self.is_ia else ''} =====")
        print(f"❤️  Life: {len(self.life)} / {self.lider.life}")
        print(f"⚡ Energia: {self.energia}")
        print(f"🃏 Mão: {len(self.mao)} | Campo: {len(self.campo)} | Deck: {len(self.deck)}")
        if not self.vivo:
            print("☠️  DERROTADO")

    # ====================== FASES DO TURNO ======================

    def fase_inicio(self):
        print(f"\n--- FASE DE INÍCIO ---")
        self.resetar_ataques()
        self.gerar_energia(2)
        self.comprar(1)

    def fase_principal(self, oponente):
        print(f"\n--- FASE PRINCIPAL (Jogar Cartas) ---")
        while True:
            if not self.vivo or not oponente.vivo:
                break

            print("\nOpções da Fase Principal:")
            print("1. Ver mão")
            print("2. Ver meu campo")
            print("3. Ver campo do oponente")
            print("4. Jogar carta")
            print("5. Avançar para Fase de Ataque")
            print("0. Ver status")

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
                    idx = int(input("Número da carta para jogar: ")) - 1
                    if 0 <= idx < len(self.mao):
                        self.jogar_carta(self.mao[idx])
                    else:
                        print("❌ Número inválido!")
                except ValueError:
                    print("❌ Digite um número!")
            elif escolha == "5":
                break
            elif escolha == "0":
                self.mostrar_status()
                oponente.mostrar_status()
            else:
                print("❌ Opção inválida!")

    def fase_ataque(self, oponente):
        print(f"\n--- FASE DE ATAQUE ---")
        while True:
            if not self.vivo or not oponente.vivo:
                break

            print("\nOpções da Fase de Ataque:")
            print("1. Ver meu campo")
            print("2. Ver campo do oponente")
            print("3. Atacar o líder")
            print("4. Atacar uma carta")
            print("5. Encerrar Fase de Ataque")
            print("0. Ver status")

            escolha = input("Escolha: ").strip()

            if escolha == "1":
                self.mostrar_campo()
            elif escolha == "2":
                oponente.mostrar_campo("Campo do Oponente")
            elif escolha == "3":
                self.mostrar_campo("Cartas disponíveis para atacar")
                if not any(c.attack > 0 and not c.ja_atacou for c in self.campo):
                    print("Nenhuma carta disponível para atacar.")
                    continue
                try:
                    idx = int(input("Qual carta ataca o líder? ")) - 1
                    if 0 <= idx < len(self.campo):
                        self.atacar_lider(self.campo[idx], oponente)
                    else:
                        print("❌ Número inválido!")
                except ValueError:
                    print("❌ Digite um número!")
            elif escolha == "4":
                self.mostrar_campo()
                oponente.mostrar_campo("Campo do Oponente")
                if not self.campo or not oponente.campo:
                    print("Não há cartas para combate.")
                    continue
                try:
                    idx_atk = int(input("Sua carta atacante: ")) - 1
                    idx_def = int(input("Carta do oponente: ")) - 1
                    if 0 <= idx_atk < len(self.campo) and 0 <= idx_def < len(oponente.campo):
                        self.atacar_carta(self.campo[idx_atk], oponente.campo[idx_def], oponente)
                    else:
                        print("❌ Número inválido!")
                except ValueError:
                    print("❌ Digite números válidos!")
            elif escolha == "5":
                break
            elif escolha == "0":
                self.mostrar_status()
                oponente.mostrar_status()
            else:
                print("❌ Opção inválida!")

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

    # ====================== IA ======================
    def turno_ia(self, oponente):
        if not self.vivo or not oponente.vivo:
            return

        print(f"\n{'='*55}")
        print(f"🤖 TURNO DA IA ({self.nome})")
        print(f"{'='*55}")

        # Fase de Início
        print("\n--- FASE DE INÍCIO (IA) ---")
        self.resetar_ataques()
        self.gerar_energia(2)
        self.comprar(1)

        # Fase Principal
        print("\n--- FASE PRINCIPAL (IA) ---")
        cartas_jogaveis = sorted(
            [c for c in self.mao if self.pode_jogar(c)],
            key=lambda c: c.cost
        )
        for carta in cartas_jogaveis[:]:
            if self.pode_jogar(carta):
                if carta.card_type in ["Comum", "Especial", "Terreno", "Item", "Energia"]:
                    self.jogar_carta(carta)

        # Fase de Ataque
        print("\n--- FASE DE ATAQUE (IA) ---")
        cartas_ataque = [c for c in self.campo if c.attack > 0 and not c.ja_atacou]
        for atacante in cartas_ataque:
            if not oponente.vivo:
                break
            if len(oponente.campo) == 0:
                self.atacar_lider(atacante, oponente)
            else:
                alvo = min(oponente.campo, key=lambda c: c.defense)
                if atacante.attack >= alvo.defense:
                    self.atacar_carta(atacante, alvo, oponente)
                else:
                    self.atacar_lider(atacante, oponente)

        # Fase Final
        print("\n--- FASE FINAL (IA) ---")
        self.mostrar_status()
        oponente.mostrar_status()


# ====================== INÍCIO DO JOGO ======================

print("Distribuição do deck:")
for t, q in sorted(Counter(c.card_type for c in deck).items()):
    print(f"  {t}: {q}")

print("\n" + "="*55)
print("           BEM-VINDO AO TCG!")
print("="*55)

jogador = Jogador("Você", deck, rogen, is_ia=False)
ia = Jogador("Oponente IA", deck, rogen, is_ia=True)

print("\n--- Preparando mão inicial ---")
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
    print("Empate ou jogo interrompido.")

jogador.mostrar_status()
ia.mostrar_status()
