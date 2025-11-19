/**
 * Ability Resolution System
 * 
 * Handles triggered, activated, and passive abilities with proper queuing
 * and resolution order (Rule 600-series).
 * 
 * Rule 376.3: Triggered abilities are placed on the Chain like Activated Abilities
 */

import { GameState, updatePlayer, ChainItem } from '../types/gameState.js';
import { Result, validationError } from '../types/result.js';
import {
  Ability,
  AbilityTrigger,
  AbilityContext,
  shouldTrigger,
  resolveAbility,
  Effect,
  EffectType,
} from '../types/abilities.js';
import { CardId, PlayerId, Keyword } from '../types/primitives.js';
import { isUnit } from '../types/cards.js';
import { addToChain } from './chain.js';
import { performCleanup } from './cleanup.js';

/**
 * Triggered Ability Instance - represents an ability that has triggered
 * and is waiting to be resolved
 */
export interface TriggeredAbilityInstance {
  id: string;              // Unique instance ID
  source: CardId;          // Card that owns the ability
  controller: PlayerId;    // Player who controls the ability
  ability: Ability;        // The ability definition
  trigger: AbilityTrigger; // What triggered it
  context?: AbilityContext; // Additional context
  timestamp: number;       // When it triggered (for ordering)
}

/**
 * Ability Queue - tracks triggered abilities waiting to resolve
 */
export interface AbilityQueue {
  queue: TriggeredAbilityInstance[];
  nextId: number; // For generating unique IDs
}

/**
 * Create empty ability queue
 */
export function createAbilityQueue(): AbilityQueue {
  return {
    queue: [],
    nextId: 0,
  };
}

/**
 * Add ability queue to game state
 */
export function initializeAbilitySystem(state: GameState): GameState {
  return {
    ...state,
    abilityQueue: createAbilityQueue(),
  };
}

/**
 * Get all abilities from a card
 */
export function getCardAbilities(state: GameState, cardId: CardId): Ability[] {
  const card = state.cards.get(cardId);
  if (!card) {
    return [];
  }

  // Check if card has abilities property
  if ('abilities' in card) {
    return card.abilities;
  }

  return [];
}

/**
 * Check all cards for triggered abilities matching the trigger
 */
export function checkTriggeredAbilities(
  state: GameState,
  trigger: AbilityTrigger,
  context?: AbilityContext
): TriggeredAbilityInstance[] {
  const triggered: TriggeredAbilityInstance[] = [];
  const timestamp = Date.now();

  // Check all cards in play
  for (const [cardId, card] of state.cards) {
    // Get owner/controller
    const controller = card.owner;

    // Get abilities for this card
    const abilities = getCardAbilities(state, cardId);

    // Check each ability
    for (const ability of abilities) {
      if (shouldTrigger(ability, trigger, state, cardId)) {
        triggered.push({
          id: `ability-${state.abilityQueue?.nextId ?? 0}`,
          source: cardId,
          controller,
          ability,
          trigger,
          context,
          timestamp,
        });
      }
    }
  }

  return triggered;
}

/**
 * Queue triggered abilities for resolution
 */
export function queueTriggeredAbilities(
  state: GameState,
  instances: TriggeredAbilityInstance[]
): GameState {
  if (instances.length === 0) {
    return state;
  }

  const queue = state.abilityQueue ?? createAbilityQueue();
  const newQueue: TriggeredAbilityInstance[] = [...(queue.queue as TriggeredAbilityInstance[])];

  // Add instances to queue
  // Abilities controlled by active player go first (APNAP order)
  const activePlayer = state.turnState.turnPlayer;
  const activePlayerAbilities = instances.filter((a) => a.controller === activePlayer);
  const otherAbilities = instances.filter((a) => a.controller !== activePlayer);

  newQueue.push(...activePlayerAbilities);
  newQueue.push(...otherAbilities);

  return {
    ...state,
    abilityQueue: {
      queue: newQueue,
      nextId: queue.nextId + instances.length,
    },
  };
}

/**
 * Resolve the next ability in the queue
 */
export function resolveNextAbility(state: GameState): Result<GameState> {
  const queue = state.abilityQueue;
  if (!queue || queue.queue.length === 0) {
    return { ok: true, value: state };
  }

  // Take first ability from queue (FIFO)
  const queueArray = queue.queue as TriggeredAbilityInstance[];
  const [nextAbility, ...remainingQueue] = queueArray;

  // Update state to remove ability from queue
  let newState: GameState = {
    ...state,
    abilityQueue: {
      ...queue,
      queue: remainingQueue,
    },
  };

  // Resolve the ability
  const result = resolveAbility(
    newState,
    nextAbility.ability,
    nextAbility.source,
    nextAbility.trigger,
    nextAbility.context
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, value: result.value };
}

/**
 * Resolve all queued abilities
 */
export function resolveAllQueuedAbilities(state: GameState): Result<GameState> {
  let currentState = state;

  while (currentState.abilityQueue && currentState.abilityQueue.queue.length > 0) {
    const result = resolveNextAbility(currentState);
    if (!result.ok) {
      return result;
    }
    currentState = result.value;
  }

  return { ok: true, value: currentState };
}

/**
 * Trigger abilities and add them to the Chain
 * 
 * Rule 376.3: When a Condition is met, a Triggered Ability behaves like
 * an Activated Ability and is placed on the Chain.
 * 
 * Rule 376.3.b: If multiple abilities trigger simultaneously, controller
 * selects the order to place them on the Chain.
 * 
 * Rule 376.3.b.1: If multiple players control triggered abilities, starting
 * with Turn Player and proceeding in Turn Order, each player orders their
 * abilities on the Chain.
 * 
 * This is the main entry point for triggering abilities during gameplay
 */
export function triggerAbilities(
  state: GameState,
  trigger: AbilityTrigger,
  context?: AbilityContext
): GameState {
  // Check for triggered abilities
  const instances = checkTriggeredAbilities(state, trigger, context);
  
  if (instances.length === 0) {
    return state; // No abilities triggered
  }
  
  // Group by controller
  const abilityMap = new Map<PlayerId, TriggeredAbilityInstance[]>();
  for (const instance of instances) {
    const existing = abilityMap.get(instance.controller) || [];
    existing.push(instance);
    abilityMap.set(instance.controller, existing);
  }
  
  // Add to Chain in APNAP order (Active Player, Non-Active Player)
  // Rule 376.3.b.1: Turn Player first, then in turn order
  const turnPlayer = state.turnState.turnPlayer;
  const playerOrder: PlayerId[] = [];
  
  // Turn player goes first
  if (abilityMap.has(turnPlayer)) {
    playerOrder.push(turnPlayer);
  }
  
  // Other players in turn order
  for (const [playerId] of state.players) {
    if (playerId !== turnPlayer && abilityMap.has(playerId)) {
      playerOrder.push(playerId);
    }
  }
  
  // Add each player's abilities to Chain
  let currentState = state;
  for (const playerId of playerOrder) {
    const abilities = abilityMap.get(playerId) || [];
    
    // Each ability becomes a Chain item
    for (const instance of abilities) {
      const chainItem: Omit<ChainItem, 'pending'> = {
        id: instance.id,
        type: 'ability',
        source: instance.source,
        controller: instance.controller,
      };
      
      const addResult = addToChain(currentState, chainItem);
      if (addResult.ok) {
        currentState = addResult.value;
      }
    }
  }
  
  // Rule 319.1: Cleanup after transitioning to Closed State
  // This will finalize the Pending abilities per Rule 322.8
  const cleanupResult = performCleanup(currentState);
  if (cleanupResult.ok) {
    currentState = cleanupResult.value;
  }
  
  return currentState;
}

/**
 * Resolve a simple effect (part of declarative ability resolution)
 */
export function resolveEffect(
  state: GameState,
  effect: Effect,
  controller: PlayerId
): Result<GameState> {
  switch (effect.type) {
    case EffectType.DrawCard: {
      const player = state.players.get(controller);
      if (!player) {
        return { ok: false, error: validationError('INVALID_STATE', 'Player not found', []) };
      }

      if (player.deck.length === 0) {
        return { ok: false, error: validationError('INVALID_ACTION', 'Cannot draw from empty deck', []) };
      }

      const [drawnCard, ...remainingDeck] = player.deck;
      const newPlayer = {
        ...player,
        deck: remainingDeck,
        hand: [...player.hand, drawnCard],
      };

      return { ok: true, value: updatePlayer(state, controller, newPlayer) };
    }

    case EffectType.BuffMight: {
      // Find target and apply buff
      // TODO: Implement target selection and buff application
      return { ok: true, value: state };
    }

    case EffectType.DealDamage: {
      // Find target and deal damage
      // TODO: Implement target selection and damage dealing
      return { ok: true, value: state };
    }

    case EffectType.GrantKeyword: {
      // Find target and grant keyword
      // TODO: Implement target selection and keyword granting
      return { ok: true, value: state };
    }

    // Add more effect types as needed
    default:
      return { ok: true, value: state };
  }
}

/**
 * Get all units with a specific keyword
 */
export function getUnitsWithKeyword(state: GameState, keyword: Keyword): CardId[] {
  const units: CardId[] = [];

  for (const [cardId, card] of state.cards) {
    if (isUnit(card) && card.keywords.includes(keyword)) {
      units.push(cardId);
    }
  }

  return units;
}

/**
 * Check if a card has a specific keyword
 */
export function hasKeyword(state: GameState, cardId: CardId, keyword: Keyword): boolean {
  const card = state.cards.get(cardId);
  if (!card || !isUnit(card)) {
    return false;
  }

  return card.keywords.includes(keyword);
}
