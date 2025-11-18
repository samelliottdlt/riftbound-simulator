/**
 * Vertical Slice Integration Test
 * 
 * Tests the core game loop with a simple scenario:
 * 1. Player 1 draws a card
 * 2. Player 1 ends their turn
 * 3. Player 2's turn begins
 */

import { describe, it, expect } from 'vitest';
import {
  resolveGameState,
  getPendingChoices,
  autoResolve,
  GameState,
  SeededRNG,
  playerId,
  cardId,
  Phase,
  createCard,
  isOk,
  unwrap,
} from '../../src/index.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';

describe('Vertical Slice: Basic Turn Cycle', () => {
  it('should complete a basic turn cycle', () => {
    // Setup: Create initial game state with 2 players
    const p1 = playerId('p1');
    const p2 = playerId('p2');
    const card1 = cardId('card1');
    const card2 = cardId('card2');

    const initialState: GameState = createMinimalGameState({
      cards: new Map([
        [card1, createCard(card1, p1, 'Test Unit 1', 3)],
        [card2, createCard(card2, p2, 'Test Unit 2', 2)],
      ]),
      players: new Map([
        [p1, createMinimalPlayer(p1, { hand: [], deck: [card1] })],
        [p2, createMinimalPlayer(p2, { hand: [], deck: [card2] })],
      ]),
      turnPlayer: p1,
      phase: Phase.Draw,
      rng: new SeededRNG('test-seed'),
    });

    // Step 1: Check pending choices (should be draw)
    const choicesResult = getPendingChoices(initialState);
    expect(isOk(choicesResult)).toBe(true);
    const choices = unwrap(choicesResult);
    expect(choices).toHaveLength(1);
    expect(choices[0].type).toBe('draw');

    // Step 2: Player 1 draws a card
    const afterDrawResult = resolveGameState(initialState, { type: 'draw' });
    expect(isOk(afterDrawResult)).toBe(true);
    const afterDraw = unwrap(afterDrawResult);

    // Verify: Card moved from deck to hand, phase advanced to Action
    expect(afterDraw.players.get(p1)?.deck).toHaveLength(0);
    expect(afterDraw.players.get(p1)?.hand).toHaveLength(1);
    expect(afterDraw.players.get(p1)?.hand[0]).toBe(card1);
    expect(afterDraw.turnState.phase).toBe(Phase.Action);

    // Step 3: Check pending choices (should be endTurn)
    const actionChoicesResult = getPendingChoices(afterDraw);
    expect(isOk(actionChoicesResult)).toBe(true);
    const actionChoices = unwrap(actionChoicesResult);
    expect(actionChoices).toHaveLength(1);
    expect(actionChoices[0].type).toBe('endTurn');

    // Step 4: Player 1 ends their turn
    const afterEndTurnResult = resolveGameState(afterDraw, { type: 'endTurn' });
    expect(isOk(afterEndTurnResult)).toBe(true);
    let afterEndTurn = unwrap(afterEndTurnResult);

    // Verify: Turn passed to p2, phase is Awaken (start of new turn)
    expect(afterEndTurn.turnState.turnPlayer).toBe(p2);
    expect(afterEndTurn.turnState.phase).toBe(Phase.Awaken);

    // Step 5: Auto-advance through Awaken → Beginning → Channel → Draw
    afterEndTurn = unwrap(autoResolve(afterEndTurn)); // Awaken → Beginning
    afterEndTurn = unwrap(autoResolve(afterEndTurn)); // Beginning → Channel
    afterEndTurn = unwrap(autoResolve(afterEndTurn)); // Channel → Draw
    
    // Step 6: Player 2 can now draw
    const p2ChoicesResult = getPendingChoices(afterEndTurn);
    expect(isOk(p2ChoicesResult)).toBe(true);
    const p2Choices = unwrap(p2ChoicesResult);
    expect(p2Choices).toHaveLength(1);
    expect(p2Choices[0].type).toBe('draw');
  });

  it('should reject invalid choices', () => {
    const p1 = playerId('p1');
    const card1 = cardId('card1');

    const state: GameState = createMinimalGameState({
      cards: new Map([[card1, createCard(card1, p1, 'Test Unit', 3)]]),
      players: new Map([
        [p1, createMinimalPlayer(p1, { hand: [], deck: [card1] })],
      ]),
      turnPlayer: p1,
      phase: Phase.Draw,
      rng: new SeededRNG('test-seed'),
    });

    // Try to end turn during Draw phase (invalid)
    const result = resolveGameState(state, { type: 'endTurn' });
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.code).toBe('INVALID_CHOICE');
    }
  });

  it('should handle empty deck gracefully', () => {
    const p1 = playerId('p1');

    const state: GameState = createMinimalGameState({
      cards: new Map(),
      players: new Map([
        [p1, createMinimalPlayer(p1, { hand: [], deck: [] })],
      ]),
      turnPlayer: p1,
      phase: Phase.Draw,
      rng: new SeededRNG('test-seed'),
    });

    // No choices available when deck is empty
    const choicesResult = getPendingChoices(state);
    expect(isOk(choicesResult)).toBe(true);
    const choices = unwrap(choicesResult);
    expect(choices).toHaveLength(0);
  });
});
