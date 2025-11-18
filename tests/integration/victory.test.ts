/**
 * Tests for Victory and Scoring System
 * 
 * Tests Points, Victory Score, and win conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  PlayerId,
  playerId,
  battlefieldId,
  BattlefieldId,
  Points,
  VictoryScore,
} from '../../src/types/primitives.js';
import { GameState } from '../../src/types/gameState.js';
import {
  DEFAULT_VICTORY_SCORE,
  awardPoints,
  getPoints,
  hasPlayerWon,
  getWinners,
  isGameOver,
  isFinalPoint,
  markBattlefieldScored,
  hasScoredBattlefield,
  clearScoredBattlefields,
} from '../../src/core/victory.js';

describe('Victory Score Constants', () => {
  it('should have default victory score of 8', () => {
    expect(DEFAULT_VICTORY_SCORE).toBe(8);
  });
});

describe('Points Management', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should start with 0 points', () => {
    expect(getPoints(state, p1)).toBe(0);
    expect(getPoints(state, p2)).toBe(0);
  });

  it('should award points to a player', () => {
    const result = awardPoints(state, p1, 3 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(getPoints(result.value, p1)).toBe(3);
      expect(getPoints(result.value, p2)).toBe(0); // P2 unchanged
    }
  });

  it('should accumulate points', () => {
    let result = awardPoints(state, p1, 2 as Points);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = awardPoints(result.value, p1, 3 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(getPoints(result.value, p1)).toBe(5);
    }
  });

  it('should reject awarding points to non-existent player', () => {
    const invalidPlayer = playerId('invalid');
    const result = awardPoints(state, invalidPlayer, 1 as Points);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PLAYER_NOT_FOUND');
    }
  });
});

describe('Win Conditions', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    players.set(p2, createMinimalPlayer(p2));
    state = createMinimalGameState({ players, turnPlayer: p1 });
    state.victoryScore = 8 as VictoryScore;
  });

  it('should not have winner initially', () => {
    expect(hasPlayerWon(state, p1)).toBe(false);
    expect(hasPlayerWon(state, p2)).toBe(false);
    expect(getWinners(state)).toEqual([]);
    expect(isGameOver(state)).toBe(false);
  });

  it('should detect winner when points reach victory score', () => {
    const result = awardPoints(state, p1, 8 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasPlayerWon(result.value, p1)).toBe(true);
      expect(hasPlayerWon(result.value, p2)).toBe(false);
      expect(getWinners(result.value)).toEqual([p1]);
      expect(isGameOver(result.value)).toBe(true);
    }
  });

  it('should detect winner when points exceed victory score', () => {
    const result = awardPoints(state, p1, 10 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasPlayerWon(result.value, p1)).toBe(true);
      expect(getWinners(result.value)).toEqual([p1]);
    }
  });

  it('should detect multiple winners in multiplayer', () => {
    let result = awardPoints(state, p1, 8 as Points);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = awardPoints(result.value, p2, 8 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      const winners = getWinners(result.value);
      expect(winners).toContain(p1);
      expect(winners).toContain(p2);
      expect(winners.length).toBe(2);
    }
  });

  it('should not detect winner at 7 points (one below victory score)', () => {
    const result = awardPoints(state, p1, 7 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasPlayerWon(result.value, p1)).toBe(false);
      expect(isGameOver(result.value)).toBe(false);
    }
  });
});

describe('Final Point Detection', () => {
  let state: GameState;
  const p1 = playerId('p1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    state = createMinimalGameState({ players, turnPlayer: p1 });
    state.victoryScore = 8 as VictoryScore;
  });

  it('should detect final point when at victory score - 1', () => {
    const result = awardPoints(state, p1, 7 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(isFinalPoint(result.value, p1)).toBe(true);
    }
  });

  it('should not detect final point when below victory score - 1', () => {
    const result = awardPoints(state, p1, 6 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(isFinalPoint(result.value, p1)).toBe(false);
    }
  });

  it('should not detect final point when at 0 points', () => {
    expect(isFinalPoint(state, p1)).toBe(false);
  });

  it('should not detect final point after winning', () => {
    const result = awardPoints(state, p1, 8 as Points);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(isFinalPoint(result.value, p1)).toBe(false);
    }
  });
});

describe('Battlefield Scoring Tracking', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const bf1 = battlefieldId('bf1');
  const bf2 = battlefieldId('bf2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer(p1));
    state = createMinimalGameState({ players, turnPlayer: p1 });
  });

  it('should not have any scored battlefields initially', () => {
    expect(hasScoredBattlefield(state, p1, bf1)).toBe(false);
    expect(hasScoredBattlefield(state, p1, bf2)).toBe(false);
  });

  it('should mark battlefield as scored', () => {
    const result = markBattlefieldScored(state, p1, bf1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasScoredBattlefield(result.value, p1, bf1)).toBe(true);
      expect(hasScoredBattlefield(result.value, p1, bf2)).toBe(false);
    }
  });

  it('should track multiple scored battlefields', () => {
    let result = markBattlefieldScored(state, p1, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = markBattlefieldScored(result.value, p1, bf2);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasScoredBattlefield(result.value, p1, bf1)).toBe(true);
      expect(hasScoredBattlefield(result.value, p1, bf2)).toBe(true);
    }
  });

  it('should clear scored battlefields', () => {
    let result = markBattlefieldScored(state, p1, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = markBattlefieldScored(result.value, p1, bf2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = clearScoredBattlefields(result.value, p1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasScoredBattlefield(result.value, p1, bf1)).toBe(false);
      expect(hasScoredBattlefield(result.value, p1, bf2)).toBe(false);
    }
  });

  it('should handle marking same battlefield twice (idempotent)', () => {
    let result = markBattlefieldScored(state, p1, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = markBattlefieldScored(result.value, p1, bf1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(hasScoredBattlefield(result.value, p1, bf1)).toBe(true);
    }
  });

  it('should reject marking battlefield for non-existent player', () => {
    const invalidPlayer = playerId('invalid');
    const result = markBattlefieldScored(state, invalidPlayer, bf1);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PLAYER_NOT_FOUND');
    }
  });

  it('should reject clearing battlefields for non-existent player', () => {
    const invalidPlayer = playerId('invalid');
    const result = clearScoredBattlefields(state, invalidPlayer);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PLAYER_NOT_FOUND');
    }
  });
});
