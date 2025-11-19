/**
 * Unit Movement System
 * 
 * Implements movement mechanics for units:
 * - Standard Move (Rule 141)
 * - Ganking keyword (Rule 726)
 * - Movement restrictions and validation
 */

import { GameState, getCard, getPlayer, updatePlayer, getBattlefield, updateBattlefield, BattlefieldState } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { PlayerId, UnitId, BattlefieldId, Phase, Keyword } from '../types/primitives.js';
import { UnitCard, isUnit } from '../types/cards.js';
import { exhaustPermanent, isExhausted } from './exhaustion.js';
import { performCleanup } from './cleanup.js';

/**
 * Location where a unit can be
 */
export type UnitLocation = 
  | { type: 'base' }
  | { type: 'battlefield'; battlefieldId: BattlefieldId };

/**
 * Get the current location of a unit
 */
export function getUnitLocation(state: GameState, unitId: UnitId): Result<UnitLocation> {
  const card = getCard(state, unitId as any);
  if (!card || !isUnit(card)) {
    return err(validationError('INVALID_UNIT', `${unitId} is not a unit`));
  }

  // Check if unit is in a player's base
  const owner = getPlayer(state, card.owner);
  if (!owner) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${card.owner} not found`));
  }

  if (owner.base.has(unitId as any)) {
    return ok({ type: 'base' });
  }

  // Check all battlefields
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.units.has(unitId as any)) {
      return ok({ type: 'battlefield', battlefieldId });
    }
  }

  return err(validationError('UNIT_NOT_ON_BOARD', `Unit ${unitId} is not on the board`));
}

/**
 * Check if a unit can move (Rule 141.1)
 * - Must be during Action phase
 * - Not during Closed State (not implemented yet)
 * - Not during Showdown (not implemented yet)
 */
export function canMove(state: GameState, unitId: UnitId): Result<boolean> {
  // Check phase (Rule 141.1.a)
  if (state.turnState.phase !== Phase.Action) {
    return ok(false);
  }

  const card = getCard(state, unitId as any);
  if (!card || !isUnit(card)) {
    return err(validationError('INVALID_UNIT', `${unitId} is not a unit`));
  }

  // Check if it's the unit owner's turn
  if (card.owner !== state.turnState.turnPlayer) {
    return ok(false);
  }

  // Check if unit is exhausted (Rule 141.2)
  if (isExhausted(state, unitId as any)) {
    return ok(false);
  }

  return ok(true);
}

/**
 * Check if a battlefield can accept more units
 * Rule 141.4.a.1: Cannot move to battlefield with units from 2 other players
 */
function canBattlefieldAcceptUnit(
  state: GameState, 
  battlefieldId: BattlefieldId, 
  unitOwner: PlayerId
): boolean {
  const battlefield = getBattlefield(state, battlefieldId);
  if (!battlefield) return false;

  // Get unique players already present at battlefield
  const playersPresent = new Set<PlayerId>();
  for (const unitId of battlefield.units) {
    const unit = getCard(state, unitId as any);
    if (unit && isUnit(unit)) {
      playersPresent.add(unit.owner);
    }
  }

  // If unit owner is already present, they can add more units
  if (playersPresent.has(unitOwner)) {
    return true;
  }

  // Cannot join if 2 other players already present
  return playersPresent.size < 2;
}

/**
 * Validate a move from source to destination
 */
function validateMove(
  state: GameState,
  unit: UnitCard,
  from: UnitLocation,
  to: UnitLocation
): Result<void> {
  const hasGanking = unit.keywords.includes(Keyword.Ganking);

  // Base to Battlefield (Rule 141.4.a)
  if (from.type === 'base' && to.type === 'battlefield') {
    if (!canBattlefieldAcceptUnit(state, to.battlefieldId, unit.owner)) {
      return err(validationError(
        'BATTLEFIELD_FULL',
        `Cannot move to battlefield ${to.battlefieldId} - already has units from 2 players`
      ));
    }
    return ok(undefined);
  }

  // Battlefield to Base (Rule 141.4.b) - always allowed
  if (from.type === 'battlefield' && to.type === 'base') {
    return ok(undefined);
  }

  // Battlefield to Battlefield (Rule 141.4.c) - requires Ganking
  if (from.type === 'battlefield' && to.type === 'battlefield') {
    if (!hasGanking) {
      return err(validationError(
        'GANKING_REQUIRED',
        `Unit ${unit.id} cannot move battlefield to battlefield without Ganking keyword`
      ));
    }

    if (!canBattlefieldAcceptUnit(state, to.battlefieldId, unit.owner)) {
      return err(validationError(
        'BATTLEFIELD_FULL',
        `Cannot move to battlefield ${to.battlefieldId} - already has units from 2 players`
      ));
    }
    return ok(undefined);
  }

  return err(validationError('INVALID_MOVE', `Invalid move from ${from.type} to ${to.type}`));
}

/**
 * Move a unit to a new location (Rule 141)
 * 
 * Standard Move rules:
 * - Base to Battlefield (Rule 141.4.a)
 * - Battlefield to Base (Rule 141.4.b)
 * - Battlefield to Battlefield with Ganking (Rule 141.4.c, Rule 726)
 * 
 * Cost: Exhausting the unit (Rule 141.2) - not yet implemented
 */
export function moveUnit(
  state: GameState,
  unitId: UnitId,
  destination: UnitLocation
): Result<GameState> {
  // Validate unit exists and can move
  const canMoveResult = canMove(state, unitId);
  if (!canMoveResult.ok) {
    return canMoveResult;
  }

  if (!canMoveResult.value) {
    return err(validationError(
      'CANNOT_MOVE',
      `Unit ${unitId} cannot move at this time`
    ));
  }

  const card = getCard(state, unitId as any);
  if (!card || !isUnit(card)) {
    return err(validationError('INVALID_UNIT', `${unitId} is not a unit`));
  }

  // Get current location
  const locationResult = getUnitLocation(state, unitId);
  if (!locationResult.ok) {
    return locationResult;
  }

  const from = locationResult.value;

  // Validate the move
  const validateResult = validateMove(state, card, from, destination);
  if (!validateResult.ok) {
    return validateResult;
  }

  let newState = state;

  // Remove from source
  if (from.type === 'base') {
    const player = getPlayer(newState, card.owner);
    if (!player) {
      return err(validationError('PLAYER_NOT_FOUND', `Player ${card.owner} not found`));
    }

    const newBase = new Set(player.base);
    newBase.delete(unitId as any);
    newState = updatePlayer(newState, card.owner, { ...player, base: newBase });
  } else if (from.type === 'battlefield') {
    const battlefield = getBattlefield(newState, from.battlefieldId);
    if (!battlefield) {
      return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield not found`));
    }

    const newUnits = new Set(battlefield.units);
    newUnits.delete(unitId as any);
    newState = updateBattlefield(newState, from.battlefieldId, {
      ...battlefield,
      units: newUnits,
    });
  }

  // Add to destination
  if (destination.type === 'base') {
    const player = getPlayer(newState, card.owner);
    if (!player) {
      return err(validationError('PLAYER_NOT_FOUND', `Player ${card.owner} not found`));
    }

    const newBase = new Set(player.base);
    newBase.add(unitId as any);
    newState = updatePlayer(newState, card.owner, { ...player, base: newBase });
  } else if (destination.type === 'battlefield') {
    const battlefield = getBattlefield(newState, destination.battlefieldId);
    if (!battlefield) {
      return err(validationError('BATTLEFIELD_NOT_FOUND', `Battlefield not found`));
    }

    const newUnits = new Set(battlefield.units);
    newUnits.add(unitId as any);
    
    // Apply Contested status if moving to enemy-controlled battlefield (Rule 424, 181.3.a)
    let updatedBattlefield: BattlefieldState = {
      ...battlefield,
      units: newUnits,
    };
    
    if (battlefield.controller !== null && battlefield.controller !== card.owner) {
      updatedBattlefield = {
        ...updatedBattlefield,
        contested: true,
        contestedBy: card.owner,
      };
    }
    
    newState = updateBattlefield(newState, destination.battlefieldId, updatedBattlefield);
  }

  // Exhaust the unit (Rule 141.2)
  const exhaustResult = exhaustPermanent(newState, unitId as any);
  if (!exhaustResult.ok) return exhaustResult;
  newState = exhaustResult.value;

  // Perform Cleanup after move completes (Rule 319.7, Rule 427)
  const cleanupResult = performCleanup(newState);
  if (!cleanupResult.ok) return cleanupResult;

  return ok(cleanupResult.value);
}

/**
 * Move multiple units simultaneously (Rule 141.3)
 * All units must have the same destination
 */
export function moveUnits(
  state: GameState,
  unitIds: UnitId[],
  destination: UnitLocation
): Result<GameState> {
  if (unitIds.length === 0) {
    return ok(state);
  }

  // Validate all units can move
  for (const unitId of unitIds) {
    const canMoveResult = canMove(state, unitId);
    if (!canMoveResult.ok) {
      return canMoveResult;
    }

    if (!canMoveResult.value) {
      return err(validationError(
        'CANNOT_MOVE',
        `Unit ${unitId} cannot move at this time`
      ));
    }
  }

  // Move each unit sequentially (state is immutable, so this is safe)
  let newState = state;
  for (const unitId of unitIds) {
    const moveResult = moveUnit(newState, unitId, destination);
    if (!moveResult.ok) {
      return moveResult;
    }
    newState = moveResult.value;
  }

  return ok(newState);
}
