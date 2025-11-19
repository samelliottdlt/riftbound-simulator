/**
 * Game State - Complete
 * 
 * Full game state representation with all zones and tracking
 */

import { PlayerId, CardId, UnitId, Phase, BattlefieldId, LegendId, RuneId, Energy, Power, Points, VictoryScore } from './primitives.js';
import { Card } from './cards.js';
import { RNG } from '../utils/rng.js';

/**
 * Player state - complete with all zones and resources
 */
export interface PlayerState {
  // Main Deck zones
  hand: CardId[];
  deck: CardId[];                    // Ordered, top = index 0
  trash: CardId[];                   // Unordered
  banishment: CardId[];              // Unordered
  championZone: CardId | null;       // Chosen Champion
  
  // Board zones (shared)
  base: Set<UnitId>;                 // Units at player's base
  
  // Rune Deck
  runeDeck: RuneId[];                // Ordered, top = index 0
  runesInPlay: Set<RuneId>;          // Runes on the board
  
  // Resources
  energy: Energy;                    // Available energy this turn
  energyGenerated: Energy;           // Total energy generated this turn
  maxEnergy: Energy;                 // Maximum energy (from cards in base)
  runePool: Power[];                 // Available power for paying costs
  
  // Tracking
  cardsPlayedThisTurn: CardId[];     // For Legion and other effects
  points: Points;                    // Victory points earned (Rule 444)
  battlefieldsScored: Set<BattlefieldId>; // Tracked per turn for scoring rules
  
  // Legend (never moves)
  legend: LegendId;
}

/**
 * Battlefield state - tracks ownership and units
 */
export interface BattlefieldState {
  id: BattlefieldId;
  controller: PlayerId | null;       // Who controls this battlefield
  units: Set<UnitId>;                // Units at this battlefield
  facedownCard: CardId | null;       // Card in facedown zone (max 1)
  contested: boolean;                // Temporary status when control is challenged (Rule 181.3)
  
  // Staging flags for Cleanup steps 6-7 (Rules 322.6-322.7)
  showdownStaged: boolean;           // Showdown staged at this battlefield (Rule 322.6)
  combatStaged: boolean;             // Combat staged at this battlefield (Rule 322.7)
  contestedBy?: PlayerId;            // Who applied Contested status (for Combat attacker)
}

/**
 * Turn state - tracks current phase, active player, and state (Rules 307-313)
 */
export interface TurnState {
  phase: Phase;
  turnPlayer: PlayerId;
  turnNumber: number;                // Total turns elapsed
  
  // State tracking (Rules 307-310)
  stateType: import('./primitives.js').TurnStateType;    // Neutral or Showdown (Rule 308)
  chainState: import('./primitives.js').ChainStateType;  // Open or Closed (Rule 310)
  
  // Priority and Focus (Rules 312-313)
  priority: PlayerId | null;         // Who has priority (for chains) (Rule 312)
  activePlayer: PlayerId | null;     // Who is active during chain resolution (Rule 332.1)
  focus: PlayerId | null;            // Who has focus during showdowns (Rule 313)
}

/**
 * Combat state - tracks active combat (Rules 433-440)
 */
export interface CombatState {
  active: boolean;
  battlefield: BattlefieldId | null;  // Where combat is happening
  attackingPlayer: PlayerId | null;   // Who is attacking
  defendingPlayer: PlayerId | null;   // Who is defending
  attackers: Set<UnitId>;             // Units with Attacker designation
  defenders: Set<UnitId>;             // Units with Defender designation
  damageAssignments: Map<UnitId, Map<UnitId, number>>; // Attacker -> Defender -> Damage
}

/**
 * Chain state - tracks abilities/spells on the chain (Rules 327-336)
 */
export interface ChainState {
  items: ChainItem[];                // Ordered, resolves last-in-first-out (Rule 336.1)
}

/**
 * Chain Item - spell or ability on the chain (Rule 328)
 * Items are Pending until finalized (Rule 328.2-328.3)
 */
export interface ChainItem {
  id: string;
  type: 'spell' | 'ability';
  source: CardId;
  controller: PlayerId;
  pending: boolean;                  // Pending until "Check Legality" step (Rule 328.2)
  targetIds?: CardId[];              // Targets chosen during play (Rule 352)
}

/**
 * Ability Queue - tracks triggered abilities (forward declaration)
 */
export interface AbilityQueue {
  queue: unknown[];
  nextId: number;
}

/**
 * Complete game state
 * 
 * This is the single source of truth for the entire game.
 * All operations return a new GameState (immutability).
 */
export interface GameState {
  /** All cards in the game, indexed by ID */
  cards: Map<CardId, Card>;
  
  /** Player states, indexed by player ID */
  players: Map<PlayerId, PlayerState>;
  
  /** Battlefield states */
  battlefields: Map<BattlefieldId, BattlefieldState>;
  
  /** Current turn state */
  turnState: TurnState;
  
  /** Combat state (if combat is active) */
  combatState: CombatState;
  
  /** Chain state (for spell/ability resolution) */
  chainState: ChainState;
  
  /** Ability queue (for triggered abilities) */
  abilityQueue?: AbilityQueue;
  
  /** Random number generator (pluggable) */
  rng: RNG;
  
  /** Victory Score - points needed to win (Rule 445) */
  victoryScore: VictoryScore;
  
  /** Game metadata */
  metadata: {
    startTime: Date;
    mode: string;  // 'constructed', 'limited', etc.
  };
}

/**
 * Helper to get a card by ID
 */
export function getCard(state: GameState, cardId: CardId): Card | undefined {
  return state.cards.get(cardId);
}

/**
 * Helper to get a player by ID
 */
export function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.get(playerId);
}

/**
 * Helper to get a battlefield by ID
 */
export function getBattlefield(state: GameState, battlefieldId: BattlefieldId): BattlefieldState | undefined {
  return state.battlefields.get(battlefieldId);
}

/**
 * Helper to update a card in the state
 */
export function updateCard(state: GameState, card: Card): GameState {
  const newCards = new Map(state.cards);
  newCards.set(card.id, card);
  return {
    ...state,
    cards: newCards,
  };
}

/**
 * Helper to update a player in the state
 */
export function updatePlayer(state: GameState, playerId: PlayerId, player: PlayerState): GameState {
  const newPlayers = new Map(state.players);
  newPlayers.set(playerId, player);
  return {
    ...state,
    players: newPlayers,
  };
}

/**
 * Helper to update a battlefield in the state
 */
export function updateBattlefield(
  state: GameState,
  battlefieldId: BattlefieldId,
  battlefield: BattlefieldState
): GameState {
  const newBattlefields = new Map(state.battlefields);
  newBattlefields.set(battlefieldId, battlefield);
  return {
    ...state,
    battlefields: newBattlefields,
  };
}
