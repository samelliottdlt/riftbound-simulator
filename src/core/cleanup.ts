/**
 * Cleanup System (Rules 318-323)
 * 
 * The Cleanup is the core state-correction mechanism in Riftbound.
 * It occurs automatically after state changes and executes 10 ordered steps.
 * 
 * Rule 319: A Cleanup occurs after:
 * - State transitions (Open/Closed)
 * - Phase transitions
 * - Pending Items become Legal Items
 * - Chain Items removed
 * - Game Objects enter/leave board
 * - Game Object status changes
 * - Move actions complete
 * 
 * Rule 321: If events during Cleanup qualify for another Cleanup,
 * recursively invoke Cleanup until no changes occur.
 */

import { GameState, BattlefieldState, updateBattlefield } from '../types/gameState.js';
import { Result, ok } from '../types/result.js';
import { PlayerId, UnitId, BattlefieldId, TurnStateType, ChainStateType } from '../types/primitives.js';
import { isUnit } from '../types/cards.js';
import { getCard } from '../types/gameState.js';

/**
 * Perform a complete Cleanup (Rule 322)
 * 
 * Executes all 10 steps in order, then checks for recursion (Rule 321).
 * 
 * @param state - Current game state
 * @param isSpecialCleanup - Whether this is a Special Cleanup with extra steps
 * @param specialSteps - Additional steps for Special Cleanup (inserted at specific points)
 * @returns Updated game state or error
 */
export function performCleanup(
  state: GameState,
  _isSpecialCleanup: boolean = false,
  specialSteps?: Map<number, (s: GameState) => Result<GameState>>
): Result<GameState> {
  let currentState = state;
  let changeOccurred = false;
  
  // Rule 320: During Cleanup, Chain Items cannot be Resolved
  // Priority and Focus are not passed or awarded
  
  // Execute 10 steps in order (Rule 322)
  const steps: Array<(s: GameState) => Result<GameState>> = [
    step1_CheckVictory,
    step2_KillLethalllyDamagedUnits,
    step3_UpdateCombatDesignations,
    step4_ClearUncontrolledBattlefields,
    step5_RecallGearAndHiddenCards,
    step6_StageShowdownsAtUncontrolled,
    step7_StageCombatsAtControlled,
    step8_FinalizePendingChainItems,
    step9_InitiateShowdowns,
    step10_InitiateCombats,
  ];
  
  for (let i = 0; i < steps.length; i++) {
    // Insert special cleanup steps if provided
    if (specialSteps?.has(i)) {
      const specialStep = specialSteps.get(i)!;
      const specialResult = specialStep(currentState);
      if (!specialResult.ok) return specialResult;
      
      if (specialResult.value !== currentState) {
        changeOccurred = true;
        currentState = specialResult.value;
      }
    }
    
    // Execute regular step
    const stepResult = steps[i](currentState);
    if (!stepResult.ok) return stepResult;
    
    if (stepResult.value !== currentState) {
      changeOccurred = true;
      currentState = stepResult.value;
    }
  }
  
  // Rule 321: If event during Cleanup qualifies for Cleanup, recurse
  // Note: We use changeOccurred as proxy for "qualifies for Cleanup"
  // In full implementation, would check specific triggers (Rule 319)
  if (changeOccurred) {
    // Recurse with normal Cleanup (Rule 323.2: subsequent are normal, not Special)
    return performCleanup(currentState, false);
  }
  
  return ok(currentState);
}

/**
 * Step 1: Check Victory (Rule 322.1)
 * 
 * If a player has as many points as the Victory Score, that player wins.
 */
function step1_CheckVictory(state: GameState): Result<GameState> {
  for (const [_playerId, player] of state.players) {
    if (player.points >= state.victoryScore) {
      // Game over - player wins
      // For now, just return state (victory handling is elsewhere)
      // In full implementation, would set game.winner or similar
      return ok(state);
    }
  }
  
  return ok(state);
}

/**
 * Step 2: Kill Lethally Damaged Units (Rule 322.2)
 * 
 * All Units that have non-zero Damage marked on them equalling or
 * exceeding their Might are killed and placed in their owners' Trash.
 */
function step2_KillLethalllyDamagedUnits(state: GameState): Result<GameState> {
  let newState = state;
  const unitsToKill: UnitId[] = [];
  
  // Find all lethally damaged units
  for (const [cardId, card] of state.cards) {
    if (isUnit(card) && card.damage && card.damage > 0) {
      if (card.damage >= card.might) {
        unitsToKill.push(cardId as UnitId);
      }
    }
  }
  
  // Kill each unit (move to trash, clear from board zones)
  for (const _unitId of unitsToKill) {
    // This will be implemented using killUnit from zoneManagement
    // For now, placeholder
    // TODO: Import and use killUnit
  }
  
  return ok(newState);
}

/**
 * Step 3: Update Combat Designations (Rule 322.3)
 * 
 * Assign or Remove Attacker or Defender designation from Units as needed
 * if there is a Combat in progress.
 */
function step3_UpdateCombatDesignations(state: GameState): Result<GameState> {
  if (!state.combatState.active) {
    return ok(state); // No combat in progress
  }
  
  const combatBattlefield = state.combatState.battlefield;
  if (!combatBattlefield) {
    return ok(state);
  }
  
  let newState = state;
  
  // Rule 322.3.a: Units at combat battlefield without designation gain controller's designation
  // Rule 322.3.b: Units at combat battlefield with opposite designation switch
  // Rule 322.3.c: Units at other locations with designations lose them
  
  // TODO: Implement designation updates
  // This requires tracking which player is attacker vs defender
  
  return ok(newState);
}

/**
 * Step 4: Clear Uncontrolled Battlefields (Rule 322.4)
 * 
 * Battlefields with no Units occupying them and no Contested status
 * become Uncontrolled.
 */
function step4_ClearUncontrolledBattlefields(state: GameState): Result<GameState> {
  let newState = state;
  
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.units.size === 0 && !battlefield.contested) {
      if (battlefield.controller !== null) {
        // Clear controller
        const updatedBattlefield: BattlefieldState = {
          ...battlefield,
          controller: null,
        };
        newState = updateBattlefield(newState, battlefieldId, updatedBattlefield);
      }
    }
  }
  
  return ok(newState);
}

/**
 * Step 5: Recall Gear and Hidden Cards (Rule 322.5)
 * 
 * Recall all Gear at Battlefields. Remove all Hidden cards from all
 * Battlefields that are not controlled by the same player and place
 * them in their owner's Trash.
 */
function step5_RecallGearAndHiddenCards(state: GameState): Result<GameState> {
  // TODO: Implement gear recall
  // TODO: Implement hidden card removal
  return ok(state);
}

/**
 * Step 6: Stage Showdowns at Uncontrolled Battlefields (Rule 322.6)
 * 
 * Mark a Showdown as Staged at each Battlefield that Contested was
 * applied to that is Uncontrolled.
 * 
 * Only stage if not already in a Showdown state (to prevent re-staging
 * during Cleanup recursion after Showdown has been initiated).
 */
function step6_StageShowdownsAtUncontrolled(state: GameState): Result<GameState> {
  let newState = state;
  
  // Don't stage showdowns if already in a Showdown state
  if (state.turnState.stateType === TurnStateType.Showdown) {
    return ok(newState);
  }
  
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.contested && battlefield.controller === null) {
      // Stage showdown if not already staged
      if (!battlefield.showdownStaged) {
        const updatedBattlefield: BattlefieldState = {
          ...battlefield,
          showdownStaged: true,
        };
        newState = updateBattlefield(newState, battlefieldId, updatedBattlefield);
      }
    }
  }
  
  return ok(newState);
}

/**
 * Step 7: Stage Combats at Controlled Battlefields (Rule 322.7)
 * 
 * Mark a Combat as Staged at each Battlefield that Contested was applied
 * to that is controlled by a different player than the one who applied
 * the Contested Status.
 * 
 * The Combat remains Staged at that Battlefield as long as there are
 * Units present from two opposing players there.
 * 
 * Only stage if not already in a Showdown state (to prevent re-staging
 * during Cleanup recursion after Combat has been initiated).
 */
function step7_StageCombatsAtControlled(state: GameState): Result<GameState> {
  let newState = state;
  
  // Don't stage combats if already in a Showdown state
  if (state.turnState.stateType === TurnStateType.Showdown) {
    return ok(newState);
  }
  
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.contested && battlefield.controller !== null && battlefield.contestedBy) {
      // Contested applied to battlefield controlled by different player
      if (battlefield.controller !== battlefield.contestedBy) {
        // Check if units from both players present
        const unitsAtBattlefield = Array.from(battlefield.units)
          .map(unitId => getCard(state, unitId))
          .filter(card => card && isUnit(card));
        
        const owners = new Set(unitsAtBattlefield.map(card => card!.owner));
        
        if (owners.size >= 2) {
          // Stage combat if not already staged
          if (!battlefield.combatStaged) {
            const updatedBattlefield: BattlefieldState = {
              ...battlefield,
              combatStaged: true,
            };
            newState = updateBattlefield(newState, battlefieldId, updatedBattlefield);
          }
        }
      }
    }
  }
  
  return ok(newState);
}

/**
 * Step 8: Finalize Pending Chain Items (Rule 322.8)
 * 
 * Finalize any Pending Items on the Chain.
 */
function step8_FinalizePendingChainItems(state: GameState): Result<GameState> {
  // Check if any items on chain are pending
  const hasPendingItems = state.chainState.items.some(item => item.pending);
  
  if (!hasPendingItems) {
    return ok(state); // Nothing to finalize
  }
  
  // TODO: Implement proper finalization
  // For now, mark all as non-pending
  const newChainItems = state.chainState.items.map(item => ({
    ...item,
    pending: false,
  }));
  
  const newState: GameState = {
    ...state,
    chainState: {
      items: newChainItems,
    },
  };
  
  return ok(newState);
}

/**
 * Step 9: Initiate Showdowns (Rule 322.9)
 * 
 * If the current state is a Neutral Open State and one or more Showdowns
 * are Staged, the Turn Player chooses one of those Battlefields.
 * A Showdown begins there.
 * 
 * Rule 340: A Showdown begins when Control of a Battlefield is Contested
 * and the turn is in a Neutral Open State.
 * 
 * Rule 341: As a Showdown begins, the player who applied Contested status
 * to the Battlefield gains Focus.
 */
function step9_InitiateShowdowns(state: GameState): Result<GameState> {
  // Check if in Neutral Open State
  if (state.turnState.stateType !== TurnStateType.Neutral) {
    return ok(state); // Not in Neutral State
  }
  if (state.turnState.chainState !== ChainStateType.Open) {
    return ok(state); // Not in Open State
  }
  
  // Find staged showdowns
  const stagedShowdowns: BattlefieldId[] = [];
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.showdownStaged) {
      stagedShowdowns.push(battlefieldId);
    }
  }
  
  if (stagedShowdowns.length === 0) {
    return ok(state); // No staged showdowns
  }
  
  // Rule 322.9: Turn Player chooses one battlefield
  // For now, implement simple case: choose first staged showdown
  // TODO: When there are multiple, create a pending choice for Turn Player
  const chosenBattlefield = stagedShowdowns[0];
  const battlefield = state.battlefields.get(chosenBattlefield);
  
  if (!battlefield) {
    return ok(state); // Battlefield not found (shouldn't happen)
  }
  
  // Determine who gains Focus (Rule 341: player who applied Contested)
  const focusPlayer = battlefield.contestedBy || state.turnState.turnPlayer;
  
  // Begin Showdown: transition to Showdown State and award Focus
  let newState: GameState = {
    ...state,
    turnState: {
      ...state.turnState,
      stateType: TurnStateType.Showdown,  // Rule 308.1: Showdown in progress
      focus: focusPlayer,                  // Rule 341: Player who applied Contested gains Focus
    },
  };
  
  // Clear showdownStaged flag at the chosen battlefield
  const updatedBattlefieldState: BattlefieldState = {
    ...battlefield,
    showdownStaged: false,
  };
  newState = updateBattlefield(newState, chosenBattlefield, updatedBattlefieldState);
  
  // Note: Rule 342 - Initial Chain for combat-initiated showdowns
  // Not implemented yet (will be part of combat system integration)
  
  return ok(newState);
}

/**
 * Step 10: Initiate Combats (Rule 322.10)
 * 
 * If the current state is a Neutral Open State and Combat is Staged at
 * one or more Battlefields, the Turn Player chooses one of those
 * Battlefields. Combat begins there.
 * 
 * Rule 438.1: Combat begins with a Showdown
 * Rule 438.1.a: Establish Attacker and Defender designations
 * Rule 438.1.a.1: Attacker is player who applied Contested status
 * Rule 438.1.a.1.a: Attacker gains Focus
 */
function step10_InitiateCombats(state: GameState): Result<GameState> {
  // Check if in Neutral Open State
  if (state.turnState.stateType !== TurnStateType.Neutral) {
    return ok(state); // Not in Neutral State
  }
  if (state.turnState.chainState !== ChainStateType.Open) {
    return ok(state); // Not in Open State
  }
  
  // Find staged combats
  const stagedCombats: BattlefieldId[] = [];
  for (const [battlefieldId, battlefield] of state.battlefields) {
    if (battlefield.combatStaged) {
      stagedCombats.push(battlefieldId);
    }
  }
  
  if (stagedCombats.length === 0) {
    return ok(state); // No staged combats
  }
  
  // Rule 322.10: Turn Player chooses one battlefield
  // For now, implement simple case: choose first staged combat
  // TODO: When there are multiple, create a pending choice for Turn Player
  const chosenBattlefield = stagedCombats[0];
  const battlefield = state.battlefields.get(chosenBattlefield);
  
  if (!battlefield) {
    return ok(state); // Battlefield not found (shouldn't happen)
  }
  
  // Determine Attacker and Defender players (Rule 438.1.a)
  // Attacker is player who applied Contested status
  const attackingPlayer = battlefield.contestedBy || state.turnState.turnPlayer;
  
  // Defender is the other player (simplified for 2-player)
  let defendingPlayer: PlayerId | null = null;
  for (const [playerId] of state.players) {
    if (playerId !== attackingPlayer) {
      defendingPlayer = playerId;
      break;
    }
  }
  
  if (!defendingPlayer) {
    return ok(state); // No defender found (shouldn't happen in 2-player)
  }
  
  // Collect attacking and defending units (Rule 438.1.a.3 and 438.1.a.4)
  const attackers = new Set<UnitId>();
  const defenders = new Set<UnitId>();
  
  for (const unitId of battlefield.units) {
    const card = state.cards.get(unitId as any);
    if (card && isUnit(card)) {
      if (card.owner === attackingPlayer) {
        attackers.add(unitId as any);
      } else if (card.owner === defendingPlayer) {
        defenders.add(unitId as any);
      }
    }
  }
  
  // Begin Combat: transition to Showdown State and set combat active
  let newState: GameState = {
    ...state,
    turnState: {
      ...state.turnState,
      stateType: TurnStateType.Showdown,  // Rule 438.1: Showdown opens
      focus: attackingPlayer,              // Rule 438.1.a.1.a: Attacker gains Focus
    },
    combatState: {
      ...state.combatState,
      active: true,
      battlefield: chosenBattlefield,
      attackingPlayer,
      defendingPlayer,
      attackers,
      defenders,
      damageAssignments: new Map<UnitId, Map<UnitId, number>>(),
    },
  };
  
  // Clear combatStaged flag at the chosen battlefield
  const updatedBattlefieldState: BattlefieldState = {
    ...battlefield,
    combatStaged: false,
  };
  newState = updateBattlefield(newState, chosenBattlefield, updatedBattlefieldState);
  
  // Note: Rule 438.1.b - Initial Chain for triggered abilities (OnAttack, OnDefend)
  // Not implemented yet (will be part of triggered abilities enhancement)
  
  return ok(newState);
}

/**
 * Helper: Check if Cleanup should occur (Rule 319)
 * 
 * Returns true if any of the triggering conditions are met.
 */
export function shouldPerformCleanup(
  oldState: GameState,
  newState: GameState
): boolean {
  // Rule 319.1: After state transitions
  if (oldState.turnState.stateType !== newState.turnState.stateType) return true;
  if (oldState.turnState.chainState !== newState.turnState.chainState) return true;
  
  // Rule 319.2: After phase transitions
  if (oldState.turnState.phase !== newState.turnState.phase) return true;
  
  // Rule 319.3: After Pending Item becomes Legal Item
  const oldPending = oldState.chainState.items.filter(i => i.pending).length;
  const newPending = newState.chainState.items.filter(i => i.pending).length;
  if (oldPending > newPending) return true;
  
  // Rule 319.4: After Chain Item removed
  if (oldState.chainState.items.length > newState.chainState.items.length) return true;
  
  // Rule 319.5: After Game Objects enter/leave board
  // Check all board zones (bases, battlefields)
  for (const [playerId, player] of newState.players) {
    const oldPlayer = oldState.players.get(playerId);
    if (oldPlayer && oldPlayer.base.size !== player.base.size) return true;
    if (oldPlayer && oldPlayer.runesInPlay.size !== player.runesInPlay.size) return true;
  }
  
  for (const [battlefieldId, battlefield] of newState.battlefields) {
    const oldBattlefield = oldState.battlefields.get(battlefieldId);
    if (oldBattlefield && oldBattlefield.units.size !== battlefield.units.size) return true;
  }
  
  // Rule 319.6: After status changes
  // (damage, exhaustion, control, contested, etc.)
  // This is a catch-all - for now, assume any other difference triggers cleanup
  
  // Rule 319.7: After Move completes
  // (This is checked explicitly in movement.ts)
  
  return false;
}
