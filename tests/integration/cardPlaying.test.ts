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
  playSpell,
  playGear 
} from '../../src/core/cardPlaying.js';
import { GameState, getPlayer, updatePlayer } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {  
  PlayerId, 
  CardId, 
  Cost, 
  Domain, 
  Phase, 
  Zone, 
  Energy, 
  cardId, 
  playerId,
  CardCategory,
  Might
} from '../../src/types/primitives.js';
import { Card, UnitCard } from '../../src/types/cards.js';

describe('Cost Validation', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
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
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
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
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Action });
  });

  it('should allow playing card from hand during your turn', () => {
    const card: UnitCard = {
      id: cardId('card1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 1 as Energy, power: [] },
      might: { attack: 2, defense: 2 } as Might,
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
      might: { attack: 2, defense: 2 } as Might,
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
      might: { attack: 2, defense: 2 } as Might,
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
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Action });
  });

  it('should move unit to base when played', () => {
    const card: UnitCard = {
      id: cardId('unit1'),
      owner: p1,
      name: 'Test Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [{ domain: Domain.Mind, amount: 1 }] },
      might: { attack: 3, defense: 3 } as Might,
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
      might: { attack: 3, defense: 3 } as Might,
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
      might: { attack: 2, defense: 2 } as Might,
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
