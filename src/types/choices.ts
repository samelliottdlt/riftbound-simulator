/**
 * Choice Types - Vertical Slice
 * 
 * Minimal set of choices for the vertical slice.
 * Just enough to test the choice → resolution cycle.
 */

import { PlayerId } from './primitives.js';

/**
 * Draw choice - player must draw a card
 */
export interface DrawChoice {
  type: 'draw';
  player: PlayerId;
}

/**
 * End turn choice - player can end their turn
 */
export interface EndTurnChoice {
  type: 'endTurn';
  player: PlayerId;
}

/**
 * Pending choice - discriminated union of all possible choices
 * (Vertical slice: just draw and endTurn)
 */
export type PendingChoice = DrawChoice | EndTurnChoice;

/**
 * Player choice - the player's decision for a pending choice
 */
export type PlayerChoice =
  | { type: 'draw' }
  | { type: 'endTurn' };

/**
 * Type guard for draw choice
 */
export function isDrawChoice(choice: PendingChoice): choice is DrawChoice {
  return choice.type === 'draw';
}

/**
 * Type guard for end turn choice
 */
export function isEndTurnChoice(choice: PendingChoice): choice is EndTurnChoice {
  return choice.type === 'endTurn';
}
