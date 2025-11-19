/**
 * Tests for Battlefield Control System
 * 
 * Tests battlefield ownership, contested status, and control changes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  playerId,
  battlefieldId,
  BattlefieldId,
} from '../../src/types/primitives.js';
import { GameState, BattlefieldState } from '../../src/types/gameState.js';
import {
  getBattlefieldController,
  isBattlefieldControlled,
  isControlledBy,
  isBattlefieldContested,
  applyContested,
  removeContested,
  establishControl,
  loseControl,
  getControlledBattlefields,
  countControlledBattlefields,
} from '../../src/core/battlefieldControl.js';

describe('Battlefield Control Queries', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const bf1 = battlefieldId('bf1');
  const bf2 = battlefieldId('bf2');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    
    const battlefields = new Map<BattlefieldId, BattlefieldState>();
    battlefields.set(bf1, {
      id: bf1,
      controller: p1,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    battlefields.set(bf2, {
      id: bf2,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    
    state = createMinimalGameState({ players, turnPlayer: p1 });
    state.battlefields = battlefields;
  });

  it('should get battlefield controller', () => {
    expect(getBattlefieldController(state, bf1)).toBe(p1);
    expect(getBattlefieldController(state, bf2)).toBe(null);
  });

  it('should check if battlefield is controlled', () => {
    expect(isBattlefieldControlled(state, bf1)).toBe(true);
    expect(isBattlefieldControlled(state, bf2)).toBe(false);
  });

  it('should check if battlefield is controlled by specific player', () => {
    expect(isControlledBy(state, bf1, p1)).toBe(true);
    expect(isControlledBy(state, bf1, p2)).toBe(false);
    expect(isControlledBy(state, bf2, p1)).toBe(false);
    expect(isControlledBy(state, bf2, p2)).toBe(false);
  });

  it('should check contested status', () => {
    expect(isBattlefieldContested(state, bf1)).toBe(false);
    expect(isBattlefieldContested(state, bf2)).toBe(false);
  });

  it('should get all controlled battlefields for a player', () => {
    const controlled = getControlledBattlefields(state, p1);
    expect(controlled).toContain(bf1);
    expect(controlled).not.toContain(bf2);
    expect(controlled.length).toBe(1);
  });

  it('should count controlled battlefields', () => {
    expect(countControlledBattlefields(state, p1)).toBe(1);
    expect(countControlledBattlefields(state, p2)).toBe(0);
  });
});

describe('Contested Status', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const bf1 = battlefieldId('bf1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    
    const battlefields = new Map<BattlefieldId, BattlefieldState>();
    battlefields.set(bf1, {
      id: bf1,
      controller: p1,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    
    state = createMinimalGameState({ players, turnPlayer: p1 });
    state.battlefields = battlefields;
  });

  it('should apply contested status', () => {
    const result = applyContested(state, bf1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(isBattlefieldContested(result.value, bf1)).toBe(true);
    }
  });

  it('should remove contested status', () => {
    let result = applyContested(state, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = removeContested(result.value, bf1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(isBattlefieldContested(result.value, bf1)).toBe(false);
    }
  });

  it('should be idempotent when applying contested twice', () => {
    let result = applyContested(state, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = applyContested(result.value, bf1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(isBattlefieldContested(result.value, bf1)).toBe(true);
    }
  });

  it('should reject contested for non-existent battlefield', () => {
    const invalidBf = battlefieldId('invalid');
    const result = applyContested(state, invalidBf);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BATTLEFIELD_NOT_FOUND');
    }
  });
});

describe('Control Establishment and Loss', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const bf1 = battlefieldId('bf1');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    players.set(p2, createMinimalPlayer());
    
    const battlefields = new Map<BattlefieldId, BattlefieldState>();
    battlefields.set(bf1, {
      id: bf1,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    
    state = createMinimalGameState({ players, turnPlayer: p1 });
    state.battlefields = battlefields;
  });

  it('should establish control of uncontrolled battlefield', () => {
    const result = establishControl(state, bf1, p1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(getBattlefieldController(result.value, bf1)).toBe(p1);
      expect(isControlledBy(result.value, bf1, p1)).toBe(true);
    }
  });

  it('should lose control of battlefield', () => {
    // First establish control
    let result = establishControl(state, bf1, p1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    // Then lose it
    result = loseControl(result.value, bf1);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(getBattlefieldController(result.value, bf1)).toBe(null);
      expect(isBattlefieldControlled(result.value, bf1)).toBe(false);
    }
  });

  it('should prevent establishing control while contested', () => {
    // Apply contested
    let result = applyContested(state, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    // Try to establish control
    result = establishControl(result.value, bf1, p1);
    expect(result.ok).toBe(false);
    
    if (!result.ok) {
      expect(result.error.code).toBe('BATTLEFIELD_CONTESTED');
    }
  });

  it('should prevent losing control while contested', () => {
    // Establish control
    let result = establishControl(state, bf1, p1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    // Apply contested
    result = applyContested(result.value, bf1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    // Try to lose control
    result = loseControl(result.value, bf1);
    expect(result.ok).toBe(false);
    
    if (!result.ok) {
      expect(result.error.code).toBe('BATTLEFIELD_CONTESTED');
    }
  });

  it('should reject establishing control for non-existent battlefield', () => {
    const invalidBf = battlefieldId('invalid');
    const result = establishControl(state, invalidBf, p1);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BATTLEFIELD_NOT_FOUND');
    }
  });

  it('should reject establishing control for non-existent player', () => {
    const invalidPlayer = playerId('invalid');
    const result = establishControl(state, bf1, invalidPlayer);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PLAYER_NOT_FOUND');
    }
  });
});

describe('Multiple Battlefield Control', () => {
  let state: GameState;
  const p1 = playerId('p1');
  const bf1 = battlefieldId('bf1');
  const bf2 = battlefieldId('bf2');
  const bf3 = battlefieldId('bf3');

  beforeEach(() => {
    const players = new Map();
    players.set(p1, createMinimalPlayer());
    
    const battlefields = new Map<BattlefieldId, BattlefieldState>();
    battlefields.set(bf1, {
      id: bf1,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    battlefields.set(bf2, {
      id: bf2,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    battlefields.set(bf3, {
      id: bf3,
      controller: null,
      units: new Set(),
      facedownCard: null,
      contested: false,
      showdownStaged: false,
      combatStaged: false,
    });
    
    state = createMinimalGameState({ players, turnPlayer: p1 });
    state.battlefields = battlefields;
  });

  it('should track control of multiple battlefields', () => {
    let result = establishControl(state, bf1, p1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    result = establishControl(result.value, bf2, p1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    const controlled = getControlledBattlefields(result.value, p1);
    expect(controlled).toContain(bf1);
    expect(controlled).toContain(bf2);
    expect(controlled).not.toContain(bf3);
    expect(countControlledBattlefields(result.value, p1)).toBe(2);
  });
});
