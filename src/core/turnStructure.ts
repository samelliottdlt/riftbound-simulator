/**
 * Turn Structure
 * 
 * Manages the complete turn flow through all phases (Rule 315):
 * Awaken → Beginning → Channel → Draw → Action → Combat → Ending
 * 
 * Each phase has specific actions and timing rules.
 */

import { GameState, getPlayer, updatePlayer } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { PlayerId, Phase } from '../types/primitives.js';
import { channelRunes, emptyRunePool } from './runes.js';
import { scoreHold, getScorableBattlefields } from './scoring.js';
import { clearScoredBattlefields } from './victory.js';
import { triggerOnScoreAbilities } from './triggeredAbilities.js';


/**
 * Start a new turn for the specified player
 */
export function startTurn(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Update turn state
  let newState: GameState = {
    ...state,
    turnState: {
      ...state.turnState,
      turnPlayer: playerId,
      turnNumber: state.turnState.turnNumber + 1,
      phase: Phase.Awaken,
      priority: playerId,
    },
  };

  // Reset cards played this turn
  const updatedPlayer = {
    ...player,
    cardsPlayedThisTurn: [],
  };
  newState = updatePlayer(newState, playerId, updatedPlayer);

  // Clear scored battlefields from previous turn (Rule 443)
  const clearResult = clearScoredBattlefields(newState, playerId);
  if (!clearResult.ok) return clearResult;
  newState = clearResult.value;

  return ok(newState);
}

/**
 * Advance to the next phase
 */
export function advancePhase(state: GameState): Result<GameState> {
  const currentPhase = state.turnState.phase;
  const nextPhase = getNextPhase(currentPhase);

  if (!nextPhase) {
    return err(validationError(
      'INVALID_PHASE_TRANSITION',
      `Cannot advance from ${currentPhase} - turn must end first`
    ));
  }

  const newState: GameState = {
    ...state,
    turnState: {
      ...state.turnState,
      phase: nextPhase,
    },
  };

  return ok(newState);
}

/**
 * Get the next phase in sequence (Rule 315)
 */
function getNextPhase(currentPhase: Phase): Phase | null {
  switch (currentPhase) {
    case Phase.Awaken:
      return Phase.Beginning;
    case Phase.Beginning:
      return Phase.Channel;
    case Phase.Channel:
      return Phase.Draw;
    case Phase.Draw:
      return Phase.Action;
    case Phase.Action:
      return Phase.Combat;
    case Phase.Combat:
      return Phase.Ending;
    case Phase.Ending:
      return null; // Turn ends, must start new turn
    default:
      return null;
  }
}

/**
 * Execute Awaken phase actions (Rule 315.1):
 * - Ready all Game Objects controlled by Turn Player
 */
export function executeAwakenPhase(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (state.turnState.phase !== Phase.Awaken) {
    return err(validationError(
      'INVALID_PHASE',
      `Cannot execute Awaken phase actions during ${state.turnState.phase}`
    ));
  }

  // TODO: Ready all game objects controlled by playerId (Rule 315.1.a)
  // This includes Units, Gear, Runes, etc.
  
  return ok(state);
}

/**
 * Execute Beginning phase actions (Rule 315.2):
 * - Execute beginning step game effects (Rule 315.2.a)
 * - Score Hold for controlled battlefields (Rule 315.2.b)
 */
export function executeBeginningPhase(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (state.turnState.phase !== Phase.Beginning) {
    return err(validationError(
      'INVALID_PHASE',
      `Cannot execute Beginning phase actions during ${state.turnState.phase}`
    ));
  }

  let newState = state;

  // Beginning Step (Rule 315.2.a)
  // TODO: Execute beginning phase game effects

  // Scoring Step (Rule 315.2.b) - Holding occurs
  // Score Hold for all controlled battlefields (Rule 442.2)
  const scorableBattlefields = getScorableBattlefields(newState, playerId);
  for (const battlefieldId of scorableBattlefields) {
    const holdResult = scoreHold(newState, playerId, battlefieldId);
    if (holdResult.ok) {
      newState = holdResult.value.state;
      
      // Trigger Hold abilities at this battlefield (Rule 444.2)
      newState = triggerOnScoreAbilities(newState, battlefieldId, playerId, 'Hold');
    }
    // If scoring fails (e.g., already scored), continue to next battlefield
  }

  return ok(newState);
}

/**
 * Execute Channel phase actions (Rule 315.3):
 * - Channel 2 runes from Rune Deck
 * - Trigger any channel-triggered abilities
 */
export function executeChannelPhase(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (state.turnState.phase !== Phase.Channel) {
    return err(validationError(
      'INVALID_PHASE',
      `Cannot execute Channel phase actions during ${state.turnState.phase}`
    ));
  }

  // Channel 2 runes (Rule 315.3.b)
  // If there are fewer than 2 runes in deck, channel as many as possible (Rule 315.3.b.1)
  const channelResult = channelRunes(state, playerId, 2);
  if (!channelResult.ok) {
    return channelResult;
  }

  // TODO: Trigger abilities that respond to channeling runes

  return ok(channelResult.value);
}

/**
 * Execute Draw phase actions (Rule 315.4):
 * - Draw 1 card (Rule 315.4.b)
 * - Empty Rune Pool at end of phase (Rule 315.4.d)
 */
export function executeDrawPhase(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (state.turnState.phase !== Phase.Draw) {
    return err(validationError(
      'INVALID_PHASE',
      `Cannot execute Draw phase actions during ${state.turnState.phase}`
    ));
  }

  let newState = state;

  // Draw 1 card (Rule 315.4.b)
  const currentPlayer = getPlayer(newState, playerId)!;
  if (currentPlayer.deck.length > 0) {
    const drawnCard = currentPlayer.deck[0];
    const updatedPlayer = {
      ...currentPlayer,
      deck: currentPlayer.deck.slice(1),
      hand: [...currentPlayer.hand, drawnCard],
    };
    newState = updatePlayer(newState, playerId, updatedPlayer);
  }
  // TODO: Handle Burn Out if deck is empty (Rule 315.4.b.1)

  // Empty Rune Pool at end of Draw Phase (Rule 315.4.d, Rule 160)
  const emptyResult = emptyRunePool(newState, playerId);
  if (!emptyResult.ok) {
    return emptyResult;
  }

  return ok(emptyResult.value);
}

/**
 * Execute Ending phase actions (Rule 317):
 * - Empty Rune Pool (Rule 160)
 * - Clear temporary effects (TODO)
 * - Trigger end-of-turn abilities (TODO)
 */
export function executeEndingPhase(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (state.turnState.phase !== Phase.Ending) {
    return err(validationError(
      'INVALID_PHASE',
      `Cannot execute Ending phase actions during ${state.turnState.phase}`
    ));
  }

  let newState = state;

  // TODO: Trigger end-of-turn abilities
  // TODO: Clean up temporary effects

  // Empty Rune Pool (Rule 160)
  const emptyResult = emptyRunePool(newState, playerId);
  if (!emptyResult.ok) {
    return emptyResult;
  }

  return ok(emptyResult.value);
}

/**
 * End the current turn (advances to opponent's turn)
 */
export function endTurn(
  state: GameState,
  currentPlayerId: PlayerId,
  nextPlayerId: PlayerId
): Result<GameState> {
  if (state.turnState.phase !== Phase.Ending) {
    return err(validationError(
      'INVALID_PHASE',
      'Must be in Ending phase to end turn'
    ));
  }

  if (state.turnState.turnPlayer !== currentPlayerId) {
    return err(validationError(
      'WRONG_PLAYER',
      `It is ${state.turnState.turnPlayer}'s turn, not ${currentPlayerId}'s`
    ));
  }

  // Execute ending phase cleanup
  const cleanupResult = executeEndingPhase(state, currentPlayerId);
  if (!cleanupResult.ok) {
    return cleanupResult;
  }

  // Start next player's turn
  return startTurn(cleanupResult.value, nextPlayerId);
}

/**
 * Check if it's a specific player's turn
 */
export function isPlayerTurn(state: GameState, playerId: PlayerId): boolean {
  return state.turnState.turnPlayer === playerId;
}

/**
 * Get current phase
 */
export function getCurrentPhase(state: GameState): Phase {
  return state.turnState.phase;
}

/**
 * Get current turn player
 */
export function getTurnPlayer(state: GameState): PlayerId {
  return state.turnState.turnPlayer;
}

/**
 * Get turn number
 */
export function getTurnNumber(state: GameState): number {
  return state.turnState.turnNumber;
}

/**
 * Check if in combat phase
 */
export function isInCombatPhase(state: GameState): boolean {
  return state.turnState.phase === Phase.Combat;
}

/**
 * Check if in action phase
 */
export function isInActionPhase(state: GameState): boolean {
  return state.turnState.phase === Phase.Action;
}

/**
 * Complete turn cycle helper (for testing)
 * Advances through all phases and executes phase actions
 */
export function completeTurnCycle(
  state: GameState,
  playerId: PlayerId,
  nextPlayerId: PlayerId
): Result<GameState> {
  // Awaken phase → Beginning
  let result: Result<GameState> = executeAwakenPhase(state, playerId);
  if (!result.ok) return result;
  let newState = result.value;

  result = advancePhase(newState);
  if (!result.ok) return result;
  newState = result.value;

  // Beginning phase (Hold scoring)
  result = executeBeginningPhase(newState, playerId);
  if (!result.ok) return result;
  newState = result.value;

  result = advancePhase(newState);
  if (!result.ok) return result;
  newState = result.value;

  // Channel phase
  result = executeChannelPhase(newState, playerId);
  if (!result.ok) return result;
  newState = result.value;

  result = advancePhase(newState);
  if (!result.ok) return result;
  newState = result.value;

  // Draw phase
  result = executeDrawPhase(newState, playerId);
  if (!result.ok) return result;
  newState = result.value;

  result = advancePhase(newState);
  if (!result.ok) return result;
  newState = result.value;

  // Action phase (no automatic actions)
  result = advancePhase(newState);
  if (!result.ok) return result;
  newState = result.value;

  // Combat phase (no automatic actions)
  result = advancePhase(newState);
  if (!result.ok) return result;
  newState = result.value;

  // Ending phase and turn end
  result = endTurn(newState, playerId, nextPlayerId);
  if (!result.ok) return result;

  return result;
}
