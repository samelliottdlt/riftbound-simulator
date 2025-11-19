/**
 * Turn Action - Vertical Slice
 * 
 * Handles turn progression and phase transitions
 */

import { GameState } from '../../types/gameState.js';
import { Result, ok } from '../../types/result.js';
import { Phase } from '../../types/primitives.js';

/**
 * Advances from Beginning phase to Action phase
 */
export function advanceToActionPhase(state: GameState): Result<GameState> {
  return ok({
    ...state,
    turnState: {
      ...state.turnState,
      phase: Phase.Action,
    },
  });
}

/**
 * Advances from Action phase to Ending phase
 */
export function advanceToEndingPhase(state: GameState): Result<GameState> {
  return ok({
    ...state,
    turnState: {
      ...state.turnState,
      phase: Phase.Ending,
    },
  });
}

/**
 * Advances from Ending phase to next player's Awaken phase
 * 
 * Vertical slice: assumes 2-player game (p1 and p2)
 */
export function advanceToNextTurn(state: GameState): Result<GameState> {
  const currentPlayer = state.turnState.turnPlayer;
  const nextPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';

  return ok({
    ...state,
    turnState: {
      ...state.turnState,
      phase: Phase.Awaken,
      turnPlayer: nextPlayer as any,
      turnNumber: state.turnState.turnNumber + 1,
      priority: null,
    },
  });
}
