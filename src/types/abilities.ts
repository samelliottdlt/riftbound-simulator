/**
 * Ability System - Foundation
 * 
 * Hybrid declarative/code system for card abilities:
 * - AbilityDescriptor: Declarative for simple abilities
 * - AbilityFunction: Pure functions for complex interactions
 * - Triggers: When abilities activate
 * - Targets: What abilities can affect
 */

import { GameState } from './gameState.js';
import { Result } from './result.js';
import { AbilityId, CardId, UnitId, Keyword } from './primitives.js';

/**
 * Ability Trigger - when does an ability activate
 */
export enum AbilityTrigger {
  // Play triggers
  OnPlay = 'OnPlay',               // When card is played
  OnChanneled = 'OnChanneled',     // When rune is channeled
  
  // Combat triggers
  OnAttack = 'OnAttack',           // When unit attacks
  OnDefend = 'OnDefend',           // When unit defends
  OnDamageDealt = 'OnDamageDealt', // When unit deals damage
  OnDamageTaken = 'OnDamageTaken', // When unit takes damage
  
  // Death triggers
  OnDeath = 'OnDeath',             // When permanent dies (Deathknell)
  OnAllyDeath = 'OnAllyDeath',     // When friendly unit dies
  OnEnemyDeath = 'OnEnemyDeath',   // When enemy unit dies
  
  // Scoring triggers
  OnConquer = 'OnConquer',         // When battlefield is conquered (Rule 442.1)
  OnHold = 'OnHold',               // When battlefield is held (Rule 442.2)
  OnScore = 'OnScore',             // When any scoring occurs
  
  // Turn triggers
  OnTurnStart = 'OnTurnStart',     // Start of controller's turn
  OnTurnEnd = 'OnTurnEnd',         // End of controller's turn
  OnPhaseStart = 'OnPhaseStart',   // Start of specific phase
  OnPhaseEnd = 'OnPhaseEnd',       // End of specific phase
  
  // Zone change triggers
  OnEnterPlay = 'OnEnterPlay',     // When enters the board
  OnLeavePlay = 'OnLeavePlay',     // When leaves the board
  
  // Passive (always active)
  Passive = 'Passive',
  
  // Activated (player chooses to activate)
  Activated = 'Activated',
}

/**
 * Ability Target Type - what can be targeted
 */
export enum TargetType {
  Unit = 'Unit',
  Permanent = 'Permanent',
  Spell = 'Spell',
  Player = 'Player',
  Battlefield = 'Battlefield',
  Card = 'Card',  // Any card
}

/**
 * Target Filter - restrictions on valid targets
 */
export interface TargetFilter {
  type: TargetType;
  friendly?: boolean;         // Must be friendly to caster
  enemy?: boolean;            // Must be enemy to caster
  minMight?: number;          // Minimum might value
  maxMight?: number;          // Maximum might value
  hasKeyword?: Keyword;       // Must have specific keyword
  lackKeyword?: Keyword;      // Must NOT have specific keyword
  atSameLocation?: boolean;   // Must be at same location as caster
  custom?: (state: GameState, cardId: CardId, targetId: CardId) => boolean;
}

/**
 * Effect Type - what the ability does
 */
export enum EffectType {
  // Stat modification
  BuffMight = 'BuffMight',
  DebuffMight = 'DebuffMight',
  SetMight = 'SetMight',
  
  // Damage
  DealDamage = 'DealDamage',
  HealDamage = 'HealDamage',
  
  // Keywords
  GrantKeyword = 'GrantKeyword',
  RemoveKeyword = 'RemoveKeyword',
  
  // Card manipulation
  DrawCard = 'DrawCard',
  DiscardCard = 'DiscardCard',
  PlayCard = 'PlayCard',
  RecycleCard = 'RecycleCard',
  BanishCard = 'BanishCard',
  
  // Unit manipulation
  KillUnit = 'KillUnit',
  RecallUnit = 'RecallUnit',
  MoveUnit = 'MoveUnit',
  
  // Energy
  GenerateEnergy = 'GenerateEnergy',
  SpendEnergy = 'SpendEnergy',
  
  // Power
  AddPower = 'AddPower',
  
  // Custom
  Custom = 'Custom',
}

/**
 * Effect - simple declarative effect
 */
export interface Effect {
  type: EffectType;
  value?: number;               // Numeric value (damage, buff amount, etc.)
  keyword?: Keyword;            // For keyword grants/removal
  target?: TargetFilter;        // What to affect
  duration?: 'Turn' | 'Permanent' | 'UntilLeavePlay';
}

/**
 * Ability Descriptor - declarative ability definition
 * 
 * Used for simple, common abilities that can be expressed declaratively
 */
export interface AbilityDescriptor {
  id: AbilityId;
  trigger: AbilityTrigger;
  effects: Effect[];
  condition?: (state: GameState, sourceId: CardId) => boolean;
  cost?: {
    energy?: number;
    exhaust?: boolean;  // Must exhaust permanent to activate
  };
}

/**
 * Ability Function - code-based ability for complex interactions
 * 
 * Pure function that takes game state and returns new game state
 * Used when declarative approach is insufficient
 */
export type AbilityFunction = (
  state: GameState,
  sourceId: CardId,
  trigger: AbilityTrigger,
  context?: AbilityContext
) => Result<GameState>;

/**
 * Ability Context - additional information when ability triggers
 */
export interface AbilityContext {
  // Combat context
  attacker?: UnitId;
  defender?: UnitId;
  damageAmount?: number;
  
  // Death context
  diedUnit?: CardId;
  controller?: import('./primitives.js').PlayerId;
  
  // Play context
  playedCard?: CardId;
  
  // Zone change context
  enteredCard?: CardId;
  leftCard?: CardId;
  
  // Scoring context
  battlefieldId?: import('./primitives.js').BattlefieldId;
  scorer?: import('./primitives.js').PlayerId;
  scoreType?: 'Conquer' | 'Hold';
  
  // Turn context
  turnPlayer?: import('./primitives.js').PlayerId;
  phase?: string;
  
  [key: string]: unknown; // Extensible for future needs
}

/**
 * Ability - discriminated union of descriptor or function
 */
export type Ability =
  | { type: 'descriptor'; descriptor: AbilityDescriptor }
  | { type: 'function'; function: AbilityFunction; trigger: AbilityTrigger };

/**
 * Helper to create descriptor ability
 */
export function descriptorAbility(descriptor: AbilityDescriptor): Ability {
  return { type: 'descriptor', descriptor };
}

/**
 * Helper to create function ability
 */
export function functionAbility(
  trigger: AbilityTrigger,
  fn: AbilityFunction
): Ability {
  return { type: 'function', function: fn, trigger };
}

/**
 * Check if ability should trigger
 */
export function shouldTrigger(
  ability: Ability,
  trigger: AbilityTrigger,
  state: GameState,
  sourceId: CardId
): boolean {
  if (ability.type === 'descriptor') {
    if (ability.descriptor.trigger !== trigger) {
      return false;
    }
    if (ability.descriptor.condition) {
      return ability.descriptor.condition(state, sourceId);
    }
    return true;
  } else {
    return ability.trigger === trigger;
  }
}

/**
 * Resolve a simple effect
 */
function resolveEffect(
  state: GameState,
  effect: Effect,
  controller: import('./primitives.js').PlayerId
): Result<GameState> {
  switch (effect.type) {
    case EffectType.DrawCard: {
      const player = state.players.get(controller);
      if (!player) {
        return { ok: false, error: { code: 'INVALID_STATE', message: 'Player not found', fixes: [] } };
      }

      if (player.deck.length === 0) {
        return { ok: false, error: { code: 'INVALID_ACTION', message: 'Cannot draw from empty deck', fixes: [] } };
      }

      const [drawnCard, ...remainingDeck] = player.deck;
      const newPlayer = {
        ...player,
        deck: remainingDeck,
        hand: [...player.hand, drawnCard],
      };

      const newPlayers = new Map(state.players);
      newPlayers.set(controller, newPlayer);

      return { ok: true, value: { ...state, players: newPlayers } };
    }

    case EffectType.BuffMight:
    case EffectType.DealDamage:
    case EffectType.GrantKeyword:
      // TODO: Implement these effects
      return { ok: true, value: state };

    default:
      return { ok: true, value: state };
  }
}

/**
 * Resolve an ability (will be expanded with full effect resolution)
 */
export function resolveAbility(
  state: GameState,
  ability: Ability,
  sourceId: CardId,
  trigger: AbilityTrigger,
  context?: AbilityContext
): Result<GameState> {
  if (ability.type === 'function') {
    return ability.function(state, sourceId, trigger, context);
  }
  
  // Descriptor resolution - resolve each effect in order
  let currentState = state;
  const descriptor = ability.descriptor;
  
  // Get controller from source card
  const sourceCard = currentState.cards.get(sourceId);
  if (!sourceCard) {
    return { ok: true, value: state }; // Card not found, skip
  }
  
  const controller = sourceCard.owner;
  
  // Resolve each effect
  for (const effect of descriptor.effects) {
    const result = resolveEffect(currentState, effect, controller);
    if (!result.ok) {
      return result;
    }
    currentState = result.value;
  }
  
  return { ok: true, value: currentState };
}
