/**
 * Card Playing System Tests
 * 
 * Tests cost validation, cost payment, and card playing mechanics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  canAffordCost, 
  payCost, 
  canPlayCard, 
  playUnit, 
  playSpell
} from '../../src/core/cardPlaying.js';
import { GameState, getPlayer, updatePlayer } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {  
  Cost, 
  Domain, 
  Phase, 
  Energy, 
  cardId, 
  playerId,
  CardCategory,
  Might,
  ChainStateType
} from '../../src/types/primitives.js';
import { UnitCard, SpellCard } from '../../src/types/cards.js';
import { chainExists } from '../../src/core/chain.js';

describe('Cost Validation', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should allow playing card when player can afford cost', () => {
    const player = getPlayer(state, p1)!;
    const costAffordable: Cost = {
      energy: 2 as Energy,
      power: [{ domain: Domain.Mind, amount: 2 }],
    };

    // Give player enough resources
    const updatedPlayer = {
      ...player,
      energy: 3 as Energy,
      runePool: [{ domain: Domain.Mind, amount: 2 }],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    expect(canAffordCost(getPlayer(state, p1)!, costAffordable)).toBe(true);
  });

  it('should prevent playing card with insufficient energy', () => {
    const player = getPlayer(state, p1)!;
    const costExpensive: Cost = {
      energy: 5 as Energy,
      power: [],
    };

    const updatedPlayer = {
      ...player,
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);

    expect(canAffordCost(getPlayer(state, p1)!, costExpensive)).toBe(false);
  });

  it('should prevent playing card with insufficient power', () => {
    const player = getPlayer(state, p1)!;
    const costRequiresPower: Cost = {
      energy: 0 as Energy,
      power: [{ domain: Domain.Chaos, amount: 3 }],
    };

    const updatedPlayer = {
      ...player,
      runePool: [{ domain: Domain.Chaos, amount: 1 }],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    expect(canAffordCost(getPlayer(state, p1)!, costRequiresPower)).toBe(false);
  });
});

describe('Cost Payment', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should deduct energy when paying cost', () => {
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      energy: 5 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const cost: Cost = { energy: 3 as Energy, power: [] };
    const result = payCost(state, p1, cost);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.energy).toBe(2); // 5 - 3
    }
  });

  it('should deduct power when paying cost', () => {
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      runePool: [
        { domain: Domain.Mind, amount: 3 },
        { domain: Domain.Chaos, amount: 2 },
      ],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const cost: Cost = {
      energy: 0 as Energy,
      power: [{ domain: Domain.Mind, amount: 2 }],
    };
    const result = payCost(state, p1, cost);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      const mindPower = newPlayer.runePool.filter(p => p.domain === Domain.Mind);
      const totalMind = mindPower.reduce((sum, p) => sum + p.amount, 0);
      expect(totalMind).toBe(1); // 3 - 2
    }
  });

  it('should fail when player cannot afford cost', () => {
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      energy: 1 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const cost: Cost = { energy: 3 as Energy, power: [] };
    const result = payCost(state, p1, cost);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INSUFFICIENT_RESOURCES');
    }
  });
});

describe('Play Validation', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Action });
  });

  it('should allow playing card from hand during your turn', () => {
    const card: UnitCard = {
      id: cardId('card1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 1 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [card.id],
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(card.id, card);

    const result = canPlayCard(state, card.id, p1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('should prevent playing card not in hand', () => {
    const card: UnitCard = {
      id: cardId('card1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 1 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      deck: [card.id], // Card in deck, not hand
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(card.id, card);

    const result = canPlayCard(state, card.id, p1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  it('should prevent playing opponent\'s cards', () => {
    const card: UnitCard = {
      id: cardId('card1'),
      owner: p2, // Owned by opponent
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 1 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [card.id],
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(card.id, card);

    const result = canPlayCard(state, card.id, p1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });
});

describe('Playing Units', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Action });
  });

  it('should move unit to base when played', () => {
    const card: UnitCard = {
      id: cardId('unit1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [{ domain: Domain.Mind, amount: 1 }] },
      might: 3 as Might,
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [card.id],
      energy: 3 as Energy,
      runePool: [{ domain: Domain.Mind, amount: 2 }],
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(card.id, card);

    const result = playUnit(state, card.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.hand).not.toContain(card.id);
      expect(newPlayer.base.has(card.id as any)).toBe(true);
    }
  });

  it('should deduct cost when playing unit', () => {
    const card: UnitCard = {
      id: cardId('unit1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [{ domain: Domain.Mind, amount: 1 }] },
      might: 3 as Might,
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [card.id],
      energy: 3 as Energy,
      runePool: [{ domain: Domain.Mind, amount: 2 }],
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(card.id, card);

    const result = playUnit(state, card.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.energy).toBe(1); // 3 - 2
      const mindPower = newPlayer.runePool.filter(p => p.domain === Domain.Mind);
      const totalMind = mindPower.reduce((sum, p) => sum + p.amount, 0);
      expect(totalMind).toBe(1); // 2 - 1
    }
  });

  it('should track cards played this turn', () => {
    const card: UnitCard = {
      id: cardId('unit1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 1 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [card.id],
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(card.id, card);

    const result = playUnit(state, card.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.cardsPlayedThisTurn).toContain(card.id);
    }
  });
});

describe('Playing Spells with Chain Integration', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Action });
  });

  it('should add spell to Chain as Pending item when played (Rule 351)', () => {
    const spell: SpellCard = {
      id: cardId('spell1'),
      owner: p1,
      name: 'Test Spell',
      category: CardCategory.Spell,
      cost: { energy: 2 as Energy, power: [] },
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      instructions: [],
      rulesText: 'Draw a card',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [spell.id],
      energy: 3 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(spell.id, spell);

    const result = playSpell(state, spell.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Chain should exist and contain the spell
      expect(chainExists(result.value)).toBe(true);
      expect(result.value.chainState.items.length).toBe(1);
      
      const chainItem = result.value.chainState.items[0];
      expect(chainItem.type).toBe('spell');
      expect(chainItem.source).toBe(spell.id);
      expect(chainItem.controller).toBe(p1);
      // Note: Item is finalized by Cleanup (Rule 322.8) after adding to Chain
      expect(chainItem.pending).toBe(false); // Finalized by Cleanup step 8
    }
  });

  it('should set state to Closed when spell added to Chain (Rule 330)', () => {
    const spell: SpellCard = {
      id: cardId('spell1'),
      owner: p1,
      name: 'Test Spell',
      category: CardCategory.Spell,
      cost: { energy: 1 as Energy, power: [] },
      domains: [Domain.Chaos],
      keywords: [],
      supertypes: [],
      tags: [],
      instructions: [],
      rulesText: 'Deal 3 damage',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [spell.id],
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(spell.id, spell);

    // Initially Open State
    expect(state.turnState.chainState).toBe(ChainStateType.Open);

    const result = playSpell(state, spell.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should transition to Closed State (Rule 330.1)
      expect(result.value.turnState.chainState).toBe(ChainStateType.Closed);
    }
  });

  it('should deduct cost when playing spell (Rule 354)', () => {
    const spell: SpellCard = {
      id: cardId('spell1'),
      owner: p1,
      name: 'Test Spell',
      category: CardCategory.Spell,
      cost: { energy: 2 as Energy, power: [{ domain: Domain.Mind, amount: 1 }] },
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      instructions: [],
      rulesText: 'Draw 2 cards',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [spell.id],
      energy: 3 as Energy,
      runePool: [{ domain: Domain.Mind, amount: 2 }],
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(spell.id, spell);

    const result = playSpell(state, spell.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.energy).toBe(1); // 3 - 2
      const mindPower = newPlayer.runePool.filter(p => p.domain === Domain.Mind);
      const totalMind = mindPower.reduce((sum, p) => sum + p.amount, 0);
      expect(totalMind).toBe(1); // 2 - 1
    }
  });

  it('should track spell in cardsPlayedThisTurn', () => {
    const spell: SpellCard = {
      id: cardId('spell1'),
      owner: p1,
      name: 'Test Spell',
      category: CardCategory.Spell,
      cost: { energy: 1 as Energy, power: [] },
      domains: [Domain.Fury],
      keywords: [],
      supertypes: [],
      tags: [],
      instructions: [],
      rulesText: 'Deal damage',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [spell.id],
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(spell.id, spell);

    const result = playSpell(state, spell.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.cardsPlayedThisTurn).toContain(spell.id);
    }
  });

  it('should set Active Player to spell controller (Rule 332.1)', () => {
    const spell: SpellCard = {
      id: cardId('spell1'),
      owner: p1,
      name: 'Test Spell',
      category: CardCategory.Spell,
      cost: { energy: 1 as Energy, power: [] },
      domains: [Domain.Mind],
      keywords: [],
      supertypes: [],
      tags: [],
      instructions: [],
      rulesText: 'Draw a card',
    };

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [spell.id],
      energy: 2 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(spell.id, spell);

    const result = playSpell(state, spell.id, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Active Player should be set to spell controller (Rule 332.1)
      expect(result.value.turnState.activePlayer).toBe(p1);
      expect(result.value.turnState.priority).toBe(p1);
    }
  });

  it('should handle targeted spells with targetIds (Rule 352)', () => {
    const spell: SpellCard = {
      id: cardId('spell1'),
      owner: p1,
      name: 'Kill Spell',
      category: CardCategory.Spell,
      cost: { energy: 3 as Energy, power: [] },
      domains: [Domain.Chaos],
      keywords: [],
      supertypes: [],
      tags: [],
      instructions: [],
      rulesText: 'Kill a unit',
    };

    const targetUnit = cardId('unit1');

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      hand: [spell.id],
      energy: 4 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);
    state.cards.set(spell.id, spell);

    const result = playSpell(state, spell.id, p1, [targetUnit]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Chain item should store targets (Rule 352)
      const chainItem = result.value.chainState.items[0];
      expect(chainItem.targetIds).toContain(targetUnit);
    }
  });
});
