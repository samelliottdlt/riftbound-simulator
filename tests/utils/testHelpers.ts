/**
 * Test Helpers
 * 
 * Utilities for creating test game states and scenarios
 */

import { GameState, PlayerState, BattlefieldState } from '../../src/types/gameState.js';
import { Card } from '../../src/types/cards.js';
import { PlayerId, CardId, UnitId, Phase, LegendId, legendId, Points, VictoryScore, TurnStateType, ChainStateType, BattlefieldId } from '../../src/types/primitives.js';
import { RNG, SeededRNG } from '../../src/utils/rng.js';

/**
 * Create a minimal PlayerState for testing
 */
export function createMinimalPlayer(
  options: {
    hand?: CardId[];
    deck?: CardId[];
    base?: UnitId[];
    legend?: LegendId;
  } = {}
): PlayerState {
  return {
    hand: options.hand ?? [],
    deck: options.deck ?? [],
    trash: [],
    banishment: [],
    championZone: null,
    base: new Set(options.base ?? []),
    runeDeck: [],
    runesInPlay: new Set(),
    energy: 0,
    energyGenerated: 0,
    maxEnergy: 0,
    runePool: [],
    cardsPlayedThisTurn: [],
    points: 0 as Points,
    battlefieldsScored: new Set(),
    legend: options.legend ?? legendId('default-legend'),
  };
}

/**
 * Create a minimal GameState for testing (backward compatible with vertical slice)
 */
export function createMinimalGameState(options: {
  cards?: Map<CardId, Card>;
  players?: Map<PlayerId, PlayerState>;
  turnPlayer: PlayerId;
  phase?: Phase;
  rng?: RNG;
  battlefields?: Map<any, any>;
}): GameState {
  return {
    cards: options.cards ?? new Map(),
    players: options.players ?? new Map(),
    battlefields: options.battlefields ?? new Map(),
    turnState: {
      phase: options.phase ?? Phase.Awaken,
      turnPlayer: options.turnPlayer,
      turnNumber: 1,
      stateType: TurnStateType.Neutral,       // Default to Neutral State
      chainState: ChainStateType.Open,        // Default to Open State
      priority: null,
      activePlayer: null,
      focus: null,
    },
    combatState: {
      active: false,
      battlefield: null,
      attackingPlayer: null,
      defendingPlayer: null,
      attackers: new Set<UnitId>(),
      defenders: new Set<UnitId>(),
      damageAssignments: new Map<UnitId, Map<UnitId, number>>(),
    },
    chainState: {
      items: [],
    },
    rng: options.rng ?? new SeededRNG('test-seed'),
    victoryScore: 8 as VictoryScore,
    metadata: {
      startTime: new Date(),
      mode: 'test',
    },
  };
}

/**
 * Create a minimal BattlefieldState for testing
 */
export function createMinimalBattlefield(
  id: BattlefieldId,
  options: {
    controller?: PlayerId | null;
    units?: UnitId[];
    contested?: boolean;
    showdownStaged?: boolean;
    combatStaged?: boolean;
    contestedBy?: PlayerId;
  } = {}
): BattlefieldState {
  return {
    id,
    controller: options.controller ?? null,
    units: new Set(options.units ?? []),
    facedownCard: null,
    contested: options.contested ?? false,
    showdownStaged: options.showdownStaged ?? false,
    combatStaged: options.combatStaged ?? false,
    contestedBy: options.contestedBy,
  };
}

/**
 * Create a complete 2-player game state for testing
 */
export function createTwoPlayerGameState(
  p1Cards: { id: CardId; card: Card }[],
  p2Cards: { id: CardId; card: Card }[],
  options: {
    p1Hand?: CardId[];
    p1Deck?: CardId[];
    p2Hand?: CardId[];
    p2Deck?: CardId[];
    turnPlayer: PlayerId;
    phase?: Phase;
    rng?: RNG;
  }
): GameState {
  const allCards = new Map<CardId, Card>();
  p1Cards.forEach(({ id, card }) => allCards.set(id, card));
  p2Cards.forEach(({ id, card }) => allCards.set(id, card));

  const players = new Map<PlayerId, PlayerState>();
  players.set(
    options.turnPlayer,
    createMinimalPlayer({
      hand: options.p1Hand,
      deck: options.p1Deck,
    })
  );
  
  // Assume second player ID based on turn player
  const p2Id = options.turnPlayer === 'p1' ? 'p2' : 'p1';
  players.set(
    p2Id as PlayerId,
    createMinimalPlayer({
      hand: options.p2Hand,
      deck: options.p2Deck,
    })
  );

  return createMinimalGameState({
    cards: allCards,
    players,
    turnPlayer: options.turnPlayer,
    phase: options.phase,
    rng: options.rng,
  });
}
