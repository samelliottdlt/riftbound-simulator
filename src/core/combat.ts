/**
 * Combat System
 * 
 * Handles combat resolution in Riftbound:
 * - Attack declaration
 * - Blocker assignment
 * - Damage calculation and assignment
 * - Combat damage resolution
 * - Unit destruction
 * 
 * Combat keywords handled:
 * - Assault: +X might while attacker
 * - Shield: +X might while defender
 * - Tank: Must be assigned lethal before non-Tank units
 */

import { GameState, getCard, getBattlefield, updateCard } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { PlayerId, UnitId, BattlefieldId, Phase, Keyword } from '../types/primitives.js';
import { UnitCard, isUnit } from '../types/cards.js';
import { killCard } from './zoneManagement.js';
import { getBattlefieldController, removeContested, establishControl } from './battlefieldControl.js';
import { scoreConquer } from './scoring.js';
import { triggerOnScoreAbilities } from './triggeredAbilities.js';

/**
 * Check if a unit has a specific keyword
 */
function hasKeyword(card: UnitCard, keyword: Keyword): boolean {
  return card.keywords.includes(keyword);
}

/**
 * Get might value for a unit (Rule 140.2)
 * - Assault: +X might while attacker (Rule 723)
 * - Shield: +X might while defender (Rule 730)
 * - Keywords, abilities, and effects can modify might
 * 
 * Note: Currently simplified - full keyword/ability system will be implemented later
 */
function getMight(card: UnitCard, isAttacker: boolean = false, isDefender: boolean = false): number {
  let might = card.might;
  
  // Apply Assault bonus if attacker (Rule 723)
  if (isAttacker && hasKeyword(card, Keyword.Assault)) {
    // TODO: Extract Assault value from keyword when we implement parameterized keywords
    // For now, Assault = +1
    might += 1;
  }
  
  // Apply Shield bonus if defender (Rule 730)
  if (isDefender && hasKeyword(card, Keyword.Shield)) {
    // TODO: Extract Shield value from keyword when we implement parameterized keywords
    // For now, Shield = +1
    might += 1;
  }
  
  // Might cannot be less than 0 (Rule 140.2.b)
  return Math.max(0, might);
}

/**
 * Assign damage to units respecting Tank keyword priority (Rule 731)
 * 
 * Rules:
 * - Rule 731.1.b: Tank units must be assigned lethal damage before non-Tank units
 * - Rule 439.1.d.3: Units must have lethal damage assigned before moving to next
 * - Rule 439.1.d.4: Can't assign more than lethal unless no other targets
 * - Rule 439.1.d.6: Multiple Tank units can be assigned in any order
 * 
 * @param totalDamage Total damage to assign
 * @param units Units receiving damage (sorted by priority)
 * @returns Map of unitId to damage assigned
 */
function assignDamage(totalDamage: number, units: UnitCard[]): Map<string, number> {
  const assignments = new Map<string, number>();
  let remainingDamage = totalDamage;

  // Separate units into Tank and non-Tank groups (Rule 731.1.c.2)
  const tankUnits = units.filter(u => hasKeyword(u, Keyword.Tank));
  const nonTankUnits = units.filter(u => !hasKeyword(u, Keyword.Tank));

  // Process Tank units first (Rule 731.1.b)
  for (const unit of tankUnits) {
    if (remainingDamage <= 0) break;

    const currentDamage = unit.damage ?? 0;
    const lethalDamage = unit.might - currentDamage;
    const damageToAssign = Math.min(remainingDamage, Math.max(0, lethalDamage));

    if (damageToAssign > 0) {
      assignments.set(unit.id, damageToAssign);
      remainingDamage -= damageToAssign;
    }
  }

  // After all Tank units have lethal, assign to non-Tank units (Rule 731.1.c.2)
  for (const unit of nonTankUnits) {
    if (remainingDamage <= 0) break;

    const currentDamage = unit.damage ?? 0;
    const lethalDamage = unit.might - currentDamage;
    const damageToAssign = Math.min(remainingDamage, Math.max(0, lethalDamage));

    if (damageToAssign > 0) {
      assignments.set(unit.id, damageToAssign);
      remainingDamage -= damageToAssign;
    }
  }

  // If damage remains and all units have lethal, assign excess (Rule 439.1.d.4)
  if (remainingDamage > 0 && units.length > 0) {
    // Assign remaining damage to last unit processed
    const lastUnit = nonTankUnits.length > 0 
      ? nonTankUnits[nonTankUnits.length - 1]
      : tankUnits[tankUnits.length - 1];
    
    const currentAssignment = assignments.get(lastUnit.id) ?? 0;
    assignments.set(lastUnit.id, currentAssignment + remainingDamage);
  }

  return assignments;
}

/**
 * Declare attackers for combat
 */
export function declareAttackers(
  state: GameState,
  attackingPlayer: PlayerId,
  attackers: UnitId[],
  targetBattlefield?: BattlefieldId
): Result<GameState> {
  // Validate it's combat phase
  if (state.turnState.phase !== Phase.Combat) {
    return err(validationError(
      'INVALID_PHASE',
      `Can only declare attackers during Combat phase, currently in ${state.turnState.phase}`
    ));
  }

  // Validate it's the attacking player's turn
  if (state.turnState.turnPlayer !== attackingPlayer) {
    return err(validationError(
      'WRONG_PLAYER',
      `Not ${attackingPlayer}'s turn`
    ));
  }

  // Validate all attackers exist and can attack
  for (const attackerId of attackers) {
    const attacker = getCard(state, attackerId as any);
    if (!attacker || !isUnit(attacker)) {
      return err(validationError('INVALID_ATTACKER', `${attackerId} is not a unit`));
    }

    // Check unit is owned by attacking player
    if (attacker.owner !== attackingPlayer) {
      return err(validationError('INVALID_ATTACKER', `${attackerId} is not owned by ${attackingPlayer}`));
    }

    // TODO: Check unit is not exhausted
  }

  // Update combat state
  const newState: GameState = {
    ...state,
    combatState: {
      ...state.combatState,
      active: true,
      attackers: new Set(attackers),
      defenders: new Set(),
      battlefield: targetBattlefield ?? null,
      damageAssignments: new Map<UnitId, Map<UnitId, number>>(),
    },
  };

  return ok(newState);
}

/**
 * Declare defenders (blockers) for combat
 */
export function declareDefenders(
  state: GameState,
  defendingPlayer: PlayerId,
  assignments: Map<UnitId, UnitId> // Blocker -> Attacker
): Result<GameState> {
  if (!state.combatState.active) {
    return err(validationError('NO_COMBAT', 'No active combat'));
  }

  // Validate all blockers exist and can block
  for (const [blockerId, attackerId] of assignments.entries()) {
    const blocker = getCard(state, blockerId as any);
    if (!blocker || !isUnit(blocker)) {
      return err(validationError('INVALID_BLOCKER', `${blockerId} is not a unit`));
    }

    // Check blocker is owned by defending player
    if (blocker.owner !== defendingPlayer) {
      return err(validationError('INVALID_BLOCKER', `${blockerId} is not owned by ${defendingPlayer}`));
    }

    // Check attacker exists and is attacking
    const attacker = getCard(state, attackerId as any);
    if (!attacker || !isUnit(attacker)) {
      return err(validationError('INVALID_ATTACKER', `${attackerId} is not a unit`));
    }

    if (!state.combatState.attackers.has(attackerId)) {
      return err(validationError('INVALID_ATTACKER', `${attackerId} is not attacking`));
    }
  }

  // Extract unique defenders
  const defenders = new Set<UnitId>();
  for (const blockerId of assignments.keys()) {
    defenders.add(blockerId);
  }

  // Build damage assignments map (Attacker -> Blocker -> Damage placeholder)
  const damageAssignments = new Map<UnitId, Map<UnitId, number>>();
  for (const [blockerId, attackerId] of assignments.entries()) {
    if (!damageAssignments.has(attackerId)) {
      damageAssignments.set(attackerId, new Map<UnitId, number>());
    }
    damageAssignments.get(attackerId)!.set(blockerId, 0); // Damage calculated during resolution
  }

  // Update combat state with defenders and assignments
  const newState: GameState = {
    ...state,
    combatState: {
      ...state.combatState,
      defenders,
      damageAssignments,
    },
  };

  return ok(newState);
}

/**
 * Resolve combat damage
 */
export function resolveCombatDamage(
  state: GameState
): Result<GameState> {
  if (!state.combatState.active) {
    return err(validationError('NO_COMBAT', 'No active combat'));
  }

  let newState = { ...state };
  const destroyedUnits: UnitId[] = [];

  // Sum might of all attackers and defenders (Rule 439.1.b-c)
  let totalAttackerMight = 0;
  let totalDefenderMight = 0;
  
  const attackers: UnitCard[] = [];
  const defenders: UnitCard[] = [];
  
  for (const attackerId of state.combatState.attackers) {
    const attacker = getCard(newState, attackerId as any);
    if (attacker && isUnit(attacker)) {
      const might = getMight(attacker, true, false); // is attacker
      totalAttackerMight += might;
      attackers.push(attacker);
    }
  }
  
  for (const defenderId of state.combatState.defenders) {
    const defender = getCard(newState, defenderId as any);
    if (defender && isUnit(defender)) {
      const might = getMight(defender, false, true); // is defender
      totalDefenderMight += might;
      defenders.push(defender);
    }
  }
  
  // Assign damage respecting Tank keyword priority (Rule 439.1.d, Rule 731)
  const defenderDamageAssignments = assignDamage(totalAttackerMight, defenders);
  const attackerDamageAssignments = assignDamage(totalDefenderMight, attackers);
  
  // Apply damage to defenders
  for (const defender of defenders) {
    const damageToDefender = defenderDamageAssignments.get(defender.id) ?? 0;
    if (damageToDefender === 0) continue;

    const currentDamage = defender.damage ?? 0;
    const newDamage = currentDamage + damageToDefender;
    
    // Update card with new damage
    const updatedDefender: UnitCard = {
      ...defender,
      damage: newDamage,
    };
    newState = updateCard(newState, updatedDefender);
    
    // Check if unit should be killed (Rule 140.2.a)
    if (newDamage >= defender.might) {
      destroyedUnits.push(defender.id as any);
    }
  }
  
  // Apply damage to attackers
  for (const attacker of attackers) {
    const damageToAttacker = attackerDamageAssignments.get(attacker.id) ?? 0;
    if (damageToAttacker === 0) continue;

    const currentDamage = attacker.damage ?? 0;
    const newDamage = currentDamage + damageToAttacker;
    
    // Update card with new damage
    const updatedAttacker: UnitCard = {
      ...attacker,
      damage: newDamage,
    };
    newState = updateCard(newState, updatedAttacker);
    
    // Check if unit should be killed (Rule 140.2.a)
    if (newDamage >= attacker.might) {
      destroyedUnits.push(attacker.id as any);
    }
  }

  // Destroy all units marked for destruction
  for (const unitId of destroyedUnits) {
    const killResult = killCard(newState, unitId as any);
    if (killResult.ok) {
      newState = killResult.value;
    }
  }

  // Get the battlefield where combat occurred
  const battlefieldId = state.combatState.battlefield;

  // Clear contested status (Rule 440.1.b)
  if (battlefieldId) {
    const removeContestedResult = removeContested(newState, battlefieldId);
    if (removeContestedResult.ok) {
      newState = removeContestedResult.value;
    }

    // Check if any units remain at the battlefield and establish control (Rule 440.2)
    const battlefield = getBattlefield(newState, battlefieldId);
    if (battlefield && battlefield.units.size > 0) {
      // Determine who has units remaining
      const playersWithUnits = new Set<PlayerId>();
      for (const unitId of battlefield.units) {
        const unit = getCard(newState, unitId as any);
        if (unit && isUnit(unit)) {
          playersWithUnits.add(unit.owner);
        }
      }

      // If exactly one player has units, they establish control
      if (playersWithUnits.size === 1) {
        const controllerId = Array.from(playersWithUnits)[0];
        const currentController = getBattlefieldController(newState, battlefieldId);

        // Only establish control if they don't already control it
        if (currentController !== controllerId) {
          const establishResult = establishControl(newState, battlefieldId, controllerId);
          if (!establishResult.ok) {
            return establishResult;
          }
          newState = establishResult.value;

          // Attempt to score Conquer (Rule 440.2.a)
          const conquerResult = scoreConquer(newState, controllerId, battlefieldId);
          if (conquerResult.ok) {
            newState = conquerResult.value.state;
            
            // Trigger Conquer abilities at this battlefield (Rule 444.2)
            newState = triggerOnScoreAbilities(newState, battlefieldId, controllerId, 'Conquer');
          }
          // If scoring fails (e.g., already scored this turn), that's okay - control is still established
        }
      }
    }
  }

  // Clear combat state
  newState = {
    ...newState,
    combatState: {
      active: false,
      attackers: new Set(),
      defenders: new Set(),
      battlefield: null,
      attackingPlayer: null,
      defendingPlayer: null,
      damageAssignments: new Map<UnitId, Map<UnitId, number>>(),
    },
  };

  return ok(newState);
}

/**
 * Check if a unit can attack
 */
export function canAttack(state: GameState, unitId: UnitId): boolean {
  const unit = getCard(state, unitId as any);
  if (!unit || !isUnit(unit)) {
    return false;
  }

  // Check if unit has Accelerate (can attack immediately)
  if (hasKeyword(unit, Keyword.Accelerate)) {
    return true;
  }

  // TODO: Check if unit has been in play since start of turn (summoning sickness)
  
  return false;
}

/**
 * Check if a unit can block
 */
export function canBlock(state: GameState, unitId: UnitId, attackerId: UnitId): boolean {
  const unit = getCard(state, unitId as any);
  if (!unit || !isUnit(unit)) {
    return false;
  }

  const attacker = getCard(state, attackerId as any);
  if (!attacker || !isUnit(attacker)) {
    return false;
  }

  return true;
}

/**
 * Check if combat is active
 */
export function isCombatActive(state: GameState): boolean {
  return state.combatState.active;
}

/**
 * Get all attackers
 */
export function getAttackers(state: GameState): UnitId[] {
  return Array.from(state.combatState.attackers);
}

/**
 * Get all defenders
 */
export function getDefenders(state: GameState): UnitId[] {
  return Array.from(state.combatState.defenders);
}

/**
 * Quick combat helper (for testing) - declare attackers and resolve immediately
 */
export function quickCombat(
  state: GameState,
  attackingPlayer: PlayerId,
  attackers: UnitId[],
  blockers?: Map<UnitId, UnitId>
): Result<GameState> {
  // Declare attackers
  let result = declareAttackers(state, attackingPlayer, attackers);
  if (!result.ok) return result;
  let newState = result.value;

  // Declare blockers if any
  if (blockers && blockers.size > 0) {
    const defendingPlayer = state.turnState.turnPlayer === attackingPlayer 
      ? getOpponentId(state, attackingPlayer) 
      : attackingPlayer;
    
    result = declareDefenders(newState, defendingPlayer, blockers);
    if (!result.ok) return result;
    newState = result.value;
  }

  // Resolve damage
  return resolveCombatDamage(newState);
}

/**
 * Helper to get opponent's player ID (simplified for 2-player)
 */
function getOpponentId(state: GameState, playerId: PlayerId): PlayerId {
  for (const [id] of state.players) {
    if (id !== playerId) {
      return id;
    }
  }
  return playerId; // Fallback
}
