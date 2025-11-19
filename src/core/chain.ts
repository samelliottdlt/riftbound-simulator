/**
 * Chain System (Rules 326-336)
 * 
 * The Chain is a temporary zone where cards are played and abilities are activated.
 * It resolves items last-in-first-out (like a stack) with priority passing.
 * 
 * Rule 327: The Chain is a Non-Board Zone that temporarily exists whenever
 * a card is played or an ability is activated.
 * 
 * Rule 329: The Chain exists as long as a Chain Item is on it.
 * 
 * Chain Resolution has 4 steps (Rules 331-336):
 * 1. Finalize - Complete playing of Pending Items
 * 2. Execute - Active Player plays/activates/passes priority
 * 3. Pass - Check if all players passed, else continue
 * 4. Resolve - Execute top item's effects
 */

import { GameState, ChainItem } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { ChainStateType } from '../types/primitives.js';
import { performCleanup } from './cleanup.js';

/**
 * Add item to Chain (Rule 332)
 * 
 * When a card is played or ability activated, a Chain is created (if not exists)
 * and the item is added as a Pending Item.
 * 
 * @param state - Current game state
 * @param item - Chain item to add (spell or ability)
 * @returns Updated game state with item on chain
 */
export function addToChain(
  state: GameState,
  item: Omit<ChainItem, 'pending'>
): Result<GameState> {
  // Create chain item as Pending (Rule 328.2)
  const chainItem: ChainItem = {
    ...item,
    pending: true,
  };
  
  // Add to chain
  const newChainItems = [...state.chainState.items, chainItem];
  
  // Update state to Closed (Rule 330.1: Closed State if Chain exists)
  const newState: GameState = {
    ...state,
    chainState: {
      items: newChainItems,
    },
    turnState: {
      ...state.turnState,
      chainState: ChainStateType.Closed,
    },
  };
  
  // Set Active Player to controller of item (Rule 332.1)
  const stateWithActivePlayer: GameState = {
    ...newState,
    turnState: {
      ...newState.turnState,
      activePlayer: item.controller,
      priority: item.controller, // Controller gains priority initially
    },
  };
  
  return ok(stateWithActivePlayer);
}

/**
 * Step 1: Finalize Pending Items (Rule 333)
 * 
 * If one or more Items are Pending, their controllers must complete the
 * steps of Playing those Pending Items until they are Finalized Items
 * or leave the Chain.
 * 
 * This process does not pass Priority.
 * Each Item is Finalized in the order it was appended to the Chain.
 */
export function finalizeChainItems(state: GameState): Result<GameState> {
  // Find pending items
  const pendingItems = state.chainState.items.filter(item => item.pending);
  
  if (pendingItems.length === 0) {
    return ok(state); // Nothing to finalize
  }
  
  // Finalize each in order
  let newState = state;
  for (const item of pendingItems) {
    // TODO: Complete steps of Playing the item (Rule 346-356)
    // For now, just mark as finalized
    const newItems = newState.chainState.items.map(i =>
      i.id === item.id ? { ...i, pending: false } : i
    );
    
    newState = {
      ...newState,
      chainState: {
        items: newItems,
      },
    };
  }
  
  // Rule 333.1.c: Abilities that Add resources, Units, and Gear resolve immediately
  // and do not progress to Step 2: Execute
  // TODO: Implement immediate resolution for Add abilities
  
  // Rule 333.1.c.3: If Chain not empty and no Pending Items,
  // controller of newest item gains Priority and becomes Active Player
  if (newState.chainState.items.length > 0) {
    const newestItem = newState.chainState.items[newState.chainState.items.length - 1];
    newState = {
      ...newState,
      turnState: {
        ...newState.turnState,
        activePlayer: newestItem.controller,
        priority: newestItem.controller,
      },
    };
  }
  
  // Rule 319.3: Cleanup after Pending Item becomes Legal Item
  if (pendingItems.length > 0) {
    const cleanupResult = performCleanup(newState);
    if (!cleanupResult.ok) {
      return cleanupResult;
    }
    newState = cleanupResult.value;
  }
  
  return ok(newState);
}

/**
 * Step 2: Execute - Active Player's Actions (Rule 334)
 * 
 * The Active Player may:
 * - Play a Card that is legally timed (Reaction during Closed State)
 * - Activate Abilities that are legally timed
 * - Pass Priority
 * 
 * Returns: Choice options for the Active Player
 */
export function getChainExecuteChoices(_state: GameState): string[] {
  // Rule 334.1.a: Play legally timed cards (Reactions during Closed State)
  // Rule 334.1.b: Activate legally timed abilities
  // Rule 334.1.c: Pass Priority
  
  return [
    'play_reaction',
    'activate_ability',
    'pass_priority',
  ];
}

/**
 * Step 3: Pass Priority (Rule 335)
 * 
 * If all players have passed Priority without adding any items to the Chain,
 * proceed to Step 4: Resolve.
 * 
 * Otherwise, the Active Player passes Priority to the next Player in Turn Order.
 * 
 * @param state - Current game state
 * @param passCount - How many players have passed in sequence
 * @returns Updated state or indication to proceed to Step 4
 */
export function passPriority(
  state: GameState,
  passCount: number
): Result<{ state: GameState; shouldResolve: boolean }> {
  const playerCount = state.players.size;
  
  // Rule 335.1: If all players passed without adding items, proceed to Resolve
  if (passCount >= playerCount) {
    return ok({ state, shouldResolve: true });
  }
  
  // Rule 335.2: Pass Priority to next Player in Turn Order
  const playerIds = Array.from(state.players.keys());
  const currentActiveIndex = playerIds.indexOf(state.turnState.activePlayer!);
  const nextIndex = (currentActiveIndex + 1) % playerCount;
  const nextPlayer = playerIds[nextIndex];
  
  const newState: GameState = {
    ...state,
    turnState: {
      ...state.turnState,
      activePlayer: nextPlayer,
      priority: nextPlayer,
    },
  };
  
  return ok({ state: newState, shouldResolve: false });
}

/**
 * Step 4: Resolve Top Chain Item (Rule 336)
 * 
 * The newest item on the Chain resolves. Execute its game effects in their entirety.
 * 
 * After resolution:
 * - If Chain is empty, play proceeds in an Open State
 * - If Chain not empty with Pending Items, return to Step 1: Finalize
 * - If Chain not empty with no Pending Items, controller of newest item
 *   gains Priority and becomes Active Player, return to Step 2: Execute
 */
export function resolveTopChainItem(state: GameState): Result<GameState> {
  if (state.chainState.items.length === 0) {
    return err(validationError(
      'EMPTY_CHAIN',
      'Cannot resolve item from empty chain',
      ['Add items to chain before resolving']
    ));
  }
  
  // Get newest item (last in array)
  // const topItem = state.chainState.items[state.chainState.items.length - 1];
  
  // TODO: Execute item's game effects (Rule 336.1)
  // - For spells: Execute instructions
  // - For abilities: Execute ability effects
  
  // Remove item from chain
  const newItems = state.chainState.items.slice(0, -1);
  
  let newState: GameState = {
    ...state,
    chainState: {
      items: newItems,
    },
  };
  
  // Rule 336.2: If Chain is empty, play proceeds in Open State
  if (newItems.length === 0) {
    newState = {
      ...newState,
      turnState: {
        ...newState.turnState,
        chainState: ChainStateType.Open,
        activePlayer: null,
        priority: newState.turnState.turnPlayer, // Priority returns to Turn Player
      },
    };
    
    // Rule 319.1: Cleanup after transitioning to Open State
    const cleanupResult = performCleanup(newState);
    if (!cleanupResult.ok) {
      return cleanupResult;
    }
    newState = cleanupResult.value;
  } else {
    // Rule 336.4: If Chain not empty with no Pending Items,
    // controller of newest item gains Priority
    const hasPendingItems = newItems.some(item => item.pending);
    if (!hasPendingItems) {
      const newestItem = newItems[newItems.length - 1];
      newState = {
        ...newState,
        turnState: {
          ...newState.turnState,
          activePlayer: newestItem.controller,
          priority: newestItem.controller,
        },
      };
    }
    
    // Rule 319.4: Cleanup after Chain item removed (even if Chain not empty)
    const cleanupResult = performCleanup(newState);
    if (!cleanupResult.ok) {
      return cleanupResult;
    }
    newState = cleanupResult.value;
  }
  
  return ok(newState);
}

/**
 * Complete Chain Resolution Cycle
 * 
 * Runs the full 4-step process until Chain is empty.
 * This is the main entry point for chain resolution.
 * 
 * Note: In the actual game, this would be player-driven with choices.
 * This is a simplified automated version for testing.
 */
export function resolveChain(state: GameState): Result<GameState> {
  let currentState = state;
  let passCount = 0;
  
  while (currentState.chainState.items.length > 0) {
    // Step 1: Finalize
    const finalizeResult = finalizeChainItems(currentState);
    if (!finalizeResult.ok) return finalizeResult;
    currentState = finalizeResult.value;
    
    // Step 2: Execute (in real game, wait for player choice)
    // For now, assume all players pass
    
    // Step 3: Pass
    const passResult = passPriority(currentState, passCount + 1);
    if (!passResult.ok) return passResult;
    
    if (passResult.value.shouldResolve) {
      // Step 4: Resolve
      const resolveResult = resolveTopChainItem(passResult.value.state);
      if (!resolveResult.ok) return resolveResult;
      currentState = resolveResult.value;
      passCount = 0; // Reset pass count after resolution
    } else {
      currentState = passResult.value.state;
      passCount++;
    }
  }
  
  return ok(currentState);
}

/**
 * Check if Chain exists (Rule 329)
 * 
 * The Chain exists as long as a Chain Item is on it.
 */
export function chainExists(state: GameState): boolean {
  return state.chainState.items.length > 0;
}

/**
 * Check if state is Open or Closed (Rule 330)
 * 
 * Closed State: Chain exists
 * Open State: No Chain exists
 */
export function isClosedState(state: GameState): boolean {
  return chainExists(state);
}

export function isOpenState(state: GameState): boolean {
  return !chainExists(state);
}
