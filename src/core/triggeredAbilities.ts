/**
 * Triggered Abilities Integration
 * 
 * Integrates triggered abilities with game events:
 * - OnPlay: When a card is played
 * - OnDeath: When a permanent dies (Deathknell)
 * - OnScore: When a battlefield is scored (Conquer/Hold)
 * - OnTurnStart/End: Turn phase triggers
 * - OnEnterPlay/LeavePlay: Zone change triggers
 */

import { GameState } from '../types/gameState.js';
import { AbilityTrigger, AbilityContext } from '../types/abilities.js';
import { triggerAbilities, resolveAllQueuedAbilities } from './abilityResolution.js';
import { Result } from '../types/result.js';
import { CardId, PlayerId, BattlefieldId, UnitId } from '../types/primitives.js';

/**
 * Trigger OnPlay abilities when a card is played
 */
export function triggerOnPlayAbilities(
  state: GameState,
  cardId: CardId
): GameState {
  const context: AbilityContext = {
    playedCard: cardId,
  };

  return triggerAbilities(state, AbilityTrigger.OnPlay, context);
}

/**
 * Trigger OnDeath abilities when a permanent dies (Deathknell keyword)
 */
export function triggerOnDeathAbilities(
  state: GameState,
  diedCardId: CardId,
  controller: PlayerId
): GameState {
  const context: AbilityContext = {
    diedUnit: diedCardId,
    controller,
  };

  // Check for Deathknell abilities on the dying unit
  let newState = triggerAbilities(state, AbilityTrigger.OnDeath, context);

  // Check for OnAllyDeath and OnEnemyDeath triggers on other units
  newState = triggerAbilities(newState, AbilityTrigger.OnAllyDeath, context);
  newState = triggerAbilities(newState, AbilityTrigger.OnEnemyDeath, context);

  return newState;
}

/**
 * Trigger OnScore abilities when a battlefield is scored (Conquer or Hold)
 */
export function triggerOnScoreAbilities(
  state: GameState,
  battlefieldId: BattlefieldId,
  scorer: PlayerId,
  scoreType: 'Conquer' | 'Hold'
): GameState {
  const context: AbilityContext = {
    battlefieldId,
    scorer,
    scoreType,
  };

  // Use appropriate trigger based on score type
  const trigger = scoreType === 'Conquer' 
    ? AbilityTrigger.OnConquer 
    : AbilityTrigger.OnHold;

  return triggerAbilities(state, trigger, context);
}

/**
 * Trigger OnEnterPlay abilities when a permanent enters the battlefield
 */
export function triggerOnEnterPlayAbilities(
  state: GameState,
  cardId: CardId
): GameState {
  const context: AbilityContext = {
    enteredCard: cardId,
  };

  return triggerAbilities(state, AbilityTrigger.OnEnterPlay, context);
}

/**
 * Trigger OnLeavePlay abilities when a permanent leaves the battlefield
 */
export function triggerOnLeavePlayAbilities(
  state: GameState,
  cardId: CardId
): GameState {
  const context: AbilityContext = {
    leftCard: cardId,
  };

  return triggerAbilities(state, AbilityTrigger.OnLeavePlay, context);
}

/**
 * Trigger OnTurnStart abilities at the start of a player's turn
 */
export function triggerOnTurnStartAbilities(
  state: GameState,
  playerId: PlayerId
): GameState {
  const context: AbilityContext = {
    turnPlayer: playerId,
  };

  return triggerAbilities(state, AbilityTrigger.OnTurnStart, context);
}

/**
 * Trigger OnTurnEnd abilities at the end of a player's turn
 */
export function triggerOnTurnEndAbilities(
  state: GameState,
  playerId: PlayerId
): GameState {
  const context: AbilityContext = {
    turnPlayer: playerId,
  };

  return triggerAbilities(state, AbilityTrigger.OnTurnEnd, context);
}

/**
 * Trigger OnAttack abilities when a unit attacks
 */
export function triggerOnAttackAbilities(
  state: GameState,
  attackerId: UnitId
): GameState {
  const context: AbilityContext = {
    attacker: attackerId,
  };

  return triggerAbilities(state, AbilityTrigger.OnAttack, context);
}

/**
 * Trigger OnDefend abilities when a unit defends
 */
export function triggerOnDefendAbilities(
  state: GameState,
  defenderId: UnitId
): GameState {
  const context: AbilityContext = {
    defender: defenderId,
  };

  return triggerAbilities(state, AbilityTrigger.OnDefend, context);
}

/**
 * Trigger and resolve abilities immediately
 * 
 * Use this when abilities should resolve before continuing gameplay
 * (e.g., OnDeath abilities before state-based actions)
 */
export function triggerAndResolveAbilities(
  state: GameState,
  trigger: AbilityTrigger,
  context?: AbilityContext
): Result<GameState> {
  // Trigger abilities
  const stateWithQueue = triggerAbilities(state, trigger, context);

  // Resolve all queued abilities
  return resolveAllQueuedAbilities(stateWithQueue);
}

/**
 * Check if a card has Deathknell keyword and should trigger on death
 */
export function hasDeathknell(state: GameState, cardId: CardId): boolean {
  const card = state.cards.get(cardId);
  if (!card) {
    return false;
  }

  if ('abilities' in card && Array.isArray(card.abilities)) {
    return card.abilities.some((ability) => {
      if (ability.type === 'descriptor') {
        return ability.descriptor.trigger === AbilityTrigger.OnDeath;
      } else if (ability.type === 'function') {
        return ability.trigger === AbilityTrigger.OnDeath;
      }
      return false;
    });
  }

  return false;
}
