/**
 * Choice Derivation - Vertical Slice
 * 
 * Determines what choices are available to players based on game state.
 * Pure function: same state → same choices
 */

import { GameState, getPlayer } from '../types/gameState.js';
import { PendingChoice } from '../types/choices.js';
import { Phase } from '../types/primitives.js';
import { Result, ok, err, validationError } from '../types/result.js';

/**
 * Derives all pending choices from the current game state
 * 
 * Vertical slice logic:
 * - Awaken, Beginning, Channel: No choices (auto-advance phases)
 * - Draw phase: DrawChoice if deck has cards
 * - Action phase: EndTurnChoice
 * - Combat, Ending: No choices (auto-advance)
 */
export function deriveChoices(state: GameState): Result<PendingChoice[], never> {
  const { turnState } = state;
  const player = getPlayer(state, turnState.turnPlayer);

  if (!player) {
    // This shouldn't happen in a valid game state, but handle gracefully
    return ok([]);
  }

  const choices: PendingChoice[] = [];

  switch (turnState.phase) {
    case Phase.Awaken:
    case Phase.Beginning:
    case Phase.Channel:
      // These phases have no player choices in the vertical slice
      // They should auto-advance
      break;

    case Phase.Draw:
      // If player has cards in deck, they must draw
      if (player.deck.length > 0) {
        choices.push({
          type: 'draw',
          player: turnState.turnPlayer,
        });
      }
      break;

    case Phase.Action:
      // Player can always end their turn
      choices.push({
        type: 'endTurn',
        player: turnState.turnPlayer,
      });
      break;

    case Phase.Ending:
      // No choices in ending phase (will auto-advance)
      break;
  }

  return ok(choices);
}

/**
 * Validates that a player choice matches a pending choice
 */
export function validateChoice(
  pendingChoices: PendingChoice[],
  playerChoice: { type: string }
): Result<PendingChoice> {
  const matching = pendingChoices.find((c) => c.type === playerChoice.type);

  if (!matching) {
    return err(
      validationError(
        'INVALID_CHOICE',
        `Choice type '${playerChoice.type}' is not available`,
        ['choice'],
        [
          {
            description: `Available choices: ${pendingChoices.map((c) => c.type).join(', ')}`,
          },
        ]
      )
    );
  }

  return ok(matching);
}
