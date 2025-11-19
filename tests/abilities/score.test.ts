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
import { playerId, cardId, battlefieldId, abilityId, unitId, UnitId, Phase, TurnStateType, ChainStateType } from '../../src/types/primitives.js';
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
          showdownStaged: false,
          combatStaged: false,
        }],
      ]),
      turnState: {
        phase: Phase.Combat,
        turnPlayer: p1,
        turnNumber: 1,
        priority: null,
        stateType: TurnStateType.Neutral,
        chainState: ChainStateType.Open,
        activePlayer: null,
        focus: null,
      },
      combatState: {
        active: true,
        battlefield: bf1,
        attackingPlayer: null,
        defendingPlayer: null,
        attackers: new Set(),
        defenders: new Set(),
        damageAssignments: new Map() as Map<UnitId, Map<UnitId, number>>,
      },
      chainState: {
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
        units: new Set([attacker.id, defender.id] as UnitId[]),
        controller: p2, // p2 controls initially
      });

      // Set up combat
      state.combatState.attackers = new Set([attacker.id] as UnitId[]);
      state.combatState.defenders = new Set([defender.id] as UnitId[]);

      // Assign damage: attacker deals 5, defender deals 2
      const damageAssignments = new Map() as Map<UnitId, Map<UnitId, number>>;
      damageAssignments.set(attacker.id as UnitId, new Map([[defender.id as UnitId, 5]]));
      damageAssignments.set(defender.id as UnitId, new Map([[attacker.id as UnitId, 2]]));
      state.combatState.damageAssignments = damageAssignments;

      // Resolve combat (defender dies, p1 gains control and scores Conquer)
      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);

      if (combatResult.ok) {
        let newState = combatResult.value;

        // OnConquer ability should be added to Chain
        expect(newState.chainState).toBeDefined();
        expect(newState.chainState.items.length).toBeGreaterThan(0);

        // Resolve the Chain (note: full Chain resolution with priority passing
        // is not yet implemented, so abilities remain on Chain)
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);

        if (resolveResult.ok) {
          newState = resolveResult.value;

          // Verify ability was triggered (on Chain)
          expect(newState.chainState.items.length).toBeGreaterThan(0);

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
        units: new Set([attacker.id, defender.id] as UnitId[]),
        controller: p2,
      });

      state.combatState.attackers = new Set([attacker.id] as UnitId[]);
      state.combatState.defenders = new Set([defender.id] as UnitId[]);

      const damageAssignments = new Map() as Map<UnitId, Map<UnitId, number>>;
      damageAssignments.set(attacker.id as UnitId, new Map([[defender.id as UnitId, 5]]));
      damageAssignments.set(defender.id as UnitId, new Map([[attacker.id as UnitId, 2]]));
      state.combatState.damageAssignments = damageAssignments;

      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);

      if (combatResult.ok) {
        let newState = combatResult.value;

        // OnConquer ability should be added to Chain
        expect(newState.chainState.items.length).toBeGreaterThan(0);

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
        units: new Set([attacker.id, defender.id] as UnitId[]),
        controller: p1,
      });

      state.combatState.attackers = new Set([attacker.id] as UnitId[]);
      state.combatState.defenders = new Set([defender.id] as UnitId[]);

      const damageAssignments = new Map() as Map<UnitId, Map<UnitId, number>>;
      damageAssignments.set(attacker.id as UnitId, new Map([[defender.id as UnitId, 5]]));
      damageAssignments.set(defender.id as UnitId, new Map([[attacker.id as UnitId, 2]]));
      state.combatState.damageAssignments = damageAssignments;

      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);

      if (combatResult.ok) {
        const newState = combatResult.value;

        // No OnConquer abilities should be added to Chain (control didn't change)
        expect(newState.chainState.items.length).toBe(0);
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

      // Execute Beginning Phase (should score Hold and trigger abilities)
      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        let newState = beginningResult.value;

        // OnHold ability should be added to Chain
        expect(newState.chainState).toBeDefined();
        expect(newState.chainState.items.length).toBeGreaterThan(0);

        // Resolve the Chain (note: full Chain resolution with priority passing
        // is not yet implemented, so abilities remain on Chain)
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);

        if (resolveResult.ok) {
          newState = resolveResult.value;

          // Verify ability was triggered (on Chain)
          expect(newState.chainState.items.length).toBeGreaterThan(0);

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
        units: new Set([unit.id] as UnitId[]),
        controller: p1,
      });

      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        let newState = beginningResult.value;

        // OnHold ability should be added to Chain
        expect(newState.chainState.items.length).toBeGreaterThan(0);

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
        units: new Set([unit1.id, unit2.id] as UnitId[]),
        controller: p1,
      });

      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);

      if (beginningResult.ok) {
        let newState = beginningResult.value;

        // Should have 3 OnHold abilities added to Chain (battlefield + 2 units)
        expect(newState.chainState.items.length).toBe(3);

        // Resolve the Chain (note: full Chain resolution with priority passing
        // is not yet implemented, so abilities remain on Chain)
        const resolveResult = resolveAllQueuedAbilities(newState);
        expect(resolveResult.ok).toBe(true);

        if (resolveResult.ok) {
          newState = resolveResult.value;

          // Verify abilities were triggered (on Chain)
          expect(newState.chainState.items.length).toBe(3);
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
