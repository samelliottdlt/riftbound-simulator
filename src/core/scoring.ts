/**
 * Scoring system for Riftbound (Rule 441-444)
 *
 * Players score points in two ways:
 * - Conquer: Gain control of a battlefield they haven't scored this turn
 * - Hold: Maintain control of a battlefield during their Beginning Phase
 *
 * Final Point restrictions (Rule 444.1.b):
 * - Hold: Always awards the final point
 * - Conquer: Only awards final point if all battlefields have been scored this turn
 */

import { Result, ok, err, validationError } from '../types/result.js';
import type { GameState } from '../types/gameState.js';
import type {
  PlayerId,
  BattlefieldId,
  Points,
} from '../types/primitives.js';
import { awardPoints, isFinalPoint, markBattlefieldScored } from './victory.js';
import {
  getBattlefieldController,
  isBattlefieldControlled,
} from './battlefieldControl.js';

/**
 * The method by which a player scored a battlefield.
 */
export type ScoreMethod = 'conquer' | 'hold';

/**
 * The outcome of a scoring attempt.
 */
export interface ScoreResult {
  /** Whether the player earned a point */
  pointAwarded: boolean;
  /** Whether the player drew a card (final point via conquer without all battlefields) */
  cardDrawn: boolean;
  /** The method used to score */
  method: ScoreMethod;
}

/**
 * Attempt to score a battlefield via Conquer (Rule 442.1).
 *
 * A player conquers when they gain control of a battlefield they haven't scored this turn.
 * If this would be the final point, special restrictions apply (Rule 444.1.b).
 *
 * @param state - Current game state
 * @param playerId - Player attempting to conquer
 * @param battlefieldId - Battlefield being conquered
 * @returns Updated game state with point awarded, or error if invalid
 */
export function scoreConquer(
  state: GameState,
  playerId: PlayerId,
  battlefieldId: BattlefieldId
): Result<{ state: GameState; result: ScoreResult }> {
  const player = state.players.get(playerId);
  if (!player) {
    return err(validationError('INVALID_PLAYER', `Player ${playerId} not found`));
  }

  // Check if battlefield has already been scored this turn (Rule 443)
  if (player.battlefieldsScored.has(battlefieldId)) {
    return err(validationError(
      'ALREADY_SCORED',
      `Player ${playerId} has already scored battlefield ${battlefieldId} this turn`
    ));
  }

  // Verify the player controls the battlefield
  const controller = getBattlefieldController(state, battlefieldId);
  if (controller !== playerId) {
    return err(validationError(
      'NOT_CONTROLLED',
      `Player ${playerId} does not control battlefield ${battlefieldId}`
    ));
  }

  // Mark battlefield as scored
  const markResult = markBattlefieldScored(state, playerId, battlefieldId);
  if (!markResult.ok) return markResult;
  let newState = markResult.value;

  // Check if this would be the final point (Rule 444.1.b)
  const isLastPoint = isFinalPoint(state, playerId);

  if (isLastPoint) {
    // Final point via Conquer: must have scored ALL battlefields this turn
    const allBattlefieldsScored = hasPlayerScoredAllBattlefields(newState, playerId);

    if (allBattlefieldsScored) {
      // Award the final point (Rule 444.1.b.2)
      const awardResult = awardPoints(newState, playerId, 1 as Points);
      if (!awardResult.ok) return awardResult;

      return ok({
        state: awardResult.value,
        result: {
          pointAwarded: true,
          cardDrawn: false,
          method: 'conquer',
        },
      });
    } else {
      // Draw a card instead of awarding the point (Rule 444.1.b.2)
      // TODO: Implement card drawing - for now just return state without point
      return ok({
        state: newState,
        result: {
          pointAwarded: false,
          cardDrawn: true,
          method: 'conquer',
        },
      });
    }
  }

  // Not the final point: award normally (Rule 444.1)
  const awardResult = awardPoints(newState, playerId, 1 as Points);
  if (!awardResult.ok) return awardResult;

  return ok({
    state: awardResult.value,
    result: {
      pointAwarded: true,
      cardDrawn: false,
      method: 'conquer',
    },
  });
}

/**
 * Attempt to score a battlefield via Hold (Rule 442.2).
 *
 * A player holds when they maintain control of a battlefield during their Beginning Phase.
 * Hold always awards the final point without restrictions (Rule 444.1.b.1).
 *
 * @param state - Current game state
 * @param playerId - Player attempting to hold (must be turn player)
 * @param battlefieldId - Battlefield being held
 * @returns Updated game state with point awarded, or error if invalid
 */
export function scoreHold(
  state: GameState,
  playerId: PlayerId,
  battlefieldId: BattlefieldId
): Result<{ state: GameState; result: ScoreResult }> {
  const player = state.players.get(playerId);
  if (!player) {
    return err(validationError('INVALID_PLAYER', `Player ${playerId} not found`));
  }

  // Check if battlefield has already been scored this turn (Rule 443)
  if (player.battlefieldsScored.has(battlefieldId)) {
    return err(validationError(
      'ALREADY_SCORED',
      `Player ${playerId} has already scored battlefield ${battlefieldId} this turn`
    ));
  }

  // Verify the player controls the battlefield
  const controller = getBattlefieldController(state, battlefieldId);
  if (controller !== playerId) {
    return err(validationError(
      'NOT_CONTROLLED',
      `Player ${playerId} does not control battlefield ${battlefieldId}`
    ));
  }

  // Mark battlefield as scored
  const markResult = markBattlefieldScored(state, playerId, battlefieldId);
  if (!markResult.ok) return markResult;
  let newState = markResult.value;

  // Hold always awards a point, even if it's the final point (Rule 444.1.b.1)
  const awardResult = awardPoints(newState, playerId, 1 as Points);
  if (!awardResult.ok) return awardResult;

  return ok({
    state: awardResult.value,
    result: {
      pointAwarded: true,
      cardDrawn: false,
      method: 'hold',
    },
  });
}

/**
 * Check if a player has scored all battlefields this turn.
 *
 * Used to determine if a player can score the final point via Conquer (Rule 444.1.b.2).
 *
 * @param state - Current game state
 * @param playerId - Player to check
 * @returns True if all battlefields have been scored this turn
 */
export function hasPlayerScoredAllBattlefields(
  state: GameState,
  playerId: PlayerId
): boolean {
  const player = state.players.get(playerId);
  if (!player) return false;

  // Count all battlefields in the game
  const totalBattlefields = Array.from(state.battlefields.keys()).length;

  // If there are no battlefields, player hasn't scored all (vacuous truth handled as false)
  if (totalBattlefields === 0) return false;

  // Check if player has scored all of them
  return player.battlefieldsScored.size === totalBattlefields;
}

/**
 * Get all battlefields that can be scored by a player this turn.
 *
 * A battlefield can be scored if:
 * 1. The player controls it
 * 2. The player hasn't already scored it this turn
 *
 * @param state - Current game state
 * @param playerId - Player to check
 * @returns Array of battlefield IDs that can be scored
 */
export function getScorableBattlefields(
  state: GameState,
  playerId: PlayerId
): BattlefieldId[] {
  const player = state.players.get(playerId);
  if (!player) return [];

  const scorable: BattlefieldId[] = [];

  for (const [battlefieldId] of state.battlefields) {
    // Skip if already scored this turn
    if (player.battlefieldsScored.has(battlefieldId)) {
      continue;
    }

    // Check if player controls it
    if (
      isBattlefieldControlled(state, battlefieldId) &&
      getBattlefieldController(state, battlefieldId) === playerId
    ) {
      scorable.push(battlefieldId);
    }
  }

  return scorable;
}

/**
 * Check if a player can score the final point via Conquer at this moment.
 *
 * The final point via Conquer requires all battlefields to be scored this turn (Rule 444.1.b.2).
 *
 * @param state - Current game state
 * @param playerId - Player to check
 * @returns True if the player can score the final point via Conquer
 */
export function canScoreFinalPointViaConquer(
  state: GameState,
  playerId: PlayerId
): boolean {
  if (!isFinalPoint(state, playerId)) {
    return false;
  }

  return hasPlayerScoredAllBattlefields(state, playerId);
}
