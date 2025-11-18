/**
 * Ability System Tests
 * 
 * Tests for the ability resolution framework including:
 * - Triggered abilities
 * - Ability queueing
 * - Resolution order (APNAP)
 * - Multiple simultaneous triggers
 */

import { describe, it, expect } from 'vitest';
import {
  createAbilityQueue,
  initializeAbilitySystem,
  checkTriggeredAbilities,
  queueTriggeredAbilities,
  resolveNextAbility,
  resolveAllQueuedAbilities,
  triggerAbilities,
  getCardAbilities,
  hasKeyword,
  getUnitsWithKeyword,
} from '../../src/core/abilityResolution.js';
import {
  descriptorAbility,
  functionAbility,
  AbilityTrigger,
  EffectType,
} from '../../src/types/abilities.js';
import { GameState } from '../../src/types/gameState.js';
import { playerId, cardId, battlefieldId, abilityId, Phase, Keyword } from '../../src/types/primitives.js';
import { createUnit } from '../../src/types/cards.js';
import { SeededRNG } from '../../src/utils/rng.js';

describe('Ability System Foundation', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  function createTestState(): GameState {
    const unit1 = createUnit(cardId('unit1'), p1, 'Test Unit 1', { energy: 1, power: [] }, 3);
    const unit2 = createUnit(cardId('unit2'), p2, 'Test Unit 2', { energy: 2, power: [] }, 4);

    return {
      cards: new Map([
        [unit1.id, unit1],
        [unit2.id, unit2],
      ]),
      players: new Map([
        [p1, {
          hand: [],
          deck: [],
          trash: [],
          banishment: [],
          championZone: null,
          base: new Set(),
          runeDeck: [],
          runesInPlay: new Set(),
          energy: 5,
          energyGenerated: 5,
          maxEnergy: 5,
          runePool: [],
          cardsPlayedThisTurn: [],
          points: 0,
          battlefieldsScored: new Set(),
          legend: '' as any,
        }],
        [p2, {
          hand: [],
          deck: [],
          trash: [],
          banishment: [],
          championZone: null,
          base: new Set(),
          runeDeck: [],
          runesInPlay: new Set(),
          energy: 4,
          energyGenerated: 4,
          maxEnergy: 4,
          runePool: [],
          cardsPlayedThisTurn: [],
          points: 0,
          battlefieldsScored: new Set(),
          legend: '' as any,
        }],
      ]),
      battlefields: new Map([
        [battlefieldId('bf1'), {
          id: battlefieldId('bf1'),
          controller: p1,
          units: new Set(),
          facedownCard: null,
          contested: false,
        }],
      ]),
      turnState: {
        phase: Phase.Action,
        turnPlayer: p1,
        turnNumber: 1,
        priority: null,
      },
      combatState: {
        active: false,
        attackers: new Set(),
        defenders: new Set(),
        battlefield: null,
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

  describe('Ability Queue', () => {
    it('should create empty ability queue', () => {
      const queue = createAbilityQueue();

      expect(queue.queue).toEqual([]);
      expect(queue.nextId).toBe(0);
    });

    it('should initialize ability system on game state', () => {
      const state = createTestState();
      const newState = initializeAbilitySystem(state);

      expect(newState.abilityQueue).toBeDefined();
      expect(newState.abilityQueue?.queue).toEqual([]);
      expect(newState.abilityQueue?.nextId).toBe(0);
    });
  });

  describe('Triggered Abilities', () => {
    it('should check for triggered abilities (none present)', () => {
      const state = initializeAbilitySystem(createTestState());

      const triggered = checkTriggeredAbilities(state, AbilityTrigger.OnPlay);

      expect(triggered).toEqual([]);
    });

    it('should queue triggered abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create a mock triggered ability
      const ability = descriptorAbility({
        id: abilityId('test-ability'),
        trigger: AbilityTrigger.OnPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      const instance = {
        id: 'ability-0',
        source: cardId('unit1'),
        controller: p1,
        ability,
        trigger: AbilityTrigger.OnPlay,
        timestamp: Date.now(),
      };

      state = queueTriggeredAbilities(state, [instance]);

      expect(state.abilityQueue?.queue.length).toBe(1);
      expect(state.abilityQueue?.queue[0]).toEqual(instance);
      expect(state.abilityQueue?.nextId).toBe(1);
    });

    it('should queue abilities in APNAP order (active player first)', () => {
      let state = initializeAbilitySystem(createTestState());
      state = { ...state, turnState: { ...state.turnState, turnPlayer: p1 } };

      const ability = descriptorAbility({
        id: abilityId('test-ability'),
        trigger: AbilityTrigger.OnPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      const p1Instance = {
        id: 'ability-0',
        source: cardId('unit1'),
        controller: p1,
        ability,
        trigger: AbilityTrigger.OnPlay,
        timestamp: Date.now(),
      };

      const p2Instance = {
        id: 'ability-1',
        source: cardId('unit2'),
        controller: p2,
        ability,
        trigger: AbilityTrigger.OnPlay,
        timestamp: Date.now(),
      };

      // Queue both abilities (p2 first, then p1)
      state = queueTriggeredAbilities(state, [p2Instance, p1Instance]);

      // Active player (p1) abilities should be first
      expect(state.abilityQueue?.queue.length).toBe(2);
      expect(state.abilityQueue?.queue[0].controller).toBe(p1);
      expect(state.abilityQueue?.queue[1].controller).toBe(p2);
    });
  });

  describe('Ability Resolution', () => {
    it('should resolve next ability from queue', () => {
      let state = initializeAbilitySystem(createTestState());

      const ability = descriptorAbility({
        id: abilityId('test-ability'),
        trigger: AbilityTrigger.OnPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      // Add card to state so resolveAbility can find it
      const unit = createUnit(cardId('unit1'), p1, 'Test Unit', { energy: 1, power: [] }, 3 as any);
      state.cards.set(unit.id, unit);

      // Ensure player has cards in deck
      const player = state.players.get(p1)!;
      if (player.deck.length === 0) {
        state = {
          ...state,
          players: new Map(state.players).set(p1, {
            ...player,
            deck: [cardId('deck-card-1'), cardId('deck-card-2')],
          }),
        };
      }

      const instance = {
        id: 'ability-0',
        source: unit.id,
        controller: p1,
        ability,
        trigger: AbilityTrigger.OnPlay,
        timestamp: Date.now(),
      };

      state = queueTriggeredAbilities(state, [instance]);

      const result = resolveNextAbility(state);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Ability should be removed from queue
        expect(result.value.abilityQueue?.queue.length).toBe(0);
      }
    });

    it('should resolve all queued abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const ability = descriptorAbility({
        id: abilityId('test-ability'),
        trigger: AbilityTrigger.OnPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      // Add cards to state
      const unit1 = createUnit(cardId('unit1'), p1, 'Test Unit 1', { energy: 1, power: [] }, 3 as any);
      const unit2 = createUnit(cardId('unit2'), p1, 'Test Unit 2', { energy: 1, power: [] }, 3 as any);
      state.cards.set(unit1.id, unit1);
      state.cards.set(unit2.id, unit2);

      // Ensure player has enough cards in deck
      const player = state.players.get(p1)!;
      state = {
        ...state,
        players: new Map(state.players).set(p1, {
          ...player,
          deck: [cardId('deck-card-1'), cardId('deck-card-2'), cardId('deck-card-3')],
        }),
      };

      const instances = [
        {
          id: 'ability-0',
          source: unit1.id,
          controller: p1,
          ability,
          trigger: AbilityTrigger.OnPlay,
          timestamp: Date.now(),
        },
        {
          id: 'ability-1',
          source: unit2.id,
          controller: p1,
          ability,
          trigger: AbilityTrigger.OnPlay,
          timestamp: Date.now() + 1,
        },
      ];

      state = queueTriggeredAbilities(state, instances);

      const result = resolveAllQueuedAbilities(state);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // All abilities should be resolved and removed
        expect(result.value.abilityQueue?.queue.length).toBe(0);
      }
    });

    it('should handle empty queue gracefully', () => {
      const state = initializeAbilitySystem(createTestState());

      const result = resolveNextAbility(state);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(state);
      }
    });
  });

  describe('Helper Functions', () => {
    it('should get card abilities (empty for now)', () => {
      const state = createTestState();

      const abilities = getCardAbilities(state, cardId('unit1'));

      // Currently returns empty until Card type is updated
      expect(abilities).toEqual([]);
    });

    it('should check if card has keyword', () => {
      const state = createTestState();
      const unit = createUnit(
        cardId('unit-with-keyword'),
        p1,
        'Assault Unit',
        { energy: 2, power: [] },
        3 as any,
        [],
        [Keyword.Assault]
      );
      state.cards.set(unit.id, unit);

      expect(hasKeyword(state, unit.id, Keyword.Assault)).toBe(true);
      expect(hasKeyword(state, unit.id, Keyword.Shield)).toBe(false);
    });

    it('should get all units with specific keyword', () => {
      const state = createTestState();
      const assaultUnit = createUnit(
        cardId('assault-unit'),
        p1,
        'Assault Unit',
        { energy: 2, power: [] },
        3 as any,
        [],
        [Keyword.Assault]
      );
      const shieldUnit = createUnit(
        cardId('shield-unit'),
        p2,
        'Shield Unit',
        { energy: 2, power: [] },
        4 as any,
        [],
        [Keyword.Shield]
      );
      state.cards.set(assaultUnit.id, assaultUnit);
      state.cards.set(shieldUnit.id, shieldUnit);

      const assaultUnits = getUnitsWithKeyword(state, Keyword.Assault);

      expect(assaultUnits).toHaveLength(1);
      expect(assaultUnits[0]).toBe(assaultUnit.id);
    });
  });

  describe('Trigger Abilities Integration', () => {
    it('should trigger and queue abilities in one step', () => {
      let state = initializeAbilitySystem(createTestState());

      // Currently no abilities on cards, so this will queue nothing
      state = triggerAbilities(state, AbilityTrigger.OnPlay);

      expect(state.abilityQueue?.queue).toEqual([]);
    });
  });
});
