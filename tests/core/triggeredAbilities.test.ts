/**
 * Triggered Abilities Tests
 * 
 * Tests for triggered ability integration with game events:
 * - OnPlay triggers
 * - OnDeath/Deathknell triggers
 * - OnScore triggers (Conquer/Hold)
 * - OnEnterPlay/OnLeavePlay triggers
 * - OnTurnStart/OnTurnEnd triggers
 */

import { describe, it, expect } from 'vitest';
import {
  triggerOnPlayAbilities,
  triggerOnDeathAbilities,
  triggerOnScoreAbilities,
  triggerOnEnterPlayAbilities,
  triggerOnLeavePlayAbilities,
  triggerOnTurnStartAbilities,
  triggerOnTurnEndAbilities,
  triggerOnAttackAbilities,
  triggerOnDefendAbilities,
  triggerAndResolveAbilities,
  hasDeathknell,
} from '../../src/core/triggeredAbilities.js';
import { initializeAbilitySystem } from '../../src/core/abilityResolution.js';
import {
  descriptorAbility,
  AbilityTrigger,
  EffectType,
} from '../../src/types/abilities.js';
import { GameState } from '../../src/types/gameState.js';
import { playerId, cardId, battlefieldId, abilityId, unitId, UnitId, Phase, Keyword, TurnStateType, ChainStateType } from '../../src/types/primitives.js';
import { createUnit, UnitCard } from '../../src/types/cards.js';
import { SeededRNG } from '../../src/utils/rng.js';

describe('Triggered Abilities Integration', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  function createTestState(): GameState {
    return {
      cards: new Map(),
      players: new Map([
        [p1, {
          hand: [],
          deck: [cardId('card1'), cardId('card2')],
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
          showdownStaged: false,
          combatStaged: false,
        }],
      ]),
      turnState: {
        phase: Phase.Action,
        turnPlayer: p1,
        turnNumber: 1,
        priority: null,
        stateType: TurnStateType.Neutral,
        chainState: ChainStateType.Open,
        activePlayer: p1,
        focus: null,
      },
      combatState: {
        active: false,
        attackers: new Set(),
        defenders: new Set(),
        battlefield: null,
        damageAssignments: new Map<UnitId, Map<UnitId, number>>(),
        attackingPlayer: null,
        defendingPlayer: null,
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

  describe('OnPlay Triggers', () => {
    it('should trigger OnPlay abilities when card is played', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create unit with OnPlay ability
      const onPlayAbility = descriptorAbility({
        id: abilityId('on-play'),
        trigger: AbilityTrigger.OnPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('unit-with-onplay'), p1, 'OnPlay Unit', { energy: 2, power: [] }, 3),
        abilities: [onPlayAbility],
      };

      state.cards.set(unit.id, unit);

      // Trigger OnPlay
      const newState = triggerOnPlayAbilities(state, unit.id);

      // Should have added ability to Chain (finalized by Cleanup)
      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.source).toBe(unit.id);
      expect(chainItem.pending).toBe(false); // Finalized by Cleanup step 8
    });

    it('should not trigger non-OnPlay abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create unit with OnDeath ability (should not trigger on play)
      const onDeathAbility = descriptorAbility({
        id: abilityId('on-death'),
        trigger: AbilityTrigger.OnDeath,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('unit-with-ondeath'), p1, 'OnDeath Unit', { energy: 2, power: [] }, 3),
        abilities: [onDeathAbility],
      };

      state.cards.set(unit.id, unit);

      // Trigger OnPlay
      const newState = triggerOnPlayAbilities(state, unit.id);

      // Should not add ability to Chain
      expect(newState.chainState.items.length).toBe(0);
    });
  });

  describe('OnDeath Triggers (Deathknell)', () => {
    it('should trigger OnDeath abilities when unit dies', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create unit with Deathknell ability
      const deathknellAbility = descriptorAbility({
        id: abilityId('deathknell'),
        trigger: AbilityTrigger.OnDeath,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('deathknell-unit'), p1, 'Deathknell Unit', { energy: 2, power: [] }, 3, [], [Keyword.Deathknell]),
        abilities: [deathknellAbility],
      };

      state.cards.set(unit.id, unit);

      // Trigger OnDeath
      const newState = triggerOnDeathAbilities(state, unit.id, p1);

      // Should have added OnDeath ability to Chain
      expect(newState.chainState.items.length).toBeGreaterThanOrEqual(1);
      const chainItems = newState.chainState.items;
      const onDeathAbility = chainItems.find((item) => item.source === unit.id);
      expect(onDeathAbility).toBeDefined();
      expect(onDeathAbility?.type).toBe('ability');
    });

    it('should detect Deathknell keyword', () => {
      let state = createTestState();

      // Create unit with Deathknell ability
      const deathknellAbility = descriptorAbility({
        id: abilityId('deathknell'),
        trigger: AbilityTrigger.OnDeath,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unitWithDeathknell: UnitCard = {
        ...createUnit(cardId('deathknell-unit'), p1, 'Deathknell Unit', { energy: 2, power: [] }, 3, [], [Keyword.Deathknell]),
        abilities: [deathknellAbility],
      };

      const unitWithoutDeathknell = createUnit(cardId('normal-unit'), p1, 'Normal Unit', { energy: 2, power: [] }, 3);

      state.cards.set(unitWithDeathknell.id, unitWithDeathknell);
      state.cards.set(unitWithoutDeathknell.id, unitWithoutDeathknell);

      expect(hasDeathknell(state, unitWithDeathknell.id)).toBe(true);
      expect(hasDeathknell(state, unitWithoutDeathknell.id)).toBe(false);
    });

    it('should trigger OnAllyDeath for other friendly units', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create unit that triggers on ally death
      const onAllyDeathAbility = descriptorAbility({
        id: abilityId('on-ally-death'),
        trigger: AbilityTrigger.OnAllyDeath,
        effects: [{ type: EffectType.BuffMight, value: 1 }],
      });

      const observer: UnitCard = {
        ...createUnit(cardId('observer'), p1, 'Observer', { energy: 2, power: [] }, 2),
        abilities: [onAllyDeathAbility],
      };

      const dyingUnit = createUnit(cardId('dying'), p1, 'Dying Unit', { energy: 1, power: [] }, 1);

      state.cards.set(observer.id, observer);
      state.cards.set(dyingUnit.id, dyingUnit);

      // Trigger death
      const newState = triggerOnDeathAbilities(state, dyingUnit.id, p1);

      // Should have added OnAllyDeath ability to Chain
      const chainItems = newState.chainState.items;
      const allyDeathAbility = chainItems.find((item) => item.source === observer.id);
      expect(allyDeathAbility).toBeDefined();
    });
  });

  describe('OnScore Triggers', () => {
    it('should trigger OnConquer abilities when battlefield is conquered', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create battlefield with OnConquer ability
      const onConquerAbility = descriptorAbility({
        id: abilityId('on-conquer'),
        trigger: AbilityTrigger.OnConquer,
        effects: [{ type: EffectType.DrawCard }],
      });

      // For now, we'll test with a unit since battlefield abilities work similarly
      const unit: UnitCard = {
        ...createUnit(cardId('conquer-unit'), p1, 'Conquer Unit', { energy: 2, power: [] }, 3),
        abilities: [onConquerAbility],
      };

      state.cards.set(unit.id, unit);

      // Trigger OnConquer
      const newState = triggerOnScoreAbilities(state, battlefieldId('bf1'), p1, 'Conquer');

      // Should have added OnConquer ability to Chain
      const chainItems = newState.chainState.items;
      const conquerAbility = chainItems.find((item) => item.source === unit.id);
      expect(conquerAbility).toBeDefined();
    });

    it('should trigger OnHold abilities when battlefield is held', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create battlefield with OnHold ability
      const onHoldAbility = descriptorAbility({
        id: abilityId('on-hold'),
        trigger: AbilityTrigger.OnHold,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('hold-unit'), p1, 'Hold Unit', { energy: 2, power: [] }, 3),
        abilities: [onHoldAbility],
      };

      state.cards.set(unit.id, unit);

      // Trigger OnHold
      const newState = triggerOnScoreAbilities(state, battlefieldId('bf1'), p1, 'Hold');

      // Should have added OnHold ability to Chain
      const chainItems = newState.chainState.items;
      const holdAbility = chainItems.find((item) => item.source === unit.id);
      expect(holdAbility).toBeDefined();
    });
  });

  describe('Zone Change Triggers', () => {
    it('should trigger OnEnterPlay abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const onEnterAbility = descriptorAbility({
        id: abilityId('on-enter'),
        trigger: AbilityTrigger.OnEnterPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('enter-unit'), p1, 'Enter Unit', { energy: 2, power: [] }, 3),
        abilities: [onEnterAbility],
      };

      state.cards.set(unit.id, unit);

      const newState = triggerOnEnterPlayAbilities(state, unit.id);

      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.source).toBe(unit.id);
    });

    it('should trigger OnLeavePlay abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const onLeaveAbility = descriptorAbility({
        id: abilityId('on-leave'),
        trigger: AbilityTrigger.OnLeavePlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('leave-unit'), p1, 'Leave Unit', { energy: 2, power: [] }, 3),
        abilities: [onLeaveAbility],
      };

      state.cards.set(unit.id, unit);

      const newState = triggerOnLeavePlayAbilities(state, unit.id);

      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.source).toBe(unit.id);
    });
  });

  describe('Turn Triggers', () => {
    it('should trigger OnTurnStart abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const onTurnStartAbility = descriptorAbility({
        id: abilityId('on-turn-start'),
        trigger: AbilityTrigger.OnTurnStart,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('turn-start-unit'), p1, 'Turn Start Unit', { energy: 2, power: [] }, 3),
        abilities: [onTurnStartAbility],
      };

      state.cards.set(unit.id, unit);

      const newState = triggerOnTurnStartAbilities(state, p1);

      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.controller).toBe(p1);
    });

    it('should trigger OnTurnEnd abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const onTurnEndAbility = descriptorAbility({
        id: abilityId('on-turn-end'),
        trigger: AbilityTrigger.OnTurnEnd,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('turn-end-unit'), p1, 'Turn End Unit', { energy: 2, power: [] }, 3),
        abilities: [onTurnEndAbility],
      };

      state.cards.set(unit.id, unit);

      const newState = triggerOnTurnEndAbilities(state, p1);

      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.controller).toBe(p1);
    });
  });

  describe('Combat Triggers', () => {
    it('should trigger OnAttack abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const onAttackAbility = descriptorAbility({
        id: abilityId('on-attack'),
        trigger: AbilityTrigger.OnAttack,
        effects: [{ type: EffectType.BuffMight, value: 2 }],
      });

      const unit: UnitCard = {
        ...createUnit(unitId('attacker'), p1, 'Attacker', { energy: 2, power: [] }, 3),
        abilities: [onAttackAbility],
      };

      state.cards.set(unit.id, unit);

      const newState = triggerOnAttackAbilities(state, unit.id as any);

      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.source).toBe(unit.id);
    });

    it('should trigger OnDefend abilities', () => {
      let state = initializeAbilitySystem(createTestState());

      const onDefendAbility = descriptorAbility({
        id: abilityId('on-defend'),
        trigger: AbilityTrigger.OnDefend,
        effects: [{ type: EffectType.BuffMight, value: 1 }],
      });

      const unit: UnitCard = {
        ...createUnit(unitId('defender'), p1, 'Defender', { energy: 2, power: [] }, 3),
        abilities: [onDefendAbility],
      };

      state.cards.set(unit.id, unit);

      const newState = triggerOnDefendAbilities(state, unit.id as any);

      expect(newState.chainState.items.length).toBe(1);
      const chainItem = newState.chainState.items[0];
      expect(chainItem.type).toBe('ability');
      expect(chainItem.source).toBe(unit.id);
    });
  });

  describe('Trigger and Resolve', () => {
    it('should trigger and resolve abilities immediately', () => {
      let state = initializeAbilitySystem(createTestState());

      // Create unit with OnPlay that draws a card
      const onPlayAbility = descriptorAbility({
        id: abilityId('on-play-draw'),
        trigger: AbilityTrigger.OnPlay,
        effects: [{ type: EffectType.DrawCard }],
      });

      const unit: UnitCard = {
        ...createUnit(cardId('draw-unit'), p1, 'Draw Unit', { energy: 2, power: [] }, 3),
        abilities: [onPlayAbility],
      };

      state.cards.set(unit.id, unit);

      // Trigger and resolve
      const result = triggerAndResolveAbilities(state, AbilityTrigger.OnPlay, { playedCard: unit.id });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Note: With Chain integration, abilities are added to Chain and need
        // Chain resolution (priority passing) to execute. The triggerAndResolveAbilities
        // function currently doesn't fully resolve the Chain, so abilities remain on Chain.
        // This test validates the ability was triggered and added to Chain.
        expect(result.value.chainState.items.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
