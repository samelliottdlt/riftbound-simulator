/**
 * Turn Structure Tests
 * 
 * Tests turn flow, phase transitions, and phase-specific actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startTurn,
  advancePhase,
  executeAwakenPhase,
  executeBeginningPhase,
  executeDrawPhase,
  executeEndingPhase,
  endTurn,
  isPlayerTurn,
  getCurrentPhase,
  getTurnPlayer,
  getTurnNumber,
  isInCombatPhase,
  isInActionPhase,
  completeTurnCycle,
} from '../../src/core/turnStructure.js';
import { GameState, getPlayer, updatePlayer } from '../../src/types/gameState.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  PlayerId,
  CardId,
  Phase,
  Energy,
  playerId,
  cardId,
  CardCategory,
  Domain,
  Might,
} from '../../src/types/primitives.js';
import { UnitCard } from '../../src/types/cards.js';

describe('Turn Initialization', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should start a new turn', () => {
    const result = startTurn(state, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getTurnPlayer(result.value)).toBe(p1);
      expect(getCurrentPhase(result.value)).toBe(Phase.Awaken);
      expect(getTurnNumber(result.value)).toBe(2); // Initial state is turn 1
    }
  });

  it('should reset cards played this turn', () => {
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      cardsPlayedThisTurn: [cardId('card1'), cardId('card2')],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const result = startTurn(state, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.cardsPlayedThisTurn).toHaveLength(0);
    }
  });
});

describe('Phase Transitions', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Awaken });
  });

  it('should advance from Awaken to Beginning', () => {
    const result = advancePhase(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCurrentPhase(result.value)).toBe(Phase.Beginning);
    }
  });

  it('should advance from Beginning to Channel', () => {
    state.turnState.phase = Phase.Beginning;
    const result = advancePhase(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCurrentPhase(result.value)).toBe(Phase.Channel);
    }
  });

  it('should advance from Channel to Draw', () => {
    state.turnState.phase = Phase.Channel;
    const result = advancePhase(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCurrentPhase(result.value)).toBe(Phase.Draw);
    }
  });

  it('should advance from Draw to Action', () => {
    state.turnState.phase = Phase.Draw;
    const result = advancePhase(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCurrentPhase(result.value)).toBe(Phase.Action);
    }
  });

  it('should advance from Action to Combat', () => {
    state.turnState.phase = Phase.Action;
    const result = advancePhase(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCurrentPhase(result.value)).toBe(Phase.Combat);
      expect(isInCombatPhase(result.value)).toBe(true);
    }
  });

  it('should advance from Combat to Ending', () => {
    state.turnState.phase = Phase.Combat;
    const result = advancePhase(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCurrentPhase(result.value)).toBe(Phase.Ending);
    }
  });

  it('should not advance from Ending phase', () => {
    state.turnState.phase = Phase.Ending;
    const result = advancePhase(state);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PHASE_TRANSITION');
    }
  });
});

describe('Draw Phase', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Draw });
  });

  it('should empty Rune Pool at end of phase', () => {
    // Add energy and power to Rune Pool
    let player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      energy: 5 as Energy,
      runePool: [{ domain: Domain.Fury, amount: 1 }],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const result = executeDrawPhase(state, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      // Rune Pool should be emptied
      expect(newPlayer.energy).toBe(0);
      expect(newPlayer.runePool).toHaveLength(0);
    }
  });

  it('should draw a card', () => {
    const card1 = cardId('card1');
    const card2 = cardId('card2');

    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      deck: [card1, card2],
      hand: [],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const result = executeDrawPhase(state, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.hand).toContain(card1);
      expect(newPlayer.deck).toHaveLength(1);
      expect(newPlayer.deck[0]).toBe(card2);
    }
  });

  it('should not draw when deck is empty', () => {
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      deck: [],
      hand: [],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const result = executeDrawPhase(state, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.hand).toHaveLength(0);
    }
  });
});

describe('Ending Phase', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Ending });
  });

  it('should reset energy', () => {
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      energy: 5 as Energy,
      energyGenerated: 5 as Energy,
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const result = executeEndingPhase(state, p1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const newPlayer = getPlayer(result.value, p1)!;
      expect(newPlayer.energy).toBe(0);
      expect(newPlayer.energyGenerated).toBe(0);
    }
  });
});

describe('Turn End', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Ending });
  });

  it('should end turn and start next player\'s turn', () => {
    const result = endTurn(state, p1, p2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getTurnPlayer(result.value)).toBe(p2);
      expect(getCurrentPhase(result.value)).toBe(Phase.Awaken);
      expect(getTurnNumber(result.value)).toBe(2);
    }
  });

  it('should fail if not in Ending phase', () => {
    state.turnState.phase = Phase.Action;
    const result = endTurn(state, p1, p2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PHASE');
    }
  });

  it('should fail if wrong player tries to end turn', () => {
    const result = endTurn(state, p2, p1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('WRONG_PLAYER');
    }
  });
});

describe('Complete Turn Cycle', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Awaken });
  });

  it('should complete full turn cycle', () => {
    // Add cards to deck for draw
    const card1 = cardId('card1');
    const player = getPlayer(state, p1)!;
    const updatedPlayer = {
      ...player,
      deck: [card1],
    };
    state = updatePlayer(state, p1, updatedPlayer);

    const result = completeTurnCycle(state, p1, p2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should be p2's turn now
      expect(getTurnPlayer(result.value)).toBe(p2);
      expect(getCurrentPhase(result.value)).toBe(Phase.Awaken);
      
      // P1 should have drawn a card
      const p1Final = getPlayer(result.value, p1)!;
      expect(p1Final.hand).toContain(card1);
      
      // P1's energy should be reset
      expect(p1Final.energy).toBe(0);
    }
  });
});

describe('Query Functions', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1, phase: Phase.Action });
  });

  it('should check if it is player\'s turn', () => {
    expect(isPlayerTurn(state, p1)).toBe(true);
    expect(isPlayerTurn(state, p2)).toBe(false);
  });

  it('should check if in action phase', () => {
    expect(isInActionPhase(state)).toBe(true);
    state.turnState.phase = Phase.Combat;
    expect(isInActionPhase(state)).toBe(false);
  });

  it('should get turn information', () => {
    expect(getCurrentPhase(state)).toBe(Phase.Action);
    expect(getTurnPlayer(state)).toBe(p1);
    expect(getTurnNumber(state)).toBe(1);
  });
});
