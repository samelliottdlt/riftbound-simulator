/**
 * Cleanup System Tests (Rules 318-323)
 * 
 * Tests for the 10-step Cleanup process that corrects game state
 */

import { describe, it, expect } from 'vitest';
import { performCleanup, shouldPerformCleanup } from '../../src/core/cleanup.js';
import { playerId, cardId, unitId, battlefieldId, Phase, TurnStateType, ChainStateType } from '../../src/types/primitives.js';
import { createMinimalGameState, createMinimalPlayer, createMinimalBattlefield } from '../utils/testHelpers.js';
import { createUnit } from '../../src/types/cards.js';
import { unwrap } from '../../src/types/result.js';

describe('Cleanup System', () => {
  describe('Step 1: Check Victory (Rule 322.1)', () => {
    it('should detect when player reaches victory score', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      
      const player1 = createMinimalPlayer();
      player1.points = 8; // Victory score
      
      const player2 = createMinimalPlayer();
      
      const state = createMinimalGameState({
        players: new Map([[p1, player1], [p2, player2]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      
      expect(result.ok).toBe(true);
      // In full implementation, would set winner
    });
  });
  
  describe('Step 2: Kill Lethally Damaged Units (Rule 322.2)', () => {
    it('should kill units with damage >= might', () => {
      const p1 = playerId('p1');
      const unit1 = createUnit(cardId('u1'), p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit1.damage = 3; // Lethal damage
      
      const state = createMinimalGameState({
        cards: new Map([[unit1.id, unit1]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      
      expect(result.ok).toBe(true);
      // TODO: Verify unit moved to trash once killUnit is integrated
    });
    
    it('should not kill units with damage < might', () => {
      const p1 = playerId('p1');
      const unit1 = createUnit(cardId('u1'), p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit1.damage = 2; // Non-lethal
      
      const state = createMinimalGameState({
        cards: new Map([[unit1.id, unit1]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Unit should still be in cards
      expect(newState.cards.get(unit1.id)).toBeDefined();
    });
  });
  
  describe('Step 4: Clear Uncontrolled Battlefields (Rule 322.4)', () => {
    it('should clear controller from empty uncontested battlefield', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1,
        units: [], // No units
        contested: false,
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.controller).toBeNull();
    });
    
    it('should not clear controller if battlefield has units', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      const u1 = unitId('u1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1,
        units: [u1],
        contested: false,
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.controller).toBe(p1);
    });
    
    it('should not clear controller if battlefield is contested', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1,
        units: [],
        contested: true, // Contested
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.controller).toBe(p1); // Still controlled
    });
  });
  
  describe('Step 6: Stage Showdowns at Uncontrolled (Rule 322.6)', () => {
    it('should stage and initiate showdown at contested uncontrolled battlefield', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: null, // Uncontrolled
        contested: true,  // Contested
        contestedBy: p1,
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Step 6 stages showdown, then Step 9 initiates it immediately
      // (since we're in Neutral Open State)
      expect(newState.turnState.stateType).toBe(TurnStateType.Showdown);
      
      // Showdown staged flag is cleared after initiation
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.showdownStaged).toBe(false);
    });
    
    it('should not stage showdown at controlled battlefield', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1, // Controlled
        contested: true,
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.showdownStaged).toBe(false);
    });
  });
  
  describe('Step 7: Stage Combats at Controlled (Rule 322.7)', () => {
    it('should stage combat when contested by different player', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');
      const u1 = unitId('u1');
      const u2 = unitId('u2');
      
      const unit1 = createUnit(u1, p1, 'Unit 1', { energy: 0, power: [] }, 2);
      const unit2 = createUnit(u2, p2, 'Unit 2', { energy: 0, power: [] }, 2);
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1,   // Controlled by p1
        contested: true,
        contestedBy: p2,  // Contested by p2
        units: [u1, u2],  // Units from both players
      });
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit1], [u2, unit2]]),
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // In Neutral Open State, combat is staged (step 7) and immediately initiated (step 10)
      // So combatStaged is cleared, but combat becomes active
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.combatStaged).toBe(false);
      expect(newState.combatState.active).toBe(true);
      expect(newState.combatState.battlefield).toBe(bf1);
      expect(newState.turnState.stateType).toBe(TurnStateType.Showdown);
    });
    
    it('should not stage combat if controlled by same player who contested', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1,   // Controlled by p1
        contested: true,
        contestedBy: p1,  // Also contested by p1 (edge case)
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.combatStaged).toBe(false);
    });
  });
  
  describe('Step 8: Finalize Pending Chain Items (Rule 322.8)', () => {
    it('should finalize pending items on chain', () => {
      const p1 = playerId('p1');
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      // Add pending chain item
      state.chainState.items.push({
        id: 'chain-item-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: true,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      expect(newState.chainState.items[0].pending).toBe(false);
    });
  });
  
  describe('Step 9: Initiate Showdowns (Rule 322.9)', () => {
    it('should initiate showdown when staged in Neutral Open State', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: null, // Uncontrolled
        showdownStaged: true,
        contested: true,
        contestedBy: p2,  // p2 applied Contested status
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Should transition to Showdown state (Rule 308.1)
      expect(newState.turnState.stateType).toBe(TurnStateType.Showdown);
      
      // Focus should be awarded to player who applied Contested (Rule 341)
      expect(newState.turnState.focus).toBe(p2);
      
      // Showdown staged flag should be cleared
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.showdownStaged).toBe(false);
    });
    
    it('should not initiate showdown if not in Neutral Open State', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: null,
        showdownStaged: true,
        contested: true,
        contestedBy: p1,
      });
      
      // State is Closed (chain exists)
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      state.turnState.chainState = ChainStateType.Closed;
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: false,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Should NOT transition to Showdown state
      expect(newState.turnState.stateType).toBe(TurnStateType.Neutral);
      
      // Showdown should remain staged
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.showdownStaged).toBe(true);
    });
    
    it('should handle no staged showdowns gracefully', () => {
      const p1 = playerId('p1');
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      expect(newState.turnState.stateType).toBe(TurnStateType.Neutral);
    });
  });
  
  describe('Step 10: Initiate Combats (Rule 322.10)', () => {
    it('should initiate combat when staged in Neutral Open State', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');
      const u1 = unitId('u1');
      const u2 = unitId('u2');
      
      const unit1 = createUnit(u1, p1, 'Attacker', { energy: 0, power: [] }, 3);
      const unit2 = createUnit(u2, p2, 'Defender', { energy: 0, power: [] }, 2);
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p2,  // Controlled by p2
        combatStaged: true,
        contested: true,
        contestedBy: p1,  // p1 applied Contested (attacker)
        units: [u1, u2],
      });
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit1], [u2, unit2]]),
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Should transition to Showdown state (Rule 438.1)
      expect(newState.turnState.stateType).toBe(TurnStateType.Showdown);
      
      // Focus should be awarded to Attacker (Rule 438.1.a.1.a)
      expect(newState.turnState.focus).toBe(p1);
      
      // Combat should be active
      expect(newState.combatState.active).toBe(true);
      expect(newState.combatState.battlefield).toBe(bf1);
      expect(newState.combatState.attackingPlayer).toBe(p1);
      expect(newState.combatState.defendingPlayer).toBe(p2);
      
      // Units should have proper designations (Rule 438.1.a.3 and 438.1.a.4)
      expect(newState.combatState.attackers.has(u1)).toBe(true);
      expect(newState.combatState.defenders.has(u2)).toBe(true);
      
      // Combat staged flag should be cleared
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.combatStaged).toBe(false);
    });
    
    it('should not initiate combat if not in Neutral Open State', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const bf1 = battlefieldId('bf1');
      
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p2,
        combatStaged: true,
        contested: true,
        contestedBy: p1,
      });
      
      // State is Closed (chain exists)
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      state.turnState.chainState = ChainStateType.Closed;
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: false,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Should NOT transition to Showdown state or activate combat
      expect(newState.turnState.stateType).toBe(TurnStateType.Neutral);
      expect(newState.combatState.active).toBe(false);
      
      // Combat should remain staged
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.combatStaged).toBe(true);
    });
    
    it('should handle no staged combats gracefully', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      expect(newState.turnState.stateType).toBe(TurnStateType.Neutral);
      expect(newState.combatState.active).toBe(false);
    });
  });
  
  describe('Cleanup Recursion (Rule 321)', () => {
    it('should recurse when changes occur during cleanup', () => {
      const p1 = playerId('p1');
      const bf1 = battlefieldId('bf1');
      
      // Create battlefield that will lose control
      const battlefield = createMinimalBattlefield(bf1, {
        controller: p1,
        units: [], // No units, will become uncontrolled
        contested: false,
      });
      
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        battlefields: new Map([[bf1, battlefield]]),
        turnPlayer: p1,
      });
      
      const result = performCleanup(state);
      const newState = unwrap(result);
      
      // Battlefield should lose control in first cleanup
      // Second cleanup should occur but make no changes
      const updatedBattlefield = newState.battlefields.get(bf1);
      expect(updatedBattlefield?.controller).toBeNull();
    });
  });
  
  describe('shouldPerformCleanup', () => {
    it('should detect phase transitions (Rule 319.2)', () => {
      const p1 = playerId('p1');
      const oldState = createMinimalGameState({ turnPlayer: p1, phase: Phase.Awaken });
      const newState = createMinimalGameState({ turnPlayer: p1, phase: Phase.Draw });
      
      expect(shouldPerformCleanup(oldState, newState)).toBe(true);
    });
    
    it('should detect state type transitions (Rule 319.1)', () => {
      const p1 = playerId('p1');
      const oldState = createMinimalGameState({ turnPlayer: p1 });
      const newState = { ...oldState };
      newState.turnState = {
        ...oldState.turnState,
        stateType: TurnStateType.Showdown, // Changed from Neutral
      };
      
      expect(shouldPerformCleanup(oldState, newState)).toBe(true);
    });
    
    it('should detect chain state transitions (Rule 319.1)', () => {
      const p1 = playerId('p1');
      const oldState = createMinimalGameState({ turnPlayer: p1 });
      const newState = { ...oldState };
      newState.turnState = {
        ...oldState.turnState,
        chainState: ChainStateType.Closed, // Changed from Open
      };
      
      expect(shouldPerformCleanup(oldState, newState)).toBe(true);
    });
  });
});
