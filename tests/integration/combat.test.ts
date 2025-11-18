/**
 * Combat System Tests
 * 
 * Tests combat mechanics including attack/block declaration and damage resolution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  declareAttackers,
  declareDefenders,
  resolveCombatDamage,
  canAttack,
  canBlock,
  isCombatActive,
  getAttackers,
  getDefenders,
  quickCombat,
} from '../../src/core/combat.js';
import { GameState, getPlayer, updatePlayer, getCard } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  PlayerId,
  CardId,
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

describe('Attack Declaration', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Combat });
  });

  it('should declare attackers successfully', () => {
    const attacker: UnitCard = {
      id: cardId('unit1'),
      owner: p1,
      name: 'Attacker',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 3 as Might,
      domains: [Domain.Fury],
      keywords: [Keyword.Accelerate],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    const player = getPlayer(state, p1)!;
    state = updatePlayer(state, p1, { ...player, base: new Set([attacker.id as any]) });

    const result = declareAttackers(state, p1, [attacker.id as any]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isCombatActive(result.value)).toBe(true);
      expect(getAttackers(result.value)).toContain(attacker.id as any);
    }
  });

  it('should fail to declare attackers in wrong phase', () => {
    state.turnState.phase = Phase.Action;
    
    const attacker: UnitCard = {
      id: cardId('unit1'),
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

    state.cards.set(attacker.id, attacker);

    const result = declareAttackers(state, p1, [attacker.id as any]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PHASE');
    }
  });

  it('should fail if not attacking player\'s turn', () => {
    const attacker: UnitCard = {
      id: cardId('unit1'),
      owner: p2,
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

    state.cards.set(attacker.id, attacker);

    const result = declareAttackers(state, p2, [attacker.id as any]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('WRONG_PLAYER');
    }
  });
});

describe('Defender Declaration', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Combat });
  });

  it('should declare defenders successfully', () => {
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

    const defender: UnitCard = {
      id: cardId('defender'),
      owner: p2,
      name: 'Defender',
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
    state.cards.set(defender.id, defender);

    // Declare attackers first
    let result = declareAttackers(state, p1, [attacker.id as any]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;

    // Declare defenders
    const assignments = new Map();
    assignments.set(defender.id as any, attacker.id as any);
    result = declareDefenders(state, p2, assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getDefenders(result.value)).toContain(defender.id as any);
    }
  });

});

describe('Combat Damage Resolution', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Combat });
  });

  it('should destroy blocker when attacker has higher attack', () => {
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

    const defender: UnitCard = {
      id: cardId('defender'),
      owner: p2,
      name: 'Weak Defender',
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
    state.cards.set(defender.id, defender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { ...p2Player, base: new Set([defender.id as any]) });

    // Quick combat
    const assignments = new Map();
    assignments.set(defender.id as any, attacker.id as any);
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Defender should be in trash
      const location = getCardLocation(result.value, defender.id);
      expect(location.ok).toBe(true);
      if (location.ok) {
        expect(location.value.zone).toBe('Trash');
      }
    }
  });

  it('should destroy both units in mutual destruction', () => {
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

    const defender: UnitCard = {
      id: cardId('defender'),
      owner: p2,
      name: 'Defender',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 3 as Might,
      domains: [Domain.Order],
      keywords: [],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(attacker.id, attacker);
    state.cards.set(defender.id, defender);

    const p1Player = getPlayer(state, p1)!;
    const p2Player = getPlayer(state, p2)!;
    state = updatePlayer(state, p1, { ...p1Player, base: new Set([attacker.id as any]) });
    state = updatePlayer(state, p2, { ...p2Player, base: new Set([defender.id as any]) });

    const assignments = new Map();
    assignments.set(defender.id as any, attacker.id as any);
    const result = quickCombat(state, p1, [attacker.id as any], assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Both should be in trash
      const attackerLocation = getCardLocation(result.value, attacker.id);
      const defenderLocation = getCardLocation(result.value, defender.id);
      
      expect(attackerLocation.ok).toBe(true);
      expect(defenderLocation.ok).toBe(true);
      
      if (attackerLocation.ok && defenderLocation.ok) {
        expect(attackerLocation.value.zone).toBe('Trash');
        expect(defenderLocation.value.zone).toBe('Trash');
      }
    }
  });


});

describe('Combat Query Functions', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Combat });
  });

  it('should check if unit can attack with Accelerate', () => {
    const unit: UnitCard = {
      id: cardId('unit1'),
      owner: p1,
      name: 'Fast Unit',
      category: CardCategory.Unit,
      cost: { energy: 2 as Energy, power: [] },
      might: 3 as Might,
      domains: [Domain.Fury],
      keywords: [Keyword.Accelerate],
      supertypes: [],
      tags: [],
      abilities: [],
      rulesText: '',
    };

    state.cards.set(unit.id, unit);

    expect(canAttack(state, unit.id as any)).toBe(true);
  });

});
