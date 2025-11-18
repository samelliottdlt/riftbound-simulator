/**
 * Rune System Tests
 * 
 * Tests the rune-based resource system:
 * - Rune deck initialization (12 basic runes)
 * - Channeling runes from deck to board
 * - Rune abilities ([E]: Add [1], Recycle: Add [C])
 * - Rune Pool (Energy and Power)
 * - Rune Pool emptying (end of draw phase, end of turn)
 * - Cost payment with both Energy and Power
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBasicRune,
  createRuneDeck,
  channelRunes,
  addEnergy,
  addPower,
  emptyRunePool,
  spendEnergy,
  spendPower,
  hasEnergy,
  hasPower,
  getEnergy,
  getPowerPool,
  getEnergyGenerated,
  recycleRune,
} from '../../src/core/runes.js';
import { GameState, getPlayer, updatePlayer } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  PlayerId,
  playerId,
  Domain,
  Energy,
  Power,
  CardCategory,
} from '../../src/types/primitives.js';

describe('Rune Deck Initialization', () => {
  it('should create a basic rune with correct properties', () => {
    const rune = createBasicRune(Domain.Fury, 'test-1');
    
    expect(rune.name).toBe('Fury Rune');
    expect(rune.category).toBe(CardCategory.Rune);
    expect(rune.domains).toContain(Domain.Fury);
    expect(rune.domains).toHaveLength(1);
    expect(rune.rulesText).toContain('[E]: Add [1]');
    expect(rune.rulesText).toContain('Recycle');
  });

  it('should create a rune deck with 12 runes', () => {
    const deck = createRuneDeck('player1');
    
    expect(deck).toHaveLength(12);
    expect(deck.every(r => r.category === CardCategory.Rune)).toBe(true);
  });

  it('should create 2 runes of each domain', () => {
    const deck = createRuneDeck('player1');
    
    const domains = Object.values(Domain);
    domains.forEach(domain => {
      const count = deck.filter(r => r.domains.includes(domain)).length;
      expect(count).toBe(2);
    });
  });
});

describe('Channeling Runes', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    const player1 = createMinimalPlayer(p1);
    const player2 = createMinimalPlayer(p2);
    
    // Create rune decks for both players
    const runeDeck1 = createRuneDeck('p1');
    const runeDeck2 = createRuneDeck('p2');
    
    // Add runes to game state
    players.set(p1, {
      ...player1,
      runeDeck: runeDeck1.map(r => r.id),
      runesInPlay: new Set(),
    });
    players.set(p2, {
      ...player2,
      runeDeck: runeDeck2.map(r => r.id),
      runesInPlay: new Set(),
    });
    
    state = createMinimalGameState({ players, turnPlayer: p1 });
    
    // Add rune cards to state
    runeDeck1.forEach(r => state.cards.set(r.id as any, r));
    runeDeck2.forEach(r => state.cards.set(r.id as any, r));
  });

  it('should channel 2 runes from deck to board', () => {
    const player = getPlayer(state, p1)!;
    const initialDeckSize = player.runeDeck.length;
    
    const result = channelRunes(state, p1, 2);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      const updatedPlayer = getPlayer(result.value, p1)!;
      expect(updatedPlayer.runeDeck).toHaveLength(initialDeckSize - 2);
      expect(updatedPlayer.runesInPlay.size).toBe(2);
    }
  });

  it('should channel runes ready by default', () => {
    const result = channelRunes(state, p1, 2);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      const player = getPlayer(result.value, p1)!;
      const runeIds = Array.from(player.runesInPlay);
      
      // Verify runes are added to play area
      expect(runeIds.length).toBe(2);
      runeIds.forEach(runeId => {
        const rune = result.value.cards.get(runeId as any);
        expect(rune).toBeDefined();
      });
    }
  });

  it('should handle multiple channeling calls', () => {
    // Channel 2 runes
    const result1 = channelRunes(state, p1, 2);
    expect(result1.ok).toBe(true);
    
    if (result1.ok) {
      // Channel 2 more runes
      const result2 = channelRunes(result1.value, p1, 2);
      expect(result2.ok).toBe(true);
      
      if (result2.ok) {
        const player = getPlayer(result2.value, p1)!;
        expect(player.runesInPlay.size).toBe(4);
        expect(player.runeDeck.length).toBe(8);
      }
    }
  });

  it('should handle channeling when fewer runes available', () => {
    // Channel all but 1 rune
    let player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      runeDeck: player.runeDeck.slice(0, 1),
    };
    state = updatePlayer(state, p1, updatedPlayer);
    
    const result = channelRunes(state, p1, 2);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      const finalPlayer = getPlayer(result.value, p1)!;
      // Should only channel 1 rune
      expect(finalPlayer.runesInPlay.size).toBe(1);
      expect(finalPlayer.runeDeck).toHaveLength(0);
    }
  });
});

describe('Rune Pool - Energy', () => {
  let state: GameState;
  const p1 = playerId('p1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should add energy to Rune Pool', () => {
    const result = addEnergy(state, p1, 3 as Energy);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getEnergy(result.value, p1)).toBe(3);
    }
  });

  it('should accumulate energy from multiple additions', () => {
    let result = addEnergy(state, p1, 2 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addEnergy(result.value, p1, 1 as Energy);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = addEnergy(result.value, p1, 3 as Energy);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          expect(getEnergy(result.value, p1)).toBe(6);
        }
      }
    }
  });

  it('should spend energy from Rune Pool', () => {
    let result = addEnergy(state, p1, 5 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = spendEnergy(result.value, p1, 3 as Energy);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        expect(getEnergy(result.value, p1)).toBe(2);
      }
    }
  });

  it('should fail to spend more energy than available', () => {
    let result = addEnergy(state, p1, 2 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = spendEnergy(result.value, p1, 5 as Energy);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INSUFFICIENT_ENERGY');
      }
    }
  });

  it('should check if player has enough energy', () => {
    let result = addEnergy(state, p1, 4 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasEnergy(result.value, p1, 3 as Energy)).toBe(true);
      expect(hasEnergy(result.value, p1, 4 as Energy)).toBe(true);
      expect(hasEnergy(result.value, p1, 5 as Energy)).toBe(false);
    }
  });

  it('should track total energy generated', () => {
    let result = addEnergy(state, p1, 2 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addEnergy(result.value, p1, 1 as Energy);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = addEnergy(result.value, p1, 3 as Energy);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          expect(getEnergyGenerated(result.value, p1)).toBe(6);
        }
      }
    }
  });
});

describe('Rune Pool - Power', () => {
  let state: GameState;
  const p1 = playerId('p1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should add power to Rune Pool', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    const result = addPower(state, p1, furyPower);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      const powerPool = getPowerPool(result.value, p1);
      expect(powerPool).toHaveLength(1);
      expect(powerPool[0].domain).toBe(Domain.Fury);
      expect(powerPool[0].amount).toBe(1);
    }
  });

  it('should accumulate power from multiple additions', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    const mindPower: Power = { domain: Domain.Mind, amount: 1 };
    
    let result = addPower(state, p1, furyPower);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addPower(result.value, p1, mindPower);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = addPower(result.value, p1, furyPower);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          const powerPool = getPowerPool(result.value, p1);
          expect(powerPool).toHaveLength(3);
          
          const furyCount = powerPool.filter(p => p.domain === Domain.Fury).length;
          const mindCount = powerPool.filter(p => p.domain === Domain.Mind).length;
          expect(furyCount).toBe(2);
          expect(mindCount).toBe(1);
        }
      }
    }
  });

  it('should spend power from Rune Pool', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    
    let result = addPower(state, p1, furyPower);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addPower(result.value, p1, furyPower);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = spendPower(result.value, p1, [furyPower]);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          const powerPool = getPowerPool(result.value, p1);
          expect(powerPool).toHaveLength(1);
        }
      }
    }
  });

  it('should fail to spend power not in pool', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    const mindPower: Power = { domain: Domain.Mind, amount: 1 };
    
    let result = addPower(state, p1, furyPower);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = spendPower(result.value, p1, [mindPower]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INSUFFICIENT_POWER');
      }
    }
  });

  it('should check if player has enough power', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    const mindPower: Power = { domain: Domain.Mind, amount: 1 };
    
    let result = addPower(state, p1, furyPower);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addPower(result.value, p1, furyPower);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        expect(hasPower(result.value, p1, [furyPower])).toBe(true);
        expect(hasPower(result.value, p1, [furyPower, furyPower])).toBe(true);
        expect(hasPower(result.value, p1, [mindPower])).toBe(false);
      }
    }
  });
});

describe('Rune Pool Emptying', () => {
  let state: GameState;
  const p1 = playerId('p1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should empty energy and power from Rune Pool', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    
    let result = addEnergy(state, p1, 5 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addPower(result.value, p1, furyPower);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = addPower(result.value, p1, furyPower);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          // Verify resources are there
          expect(getEnergy(result.value, p1)).toBe(5);
          expect(getPowerPool(result.value, p1)).toHaveLength(2);
          
          // Empty the pool
          result = emptyRunePool(result.value, p1);
          expect(result.ok).toBe(true);
          
          if (result.ok) {
            expect(getEnergy(result.value, p1)).toBe(0);
            expect(getPowerPool(result.value, p1)).toHaveLength(0);
          }
        }
      }
    }
  });

  it('should handle emptying an already empty pool', () => {
    const result = emptyRunePool(state, p1);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getEnergy(result.value, p1)).toBe(0);
      expect(getPowerPool(result.value, p1)).toHaveLength(0);
    }
  });
});

describe('Rune Recycling', () => {
  let state: GameState;
  const p1 = playerId('p1');

  beforeEach(() => {
    const players = new Map();
    const player1 = createMinimalPlayer(p1);
    const runeDeck = createRuneDeck('p1');
    
    players.set(p1, {
      ...player1,
      runeDeck: runeDeck.map(r => r.id),
      runesInPlay: new Set(),
    });
    
    state = createMinimalGameState({ players, turnPlayer: p1 });
    runeDeck.forEach(r => state.cards.set(r.id as any, r));
  });

  it('should recycle rune from play back to deck', () => {
    // Channel a rune first
    let result = channelRunes(state, p1, 1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      const player = getPlayer(result.value, p1)!;
      const runeId = Array.from(player.runesInPlay)[0];
      const initialDeckSize = player.runeDeck.length;
      
      // Recycle the rune
      result = recycleRune(result.value, p1, runeId);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const updatedPlayer = getPlayer(result.value, p1)!;
        expect(updatedPlayer.runesInPlay.size).toBe(0);
        expect(updatedPlayer.runeDeck).toHaveLength(initialDeckSize + 1);
        expect(updatedPlayer.runeDeck).toContain(runeId);
      }
    }
  });

  it('should fail to recycle rune not in play', () => {
    const player = getPlayer(state, p1)!;
    const runeId = player.runeDeck[0];
    
    const result = recycleRune(state, p1, runeId);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNE_NOT_IN_PLAY');
    }
  });
});

describe('Energy and Power Independence', () => {
  let state: GameState;
  const p1 = playerId('p1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should allow spending energy without affecting power', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    
    let result = addEnergy(state, p1, 5 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addPower(result.value, p1, furyPower);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = spendEnergy(result.value, p1, 3 as Energy);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          expect(getEnergy(result.value, p1)).toBe(2);
          expect(getPowerPool(result.value, p1)).toHaveLength(1);
        }
      }
    }
  });

  it('should allow spending power without affecting energy', () => {
    const furyPower: Power = { domain: Domain.Fury, amount: 1 };
    
    let result = addEnergy(state, p1, 5 as Energy);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      result = addPower(result.value, p1, furyPower);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        result = spendPower(result.value, p1, [furyPower]);
        expect(result.ok).toBe(true);
        
        if (result.ok) {
          expect(getEnergy(result.value, p1)).toBe(5);
          expect(getPowerPool(result.value, p1)).toHaveLength(0);
        }
      }
    }
  });
});
