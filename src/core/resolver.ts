/**
 * Game State Resolver - Vertical Slice
 * 
 * Core game loop: resolveGameState function that processes choices
 * and returns the next game state.
 * 
 * This is the heart of the simulator - a pure function that:
 * 1. Takes current game state + player choice
 * 2. Validates the choice is legal
 * 3. Applies the choice to produce new state
 * 4. Returns new state (or error)
 */

import { GameState } from '../types/gameState.js';
import { PlayerChoice, PendingChoice } from '../types/choices.js';
import { Result, ok, err, validationError, flatMap, isOk } from '../types/result.js';
import { deriveChoices, validateChoice } from '../choices/deriveChoices.js';
import { drawCard } from '../rules/actions/draw.js';
import { advanceToActionPhase, advanceToEndingPhase, advanceToNextTurn } from '../rules/actions/turn.js';
import { Phase } from '../types/primitives.js';

/**
 * Resolves a player's choice against the current game state
 * 
 * Returns:
 * - Ok(newState): Choice was valid and applied successfully
 * - Err(error): Choice was invalid or couldn't be applied
 */
export function resolveGameState(
  state: GameState,
  choice: PlayerChoice
): Result<GameState> {
  // Step 1: Derive what choices are available
  const derivedChoicesResult = deriveChoices(state);
  if (!isOk(derivedChoicesResult)) {
    return derivedChoicesResult;
  }
  const pendingChoices = derivedChoicesResult.value;

  // Step 2: Validate the player's choice is among the available choices
  const validationResult = validateChoice(pendingChoices, choice);
  if (!isOk(validationResult)) {
    return validationResult;
  }
  const validatedChoice = validationResult.value;

  // Step 3: Apply the choice
  return applyChoice(state, validatedChoice);
}

/**
 * Applies a validated choice to the game state
 */
function applyChoice(state: GameState, choice: PendingChoice): Result<GameState> {
  switch (choice.type) {
    case 'draw':
      return flatMap(drawCard(state, choice.player), (newState) =>
        advanceToActionPhase(newState)
      );

    case 'endTurn':
      return flatMap(advanceToEndingPhase(state), (newState) =>
        advanceToNextTurn(newState)
      );

    default:
      // TypeScript should ensure this never happens
      const _exhaustive: never = choice;
      return err(
        validationError(
          'UNKNOWN_CHOICE',
          `Unknown choice type: ${(_exhaustive as any).type}`
        )
      );
  }
}

/**
 * Auto-resolves game state when no choices are pending
 * 
 * Advances through phases that have no player choices:
 * - Awaken: Auto-advance to Beginning
 * - Beginning: Auto-advance to Channel  
 * - Channel: Auto-advance to Draw
 * - Combat: Auto-advance to Ending
 * - Ending: Auto-advance to next turn
 */
export function autoResolve(state: GameState): Result<GameState> {
  switch (state.turnState.phase) {
    case Phase.Awaken:
      return ok({
        ...state,
        turnState: { ...state.turnState, phase: Phase.Beginning },
      });
      
    case Phase.Beginning:
      return ok({
        ...state,
        turnState: { ...state.turnState, phase: Phase.Channel },
      });
      
    case Phase.Channel:
      return ok({
        ...state,
        turnState: { ...state.turnState, phase: Phase.Draw },
      });
      
    case Phase.Combat:
      return ok({
        ...state,
        turnState: { ...state.turnState, phase: Phase.Ending },
      });
      
    case Phase.Ending:
      return advanceToNextTurn(state);
      
    default:
      return ok(state);
  }
}

/**
 * Gets all pending choices for the current game state
 * 
 * Convenience wrapper around deriveChoices
 */
export function getPendingChoices(state: GameState): Result<PendingChoice[]> {
  return deriveChoices(state);
}
