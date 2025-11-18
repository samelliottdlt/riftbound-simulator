/**
 * Victory and Scoring System
 * 
 * Implements Riftbound's Points and Victory Score system:
 * - Victory Score: Point total needed to win (Rule 456.3)
 * - Points: Earned through Conquer and Hold (Rule 444)
 * - Win Condition: Player wins when Points >= Victory Score (Rule 445)
 * - Final Point: Special restrictions on last point (Rule 444.1.b)
 */

import { GameState, getPlayer, updatePlayer } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { PlayerId, BattlefieldId, Points } from '../types/primitives.js';

/**
 * Default victory score for standard constructed play (Rule 458.3)
 */
export const DEFAULT_VICTORY_SCORE = 8;

/**
 * Award points to a player
 * 
 * @param state Current game state
 * @param playerId Player to award points to
 * @param amount Number of points to award
 * @returns Updated game state
 */
export function awardPoints(
  state: GameState,
  playerId: PlayerId,
  amount: Points
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  const newPoints = (player.points + amount) as Points;
  
  return ok(updatePlayer(state, playerId, {
    ...player,
    points: newPoints,
  }));
}

/**
 * Get a player's current point total
 */
export function getPoints(state: GameState, playerId: PlayerId): Points {
  const player = getPlayer(state, playerId);
  return player?.points ?? 0;
}

/**
 * Check if a player has won the game
 * Rule 445: Player wins when Points >= Victory Score
 */
export function hasPlayerWon(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);
  if (!player) return false;
  
  return player.points >= state.victoryScore;
}

/**
 * Get all players who have won
 */
export function getWinners(state: GameState): PlayerId[] {
  const winners: PlayerId[] = [];
  
  for (const [playerId] of state.players) {
    if (hasPlayerWon(state, playerId)) {
      winners.push(playerId);
    }
  }
  
  return winners;
}

/**
 * Check if game is over (at least one winner)
 */
export function isGameOver(state: GameState): boolean {
  return getWinners(state).length > 0;
}

/**
 * Check if this would be a player's final point
 * Rule 444.1.b: Final point has special restrictions
 */
export function isFinalPoint(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);
  if (!player) return false;
  
  return player.points === state.victoryScore - 1;
}

/**
 * Mark a battlefield as scored this turn for a player
 * Rule 443: Can only score once per battlefield per turn
 */
export function markBattlefieldScored(
  state: GameState,
  playerId: PlayerId,
  battlefieldId: BattlefieldId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  const newScoredBattlefields = new Set(player.battlefieldsScored);
  newScoredBattlefields.add(battlefieldId);

  return ok(updatePlayer(state, playerId, {
    ...player,
    battlefieldsScored: newScoredBattlefields,
  }));
}

/**
 * Check if a player has already scored a battlefield this turn
 */
export function hasScoredBattlefield(
  state: GameState,
  playerId: PlayerId,
  battlefieldId: BattlefieldId
): boolean {
  const player = getPlayer(state, playerId);
  if (!player) return false;
  
  return player.battlefieldsScored.has(battlefieldId);
}

/**
 * Clear scored battlefields at start of turn
 * Called during Beginning phase
 */
export function clearScoredBattlefields(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  return ok(updatePlayer(state, playerId, {
    ...player,
    battlefieldsScored: new Set(),
  }));
}
