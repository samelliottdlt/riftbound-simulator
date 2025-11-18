/**
 * Score Abilities Tests
 * 
 * Tests for Conquer and Hold triggered abilities at battlefields (Rule 444.2):
 * - Conquer abilities triggered when battlefield is conquered after combat
 * - Hold abilities triggered when battlefield is held during Beginning Phase
 * - Integration with scoring system
 * - Ability queueing and resolution
 */

import { describe, it, expect } from 'vitest';
import {
  initializeAbilitySystem,
  resolveAllQueuedAbilities,
} from '../../src/core/abilityResolution.js';
import {
  descriptorAbility,
  AbilityTrigger,
  EffectType,
} from '../../src/types/abilities.js';
import { GameState } from '../../src/types/gameState.js';
import { playerId, cardId, battlefieldId, abilityId, unitId, Phase } from '../../src/types/primitives.js';
import { createUnit, UnitCard, BattlefieldCard } from '../../src/types/cards.js';
import { SeededRNG } from '../../src/utils/rng.js';
import { resolveCombatDamage } from '../../src/core/combat.js';
import { executeBeginningPhase } from '../../src/core/turnStructure.js';

describe('Score Abilities Integration', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const bf1 = battlefieldId('bf1');
  const bf1CardId = cardId('bf1-card'); // Card ID for the battlefield card

  function createTestState(): GameState {
    return {
      cards: new Map(),
      players: new Map([
        [p1, {
          hand: [],
          deck: [cardId('deck1'), cardId('deck2'), cardId('deck3'), cardId('deck9'), cardId('deck10')],
          trash: [],
          banishment: [],
          championZone: null,
          base: new Set(),
          runeDeck: [],
          runesInPlay: new Set(),
          energy: 10,
          energyGenerated: 10,
          maxEnergy: 10,
          runePool: [],
          cardsPlayedThisTurn: [],
          points: 0,
          battlefieldsScored: new Set(),
          legend: '' as any,
        }],
        [p2, {
          hand: [],
          deck: [cardId('deck4'), cardId('deck5'), cardId('deck6'), cardId('deck7'), cardId('deck8')],
          trash: [],
          banishment: [],
          championZone: null,
          base: new Set(),
          runeDeck: [],
          runesInPlay: new Set(),
          energy: 8,
          energyGenerated: 8,
          maxEnergy: 8,
          runePool: [],
          cardsPlayedThisTurn: [],
          points: 0,
          battlefieldsScored: new Set(),
          legend: '' as any,
        }],
      ]),
      battlefields: new Map([
        [bf1, {
          id: bf1,
          controller: null,
          units: new Set(),
          facedownCard: null,
          contested: false,
        }],
      ]),
      turnState: {
        phase: Phase.Combat,
        turnPlayer: p1,
        turnNumber: 1,
        priority: null,
      },
      combatState: {
        active: true,
        attackers: new Set(),
        defenders: new Set(),
        battlefield: bf1,
        damageAssignments: new Map(),
      },
      chainState: {
        active: false,
        items: [],
      },
      rng: new SeededRNG('test-seed'),
      victoryScore: 10,
      metadata: {
        startTime: new Date(),
        mode: 'test',
      },
    };
  }

  describe('Conquer Abilities', () => {
    it('should trigger OnConquer ability when battlefield is conquered after combat', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create battlefield with OnConquer ability
      const onConquerAbility = descriptorAbility({
        id: abilityId('bf-conquer'),
        trigger: AbilityTrigger.OnConquer,
        effects: [{ type: EffectType.DrawCard }],
      });

      const battlefield: BattlefieldCard = {
        id: bf1CardId,
        owner: p1,
        name: 'Test Battlefield',
        category: 2 as any, // CardCategory.Battlefield
        domains: [],
        supertypes: [],
        tags: [],
        abilities: [onConquerAbility],
        rulesText: 'When this battlefield is conquered, draw a card.',
      };

      state.cards.set(bf1CardId, battlefield);

      // Create attacking unit (will win combat)
      const attacker: UnitCard = {
        ...createUnit(unitId('attacker'), p1, 'Attacker', { energy: 2, power: [] }, 5),
        abilities: [],
      };

      // Create defending unit (will die in combat)
      const defender: UnitCard = {
        ...createUnit(unitId('defender'), p2, 'Defender', { energy: 2, power: [] }, 2),
        abilities: [],
      };

      state.cards.set(attacker.id, attacker);
      state.cards.set(defender.id, defender);

      // Set up battlefield with both units
      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        units: new Set([attacker.id as any, defender.id as any]),
        controller: p2, // p2 controls initially
      });

      // Set up combat
      state.combatState.attackers = new Set([attacker.id as any]);
      state.combatState.defenders = new Set([defender.id as any]);

      // Assign damage: attacker deals 5, defender deals 2
      const damageAssignments = new Map();
      damageAssignments.set(attacker.id as any, new Map([[defender.id as any, 5]]));
      damageAssignments.set(defender.id as any, new Map([[attacker.id as any, 2]]));
      state.combatState.damageAssignments = damageAssignments as any;

      const p1HandSizeBefore = state.players.get(p1)!.hand.length;

      // Resolve combat (defender dies, p1 gains control and scores Conquer)
      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);

      if (combatResult.ok) {
        let newState = combatResult.value;

        // OnConquer ability should be queued
        expect(newState.abilityQueue).toBeDefined();
        expect(newState.abilityQueue!.queue.length).toBeGreaterThan(0);

        // Resolve the queued abilities
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);

        if (resolveResult.ok) {
          newState = resolveResult.value;

          // Card should have been drawn from OnConquer ability
          const p1HandSizeAfter = newState.players.get(p1)!.hand.length;
          expect(p1HandSizeAfter).toBe(p1HandSizeBefore + 1);

          // p1 should have scored Conquer points
          expect(newState.players.get(p1)!.points).toBeGreaterThan(0);
        }
      }
    });

    it('should trigger OnConquer on units at the battlefield', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create unit with OnConquer ability
      const onConquerAbility = descriptorAbility({
        id: abilityId('unit-conquer'),
        trigger: AbilityTrigger.OnConquer,
        effects: [{ type: EffectType.DrawCard }],
      });

      const attacker: UnitCard = {
        ...createUnit(unitId('attacker'), p1, 'Conquer Unit', { energy: 2, power: [] }, 5),
        abilities: [onConquerAbility],
      };

      const defender: UnitCard = {
        ...createUnit(unitId('defender'), p2, 'Defender', { energy: 2, power: [] }, 2 as any),
        abilities: [],
      };

      state.cards.set(attacker.id, attacker);
      state.cards.set(defender.id, defender);

      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        units: new Set([attacker.id as any, defender.id as any]),
        controller: p2,
      });

      state.combatState.attackers = new Set([attacker.id as any]);
      state.combatState.defenders = new Set([defender.id as any]);

      const damageAssignments = new Map();
      damageAssignments.set(attacker.id as any, new Map([[defender.id as any, 5]]));
      damageAssignments.set(defender.id as any, new Map([[attacker.id as any, 2]]));
      state.combatState.damageAssignments = damageAssignments as any;

      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);

      if (combatResult.ok) {
        let newState = combatResult.value;

        // OnConquer ability should be queued
        expect(newState.abilityQueue!.queue.length).toBeGreaterThan(0);

        // Resolve abilities
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);
      }
    });

    it('should not trigger OnConquer if control does not change', () => {
      let state = initializeAbilitySystem(createTestState());

      const onConquerAbility = descriptorAbility({
        id: abilityId('bf-conquer'),
        trigger: AbilityTrigger.OnConquer,
        effects: [{ type: EffectType.DrawCard }],
      });

      const battlefield: BattlefieldCard = {
        id: bf1CardId,
        owner: p1,
        name: 'Test Battlefield',
        category: 2 as any,
        domains: [],
        supertypes: [],
        tags: [],
        abilities: [onConquerAbility],
        rulesText: 'When conquered, draw a card.',
      };

      state.cards.set(bf1CardId, battlefield);

      // Create attacking unit that already controls the battlefield
      const attacker: UnitCard = {
        ...createUnit(unitId('attacker'), p1, 'Attacker', { energy: 2, power: [] }, 5),
        abilities: [],
      };

      const defender: UnitCard = {
        ...createUnit(unitId('defender'), p2, 'Defender', { energy: 2, power: [] }, 2),
        abilities: [],
      };

      state.cards.set(attacker.id, attacker);
      state.cards.set(defender.id, defender);

      // p1 already controls the battlefield
      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        units: new Set([attacker.id as any, defender.id as any]),
        controller: p1,
      });

      state.combatState.attackers = new Set([attacker.id as any]);
      state.combatState.defenders = new Set([defender.id as any]);

      const damageAssignments = new Map();
      damageAssignments.set(attacker.id as any, new Map([[defender.id as any, 5]]));
      damageAssignments.set(defender.id as any, new Map([[attacker.id as any, 2]]));
      state.combatState.damageAssignments = damageAssignments as any;

      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);

      if (combatResult.ok) {
        const newState = combatResult.value;

        // No OnConquer abilities should be queued (control didn't change)
        expect(newState.abilityQueue!.queue.length).toBe(0);
      }
    });
  });

  describe('Hold Abilities', () => {
    it('should trigger OnHold ability during Beginning Phase', () => {
      let state = initializeAbilitySystem(createTestState());
      state.turnState.phase = Phase.Beginning;

      // Create battlefield with OnHold ability
      const onHoldAbility = descriptorAbility({
        id: abilityId('bf-hold'),
        trigger: AbilityTrigger.OnHold,
        effects: [{ type: EffectType.DrawCard }],
      });

      const battlefield: BattlefieldCard = {
        id: bf1CardId,
        owner: p1,
        name: 'Test Battlefield',
        category: 2 as any,
        domains: [],
        supertypes: [],
        tags: [],
        abilities: [onHoldAbility],
        rulesText: 'When this battlefield is held, draw a card.',
      };

      state.cards.set(bf1CardId, battlefield);

      // Set p1 as controller
      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        controller: p1,
      });

      const p1HandSizeBefore = state.players.get(p1)!.hand.length;

      // Execute Beginning Phase (should score Hold and trigger abilities)
      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        let newState = beginningResult.value;

        // OnHold ability should be queued
        expect(newState.abilityQueue).toBeDefined();
        expect(newState.abilityQueue!.queue.length).toBeGreaterThan(0);

        // Resolve abilities
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);

        if (resolveResult.ok) {
          newState = resolveResult.value;

          // Should have drawn 1 card from OnHold ability (no auto-draw in Beginning Phase)
          const p1HandSizeAfter = newState.players.get(p1)!.hand.length;
          expect(p1HandSizeAfter).toBe(p1HandSizeBefore + 1);

          // p1 should have scored Hold points
          expect(newState.players.get(p1)!.points).toBeGreaterThan(0);
        }
      }
    });

    it('should trigger OnHold on units at the battlefield', () => {
      let state = initializeAbilitySystem(createTestState());
      state.turnState.phase = Phase.Beginning;

      // Create unit with OnHold ability
      const onHoldAbility = descriptorAbility({
        id: abilityId('unit-hold'),
        trigger: AbilityTrigger.OnHold,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(unitId('hold-unit'), p1, 'Hold Unit', { energy: 2, power: [] }, 3),
        abilities: [onHoldAbility],
      };

      state.cards.set(unit.id, unit);

      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        units: new Set([unit.id as any]),
        controller: p1,
      });

      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        let newState = beginningResult.value;

        // OnHold ability should be queued
        expect(newState.abilityQueue!.queue.length).toBeGreaterThan(0);

        // Resolve abilities
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);
      }
    });

    it('should trigger multiple Hold abilities at the same battlefield', () => {
      let state = initializeAbilitySystem(createTestState());
      state.turnState.phase = Phase.Beginning;

      const onHoldAbility = descriptorAbility({
        id: abilityId('hold-ability'),
        trigger: AbilityTrigger.OnHold,
        effects: [{ type: EffectType.DrawCard }],
      });

      // Create battlefield with Hold ability
      const battlefield: BattlefieldCard = {
        id: bf1CardId,
        owner: p1,
        name: 'Test Battlefield',
        category: 2 as any,
        domains: [],
        supertypes: [],
        tags: [],
        abilities: [onHoldAbility],
        rulesText: 'When held, draw a card.',
      };

      // Create two units with Hold abilities
      const unit1: UnitCard = {
        ...createUnit(unitId('unit1'), p1, 'Hold Unit 1', { energy: 2, power: [] }, 3),
        abilities: [onHoldAbility],
      };

      const unit2: UnitCard = {
        ...createUnit(unitId('unit2'), p1, 'Hold Unit 2', { energy: 2, power: [] }, 3),
        abilities: [onHoldAbility],
      };

      state.cards.set(bf1CardId, battlefield);
      state.cards.set(unit1.id, unit1);
      state.cards.set(unit2.id, unit2);

      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        units: new Set([unit1.id as any, unit2.id as any]),
        controller: p1,
      });

      const p1HandSizeBefore = state.players.get(p1)!.hand.length;

      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        let newState = beginningResult.value;

        // Should have 3 OnHold abilities queued (battlefield + 2 units)
        expect(newState.abilityQueue!.queue.length).toBe(3);

        // Resolve all abilities
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);

        if (resolveResult.ok) {
          newState = resolveResult.value;

          // Should draw 3 cards from abilities (no auto-draw in Beginning Phase)
          const p1HandSizeAfter = newState.players.get(p1)!.hand.length;
          expect(p1HandSizeAfter).toBe(p1HandSizeBefore + 3);
        }
      }
    });

    it('should not trigger Hold if battlefield is not controlled', () => {
      let state = initializeAbilitySystem(createTestState());
      state.turnState.phase = Phase.Beginning;

      const onHoldAbility = descriptorAbility({
        id: abilityId('bf-hold'),
        trigger: AbilityTrigger.OnHold,
        effects: [{ type: EffectType.DrawCard }],
      });

      const battlefield: BattlefieldCard = {
        id: bf1CardId,
        owner: p1,
        name: 'Test Battlefield',
        category: 2 as any,
        domains: [],
        supertypes: [],
        tags: [],
        abilities: [onHoldAbility],
        rulesText: 'When held, draw a card.',
      };

      state.cards.set(bf1CardId, battlefield);

      // No controller set
      state.battlefields.set(bf1, {
        ...state.battlefields.get(bf1)!,
        controller: null,
      });

      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        const newState = beginningResult.value;

        // No Hold abilities should be queued (no control)
        expect(newState.abilityQueue!.queue.length).toBe(0);
      }
    });
  });
});
