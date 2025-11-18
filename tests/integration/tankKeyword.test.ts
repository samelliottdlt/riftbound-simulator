/**
 * Tank Keyword Tests
 * 
 * Tests the Tank keyword implementation (Rule 731)
 * Tank units must be assigned lethal damage before non-Tank units
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  quickCombat,
} from '../../src/core/combat.js';
import { GameState, getPlayer, updatePlayer, getCard } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  PlayerId,
  Phase,
  Energy,
  playerId,
  cardId,
  CardCategory,
  Domain,
  Keyword,
  Might,
} from '../../src/types/primitives.js';
import { UnitCard } from '../../src/types/cards.js';
import { getCardLocation } from '../../src/core/zoneManagement.js';

describe('Tank Keyword (Rule 731)', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Combat });
  });

  it('should assign lethal damage to Tank unit before non-Tank units', () => {
    // Attacker with 5 might
    const attacker: UnitCard = {
      id: cardId('attacker'),
      owner: p1,
      name: 'Strong Attacker',
      category: CardCategory.Unit,
      cost: { energy: 3 as Energy, power: [] },
      might: 5 as Might,
      domains: [Domain.Fury],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Tank defender with 3 might (needs 3 to kill)
    const tankDefender: UnitCard = {
      id: cardId('tank'),
      owner: p2,
      name: 'Tank Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 3 as Might,
      domains: [Domain.Order],
      keywords: [Keyword.Tank],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Non-Tank defender with 2 might
    const normalDefender: UnitCard = {
      id: cardId('normal'),
      owner: p2,
      name: 'Normal Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Order],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    state.cards.set(tankDefender.id, tankDefender);
    state.cards.set(normalDefender.id, normalDefender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { ...p2Player, base: new Set([tankDefender.id as any, normalDefender.id as any]) });

    // Combat: attacker (5 might) vs tank (3 might) + normal (2 might)
    // Tank must receive 3 damage first (lethal), then normal receives 2 damage (lethal)
    const assignments = new Map();
    assignments.set(tankDefender.id as any, attacker.id as any);
    assignments.set(normalDefender.id as any, attacker.id as any);
    
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Tank should be dead (received 3 damage, has 3 might)
      const tankLocation = getCardLocation(result.value, tankDefender.id);
      expect(tankLocation.ok).toBe(true);
      if (tankLocation.ok) {
        expect(tankLocation.value.zone).toBe('Trash');
      }

      // Normal should also be dead (received 2 damage, has 2 might)
      const normalLocation = getCardLocation(result.value, normalDefender.id);
      expect(normalLocation.ok).toBe(true);
      if (normalLocation.ok) {
        expect(normalLocation.value.zone).toBe('Trash');
      }

      // Verify damage was assigned correctly
      const tankCard = getCard(result.value, tankDefender.id);
      const normalCard = getCard(result.value, normalDefender.id);
      
      // Both should have lethal damage before being killed
      if (tankCard) expect(tankCard.damage ?? 0).toBeGreaterThanOrEqual(3);
      if (normalCard) expect(normalCard.damage ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('should not assign damage to non-Tank if Tank has not received lethal', () => {
    // Attacker with 2 might (not enough to kill Tank)
    const attacker: UnitCard = {
      id: cardId('attacker'),
      owner: p1,
      name: 'Weak Attacker',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Fury],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Tank defender with 3 might
    const tankDefender: UnitCard = {
      id: cardId('tank'),
      owner: p2,
      name: 'Tank Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 3 as Might,
      domains: [Domain.Order],
      keywords: [Keyword.Tank],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Non-Tank defender with 2 might
    const normalDefender: UnitCard = {
      id: cardId('normal'),
      owner: p2,
      name: 'Normal Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Order],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    state.cards.set(tankDefender.id, tankDefender);
    state.cards.set(normalDefender.id, normalDefender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { ...p2Player, base: new Set([tankDefender.id as any, normalDefender.id as any]) });

    // Combat: attacker (2 might) vs tank (3 might) + normal (2 might)
    // Tank must receive all 2 damage (not lethal), normal receives 0
    const assignments = new Map();
    assignments.set(tankDefender.id as any, attacker.id as any);
    assignments.set(normalDefender.id as any, attacker.id as any);
    
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Tank should survive with 2 damage (not lethal)
      const tankLocation = getCardLocation(result.value, tankDefender.id);
      expect(tankLocation.ok).toBe(true);
      if (tankLocation.ok) {
        expect(tankLocation.value.zone).toBe('Base');
      }

      // Normal should survive with 0 damage (Tank blocked all damage)
      const normalLocation = getCardLocation(result.value, normalDefender.id);
      expect(normalLocation.ok).toBe(true);
      if (normalLocation.ok) {
        expect(normalLocation.value.zone).toBe('Base');
      }

      // Verify damage assignments
      const tankCard = getCard(result.value, tankDefender.id);
      const normalCard = getCard(result.value, normalDefender.id);
      
      expect(tankCard?.damage ?? 0).toBe(2); // Tank took all 2 damage
      expect(normalCard?.damage ?? 0).toBe(0); // Normal took no damage
    }
  });

  it('should handle multiple Tank units (Rule 731.1.c.2)', () => {
    // Attacker with 5 might
    const attacker: UnitCard = {
      id: cardId('attacker'),
      owner: p1,
      name: 'Strong Attacker',
      category: CardCategory.Unit,
      cost: { energy: 3 as Energy, power: [] },
      might: 5 as Might,
      domains: [Domain.Fury],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // First Tank with 2 might
    const tank1: UnitCard = {
      id: cardId('tank1'),
      owner: p2,
      name: 'Tank Unit 1',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Order],
      keywords: [Keyword.Tank],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Second Tank with 2 might
    const tank2: UnitCard = {
      id: cardId('tank2'),
      owner: p2,
      name: 'Tank Unit 2',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Order],
      keywords: [Keyword.Tank],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Non-Tank with 1 might
    const normalDefender: UnitCard = {
      id: cardId('normal'),
      owner: p2,
      name: 'Normal Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 1 as Might,
      domains: [Domain.Order],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    state.cards.set(tank1.id, tank1);
    state.cards.set(tank2.id, tank2);
    state.cards.set(normalDefender.id, normalDefender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { 
      ...p2Player, 
      base: new Set([tank1.id as any, tank2.id as any, normalDefender.id as any]) 
    });

    // Combat: attacker (5 might) vs tank1 (2) + tank2 (2) + normal (1)
    // Both tanks must get lethal (2 each = 4 total), then normal gets 1 (lethal)
    const assignments = new Map();
    assignments.set(tank1.id as any, attacker.id as any);
    assignments.set(tank2.id as any, attacker.id as any);
    assignments.set(normalDefender.id as any, attacker.id as any);
    
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Both tanks should be dead
      const tank1Location = getCardLocation(result.value, tank1.id);
      const tank2Location = getCardLocation(result.value, tank2.id);
      
      expect(tank1Location.ok).toBe(true);
      expect(tank2Location.ok).toBe(true);
      
      if (tank1Location.ok && tank2Location.ok) {
        expect(tank1Location.value.zone).toBe('Trash');
        expect(tank2Location.value.zone).toBe('Trash');
      }

      // Normal should also be dead (received remaining 1 damage)
      const normalLocation = getCardLocation(result.value, normalDefender.id);
      expect(normalLocation.ok).toBe(true);
      if (normalLocation.ok) {
        expect(normalLocation.value.zone).toBe('Trash');
      }
    }
  });

  it('should handle Tank units with pre-existing damage', () => {
    // Attacker with 3 might
    const attacker: UnitCard = {
      id: cardId('attacker'),
      owner: p1,
      name: 'Attacker',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 3 as Might,
      domains: [Domain.Fury],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Tank with 4 might but already has 2 damage (needs 2 more to kill)
    const tankDefender: UnitCard = {
      id: cardId('tank'),
      owner: p2,
      name: 'Damaged Tank',
      category: CardCategory.Unit,
      cost: { energy: 3 as Energy, power: [] },
      might: 4 as Might,
      damage: 2, // Pre-existing damage
      domains: [Domain.Order],
      keywords: [Keyword.Tank],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Non-Tank with 1 might
    const normalDefender: UnitCard = {
      id: cardId('normal'),
      owner: p2,
      name: 'Normal Unit',
      category: CardCategory.Unit,
      cost: { energy: 1 as Energy, power: [] },
      might: 1 as Might,
      domains: [Domain.Order],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    state.cards.set(tankDefender.id, tankDefender);
    state.cards.set(normalDefender.id, normalDefender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { 
      ...p2Player, 
      base: new Set([tankDefender.id as any, normalDefender.id as any]) 
    });

    // Combat: attacker (3 might) vs damaged tank (4 might, 2 damage) + normal (1 might)
    // Tank needs 2 more damage to kill, so it gets 2, normal gets remaining 1 (lethal)
    const assignments = new Map();
    assignments.set(tankDefender.id as any, attacker.id as any);
    assignments.set(normalDefender.id as any, attacker.id as any);
    
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Tank should be dead (2 existing + 2 new = 4 total, has 4 might)
      const tankLocation = getCardLocation(result.value, tankDefender.id);
      expect(tankLocation.ok).toBe(true);
      if (tankLocation.ok) {
        expect(tankLocation.value.zone).toBe('Trash');
      }

      // Normal should also be dead (received 1 damage, has 1 might)
      const normalLocation = getCardLocation(result.value, normalDefender.id);
      expect(normalLocation.ok).toBe(true);
      if (normalLocation.ok) {
        expect(normalLocation.value.zone).toBe('Trash');
      }
    }
  });

  it('should assign excess damage after all units have lethal (Rule 439.1.d.4)', () => {
    // Attacker with 10 might (way more than needed)
    const attacker: UnitCard = {
      id: cardId('attacker'),
      owner: p1,
      name: 'Overwhelming Attacker',
      category: CardCategory.Unit,
      cost: { energy: 5 as Energy, power: [] },
      might: 10 as Might,
      domains: [Domain.Fury],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    // Tank with 2 might
    const tankDefender: UnitCard = {
      id: cardId('tank'),
      owner: p2,
      name: 'Tank Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 2 as Might,
      domains: [Domain.Order],
      keywords: [Keyword.Tank],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    state.cards.set(tankDefender.id, tankDefender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { ...p2Player, base: new Set([tankDefender.id as any]) });

    // Combat: attacker (10 might) vs tank (2 might)
    // Tank gets 2 damage (lethal), excess 8 damage also assigned to tank
    const assignments = new Map();
    assignments.set(tankDefender.id as any, attacker.id as any);
    
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Tank should be dead
      const tankLocation = getCardLocation(result.value, tankDefender.id);
      expect(tankLocation.ok).toBe(true);
      if (tankLocation.ok) {
        expect(tankLocation.value.zone).toBe('Trash');
      }

      // Verify tank received way more damage than needed
      const tankCard = getCard(result.value, tankDefender.id);
      if (tankCard) {
        expect(tankCard.damage ?? 0).toBe(10); // All damage went to tank
      }
    }
  });
});
