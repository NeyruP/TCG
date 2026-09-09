import pygame
import sys
import random
import copy
import uuid
from collections import Counter
 
# =====================================================================
# 1. COLOQUE TODO O SEU CÓDIGO DE BACKEND AQUI
# Cole todas as classes (TCGCard, Player, Game) e as instâncias/listas
# de cartas (rogen, biblioteca, criar_deck, energies, etc.) neste espaço.
# =====================================================================
 
"""TCG STRUCTURE - Versão completa e refatorada
Arquitetura: Ability Objects + EventBus + Continuous Effects + Stack

Mecânica de Energia (atualizada):
- Sem cartas de Energia no deck.
- Jogador começa com 2 de energia.
- +1 de energia passiva no início de cada turno.
"""

from __future__ import annotations
import random
import copy
import uuid
from abc import ABC, abstractmethod
from enum import Enum, auto
from typing import List, Dict, Any, Optional, Callable, Union
from collections import defaultdict


# ============================================================
# ENUMS E TIPOS
# ============================================================

class Timing(Enum):
    ON_PLAY = auto()            # quando a carta é jogada (efeitos)
    ON_ENTER_FIELD = auto()     # quando entra no campo
    ON_ATTACK = auto()          # quando declara ataque
    ON_DRAW = auto()            # quando o controlador compra
    ON_DESTROY = auto()         # quando é destruída
    CONTINUOUS = auto()         # passivo enquanto em campo
    ACTIVATED = auto()          # ativável (custo + efeito)
    TRIGGERED = auto()          # dispara por evento


class Speed(Enum):
    SORCERY = "Sorcery"         # só no seu turno, fase principal, stack vazia
    INSTANT = "Instant"         # pode responder / qualquer momento permitido


# ============================================================
# SISTEMA DE ABILITIES (Command Pattern)
# ============================================================

class Ability(ABC):
    def __init__(self, name: str, timing: Timing, text: str = "", speed: Speed = Speed.SORCERY):
        self.id = str(uuid.uuid4())
        self.name = name
        self.timing = timing
        self.text = text
        self.speed = speed

    @abstractmethod
    def can_activate(self, game: "Game", controller: "Player", source: "TCGCard", context: Dict) -> bool:
        ...

    @abstractmethod
    def resolve(self, game: "Game", controller: "Player", source: "TCGCard",
                targets: Dict, context: Dict) -> Dict:
        """Executa o efeito. Retorna dict com resultado para log/UI."""
        ...

    def __repr__(self):
        return f"<Ability {self.name} ({self.timing.name})>"


# ---------- Abilities concretas reutilizáveis ----------

class DrawAbility(Ability):
    def __init__(self, amount: int = 1, timing: Timing = Timing.ON_PLAY, speed: Speed = Speed.SORCERY):
        super().__init__("Draw", timing, f"Compre {amount} carta(s)", speed)
        self.amount = amount

    def can_activate(self, game, controller, source, context):
        return True

    def resolve(self, game, controller, source, targets, context):
        drawn = controller.draw(self.amount)
        return {"action": "draw", "amount": len(drawn), "cards": [d.get("card").name if isinstance(d, dict) else str(d) for d in drawn]}


class BuffAbility(Ability):
    def __init__(self, atk: int = 0, defense: int = 0, permanent: bool = True,
                 turns: int = 1, filter_name: str = None, timing: Timing = Timing.ON_PLAY,
                 speed: Speed = Speed.SORCERY):
        text = f"+{atk}/{defense}" + (" permanente" if permanent else f" por {turns} turno(s)")
        super().__init__("Buff", timing, text, speed)
        self.atk = atk
        self.defense = defense
        self.permanent = permanent
        self.turns = turns
        self.filter_name = filter_name  # ex: só "Estudante de Magia"

    def can_activate(self, game, controller, source, context):
        return True

    def resolve(self, game, controller, source, targets, context):
        target = targets.get("card")
        if not target:
            return {"error": "no target"}
        if self.filter_name and target.name != self.filter_name:
            return {"error": f"target must be {self.filter_name}"}

        target.buff_ataque += self.atk
        target.buff_defesa += self.defense

        if not self.permanent:
            game.continuous.add_temporary(target, self.atk, self.defense, self.turns, source)

        return {
            "action": "buff",
            "target": target.name,
            "atk": self.atk,
            "def": self.defense,
            "permanent": self.permanent,
            "new_atk": target.atk_total(game),
            "new_def": target.def_total(game),
        }


class ContinuousModifier(Ability):
    """Efeito passivo enquanto a fonte estiver em campo."""
    def __init__(self, filter_fn: Callable[["TCGCard"], bool], atk: int = 0, defense: int = 0,
                 text: str = ""):
        super().__init__("Continuous", Timing.CONTINUOUS, text)
        self.filter_fn = filter_fn
        self.atk = atk
        self.defense = defense

    def can_activate(self, *args): return True
    def resolve(self, *args): return {}  # continuous não resolve, só aplica


class LookAndTakeAbility(Ability):
    """Olha as N primeiras cartas do próprio baralho e coloca uma na mão (ex: Rogen)."""
    def __init__(self, look: int = 5, energy_cost: int = 0, timing: Timing = Timing.ON_ATTACK):
        super().__init__("LookAndTake", timing, f"Olhe as {look} primeiras e coloque uma na mão")
        self.look = look
        self.energy_cost = energy_cost

    def can_activate(self, game, controller, source, context):
        return controller.energy_pool >= self.energy_cost

    def resolve(self, game, controller, source, targets, context):
        if controller.energy_pool < self.energy_cost:
            return {"error": "insufficient energy"}
        controller.energy_pool -= self.energy_cost

        top = controller.deck[:self.look]
        if not top:
            return {"action": "look_and_take", "taken": None}

        # escolha determinística: maior ATK; se empate, a primeira
        choice = max(top, key=lambda c: getattr(c, "attack", 0))
        for i, c in enumerate(controller.deck[:self.look]):
            if c.id == choice.id:
                controller.deck.pop(i)
                controller.hand.append(choice)
                break
        return {"action": "look_and_take", "taken": choice.name, "looked": [c.name for c in top]}


class RevealOpponentTopAbility(Ability):
    """Revela as N primeiras cartas do baralho inimigo (ex: Rodote)."""
    def __init__(self, amount: int = 3, timing: Timing = Timing.ON_ENTER_FIELD):
        super().__init__("RevealTop", timing, f"Revela as {amount} primeiras do oponente")
        self.amount = amount

    def can_activate(self, game, controller, source, context):
        return True

    def resolve(self, game, controller, source, targets, context):
        opponent = targets.get("opponent") or game.non_active_player
        if opponent is controller:
            # tenta pegar o outro
            opponent = next((p for p in game.players if p is not controller), None)
        if not opponent:
            return {"error": "no opponent"}
        top = [c.to_dict() for c in opponent.deck[:self.amount]]
        return {"action": "reveal_top", "opponent": opponent.name, "cards": top}


class AddClassAbility(Ability):
    """Adiciona uma classe a uma carta (ex: Tomo da Sabedoria)."""
    def __init__(self, class_name: str = "Mágico", timing: Timing = Timing.ON_ENTER_FIELD):
        super().__init__("AddClass", timing, f"Adiciona a classe {class_name}")
        self.class_name = class_name

    def can_activate(self, game, controller, source, context):
        return True

    def resolve(self, game, controller, source, targets, context):
        target = targets.get("card")
        if not target:
            return {"error": "no target"}
        current = str(target.card_class)
        if self.class_name not in current:
            target.card_class = f"{current},{self.class_name}" if current else self.class_name
        return {"action": "add_class", "target": target.name, "new_class": target.card_class}


class CounterEffectAbility(Ability):
    """Anula uma carta de efeito do topo do deck do oponente (ex: Anular)."""
    def __init__(self, look: int = 3, timing: Timing = Timing.ON_PLAY, speed: Speed = Speed.INSTANT):
        super().__init__("CounterEffect", timing, "Anula um Efeito do topo do oponente", speed)
        self.look = look

    def can_activate(self, game, controller, source, context):
        return True

    def resolve(self, game, controller, source, targets, context):
        opponent = targets.get("opponent")
        idx = targets.get("index")
        if not opponent:
            return {"error": "no opponent"}

        top = opponent.deck[:self.look]
        if idx is not None:
            if 0 <= idx < len(top) and top[idx].card_type == "Efeito":
                c = opponent.deck.pop(idx)
                opponent.grave.append(c)
                return {"action": "annul", "annulled": c.name}
            return {"action": "annul", "annulled": None}

        # padrão: primeiro Efeito encontrado
        for i, c in enumerate(top):
            if c.card_type == "Efeito":
                card_to_grave = opponent.deck.pop(i)
                opponent.grave.append(card_to_grave)
                return {"action": "annul", "annulled": card_to_grave.name}
        return {"action": "annul", "annulled": None}


class SacrificeBuffAbility(Ability):
    """Dá buff e depois sacrifica o alvo (ex: Canalizar)."""
    def __init__(self, atk: int = 6000, timing: Timing = Timing.ON_PLAY):
        super().__init__("SacrificeBuff", timing, f"+{atk} ATK e sacrifica")
        self.atk = atk

    def can_activate(self, game, controller, source, context):
        return True

    def resolve(self, game, controller, source, targets, context):
        target = targets.get("card")
        if not target or target.card_type not in ("Comum", "Especial"):
            return {"error": "invalid target"}
        target.buff_ataque += self.atk
        controller.remove_field_card(target)
        return {"action": "channel", "target": target.name, "final_atk": target.atk_total(game)}


class TransformDrawToLifeAbility(Ability):
    """Bomia: a primeira carta comprada vira vida."""
    def __init__(self):
        super().__init__("BomiaTransform", Timing.TRIGGERED, "Transforma a primeira compra em vida")

    def can_activate(self, game, controller, source, context):
        return source in controller.field

    def resolve(self, game, controller, source, targets, context):
        # A lógica real está no método draw do Player (checa presença de Bomia)
        return {"action": "bomia_active"}


class ProtectLeaderAbility(Ability):
    """Mabo: anula efeitos direcionados ao líder."""
    def __init__(self):
        super().__init__("ProtectLeader", Timing.CONTINUOUS, "Anula efeitos ao líder")

    def can_activate(self, *args): return True
    def resolve(self, *args): return {}


# ============================================================
# EVENT BUS
# ============================================================

class EventBus:
    def __init__(self):
        self._listeners: Dict[str, List[Callable]] = defaultdict(list)

    def subscribe(self, event: str, callback: Callable):
        if callback not in self._listeners[event]:
            self._listeners[event].append(callback)

    def unsubscribe(self, event: str, callback: Callable):
        if event in self._listeners:
            self._listeners[event] = [cb for cb in self._listeners[event] if cb != callback]

    def emit(self, event: str, **kwargs) -> List[Any]:
        results = []
        for cb in list(self._listeners.get(event, [])):
            try:
                results.append(cb(**kwargs))
            except Exception as e:
                results.append({"error": str(e)})
        return results


# ============================================================
# CONTINUOUS EFFECT MANAGER
# ============================================================

class ContinuousEffectManager:
    def __init__(self):
        self.effects: List[Dict] = []          # permanent continuous
        self.temporaries: List[Dict] = []      # buffs temporários com contador de turnos

    def add(self, source: "TCGCard", ability: ContinuousModifier):
        self.effects.append({"source": source, "ability": ability})

    def remove_from(self, source: "TCGCard"):
        self.effects = [e for e in self.effects if e["source"] is not source]

    def add_temporary(self, target: "TCGCard", atk: int, defense: int, turns: int, source: "TCGCard" = None):
        self.temporaries.append({
            "target": target,
            "atk": atk,
            "defense": defense,
            "turns": turns,
            "source": source,
        })

    def tick_end_of_turn(self, player: "Player"):
        """Chamado no fim do turno do jogador. Reduz contadores e remove buffs expirados."""
        still = []
        for t in self.temporaries:
            if t["target"].owner is not player:
                still.append(t)
                continue
            t["turns"] -= 1
            if t["turns"] <= 0:
                t["target"].buff_ataque = max(0, t["target"].buff_ataque - t["atk"])
                t["target"].buff_defesa = max(0, t["target"].buff_defesa - t["defense"])
            else:
                still.append(t)
        self.temporaries = still

    def get_atk_bonus(self, card: "TCGCard") -> int:
        bonus = 0
        for e in self.effects:
            if e["source"] in (card.owner.field if card.owner else []):
                if e["ability"].filter_fn(card):
                    bonus += e["ability"].atk
        return bonus

    def get_def_bonus(self, card: "TCGCard") -> int:
        bonus = 0
        for e in self.effects:
            if e["source"] in (card.owner.field if card.owner else []):
                if e["ability"].filter_fn(card):
                    bonus += e["ability"].defense
        return bonus

    def has_protect_leader(self, player: "Player") -> bool:
        """Mabo presente?"""
        for e in self.effects:
            if e["source"] in player.field and isinstance(e["ability"], ProtectLeaderAbility):
                return True
        # fallback por nome (caso a ability não tenha sido registrada como ContinuousModifier)
        return any(c.name == "Mabo" for c in player.field)


# ============================================================
# CARTA
# ============================================================

class TCGCard:
    def __init__(
        self,
        name: str,
        card_type: str,
        attack: int = 0,
        defense: int = 0,
        cost: int = 0,
        abilities: List[Ability] = None,
        card_class: str = "Neutro",
        attack_style: str = None,
        life: int = 0,
        speed: Speed = Speed.SORCERY,
        keywords: List[str] = None,
        raw_ability_text: str = "",
    ):
        self.id = str(uuid.uuid4())
        self.name = name
        self.card_type = card_type
        self.attack = attack
        self.defense = defense
        self.cost = cost
        self.abilities = abilities or []
        self.card_class = card_class
        self.attack_style = attack_style
        self.life = life
        self.speed = speed
        self.keywords = set(keywords or [])
        self.raw_ability_text = raw_ability_text

        # estado de jogo
        self.owner: Optional[Player] = None
        self.ja_atacou = False
        self.summoned_this_turn = False
        self.buff_ataque = 0
        self.buff_defesa = 0

    def atk_total(self, game: "Game" = None) -> int:
        base = self.attack + self.buff_ataque
        if game:
            base += game.continuous.get_atk_bonus(self)
        return base

    def def_total(self, game: "Game" = None) -> int:
        base = self.defense + self.buff_defesa
        if game:
            base += game.continuous.get_def_bonus(self)
        return base

    def has_keyword(self, kw: str) -> bool:
        return kw in self.keywords

    def copy_for_deck(self) -> "TCGCard":
        c = copy.deepcopy(self)
        c.id = str(uuid.uuid4())
        c.owner = None
        c.ja_atacou = False
        c.summoned_this_turn = False
        c.buff_ataque = 0
        c.buff_defesa = 0
        return c

    def to_dict(self, game: "Game" = None) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.card_type,
            "atk": self.atk_total(game),
            "def": self.def_total(game),
            "cost": self.cost,
            "ability": self.raw_ability_text or " | ".join(a.text for a in self.abilities),
            "class": self.card_class,
            "attack_style": self.attack_style,
            "life": self.life,
            "keywords": list(self.keywords),
            "ja_atacou": self.ja_atacou,
            "summoned_this_turn": self.summoned_this_turn,
            "speed": self.speed.value if isinstance(self.speed, Speed) else self.speed,
        }

    def __repr__(self):
        return f"<TCGCard {self.name} ({self.card_type})>"


# ============================================================
# DEFINIÇÕES DAS CARTAS (usando o novo sistema)
# ============================================================

# --- LÍDER ---
rogen = TCGCard(
    name="Rogen",
    card_type="Líder",
    attack=5000,
    defense=5000,
    cost=0,
    card_class="Mágico",
    attack_style="Especial",
    life=5,
    speed=Speed.INSTANT,
    raw_ability_text="Quando o líder for atacar você pode olhar as 5 primeiras cartas do seu baralho e colocar uma na mão (precisa de 3 energias)",
    abilities=[
        LookAndTakeAbility(look=5, energy_cost=3, timing=Timing.ON_ATTACK),
    ],
)

# --- TERRENO ---
biblioteca = TCGCard(
    name="A Grande Biblioteca",
    card_type="Terreno",
    cost=0,
    card_class="Mágico",
    raw_ability_text="Quando colocado em campo, aumenta em +1000 o dano de ataque de cartas do tipo Mágico",
    abilities=[
        ContinuousModifier(
            filter_fn=lambda c: "Mágico" in str(c.card_class),
            atk=1000,
            text="+1000 ATK a cartas Mágico",
        ),
    ],
)

# --- ITENS ---
tome = TCGCard(
    name="Tomo da Sabedoria",
    card_type="Item",
    cost=0,
    card_class="Mágico",
    raw_ability_text="Adiciona a classe Mágico a uma carta à escolha",
    abilities=[
        AddClassAbility(class_name="Mágico", timing=Timing.ON_ENTER_FIELD),
    ],
)

# --- EFEITOS ---
annul = TCGCard(
    name="Anular",
    card_type="Efeito",
    cost=4,
    card_class="Mágico",
    speed=Speed.INSTANT,
    raw_ability_text="Counter: anula uma carta de efeito do topo do deck do oponente",
    abilities=[
        CounterEffectAbility(look=3, timing=Timing.ON_PLAY, speed=Speed.INSTANT),
    ],
)

assembly = TCGCard(
    name="Assembleia",
    card_type="Efeito",
    cost=2,
    card_class="Mágico",
    speed=Speed.INSTANT,
    raw_ability_text="Concede +3000 DEF temporário a um aliado (apenas neste turno)",
    abilities=[
        BuffAbility(defense=3000, permanent=False, turns=1, timing=Timing.ON_PLAY, speed=Speed.INSTANT),
    ],
)

graduation = TCGCard(
    name="Graduação",
    card_type="Efeito",
    cost=2,
    card_class="Mágico",
    speed=Speed.SORCERY,
    raw_ability_text="Aumenta permanentemente o ATK de um Estudante de Magia em +2000",
    abilities=[
        BuffAbility(atk=2000, permanent=True, filter_name="Estudante de Magia", timing=Timing.ON_PLAY),
    ],
)

channel = TCGCard(
    name="Canalizar",
    card_type="Efeito",
    cost=6,
    card_class="Mágico",
    speed=Speed.SORCERY,
    raw_ability_text="Dá +6000 ATK a um personagem, ele vai para o descarte (efeito de sacrifício)",
    abilities=[
        SacrificeBuffAbility(atk=6000, timing=Timing.ON_PLAY),
    ],
)

# --- ESPECIAIS ---
rodote = TCGCard(
    name="Rodote",
    card_type="Especial",
    attack=4000,
    defense=5000,
    cost=3,
    card_class="Mágico",
    attack_style="Especial",
    raw_ability_text="Permite prever as próximas 3 primeiras cartas do baralho inimigo",
    abilities=[
        RevealOpponentTopAbility(amount=3, timing=Timing.ON_ENTER_FIELD),
    ],
)

mabo = TCGCard(
    name="Mabo",
    card_type="Especial",
    attack=7000,
    defense=3000,
    cost=8,
    card_class="Mágico",
    attack_style="Especial",
    raw_ability_text="Quando em campo, anula efeitos direcionados ao líder",
    abilities=[
        ProtectLeaderAbility(),
        ContinuousModifier(
            filter_fn=lambda c: False,  # só existe para registro
            text="Protege o líder",
        ),
    ],
)

drogoon = TCGCard(
    name="Drogoon",
    card_type="Especial",
    attack=6000,
    defense=6000,
    cost=6,
    card_class="Mágico",
    attack_style="Físico",
    keywords=["Defender"],
    raw_ability_text="Característica: Defensor",
    abilities=[],
)

bomia = TCGCard(
    name="Bomia",
    card_type="Especial",
    attack=2000,
    defense=2000,
    cost=4,
    card_class="Mágico",
    attack_style="Especial",
    raw_ability_text="Quando você compra uma carta com ele em campo, você pode transformá-la em uma carta de vida",
    abilities=[
        TransformDrawToLifeAbility(),
    ],
)

# --- COMUNS ---
estudante = TCGCard(
    name="Estudante de Magia",
    card_type="Comum",
    attack=3000,
    defense=2000,
    cost=2,
    card_class="Mágico",
    attack_style="Especial",
    raw_ability_text="Com 2 cartas de Energia nele você pode comprar um Tomo da Sabedoria | Counter: 1000",
    abilities=[],
)

helbo = TCGCard(
    name="Helbo",
    card_type="Comum",
    attack=2000,
    defense=3000,
    cost=2,
    card_class="Especialista",
    attack_style="Físico",
    keywords=["Defender"],
    raw_ability_text="Restaura uma carta de Energia | Característica: Defensor | Counter: 1000",
    abilities=[],
)

marbo = TCGCard(
    name="Marbo",
    card_type="Comum",
    attack=4000,
    defense=2000,
    cost=3,
    card_class="Lutador",
    attack_style="Físico",
    keywords=["Haste"],
    raw_ability_text="Pode atacar no mesmo turno que for colocado em campo | Característica: Apressado | Counter: 1000",
    abilities=[],
)

professor = TCGCard(
    name="Professor de Magia",
    card_type="Comum",
    attack=3000,
    defense=3000,
    cost=3,
    card_class="Mágico",
    attack_style="Especial",
    raw_ability_text="Counter: 2000",
    abilities=[],
)


# ============================================================
# CRIADOR DE BARALHO (sem cartas de Energia)
# ============================================================

def criar_deck() -> List[TCGCard]:
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
        [estudante] * 4 +
        [helbo] * 4 +
        [marbo] * 4 +
        [professor] * 4
    )
    return [c.copy_for_deck() for c in base]


# ============================================================
# JOGADOR
# ============================================================

class Player:
    def __init__(self, name: str, deck_cards: List[TCGCard], leader_card: TCGCard, seed: int = None):
        self.name = name
        self.deck = [c.copy_for_deck() for c in deck_cards]
        self.hand: List[TCGCard] = []
        self.field: List[TCGCard] = []
        self.grave: List[TCGCard] = []
        # Energia inicial fixa: 2
        self.energy_pool = 2
        self.leader = copy.deepcopy(leader_card)
        self.leader.owner = self
        self.leader.ja_atacou = False
        self.leader_life = self.leader.life
        self.vivo = True
        self.life: List[TCGCard] = []  # cartas de vida (viradas)

        if seed is not None:
            random.seed(seed)
        random.shuffle(self.deck)
        self.prepare_life_from_deck()

    def prepare_life_from_deck(self):
        self.life = []
        for _ in range(self.leader.life):
            if self.deck:
                self.life.append(self.deck.pop(0))

    def reset_for_new_turn(self, game: "Game" = None):
        for c in self.field:
            c.ja_atacou = False
        self.leader.ja_atacou = False
        if game:
            game.continuous.tick_end_of_turn(self)

    def draw(self, n: int = 1) -> List[Dict]:
        """
        Compra n cartas.
        Se Bomia estiver em campo, a primeira carta comprada nesta sequência vira vida.
        """
        drawn = []
        bomia_present = any(c.name == "Bomia" for c in self.field)
        for i in range(n):
            if not self.deck:
                break
            card = self.deck.pop(0)
            if bomia_present and i == 0:
                self.life.append(card)
                drawn.append({"moved_to": "life", "card": card})
            else:
                self.hand.append(card)
                drawn.append({"moved_to": "hand", "card": card})
        return drawn

    def draw_initial_hand(self, hand_size: int = 5) -> List[Dict]:
        self.hand = []
        while len(self.hand) < hand_size and self.deck:
            card = self.deck.pop(0)
            self.hand.append(card)

        def has_non_effect():
            return any(c.card_type != "Efeito" for c in self.hand)

        def has_attacker():
            return any((getattr(c, "attack", 0) + getattr(c, "buff_ataque", 0)) > 0 for c in self.hand)

        attempts = 0
        max_attempts = 200
        while (not has_non_effect() or not has_attacker()) and attempts < max_attempts and self.deck:
            attempts += 1
            swap_idx = None
            for i, dc in enumerate(self.deck):
                if not has_non_effect() and dc.card_type != "Efeito":
                    swap_idx = i
                    break
                if not has_attacker() and getattr(dc, "attack", 0) > 0:
                    swap_idx = i
                    break
            if swap_idx is None:
                break
            hand_swap_idx = next((hi for hi, hc in enumerate(self.hand) if hc.card_type == "Efeito"), 0)
            hand_card = self.hand[hand_swap_idx]
            deck_card = self.deck.pop(swap_idx)
            self.hand[hand_swap_idx] = deck_card
            self.deck.append(hand_card)
        return [c.to_dict() for c in self.hand]

    def generate_energy(self, amount: int = 1) -> int:
        """Adiciona energia passiva (ou de outras fontes futuras)."""
        self.energy_pool += amount
        return self.energy_pool

    def can_play(self, card_index: int) -> bool:
        if not (0 <= card_index < len(self.hand)):
            return False
        return self.energy_pool >= self.hand[card_index].cost

    def play_card(self, card_index: int, game: "Game", targets: Dict = None) -> Dict:
        if not (0 <= card_index < len(self.hand)):
            raise IndexError("card_index out of range")
        card = self.hand[card_index]
        if self.energy_pool < card.cost:
            raise ValueError("Insufficient energy")

        self.energy_pool -= card.cost
        card.owner = self
        targets = targets or {}

        # --- Efeito (vai para a stack) ---
        if card.card_type == "Efeito":
            ability = next((a for a in card.abilities if a.timing == Timing.ON_PLAY), None)
            if ability is None:
                self.hand.pop(card_index)
                self.grave.append(card)
                return {"action": "effect_no_ability", "card": card.to_dict(game)}
            game.push(ability, self, card, targets)
            self.hand.pop(card_index)
            return {"action": "effect_on_stack", "card": card.to_dict(game), "target": targets}

        # --- Unidades / Terrenos / Itens ---
        if card.card_type in ("Comum", "Especial", "Terreno", "Item"):
            card.ja_atacou = False
            card.summoned_this_turn = "Haste" not in card.keywords
            self.field.append(card)
            self.hand.pop(card_index)

            # Registra continuous
            for ab in card.abilities:
                if ab.timing == Timing.CONTINUOUS:
                    game.continuous.add(card, ab)

            # Emite evento
            game.events.emit("card_entered_field", card=card, controller=self, game=game)

            result = {"action": "card_to_field", "card": card.to_dict(game)}

            # Resolve ON_ENTER_FIELD (ou coloca na stack se Instant)
            for ab in card.abilities:
                if ab.timing == Timing.ON_ENTER_FIELD:
                    if ab.speed == Speed.INSTANT:
                        game.push(ab, self, card, targets)
                    else:
                        res = ab.resolve(game, self, card, targets, {})
                        result.update(res)

            return result

        # fallback
        self.field.append(card)
        self.hand.pop(card_index)
        return {"action": "card_to_field", "card": card.to_dict(game)}

    def receive_damage(self, amount: int = 1, source=None) -> Dict:
        for _ in range(amount):
            if not self.life:
                self.vivo = False
                break
            card_life = self.life.pop(0)
            self.hand.append(card_life)
        return {"remaining_life": len(self.life), "alive": self.vivo}

    def find_field_card_by_id(self, card_id: str) -> Optional[TCGCard]:
        for c in self.field:
            if c.id == card_id:
                return c
        return None

    def remove_field_card(self, card: TCGCard) -> bool:
        if card in self.field:
            self.field.remove(card)
            self.grave.append(card)
            return True
        return False

    def end_turn_reset(self, game: "Game" = None):
        self.reset_for_new_turn(game)
        return True

    def get_state(self, game: "Game" = None) -> Dict:
        return {
            "name": self.name,
            "hand": [c.to_dict(game) for c in self.hand],
            "field": [c.to_dict(game) for c in self.field],
            "grave": [c.to_dict(game) for c in self.grave],
            "deck_count": len(self.deck),
            "life_count": len(self.life),
            "energy": self.energy_pool,
            "leader": self.leader.name,
            "leader_life": self.leader_life,
            "alive": self.vivo,
        }


# ============================================================
# STACK ITEM
# ============================================================

class StackItem:
    def __init__(self, ability: Ability, controller: Player, source: TCGCard,
                 targets: Dict = None, context: Dict = None):
        self.ability = ability
        self.controller = controller
        self.source = source
        self.targets = targets or {}
        self.context = context or {}


# ============================================================
# MOTOR DO JOGO
# ============================================================

class Game:
    def __init__(self, players: List[Player]):
        if len(players) < 2:
            raise ValueError("At least two players required")
        self.players = players
        self.active_player_idx = 0
        self.turn = 1
        self.stack: List[StackItem] = []
        self.phase = "NOT_STARTED"
        self.winner = None
        self.events = EventBus()
        self.continuous = ContinuousEffectManager()

    # ----- propriedades -----
    @property
    def active_player(self) -> Player:
        return self.players[self.active_player_idx]

    @property
    def non_active_player(self) -> Player:
        return self.players[1 - self.active_player_idx]

    def set_active_player(self, player_idx: int):
        if not (0 <= player_idx < len(self.players)):
            raise IndexError("player_idx out of range")
        self.active_player_idx = player_idx

    # ----- fluxo de turnos -----
    def begin_turn(self) -> Dict:
        """
        Início de turno:
        - Reseta flags de ataque
        - +1 energia passiva (sempre)
        - Compra 1 carta
        """
        p = self.active_player
        self.phase = "BEGIN"
        for c in p.field:
            c.ja_atacou = False
        p.leader.ja_atacou = False

        # Geração passiva fixa: +1 por turno
        p.generate_energy(1)
        p.draw(1)
        self._check_player_vitality()
        self.events.emit("turn_begin", player=p, game=self)
        return {
            "phase": self.phase,
            "player": p.name,
            "energy_gained": 1,
            "energy": p.energy_pool,
        }

    def main_phase(self) -> Dict:
        self.phase = "MAIN"
        return {"phase": self.phase, "player": self.active_player.name}

    def attack_phase(self) -> Dict:
        self.phase = "ATTACK"
        return {"phase": self.phase, "player": self.active_player.name}

    def end_turn(self) -> Dict:
        self.phase = "END"
        self.active_player.end_turn_reset(self)
        self.events.emit("turn_end", player=self.active_player, game=self)
        self.active_player_idx = 1 - self.active_player_idx
        self.turn += 1
        self._check_player_vitality()
        return {"phase": self.phase, "next_player": self.active_player.name, "turn": self.turn}

    def _check_player_vitality(self):
        for p in self.players:
            if not p.vivo:
                living = [pl for pl in self.players if pl.vivo]
                self.winner = living[0].name if living else None

    # ----- Stack -----
    def push(self, ability: Ability, controller: Player, source: TCGCard, targets: Dict = None):
        self.stack.append(StackItem(ability, controller, source, targets))

    def resolve_top_of_stack(self) -> Dict:
        if not self.stack:
            return {"resolved": None}

        item = self.stack.pop()
        card = item.source
        controller = item.controller
        targets = item.targets

        # Proteção de líder (Mabo)
        if targets and isinstance(targets, dict):
            tgt_player = targets.get("target_player")
            tgt_part = targets.get("target_part")
            if tgt_player and tgt_part == "leader":
                if self.continuous.has_protect_leader(tgt_player):
                    if card not in controller.grave:
                        controller.grave.append(card)
                    return {"canceled_by_mabo": True, "card": card.name}

        result = item.ability.resolve(self, controller, card, targets, item.context)

        if card.card_type == "Efeito" and card not in controller.grave:
            controller.grave.append(card)

        return {"resolved": card.name, "result": result, "controller": controller.name}

    def resolve_all_stack(self) -> List[Dict]:
        results = []
        while self.stack:
            results.append(self.resolve_top_of_stack())
        return results

    def get_stack_snapshot(self) -> List[Dict]:
        return [
            {
                "ability": item.ability.name,
                "card": item.source.to_dict(self),
                "controller": item.controller.name,
                "targets": {k: (v.name if hasattr(v, "name") else v) for k, v in item.targets.items()},
            }
            for item in self.stack
        ]

    # ----- Ataques -----
    def attack_with_leader(self, defending_player: Player, use_ability: bool = False) -> Dict:
        attacker_player = self.active_player
        leader = attacker_player.leader

        if leader.ja_atacou:
            raise ValueError("Leader already attacked this turn")
        if leader.atk_total(self) <= 0:
            raise ValueError("Leader has no attack power")

        ability_result = None
        if use_ability:
            ab = next((a for a in leader.abilities if a.timing == Timing.ON_ATTACK), None)
            if ab and ab.can_activate(self, attacker_player, leader, {}):
                ability_result = ab.resolve(self, attacker_player, leader, {}, {})
            else:
                ability_result = {"ability_used": False, "reason": "cannot activate"}

        leader.ja_atacou = True
        damage_result = defending_player.receive_damage(1, source=leader.name)
        return {
            "leader_attack": leader.name,
            "ability_result": ability_result,
            "damage": damage_result,
        }

    def attack_leader(self, attacker_id: str, defending_player: Player) -> Dict:
        attacker = next((c for c in self.active_player.field if c.id == attacker_id), None)
        if attacker is None:
            raise ValueError("Attacker not found on field")
        if attacker.atk_total(self) <= 0:
            raise ValueError("Attacker has no attack power")
        if attacker.ja_atacou:
            raise ValueError("Attacker has already attacked this turn")
        if attacker.summoned_this_turn:
            raise ValueError("Attacker has summoning sickness")

        result = defending_player.receive_damage(1, source=attacker.name)
        attacker.ja_atacou = True
        return {"attacker": attacker.name, "defender": defending_player.name, "result": result}

    def attack_card(self, attacker_id: str, defender_id: str, defending_player: Player) -> Dict:
        attacker = next((c for c in self.active_player.field if c.id == attacker_id), None)
        if not attacker:
            raise ValueError("Attacker not found")
        defender = next((c for c in defending_player.field if c.id == defender_id), None)
        if not defender:
            raise ValueError("Defender not found")
        if attacker.atk_total(self) <= 0:
            raise ValueError("Attacker has no attack power")
        if attacker.ja_atacou:
            raise ValueError("Attacker already attacked")
        if attacker.summoned_this_turn:
            raise ValueError("Attacker has summoning sickness")

        atk = attacker.atk_total(self)
        defe = defender.def_total(self)
        if atk >= defe:
            defending_player.remove_field_card(defender)
            self.continuous.remove_from(defender)
            attacker.ja_atacou = True
            return {"winner": attacker.name, "destroyed": defender.name}
        else:
            attacker.ja_atacou = True
            return {"winner": None, "note": "attack failed"}

    # ----- utilitários -----
    def get_game_state(self) -> Dict:
        return {
            "turn": self.turn,
            "active_player": self.active_player.name,
            "phase": self.phase,
            "stack_size": len(self.stack),
            "stack": self.get_stack_snapshot(),
            "players": [p.get_state(self) for p in self.players],
            "winner": self.winner,
        }


# ============================================================
# EXEMPLO DE USO
# ============================================================

if __name__ == "__main__":
    deck_list = criar_deck()

    p1 = Player("Jogador1", deck_list, rogen, seed=42)
    p2 = Player("Jogador2", deck_list, rogen, seed=43)

    p1.draw_initial_hand(5)
    p2.draw_initial_hand(5)

    game = Game([p1, p2])

    print("=== Início do turno 1 ===")
    print(game.begin_turn())
    print(f"Energia do Jogador1 após begin_turn: {p1.energy_pool}")  # deve ser 3 (2 inicial + 1)

    # Joga Rodote (revela topo do oponente) se houver energia suficiente
    for idx, c in list(enumerate(p1.hand)):
        if c.name == "Rodote" and p1.can_play(idx):
            print("Jogando Rodote:", p1.play_card(idx, game, targets={"opponent": p2}))
            break

    # Joga Anular na stack
    for idx, c in list(enumerate(p1.hand)):
        if c.name == "Anular" and p1.can_play(idx):
            print("Jogando Anular:", p1.play_card(idx, game, targets={"opponent": p2, "index": 0}))
            break

    print("\n=== Resolvendo stack ===")
    print(game.resolve_all_stack())

    print("\n=== Estado final ===")
    import pprint
    pprint.pprint(game.get_game_state())

 
 
 
 
# =====================================================================
# 2. CÓDIGO DA INTERFACE GRÁFICA (PYGAME)
# =====================================================================
 
pygame.init()
 
# Configurações da Tela
WIDTH, HEIGHT = 1280, 720
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("TCG - Arena de Magia")
clock = pygame.time.Clock()
 
# Cores
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
DARK_GRAY = (50, 50, 50)
BLUE = (70, 130, 180)
RED = (200, 50, 50)
GREEN = (50, 200, 50)
GOLD = (218, 165, 32)
 
# Fontes
font_small = pygame.font.SysFont("Arial", 12)
font = pygame.font.SysFont("Arial", 16, bold=True)
font_large = pygame.font.SysFont("Arial", 24, bold=True)
 
def draw_text(surface, text, x, y, color=BLACK, f=font):
    img = f.render(text, True, color)
    surface.blit(img, (x, y))
 
def draw_card(surface, card, x, y, is_playable=False):
    rect = pygame.Rect(x, y, 100, 140)
    
    # Borda brilha se puder jogar ou atacar
    border_color = GOLD if is_playable else BLACK
    pygame.draw.rect(surface, WHITE, rect)
    pygame.draw.rect(surface, border_color, rect, 3)
 
    # Informações da carta
    draw_text(surface, card.name[:12], x+5, y+5, BLUE, font_small)
    draw_text(surface, f"Tipo: {card.card_type}", x+5, y+25, BLACK, font_small)
    draw_text(surface, f"Custo: {card.cost}", x+5, y+45, RED, font)
 
    if card.card_type in ["Comum", "Especial"]:
        draw_text(surface, f"ATK: {card.atk_total()}", x+5, y+100, BLACK, font_small)
        draw_text(surface, f"DEF: {card.def_total()}", x+5, y+115, BLACK, font_small)
    elif card.card_type == "Energia":
        draw_text(surface, f"+{card.energy_generated} EN", x+5, y+100, GREEN, font)
        
    if card.ja_atacou:
        pygame.draw.rect(surface, (255, 0, 0, 100), rect, 0) # Tinta vermelha se atacou
        
    return rect
 
def draw_player_info(surface, player, x, y):
    draw_text(surface, f"{player.name}", x, y, WHITE, font_large)
    draw_text(surface, f"Líder: {player.leader.name}", x, y+30, WHITE, font)
    draw_text(surface, f"Vida: {len(player.life)}", x, y+50, GREEN if len(player.life) > 2 else RED, font)
    draw_text(surface, f"Energia: {player.energy_pool}", x, y+70, BLUE, font)
    draw_text(surface, f"Deck: {len(player.deck)} | Descarte: {len(player.grave)}", x, y+90, GRAY, font_small)
 
def main():
    # Inicializa o Jogo
    p1 = Player("Jogador 1", criar_deck(), rogen)
    p2 = Player("Jogador 2 (Oponente)", criar_deck(), rogen)
    p1.draw_initial_hand(5)
    p2.draw_initial_hand(5)
    
    game = Game([p1, p2])
    game.begin_turn()
 
    running = True
    message = ""
    message_timer = 0
 
    # Retângulos para interação global
    btn_next_phase = pygame.Rect(1050, 300, 200, 50)
    btn_leader_p2 = pygame.Rect(1050, 50, 200, 100) # Área do Líder Inimigo
    
    selected_attacker = None
 
    while running:
        screen.fill(DARK_GRAY)
        
        active_p = game.active_player
        
        # Desenha Informações dos Jogadores
        draw_player_info(screen, p2, 1050, 50)   # P2 no topo direito
        draw_player_info(screen, p1, 1050, 500)  # P1 na base direita
        
        # Desenha Botão de Próxima Fase
        pygame.draw.rect(screen, GOLD if game.phase == "MAIN" else RED, btn_next_phase)
        draw_text(screen, f"AVANÇAR FASE", 1080, 315, BLACK, font)
        draw_text(screen, f"Fase Atual: {game.phase}", 1050, 360, WHITE, font)
        draw_text(screen, f"Turno de: {active_p.name}", 1050, 380, WHITE, font)
 
        # Atualiza Retângulos Clicáveis das Cartas
        hand_rects = []
        field_rects_p1 = []
        field_rects_p2 = []
 
        # Renderiza Mão P1
        for i, card in enumerate(p1.hand):
            is_playable = (game.active_player == p1 and game.phase == "MAIN" and p1.can_play(i))
            rect = draw_card(screen, card, 50 + (i * 110), 550, is_playable)
            hand_rects.append((rect, i))
 
        # Renderiza Campo P1
        for i, card in enumerate(p1.field):
            is_playable = (game.active_player == p1 and game.phase == "ATTACK" and not card.ja_atacou)
            rect = draw_card(screen, card, 50 + (i * 110), 380, is_playable)
            field_rects_p1.append((rect, card))
 
        # Renderiza Campo P2
        for i, card in enumerate(p2.field):
            rect = draw_card(screen, card, 50 + (i * 110), 200, False)
            field_rects_p2.append((rect, card))
 
        # Renderiza Mão P2 (Verso)
        for i in range(len(p2.hand)):
            pygame.draw.rect(screen, BLUE, (50 + (i * 110), 20, 100, 140))
            pygame.draw.rect(screen, WHITE, (50 + (i * 110), 20, 100, 140), 2)
            draw_text(screen, "TCG", 80 + (i * 110), 80, WHITE, font)
 
        # Sistema de mensagens flutuantes na tela
        if message and pygame.time.get_ticks() < message_timer:
            draw_text(screen, message, 500, 350, GOLD, font_large)
            
        # Tela de Vitória
        if game.winner:
            screen.fill((0,0,0, 128))
            draw_text(screen, f"O VENCEDOR É: {game.winner}!", 450, 300, GOLD, font_large)
            pygame.display.flip()
            pygame.time.delay(5000)
            break
 
        # TRATAMENTO DE EVENTOS (Cliques)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                pos = event.pos
                
                # Clique no Botão de Próxima Fase
                if btn_next_phase.collidepoint(pos):
                    game.next_phase()
                    selected_attacker = None
                    message = "Mudança de Fase!"
                    message_timer = pygame.time.get_ticks() + 1500
 
                # Ações do Jogador 1
                if game.active_player == p1:
                    
                    if game.phase == "MAIN":
                        for rect, idx in hand_rects:
                            if rect.collidepoint(pos):
                                if p1.can_play(idx):
                                    p1.play_card(idx)
                                    message = "Carta Jogada!"
                                else:
                                    message = "Energia Insuficiente!"
                                message_timer = pygame.time.get_ticks() + 1500
                    
                    elif game.phase == "ATTACK":
                        for rect, card in field_rects_p1:
                            if rect.collidepoint(pos):
                                if not card.ja_atacou:
                                    selected_attacker = card
                                    message = f"{card.name} pronto para atacar!"
                                    message_timer = pygame.time.get_ticks() + 1000
                                else:
                                    message = "Carta já atacou este turno!"
                                    message_timer = pygame.time.get_ticks() + 1000
                                    
                        # Se tem aliado selecionado e clica no líder inimigo
                        if selected_attacker and btn_leader_p2.collidepoint(pos):
                            success = game.attack_leader(selected_attacker)
                            if success:
                                message = "Ataque Direto ao Líder!"
                            else:
                                message = "Este aliado não pode atacar neste turno!"
                            selected_attacker = None
                            message_timer = pygame.time.get_ticks() + 1500
 
        pygame.display.flip()
        clock.tick(30)
 
    pygame.quit()
    sys.exit()
 
if __name__ == "__main__":
    main()
 
