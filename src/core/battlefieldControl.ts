/**
 * Battlefield Control System
 * 
 * Implements Riftbound's battlefield ownership and contested mechanics:
 * - Control: Player ownership of battlefields (Rule 179)
 * - Contested: Temporary status when control is challenged (Rule 181.3)
 * - Control establishment and loss (Rule 181.4)
 */

import { GameState, getPlayer, getBattlefield, updateBattlefield, getCard } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { PlayerId, BattlefieldId } from '../types/primitives.js';
import { isUnit } from '../types/cards.js';

/**
 * Get the controller of a battlefield
 */
export function getBattlefieldController(
  state: GameState,
  battlefieldId: BattlefieldId
): PlayerId | null {
  const battlefield = getBattlefield(state, battlefieldId);
  return battlefield?.controller ?? null;
}

/**
 * Check if a battlefield is controlled (by any player)
 * Rule 181.2.a
 */
export function isBattlefieldControlled(
  state: GameState,
  battlefieldId: BattlefieldId
): boolean {
  return getBattlefieldController(state, battlefieldId) !== null;
}

/**
 * Check if a battlefield is controlled by a specific player
 */
export function isControlledBy(
  state: GameState,
  battlefieldId: BattlefieldId,
  playerId: PlayerId
): boolean {
  return getBattlefieldController(state, battlefieldId) === playerId;
}

/**
 * Check if a battlefield is contested
 * Rule 181.3
 */
export function isBattlefieldContested(
  state: GameState,
  battlefieldId: BattlefieldId
): boolean {
  const battlefield = getBattlefield(state, battlefieldId);
  return battlefield?.contested ?? false;
}

/**
 * Apply Contested status to a battlefield
 * Rule 181.3.a: Applied when a unit controlled by a player moves to a battlefield
 * where they don't control and that unit's controller doesn't already control
 */
export function applyContested(
  state: GameState,
  battlefieldId: BattlefieldId
): Result<GameState> {
  const battlefield = getBattlefield(state, battlefieldId);
  if (!battlefield) {
    return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield ${battlefieldId} not found`));
  }

  // Can't contest if already contested (Rule 181.3.c - control can't change while contested)
  if (battlefield.contested) {
    return ok(state); // Already contested, no change
  }

  return ok(updateBattlefield(state, battlefieldId, {
    ...battlefield,
    contested: true,
  }));
}

/**
 * Remove Contested status from a battlefield
 * Rule 181.3.b: Remains contested until control is established or re-established
 */
export function removeContested(
  state: GameState,
  battlefieldId: BattlefieldId
): Result<GameState> {
  const battlefield = getBattlefield(state, battlefieldId);
  if (!battlefield) {
    return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield ${battlefieldId} not found`));
  }

  return ok(updateBattlefield(state, battlefieldId, {
    ...battlefield,
    contested: false,
  }));
}

/**
 * Establish control of a battlefield
 * Rule 181.4: Player controls battlefield if they control units there
 */
export function establishControl(
  state: GameState,
  battlefieldId: BattlefieldId,
  playerId: PlayerId
): Result<GameState> {
  const battlefield = getBattlefield(state, battlefieldId);
  if (!battlefield) {
    return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield ${battlefieldId} not found`));
  }

  // Rule 181.3.c: Control cannot change while contested
  if (battlefield.contested) {
    return err(validationError(
      'BATTLEFIELD_CONTESTED',
      `Cannot change control of battlefield ${battlefieldId} while contested`
    ));
  }

  // Verify player has units at battlefield
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Check if player has any units at this battlefield
  const hasUnitsAtBattlefield = Array.from(battlefield.units).some((unitId) => {
    const unit = getCard(state, unitId as any);
    return unit && isUnit(unit) && unit.owner === playerId;
  });

  if (!hasUnitsAtBattlefield && battlefield.units.size > 0) {
    return err(validationError(
      'NO_UNITS_AT_BATTLEFIELD',
      `Player ${playerId} has no units at battlefield ${battlefieldId}`
    ));
  }

  return ok(updateBattlefield(state, battlefieldId, {
    ...battlefield,
    controller: playerId,
  }));
}

/**
 * Remove control from a battlefield (make it uncontrolled)
 * Rule 181.4.c: Player loses control when they have no units at battlefield
 */
export function loseControl(
  state: GameState,
  battlefieldId: BattlefieldId
): Result<GameState> {
  const battlefield = getBattlefield(state, battlefieldId);
  if (!battlefield) {
    return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield ${battlefieldId} not found`));
  }

  // Rule 181.3.c: Control cannot change while contested
  if (battlefield.contested) {
    return err(validationError(
      'BATTLEFIELD_CONTESTED',
      `Cannot change control of battlefield ${battlefieldId} while contested`
    ));
  }

  return ok(updateBattlefield(state, battlefieldId, {
    ...battlefield,
    controller: null,
  }));
}

/**
 * Update battlefield control based on units present
 * Rule 181.4: Called after units move or are destroyed
 * 
 * This checks:
 * - If current controller has no units → lose control
 * - If uncontrolled and one player has units → establish control
 */
export function updateBattlefieldControl(
  state: GameState,
  battlefieldId: BattlefieldId
): Result<GameState> {
  const battlefield = getBattlefield(state, battlefieldId);
  if (!battlefield) {
    return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield ${battlefieldId} not found`));
  }

  // Can't update control while contested
  if (battlefield.contested) {
    return ok(state);
  }

  // TODO: Count units per player at this battlefield
  // For now, this is incomplete - we need card ownership tracking

  // Rule 181.4.c: If current controller has no units, they lose control
  if (battlefield.controller && battlefield.units.size === 0) {
    return loseControl(state, battlefieldId);
  }

  return ok(state);
}

/**
 * Get all battlefields controlled by a player
 */
export function getControlledBattlefields(
  state: GameState,
  playerId: PlayerId
): BattlefieldId[] {
  const controlled: BattlefieldId[] = [];
  
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.controller === playerId) {
      controlled.push(battlefieldId);
    }
  }
  
  return controlled;
}

/**
 * Count how many battlefields a player controls
 */
export function countControlledBattlefields(
  state: GameState,
  playerId: PlayerId
): number {
  return getControlledBattlefields(state, playerId).length;
}
