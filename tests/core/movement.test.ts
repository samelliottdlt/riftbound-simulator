/**
 * Movement System Tests
 * 
 * Tests unit movement mechanics:
 * - Standard Move (Rule 141)
 * - Ganking keyword (Rule 726)
 * - Movement restrictions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  moveUnit,
  moveUnits,
  getUnitLocation,
  canMove,
} from '../../src/core/movement.js';
import { GameState, getPlayer, updatePlayer, BattlefieldState } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  Phase,
  Energy,
  playerId,
  cardId,
  battlefieldId,
  UnitId,
  CardCategory,
  Domain,
  Keyword,
  Might,
} from '../../src/types/primitives.js';
import { UnitCard } from '../../src/types/cards.js';

describe('Movement System (Rule 141)', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const bf1 = battlefieldId('bf1');
  const bf2 = battlefieldId('bf2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    
    const battlefields = new Map();
    battlefields.set(bf1, {
      id: bf1,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
    } as BattlefieldState);
    battlefields.set(bf2, {
      id: bf2,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
    } as BattlefieldState);
    
    state = createMinimalGameState({ 
      players, 
      turnPlayer: p1, 
      phase: Phase.Action,
      battlefields 
    });
  });

  describe('getUnitLocation', () => {
    it('should find unit at base', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      const player = getPlayer(state, p1)!;
      state = updatePlayer(state, p1, { 
        ...player, 
        base: new Set([unit.id] as UnitId[]) 
      });

      const result = getUnitLocation(state, unit.id as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe('base');
      }
    });

    it('should find unit at battlefield', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      const battlefield = state.battlefields.get(bf1)!;
      state.battlefields.set(bf1, {
        ...battlefield,
        units: new Set([unit.id] as UnitId[]),
      });

      const result = getUnitLocation(state, unit.id as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe('battlefield');
        if (result.value.type === 'battlefield') {
          expect(result.value.battlefieldId).toBe(bf1);
        }
      }
    });
  });

  describe('canMove', () => {
    it('should allow movement during Action phase', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      state.turnState.phase = Phase.Action;

      const result = canMove(state, unit.id as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should not allow movement during Combat phase', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      state.turnState.phase = Phase.Combat;

      const result = canMove(state, unit.id as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('should not allow movement on opponent\'s turn', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p2,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      state.turnState.turnPlayer = p1; // p1's turn, but unit owned by p2

      const result = canMove(state, unit.id as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  describe('Base to Battlefield movement (Rule 141.4.a)', () => {
    it('should move unit from base to battlefield', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      const player = getPlayer(state, p1)!;
      state = updatePlayer(state, p1, { 
        ...player, 
        base: new Set([unit.id] as UnitId[]) 
      });

      const result = moveUnit(state, unit.id as any, {
        type: 'battlefield',
        battlefieldId: bf1,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Unit should be at battlefield
        const battlefield = result.value.battlefields.get(bf1)!;
        expect(battlefield.units.has(unit.id as any)).toBe(true);

        // Unit should not be in base
        const updatedPlayer = getPlayer(result.value, p1)!;
        expect(updatedPlayer.base.has(unit.id as any)).toBe(false);
      }
    });

    it('should reject move to battlefield with 2 other players (Rule 141.4.a.1)', () => {
      const p3 = playerId('p3');
      state.players.set(p3, createMinimalPlayer());

      const unit1: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Unit 1',
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

      const unit2: UnitCard = {
        id: cardId('unit2'),
        owner: p2,
        name: 'Unit 2',
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

      const unit3: UnitCard = {
        id: cardId('unit3'),
        owner: p3,
        name: 'Unit 3',
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

      state.cards.set(unit1.id, unit1);
      state.cards.set(unit2.id, unit2);
      state.cards.set(unit3.id, unit3);

      // Put p2 and p3 units at battlefield
      const battlefield = state.battlefields.get(bf1)!;
      state.battlefields.set(bf1, {
        ...battlefield,
        units: new Set([unit2.id as any, unit3.id] as UnitId[]),
      });

      // Put p1 unit in base
      const player = getPlayer(state, p1)!;
      state = updatePlayer(state, p1, { 
        ...player, 
        base: new Set([unit1.id] as UnitId[]) 
      });

      // Try to move p1 unit to battlefield with 2 other players
      const result = moveUnit(state, unit1.id as any, {
        type: 'battlefield',
        battlefieldId: bf1,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BATTLEFIELD_FULL');
      }
    });

    it('should allow move to battlefield with own units present', () => {
      const unit1: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Unit 1',
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

      const unit2: UnitCard = {
        id: cardId('unit2'),
        owner: p1,
        name: 'Unit 2',
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

      state.cards.set(unit1.id, unit1);
      state.cards.set(unit2.id, unit2);

      // Unit1 at battlefield
      const battlefield = state.battlefields.get(bf1)!;
      state.battlefields.set(bf1, {
        ...battlefield,
        units: new Set([unit1.id] as UnitId[]),
      });

      // Unit2 at base
      const player = getPlayer(state, p1)!;
      state = updatePlayer(state, p1, { 
        ...player, 
        base: new Set([unit2.id] as UnitId[]) 
      });

      // Move unit2 to same battlefield as unit1
      const result = moveUnit(state, unit2.id as any, {
        type: 'battlefield',
        battlefieldId: bf1,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const updatedBattlefield = result.value.battlefields.get(bf1)!;
        expect(updatedBattlefield.units.size).toBe(2);
        expect(updatedBattlefield.units.has(unit1.id as UnitId)).toBe(true);
        expect(updatedBattlefield.units.has(unit2.id as UnitId)).toBe(true);
      }
    });
  });

  describe('Battlefield to Base movement (Rule 141.4.b)', () => {
    it('should move unit from battlefield to base', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Test Unit',
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

      state.cards.set(unit.id, unit);
      
      // Put unit at battlefield
      const battlefield = state.battlefields.get(bf1)!;
      state.battlefields.set(bf1, {
        ...battlefield,
        units: new Set([unit.id] as UnitId[]),
      });

      const result = moveUnit(state, unit.id as any, { type: 'base' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Unit should be at base
        const player = getPlayer(result.value, p1)!;
        expect(player.base.has(unit.id as any)).toBe(true);

        // Unit should not be at battlefield
        const updatedBattlefield = result.value.battlefields.get(bf1)!;
        expect(updatedBattlefield.units.has(unit.id as any)).toBe(false);
      }
    });
  });

  describe('Ganking keyword (Rule 726)', () => {
    it('should allow battlefield to battlefield movement with Ganking', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Ganking Unit',
        category: CardCategory.Unit,
        cost: { energy: 2 as Energy, power: [] },
        might: 3 as Might,
        domains: [Domain.Fury],
        keywords: [Keyword.Ganking],
        supertypes: [],
        tags: [],
        abilities: [],
        rulesText: '',
      };

      state.cards.set(unit.id, unit);
      
      // Put unit at battlefield 1
      const battlefield1 = state.battlefields.get(bf1)!;
      state.battlefields.set(bf1, {
        ...battlefield1,
        units: new Set([unit.id] as UnitId[]),
      });

      // Move to battlefield 2
      const result = moveUnit(state, unit.id as any, {
        type: 'battlefield',
        battlefieldId: bf2,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Unit should be at battlefield 2
        const updatedBf2 = result.value.battlefields.get(bf2)!;
        expect(updatedBf2.units.has(unit.id as any)).toBe(true);

        // Unit should not be at battlefield 1
        const updatedBf1 = result.value.battlefields.get(bf1)!;
        expect(updatedBf1.units.has(unit.id as any)).toBe(false);
      }
    });

    it('should reject battlefield to battlefield movement without Ganking', () => {
      const unit: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Normal Unit',
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

      state.cards.set(unit.id, unit);
      
      // Put unit at battlefield 1
      const battlefield1 = state.battlefields.get(bf1)!;
      state.battlefields.set(bf1, {
        ...battlefield1,
        units: new Set([unit.id] as UnitId[]),
      });

      // Try to move to battlefield 2 without Ganking
      const result = moveUnit(state, unit.id as any, {
        type: 'battlefield',
        battlefieldId: bf2,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('GANKING_REQUIRED');
      }
    });
  });

  describe('Multiple unit movement (Rule 141.3)', () => {
    it('should move multiple units to same destination', () => {
      const unit1: UnitCard = {
        id: cardId('unit1'),
        owner: p1,
        name: 'Unit 1',
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

      const unit2: UnitCard = {
        id: cardId('unit2'),
        owner: p1,
        name: 'Unit 2',
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

      state.cards.set(unit1.id, unit1);
      state.cards.set(unit2.id, unit2);

      const player = getPlayer(state, p1)!;
      state = updatePlayer(state, p1, { 
        ...player, 
        base: new Set([unit1.id as UnitId, unit2.id] as UnitId[]) 
      });

      const result = moveUnits(
        state, 
        [unit1.id as UnitId, unit2.id as UnitId],
        { type: 'battlefield', battlefieldId: bf1 }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Both units should be at battlefield
        const battlefield = result.value.battlefields.get(bf1)!;
        expect(battlefield.units.has(unit1.id as UnitId)).toBe(true);
        expect(battlefield.units.has(unit2.id as UnitId)).toBe(true);

        // Neither should be in base
        const updatedPlayer = getPlayer(result.value, p1)!;
        expect(updatedPlayer.base.has(unit1.id as UnitId)).toBe(false);
        expect(updatedPlayer.base.has(unit2.id as UnitId)).toBe(false);
      }
    });
  });
});
