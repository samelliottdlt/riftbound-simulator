/**
 * Draw Action - Vertical Slice
 * 
 * Handles the draw action: move top card from deck to hand
 */

import { GameState, getPlayer, updatePlayer } from '../../types/gameState.js';
import { Result, ok, err, validationError } from '../../types/result.js';
import { PlayerId } from '../../types/primitives.js';

/**
 * Draws a card from the player's deck to their hand
 * 
 * Preconditions:
 * - Player must exist
 * - Player's deck must have at least one card
 * 
 * Postconditions:
 * - Top card of deck is removed
 * - That card is added to hand
 */
export function drawCard(state: GameState, playerId: PlayerId): Result<GameState> {
  const player = getPlayer(state, playerId);

  if (!player) {
    return err(
      validationError(
        'PLAYER_NOT_FOUND',
        `Player ${playerId} not found`,
        ['players', playerId]
      )
    );
  }

  if (player.deck.length === 0) {
    return err(
      validationError(
        'EMPTY_DECK',
        `Player ${playerId} has no cards in deck`,
        ['players', playerId, 'deck'],
        [
          {
            description: 'Cannot draw from empty deck',
          },
        ]
      )
    );
  }

  // Draw top card (index 0) from deck
  const [drawnCard, ...remainingDeck] = player.deck;

  // Update player state
  const updatedPlayer = {
    ...player,
    deck: remainingDeck,
    hand: [...player.hand, drawnCard],
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}
