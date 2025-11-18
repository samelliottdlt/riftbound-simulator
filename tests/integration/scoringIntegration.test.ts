/**
 * Integration tests for Scoring with Turn Structure and Combat
 *
 * Tests that Hold and Conquer scoring are properly triggered:
 * - Hold scoring during Beginning Phase
 * - Conquer scoring after combat resolution
 * - Clearing scored battlefields at turn start
 */

import { describe, it, expect } from 'vitest';
import {
  executeBeginningPhase,
  startTurn,
  advancePhase,
} from '../../src/core/turnStructure.js';
import { resolveCombatDamage } from '../../src/core/combat.js';
import { updateBattlefield } from '../../src/types/gameState.js';
import {
  createMinimalGameState,
  createMinimalPlayer,
} from '../utils/testHelpers.js';
import {
  playerId,
  battlefieldId,
  unitId,
  cardId,
  Phase,
  CardCategory,
  Keyword,
  type Points,
} from '../../src/types/primitives.js';
import type { BattlefieldState, GameState } from '../../src/types/gameState.js';
import type { UnitCard } from '../../src/types/cards.js';

/**
 * Helper to create a test unit card
 */
function createTestUnit(
  id: string,
  owner: string,
  name: string,
  attack: number,
  defense: number
): UnitCard {
  return {
    id: cardId(id),
    owner: playerId(owner),
    name,
    category: CardCategory.Unit,
    domains: [],
    supertypes: [],
    tags: [],
    cost: { energy: 0, power: 0 },
    might: { attack, defense },
    keywords: [],
    abilities: [],
    rulesText: '',
  };
}

/**
 * Helper to create a battlefield with a unit
 */
function createBattlefieldWithUnit(
  state: GameState,
  bfId: string,
  unit: UnitCard
): GameState {
  const battlefieldIdValue = battlefieldId(bfId);
  const unitIdValue = unitId(unit.id);

  // Add battlefield
  const bf: BattlefieldState = {
    id: battlefieldIdValue,
    controller: null,
    contested: false,
    units: new Set([unitIdValue]),
    facedownCard: null,
  };

  // Add unit card to game
  const newCards = new Map(state.cards);
  newCards.set(unit.id, unit);

  return {
    ...state,
    cards: newCards,
    battlefields: new Map(state.battlefields).set(battlefieldIdValue, bf),
  };
}

/**
 * Helper to set battlefield control directly (bypasses validation for testing)
 */
function setControlDirect(
  state: GameState,
  bfId: string,
  owner: string | null
): GameState {
  const battlefieldIdValue = battlefieldId(bfId);
  const ownerId = owner ? playerId(owner) : null;
  const bf = state.battlefields.get(battlefieldIdValue);
  if (!bf) throw new Error(`Battlefield ${bfId} not found`);

  return updateBattlefield(state, battlefieldIdValue, {
    ...bf,
    controller: ownerId,
  });
}

describe('Scoring Integration', () => {
  describe('Hold Scoring in Draw Phase', () => {
    it('should automatically score Hold for controlled battlefields during Draw Phase', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer(p1)]]),
        turnPlayer: p1,
        phase: Phase.Awaken,
      });

      // Create battlefield with unit
      const unit1 = createTestUnit('unit1', 'p1', 'Test Unit', 2, 2);
      state = createBattlefieldWithUnit(state, 'bf1', unit1);

      // Establish control
      state = setControlDirect(state, 'bf1', 'p1');

      // Player has 0 points initially
      let player = state.players.get(p1);
      expect(player?.points).toBe(0);

      // Advance to Beginning Phase
      const advanceResult = advancePhase(state);
      expect(advanceResult.ok).toBe(true);
      if (!advanceResult.ok) throw new Error('Failed to advance');
      state = advanceResult.value;

      // Execute Beginning Phase (should trigger Hold scoring)
      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);
      if (!beginningResult.ok) throw new Error('Failed to execute beginning');
      state = beginningResult.value;

      // Player should now have 1 point from Hold
      player = state.players.get(p1);
      expect(player?.points).toBe(1);
      expect(player?.battlefieldsScored.has(bf1)).toBe(true);
    });

    it('should score Hold for multiple controlled battlefields', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer(p1)]]),
        turnPlayer: p1,
        phase: Phase.Awaken,
      });

      // Create two battlefields with units
      const unit1 = createTestUnit('unit1', 'p1', 'Test Unit 1', 2, 2);
      const unit2 = createTestUnit('unit2', 'p1', 'Test Unit 2', 2, 2);
      state = createBattlefieldWithUnit(state, 'bf1', unit1);
      state = createBattlefieldWithUnit(state, 'bf2', unit2);

      // Establish control of both
      state = setControlDirect(state, 'bf1', 'p1');
      state = setControlDirect(state, 'bf2', 'p1');

      // Advance to Beginning Phase
      const advanceResult = advancePhase(state);
      expect(advanceResult.ok).toBe(true);
      if (!advanceResult.ok) throw new Error('Failed to advance');
      state = advanceResult.value;

      // Execute Beginning Phase
      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);
      if (!beginningResult.ok) throw new Error('Failed beginning');
      state = beginningResult.value;

      // Player should have 2 points (one from each battlefield)
      const player = state.players.get(p1);
      expect(player?.points).toBe(2);
      expect(player?.battlefieldsScored.has(bf1)).toBe(true);
      expect(player?.battlefieldsScored.has(bf2)).toBe(true);
    });

    it('should not score Hold for uncontrolled battlefields', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer(p1)]]),
        turnPlayer: p1,
        phase: Phase.Awaken,
      });

      // Create battlefield but DON'T establish control
      const unit1 = createTestUnit('unit1', 'p1', 'Test Unit', 2, 2);
      state = createBattlefieldWithUnit(state, 'bf1', unit1);

      // Advance to Beginning Phase
      const advanceResult = advancePhase(state);
      expect(advanceResult.ok).toBe(true);
      if (!advanceResult.ok) throw new Error('Failed to advance');
      state = advanceResult.value;

      // Execute Beginning Phase
      const beginningResult = executeBeginningPhase(state, p1);
      expect(beginningResult.ok).toBe(true);
      if (!beginningResult.ok) throw new Error('Failed beginning');
      state = beginningResult.value;

      // Player should have 0 points (no control = no Hold scoring)
      const player = state.players.get(p1);
      expect(player?.points).toBe(0);
    });
  });

  describe('Conquer Scoring After Combat', () => {
    it('should automatically score Conquer when gaining control after combat', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');

      let state = createMinimalGameState({
        players: new Map([
          [p1, createMinimalPlayer(p1)],
          [p2, createMinimalPlayer(p2)],
        ]),
        turnPlayer: p1,
        phase: Phase.Combat,
      });

      // Create battlefield with p1's unit (p2 currently controls it)
      const unit1 = createTestUnit('unit1', 'p1', 'Attacker', 3, 2);
      state = createBattlefieldWithUnit(state, 'bf1', unit1);

      // p2 controls the battlefield initially
      state = setControlDirect(state, 'bf1', 'p2');

      // Set up combat state (simulating p1 attacked and won)
      state = {
        ...state,
        combatState: {
          active: true,
          attackers: new Set([unitId(unit1.id)]),
          defenders: new Set(),
          battlefield: bf1,
          damageAssignments: new Map() as any,
        },
      };

      // Player p1 has 0 points initially
      let player1 = state.players.get(p1);
      expect(player1?.points).toBe(0);

      // Resolve combat (p1's unit remains, should establish control and Conquer)
      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);
      if (!combatResult.ok) throw new Error('Failed combat');
      state = combatResult.value;

      // p1 should now have 1 point from Conquer
      player1 = state.players.get(p1);
      expect(player1?.points).toBe(1);
      expect(player1?.battlefieldsScored.has(bf1)).toBe(true);
    });

    it('should not score Conquer if already scored this turn', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');

      let state = createMinimalGameState({
        players: new Map([
          [p1, createMinimalPlayer(p1)],
          [p2, createMinimalPlayer(p2)],
        ]),
        turnPlayer: p1,
        phase: Phase.Combat,
      });

      // Create battlefield
      const unit1 = createTestUnit('unit1', 'p1', 'Attacker', 3, 2);
      state = createBattlefieldWithUnit(state, 'bf1', unit1);

      // p1 controls and has already scored
      state = setControlDirect(state, 'bf1', 'p1');

      // Manually mark as scored
      const player1 = state.players.get(p1)!;
      state = {
        ...state,
        players: new Map(state.players).set(p1, {
          ...player1,
          battlefieldsScored: new Set([bf1]),
          points: 1 as Points,
        }),
      };

      // Set up combat
      state = {
        ...state,
        combatState: {
          active: true,
          attackers: new Set([unitId(unit1.id)]),
          defenders: new Set(),
          battlefield: bf1,
          damageAssignments: new Map() as any,
        },
      };

      // Resolve combat
      const combatResult = resolveCombatDamage(state);
      expect(combatResult.ok).toBe(true);
      if (!combatResult.ok) throw new Error('Failed combat');
      state = combatResult.value;

      // Still only 1 point (no additional Conquer)
      const updatedPlayer = state.players.get(p1);
      expect(updatedPlayer?.points).toBe(1);
    });
  });

  describe('Turn Cycle with Scoring', () => {
    it('should clear scored battlefields at start of new turn', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');

      let state = createMinimalGameState({
        players: new Map([
          [p1, createMinimalPlayer(p1)],
          [p2, createMinimalPlayer(p2)],
        ]),
        turnPlayer: p1,
        phase: Phase.Awaken,
      });

      // Create battlefield
      const unit1 = createTestUnit('unit1', 'p1', 'Unit', 2, 2);
      state = createBattlefieldWithUnit(state, 'bf1', unit1);

      // p1 controls
      state = setControlDirect(state, 'bf1', 'p1');

      // Mark as scored
      const player1 = state.players.get(p1)!;
      state = {
        ...state,
        players: new Map(state.players).set(p1, {
          ...player1,
          battlefieldsScored: new Set([bf1]),
        }),
      };

      // Verify battlefield is scored
      expect(state.players.get(p1)?.battlefieldsScored.has(bf1)).toBe(true);

      // Start new turn for p2
      const turnResult = startTurn(state, p2);
      expect(turnResult.ok).toBe(true);
      if (!turnResult.ok) throw new Error('Failed turn');
      state = turnResult.value;

      // Start new turn for p1 again
      const turn2Result = startTurn(state, p1);
      expect(turn2Result.ok).toBe(true);
      if (!turn2Result.ok) throw new Error('Failed turn 2');
      state = turn2Result.value;

      // Battlefield should no longer be marked as scored
      expect(state.players.get(p1)?.battlefieldsScored.has(bf1)).toBe(false);
    });
  });
});
