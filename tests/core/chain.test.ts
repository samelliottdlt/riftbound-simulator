/**
 * Chain System Tests (Rules 326-336)
 * 
 * Tests for the Chain resolution system with priority passing
 */

import { describe, it, expect } from 'vitest';
import {
  addToChain,
  finalizeChainItems,
  passPriority,
  resolveTopChainItem,
  chainExists,
  isClosedState,
  isOpenState,
} from '../../src/core/chain.js';
import { playerId, cardId, ChainStateType } from '../../src/types/primitives.js';
import { createMinimalGameState, createMinimalPlayer } from '../utils/testHelpers.js';
import { unwrap } from '../../src/types/result.js';

describe('Chain System', () => {
  describe('addToChain (Rule 332)', () => {
    it('should add item to chain as Pending', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = addToChain(state, {
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).chainState.items).toHaveLength(1);
      if (result.ok) expect(unwrap(result).chainState.items[0].pending).toBe(true);
    });
    
    it('should set state to Closed when chain created (Rule 330.1)', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = addToChain(state, {
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).turnState.chainState).toBe(ChainStateType.Closed);
    });
    
    it('should set activePlayer and priority to controller (Rule 332.1)', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = addToChain(state, {
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).turnState.activePlayer).toBe(p1);
      if (result.ok) expect(unwrap(result).turnState.priority).toBe(p1);
    });
    
    it('should append to existing chain', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      // Add first item
      let result = addToChain(state, {
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
      });
      expect(result.ok).toBe(true);
      
      // Add second item
      result = addToChain(unwrap(result), {
        id: 'chain-2',
        type: 'ability',
        source: cardId('unit1'),
        controller: p1,
      });
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).chainState.items).toHaveLength(2);
    });
  });
  
  describe('finalizeChainItems (Rule 333)', () => {
    it('should mark pending items as finalized', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      // Add pending item directly
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: true,
      });
      
      const result = finalizeChainItems(state);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).chainState.items[0].pending).toBe(false);
    });
    
    it('should set activePlayer to controller of newest item (Rule 333.1.c.3)', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      // Add item from p2
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p2,
        pending: true,
      });
      
      const result = finalizeChainItems(state);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).turnState.activePlayer).toBe(p2);
      if (result.ok) expect(unwrap(result).turnState.priority).toBe(p2);
    });
    
    it('should do nothing if no pending items', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      // Add non-pending item
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: false,
      });
      
      const result = finalizeChainItems(state);
      
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(unwrap(result)).toEqual(state); // No change
    });
  });
  
  describe('passPriority (Rule 335)', () => {
    it('should pass priority to next player in turn order', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      state.turnState.activePlayer = p1;
      state.turnState.priority = p1;
      
      const result = passPriority(state, 0);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).state.turnState.activePlayer).toBe(p2);
      if (result.ok) expect(unwrap(result).state.turnState.priority).toBe(p2);
      if (result.ok) expect(unwrap(result).shouldResolve).toBe(false);
    });
    
    it('should indicate resolution when all players pass (Rule 335.1)', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = passPriority(state, 2); // Both players passed
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).shouldResolve).toBe(true);
    });
    
    it('should wrap around to first player', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      state.turnState.activePlayer = p2; // Last player
      state.turnState.priority = p2;
      
      const result = passPriority(state, 0);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).state.turnState.activePlayer).toBe(p1); // Wrapped to first
    });
  });
  
  describe('resolveTopChainItem (Rule 336)', () => {
    it('should remove top item from chain', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: false,
      });
      
      const result = resolveTopChainItem(state);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).chainState.items).toHaveLength(0);
    });
    
    it('should set state to Open when chain becomes empty (Rule 336.2)', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
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
      
      const result = resolveTopChainItem(state);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).turnState.chainState).toBe(ChainStateType.Open);
    });
    
    it('should set priority to newest item controller when chain not empty (Rule 336.4)', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      // Add two items
      state.chainState.items.push(
        {
          id: 'chain-1',
          type: 'spell',
          source: cardId('spell1'),
          controller: p1,
          pending: false,
        },
        {
          id: 'chain-2',
          type: 'spell',
          source: cardId('spell2'),
          controller: p2,
          pending: false,
        }
      );
      
      // Resolve top (p2's item)
      const result = resolveTopChainItem(state);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(unwrap(result).chainState.items).toHaveLength(1);
      if (result.ok) expect(unwrap(result).turnState.activePlayer).toBe(p1); // Now p1's item is top
      if (result.ok) expect(unwrap(result).turnState.priority).toBe(p1);
    });
    
    it('should error if chain is empty', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = resolveTopChainItem(state);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_CHAIN');
      }
    });
  });
  
  describe('chainExists (Rule 329)', () => {
    it('should return true when items on chain', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: false,
      });
      
      expect(chainExists(state)).toBe(true);
    });
    
    it('should return false when chain empty', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      expect(chainExists(state)).toBe(false);
    });
  });
  
  describe('State helpers (Rule 330)', () => {
    it('isClosedState should return true when chain exists', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      state.chainState.items.push({
        id: 'chain-1',
        type: 'spell',
        source: cardId('spell1'),
        controller: p1,
        pending: false,
      });
      
      expect(isClosedState(state)).toBe(true);
      expect(isOpenState(state)).toBe(false);
    });
    
    it('isOpenState should return true when chain empty', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      expect(isOpenState(state)).toBe(true);
      expect(isClosedState(state)).toBe(false);
    });
  });
});
