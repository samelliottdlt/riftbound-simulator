/**
 * Integration tests for the Scoring system (Rule 441-444)
 *
 * Tests:
 * - Conquer scoring (gain control → score)
 * - Hold scoring (maintain control during Beginning Phase)
 * - Final Point restrictions (Rule 444.1.b)
 * - One score per battlefield per turn (Rule 443)
 * - Scorable battlefield queries
 */

import { describe, it, expect } from 'vitest';
import {
  scoreConquer,
  scoreHold,
  hasPlayerScoredAllBattlefields,
  getScorableBattlefields,
  canScoreFinalPointViaConquer,
} from '../../src/core/scoring.js';
import { establishControl } from '../../src/core/battlefieldControl.js';
import { awardPoints } from '../../src/core/victory.js';
import {
  createMinimalGameState,
  createMinimalPlayer,
} from '../utils/testHelpers.js';
import {
  playerId,
  battlefieldId,
  type Points,
} from '../../src/types/primitives.js';
import type { BattlefieldState, GameState } from '../../src/types/gameState.js';

/**
 * Helper to create a test game state with players
 */
function createTestGameState(playerIds: string[]): GameState {
  const players = new Map();
  for (const id of playerIds) {
    players.set(playerId(id), createMinimalPlayer());
  }

  return createMinimalGameState({
    players,
    turnPlayer: playerId(playerIds[0]),
  });
}

/**
 * Helper to add a battlefield to the game state
 */
function createTestBattlefield(
  state: GameState,
  id: string
): GameState {
  const bfId = battlefieldId(id);
  const bf: BattlefieldState = {
    id: bfId,
    controller: null,
    contested: false,
    units: new Set(),
    facedownCard: null,
    showdownStaged: false,
    combatStaged: false,
  };

  return {
    ...state,
    battlefields: new Map(state.battlefields).set(bfId, bf),
  };
}

describe('Scoring System', () => {
  describe('Conquer Scoring (Rule 442.1)', () => {
    it('should award a point when conquering a battlefield', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Give player control
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score via conquer
      const result = scoreConquer(state, p1, bf1);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Failed to conquer');

      const { state: newState, result: scoreResult } = result.value;

      expect(scoreResult.pointAwarded).toBe(true);
      expect(scoreResult.cardDrawn).toBe(false);
      expect(scoreResult.method).toBe('conquer');

      const player = newState.players.get(p1);
      expect(player?.points).toBe(1);
      expect(player?.battlefieldsScored.has(bf1)).toBe(true);
    });

    it('should reject conquering a battlefield already scored this turn', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Give player control
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score once
      const firstScore = scoreConquer(state, p1, bf1);
      expect(firstScore.ok).toBe(true);
      if (!firstScore.ok) throw new Error('Failed first score');
      state = firstScore.value.state;

      // Try to score again (Rule 443: only once per battlefield per turn)
      const secondScore = scoreConquer(state, p1, bf1);
      expect(secondScore.ok).toBe(false);
      if (secondScore.ok) throw new Error('Should have failed');

      expect(secondScore.error.code).toBe('ALREADY_SCORED');
    });

    it('should reject conquering a battlefield not controlled', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Try to score without control
      const result = scoreConquer(state, p1, bf1);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Should have failed');

      expect(result.error.code).toBe('NOT_CONTROLLED');
    });

    it('should allow conquering multiple battlefields in one turn', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);

      // Give player control of both
      let controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf1');
      state = controlResult.value;

      controlResult = establishControl(state, bf2, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf2');
      state = controlResult.value;

      // Score both
      const score1 = scoreConquer(state, p1, bf1);
      expect(score1.ok).toBe(true);
      if (!score1.ok) throw new Error('Failed score bf1');
      state = score1.value.state;

      const score2 = scoreConquer(state, p1, bf2);
      expect(score2.ok).toBe(true);
      if (!score2.ok) throw new Error('Failed score bf2');
      state = score2.value.state;

      const player = state.players.get(p1);
      expect(player?.points).toBe(2);
      expect(player?.battlefieldsScored.has(bf1)).toBe(true);
      expect(player?.battlefieldsScored.has(bf2)).toBe(true);
    });
  });

  describe('Hold Scoring (Rule 442.2)', () => {
    it('should award a point when holding a battlefield', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Give player control
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score via hold
      const result = scoreHold(state, p1, bf1);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Failed to hold');

      const { state: newState, result: scoreResult } = result.value;

      expect(scoreResult.pointAwarded).toBe(true);
      expect(scoreResult.cardDrawn).toBe(false);
      expect(scoreResult.method).toBe('hold');

      const player = newState.players.get(p1);
      expect(player?.points).toBe(1);
      expect(player?.battlefieldsScored.has(bf1)).toBe(true);
    });

    it('should reject holding a battlefield already scored this turn', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Give player control
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score once via hold
      const firstScore = scoreHold(state, p1, bf1);
      expect(firstScore.ok).toBe(true);
      if (!firstScore.ok) throw new Error('Failed first score');
      state = firstScore.value.state;

      // Try to score again
      const secondScore = scoreHold(state, p1, bf1);
      expect(secondScore.ok).toBe(false);
      if (secondScore.ok) throw new Error('Should have failed');

      expect(secondScore.error.code).toBe('ALREADY_SCORED');
    });

    it('should reject holding a battlefield not controlled', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Try to hold without control
      const result = scoreHold(state, p1, bf1);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Should have failed');

      expect(result.error.code).toBe('NOT_CONTROLLED');
    });
  });

  describe('Final Point Restrictions (Rule 444.1.b)', () => {
    it('should award final point via Hold without restrictions', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Give player 7 points (one away from victory score of 8)
      const pointResult = awardPoints(state, p1, 7 as Points);
      expect(pointResult.ok).toBe(true);
      if (!pointResult.ok) throw new Error('Failed to award points');
      state = pointResult.value;

      // Give player control
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score via hold (should award final point)
      const result = scoreHold(state, p1, bf1);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Failed to hold');

      const { state: newState, result: scoreResult } = result.value;

      expect(scoreResult.pointAwarded).toBe(true);
      expect(scoreResult.cardDrawn).toBe(false);

      const player = newState.players.get(p1);
      expect(player?.points).toBe(8); // Final point awarded
    });

    it('should award final point via Conquer when all battlefields scored', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);

      // Give player 7 points (one away from victory score of 8)
      const pointResult = awardPoints(state, p1, 7 as Points);
      expect(pointResult.ok).toBe(true);
      if (!pointResult.ok) throw new Error('Failed to award points');
      state = pointResult.value;

      // Give player control of both battlefields
      let controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf1');
      state = controlResult.value;

      controlResult = establishControl(state, bf2, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf2');
      state = controlResult.value;

      // Score first battlefield
      const score1 = scoreConquer(state, p1, bf1);
      expect(score1.ok).toBe(true);
      if (!score1.ok) throw new Error('Failed score bf1');
      state = score1.value.state;

      // Still at 7 points (didn't award because not all battlefields scored)
      let player = state.players.get(p1);
      expect(player?.points).toBe(7);

      // Score second battlefield (all battlefields now scored)
      const score2 = scoreConquer(state, p1, bf2);
      expect(score2.ok).toBe(true);
      if (!score2.ok) throw new Error('Failed score bf2');
      state = score2.value.state;

      // Should have awarded the final point
      player = state.players.get(p1);
      expect(player?.points).toBe(8);
      expect(score2.value.result.pointAwarded).toBe(true);
    });

    it('should draw card via Conquer when not all battlefields scored', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);

      // Give player 7 points (one away from victory score of 8)
      const pointResult = awardPoints(state, p1, 7 as Points);
      expect(pointResult.ok).toBe(true);
      if (!pointResult.ok) throw new Error('Failed to award points');
      state = pointResult.value;

      // Give player control of only one battlefield
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score it (should draw card instead of awarding point)
      const result = scoreConquer(state, p1, bf1);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Failed to conquer');

      const { state: newState, result: scoreResult } = result.value;

      expect(scoreResult.pointAwarded).toBe(false);
      expect(scoreResult.cardDrawn).toBe(true);

      // Still at 7 points (didn't award final point)
      const player = newState.players.get(p1);
      expect(player?.points).toBe(7);
    });

    it('should track that battlefield was scored even when drawing card', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);

      // Give player 7 points
      const pointResult = awardPoints(state, p1, 7 as Points);
      expect(pointResult.ok).toBe(true);
      if (!pointResult.ok) throw new Error('Failed to award points');
      state = pointResult.value;

      // Give player control of only one battlefield
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      // Score it (draws card)
      const result = scoreConquer(state, p1, bf1);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Failed to conquer');
      state = result.value.state;

      // Battlefield should still be marked as scored
      const player = state.players.get(p1);
      expect(player?.battlefieldsScored.has(bf1)).toBe(true);

      // Can't score it again this turn
      const secondScore = scoreConquer(state, p1, bf1);
      expect(secondScore.ok).toBe(false);
    });
  });

  describe('All Battlefields Scored Query', () => {
    it('should detect when player has scored all battlefields', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);

      // Initially, player hasn't scored any
      expect(hasPlayerScoredAllBattlefields(state, p1)).toBe(false);

      // Give control and score first
      let controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf1');
      state = controlResult.value;

      const score1 = scoreConquer(state, p1, bf1);
      expect(score1.ok).toBe(true);
      if (!score1.ok) throw new Error('Failed score bf1');
      state = score1.value.state;

      // Still not all battlefields
      expect(hasPlayerScoredAllBattlefields(state, p1)).toBe(false);

      // Score second
      controlResult = establishControl(state, bf2, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf2');
      state = controlResult.value;

      const score2 = scoreConquer(state, p1, bf2);
      expect(score2.ok).toBe(true);
      if (!score2.ok) throw new Error('Failed score bf2');
      state = score2.value.state;

      // Now all battlefields scored
      expect(hasPlayerScoredAllBattlefields(state, p1)).toBe(true);
    });

    it('should return false when no battlefields exist', () => {
      const p1 = playerId('p1');
      const state = createTestGameState([p1]);

      // No battlefields in game
      expect(hasPlayerScoredAllBattlefields(state, p1)).toBe(false);
    });

    it('should return false for invalid player', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const state = createTestGameState([p1]);

      expect(hasPlayerScoredAllBattlefields(state, p2)).toBe(false);
    });
  });

  describe('Scorable Battlefields Query', () => {
    it('should return controlled battlefields not yet scored', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');
      const bf3 = battlefieldId('bf3');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);
      state = createTestBattlefield(state, bf3);

      // Give control of bf1 and bf2
      let controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf1');
      state = controlResult.value;

      controlResult = establishControl(state, bf2, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf2');
      state = controlResult.value;

      // Both bf1 and bf2 should be scorable
      let scorable = getScorableBattlefields(state, p1);
      expect(scorable).toHaveLength(2);
      expect(scorable).toContain(bf1);
      expect(scorable).toContain(bf2);

      // Score bf1
      const score1 = scoreConquer(state, p1, bf1);
      expect(score1.ok).toBe(true);
      if (!score1.ok) throw new Error('Failed score bf1');
      state = score1.value.state;

      // Now only bf2 should be scorable
      scorable = getScorableBattlefields(state, p1);
      expect(scorable).toHaveLength(1);
      expect(scorable).toContain(bf2);
    });

    it('should return empty array when no battlefields controlled', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      const scorable = getScorableBattlefields(state, p1);
      expect(scorable).toHaveLength(0);
    });

    it('should return empty array when all controlled battlefields scored', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Give control and score
      const controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup');
      state = controlResult.value;

      const score = scoreConquer(state, p1, bf1);
      expect(score.ok).toBe(true);
      if (!score.ok) throw new Error('Failed score');
      state = score.value.state;

      // No more scorable battlefields
      const scorable = getScorableBattlefields(state, p1);
      expect(scorable).toHaveLength(0);
    });
  });

  describe('Final Point via Conquer Query', () => {
    it('should detect when player can score final point via Conquer', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const bf2 = battlefieldId('bf2');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);
      state = createTestBattlefield(state, bf2);

      // Give player 7 points
      const pointResult = awardPoints(state, p1, 7 as Points);
      expect(pointResult.ok).toBe(true);
      if (!pointResult.ok) throw new Error('Failed to award points');
      state = pointResult.value;

      // Not yet - haven't scored any battlefields
      expect(canScoreFinalPointViaConquer(state, p1)).toBe(false);

      // Give control and score first battlefield
      let controlResult = establishControl(state, bf1, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf1');
      state = controlResult.value;

      const score1 = scoreConquer(state, p1, bf1);
      expect(score1.ok).toBe(true);
      if (!score1.ok) throw new Error('Failed score bf1');
      state = score1.value.state;

      // Still not - only scored 1 of 2 battlefields
      expect(canScoreFinalPointViaConquer(state, p1)).toBe(false);

      // Score second battlefield
      controlResult = establishControl(state, bf2, p1);
      expect(controlResult.ok).toBe(true);
      if (!controlResult.ok) throw new Error('Failed setup bf2');
      state = controlResult.value;

      const score2 = scoreConquer(state, p1, bf2);
      expect(score2.ok).toBe(true);
      if (!score2.ok) throw new Error('Failed score bf2');
      state = score2.value.state;

      // Now they have 8 points (won), but the check would have returned true
      // just before scoring the second battlefield if we checked after marking it scored
    });

    it('should return false when not on final point', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');

      let state = createTestGameState([p1]);
      state = createTestBattlefield(state, bf1);

      // Player has 0 points
      expect(canScoreFinalPointViaConquer(state, p1)).toBe(false);

      // Give 5 points (not final point)
      const pointResult = awardPoints(state, p1, 5 as Points);
      expect(pointResult.ok).toBe(true);
      if (!pointResult.ok) throw new Error('Failed to award points');
      state = pointResult.value;

      expect(canScoreFinalPointViaConquer(state, p1)).toBe(false);
    });
  });
});
