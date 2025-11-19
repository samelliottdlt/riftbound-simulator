/**
 * Exhaustion System (Rules 401-402)
 * 
 * Handles exhausting and readying permanents (Units, Gear, Runes)
 */

import { GameState, getCard, updateCard } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { CardId, PlayerId } from '../types/primitives.js';
import { isUnit, isGear, isRune } from '../types/cards.js';

/**
 * Exhaust a permanent (Rule 401)
 * 
 * Exhausting is an action that marks a non-spell Game Object as "spent".
 * Exhausted permanents cannot be exhausted again until readied.
 */
export function exhaustPermanent(
  state: GameState,
  cardId: CardId
): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  // Only units, gear, and runes can be exhausted
  if (!isUnit(card) && !isGear(card) && !isRune(card)) {
    return err(validationError(
      'CANNOT_EXHAUST',
      `${card.name} cannot be exhausted (not a permanent)`,
      ['Only Units, Gear, and Runes can be exhausted']
    ));
  }

  // Check if already exhausted
  if (card.exhausted) {
    return err(validationError(
      'ALREADY_EXHAUSTED',
      `${card.name} is already exhausted`,
      ['Cannot exhaust an already exhausted permanent']
    ));
  }

  // Exhaust the permanent
  const exhaustedCard = {
    ...card,
    exhausted: true,
  };

  return ok(updateCard(state, exhaustedCard));
}

/**
 * Ready a permanent (Rule 402)
 * 
 * Readying is an action that removes the "exhausted" status from a Game Object.
 * Typically happens during Awaken phase (Rule 315.1).
 */
export function readyPermanent(
  state: GameState,
  cardId: CardId
): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  // Only units, gear, and runes can be readied
  if (!isUnit(card) && !isGear(card) && !isRune(card)) {
    return err(validationError(
      'CANNOT_READY',
      `${card.name} cannot be readied (not a permanent)`,
      ['Only Units, Gear, and Runes can be readied']
    ));
  }

  // If not exhausted, no change needed
  if (!card.exhausted) {
    return ok(state); // Already ready
  }

  // Ready the permanent
  const readiedCard = {
    ...card,
    exhausted: false,
  };

  return ok(updateCard(state, readiedCard));
}

/**
 * Ready all permanents controlled by a player (Rule 315.1.a)
 * 
 * During Awaken phase, the Turn Player readies all Game Objects they control
 * that are able to be readied.
 */
export function readyAllPermanents(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  let newState = state;

  // Find all permanents owned by player
  for (const [cardId, card] of state.cards) {
    if (card.owner !== playerId) continue;
    
    // Only ready units, gear, and runes that are exhausted
    if ((isUnit(card) || isGear(card) || isRune(card)) && card.exhausted) {
      const readyResult = readyPermanent(newState, cardId);
      if (!readyResult.ok) {
        // Continue on error - don't fail entire ready process
        continue;
      }
      newState = readyResult.value;
    }
  }

  return ok(newState);
}

/**
 * Check if a permanent is exhausted
 */
export function isExhausted(state: GameState, cardId: CardId): boolean {
  const card = getCard(state, cardId);
  if (!card) return false;
  
  if (!isUnit(card) && !isGear(card) && !isRune(card)) {
    return false; // Non-permanents are never exhausted
  }

  return card.exhausted === true;
}

/**
 * Check if a permanent is ready (not exhausted)
 */
export function isReady(state: GameState, cardId: CardId): boolean {
  return !isExhausted(state, cardId);
}
