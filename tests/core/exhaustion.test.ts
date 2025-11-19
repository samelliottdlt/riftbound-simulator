/**
 * Exhaustion and Ready System Tests (Rules 401-402)
 * 
 * Tests exhausting and readying permanents (Units, Gear, Runes)
 */

import { describe, it, expect } from 'vitest';
import { playerId, cardId, unitId, CardId } from '../../src/types/primitives.js';
import { exhaustPermanent, readyPermanent, readyAllPermanents, isExhausted, isReady } from '../../src/core/exhaustion.js';
import { createUnit, createGear, createSpell, isUnit, isGear } from '../../src/types/cards.js';
import { createMinimalGameState, createMinimalPlayer } from '../utils/testHelpers.js';
import { isOk } from '../../src/types/result.js';
import { startTurn, executeAwakenPhase } from '../../src/core/turnStructure.js';

describe('Exhaustion System (Rule 401)', () => {
  describe('Exhaust Permanent', () => {
    it('should exhaust a ready unit', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = exhaustPermanent(state, u1);
      
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      const newState = result.value;
      const exhaustedCard = newState.cards.get(u1);
      expect(exhaustedCard).toBeDefined();
      if (exhaustedCard && isUnit(exhaustedCard)) {
        expect(exhaustedCard.exhausted).toBe(true);
      }
    });
    
    it('should not exhaust an already exhausted unit', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit.exhausted = true;
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = exhaustPermanent(state, u1);
      
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.code).toBe('ALREADY_EXHAUSTED');
      }
    });
    
    it('should exhaust gear', () => {
      const p1 = playerId('p1');
      const g1 = cardId('g1');
      const gear = createGear(g1, p1, 'Test Gear', { energy: 0, power: [] });
      
      const state = createMinimalGameState({
        cards: new Map([[g1, gear]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = exhaustPermanent(state, g1);
      
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      const newState = result.value;
      const exhaustedCard = newState.cards.get(g1);
      expect(exhaustedCard).toBeDefined();
      if (exhaustedCard && isGear(exhaustedCard)) {
        expect(exhaustedCard.exhausted).toBe(true);
      }
    });
    
    it('should not exhaust a spell', () => {
      const p1 = playerId('p1');
      const s1 = cardId('s1');
      const spell = createSpell(s1, p1, 'Test Spell', { energy: 1, power: [] });
      
      const state = createMinimalGameState({
        cards: new Map([[s1, spell]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = exhaustPermanent(state, s1);
      
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.code).toBe('CANNOT_EXHAUST');
      }
    });
  });
  
  describe('Ready Permanent (Rule 402)', () => {
    it('should ready an exhausted unit', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit.exhausted = true;
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = readyPermanent(state, u1);
      
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      const newState = result.value;
      const readiedCard = newState.cards.get(u1);
      expect(readiedCard).toBeDefined();
      if (readiedCard && isUnit(readiedCard)) {
        expect(readiedCard.exhausted).toBe(false);
      }
    });
    
    it('should handle readying an already ready unit', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit.exhausted = false;
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = readyPermanent(state, u1);
      
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      const newState = result.value;
      const readiedCard = newState.cards.get(u1);
      expect(readiedCard).toBeDefined();
      if (readiedCard && isUnit(readiedCard)) {
        expect(readiedCard.exhausted).toBe(false);
      }
    });
  });
  
  describe('Ready All Permanents (Rule 315.1.a)', () => {
    it('should ready all exhausted permanents controlled by player', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const u1 = unitId('u1');
      const u2 = unitId('u2');
      const u3 = unitId('u3');
      const g1 = cardId('g1');
      
      const unit1 = createUnit(u1, p1, 'Unit 1', { energy: 0, power: [] }, 2);
      const unit2 = createUnit(u2, p1, 'Unit 2', { energy: 0, power: [] }, 2);
      const unit3 = createUnit(u3, p2, 'Enemy Unit', { energy: 0, power: [] }, 2);
      const gear1 = createGear(g1, p1, 'Gear 1', { energy: 0, power: [] });
      
      // Exhaust p1's cards
      unit1.exhausted = true;
      unit2.exhausted = true;
      gear1.exhausted = true;
      unit3.exhausted = true; // p2's unit also exhausted
      
      const state = createMinimalGameState({
        cards: new Map<CardId, any>([[u1, unit1], [u2, unit2], [u3, unit3], [g1, gear1]]),
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = readyAllPermanents(state, p1);
      
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      const newState = result.value;
      
      // p1's cards should be ready
      const card1 = newState.cards.get(u1);
      const card2 = newState.cards.get(u2);
      const card3 = newState.cards.get(u3);
      const card4 = newState.cards.get(g1);
      
      if (card1 && isUnit(card1)) expect(card1.exhausted).toBe(false);
      if (card2 && isUnit(card2)) expect(card2.exhausted).toBe(false);
      if (card4 && isGear(card4)) expect(card4.exhausted).toBe(false);
      
      // p2's unit should still be exhausted
      if (card3 && isUnit(card3)) expect(card3.exhausted).toBe(true);
    });
    
    it('should handle player with no exhausted permanents', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit.exhausted = false;
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      const result = readyAllPermanents(state, p1);
      
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      const newState = result.value;
      const card = newState.cards.get(u1);
      if (card && isUnit(card)) {
        expect(card.exhausted).toBe(false);
      }
    });
  });
  
  describe('Exhaustion State Checks', () => {
    it('should correctly identify exhausted units', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit.exhausted = true;
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      expect(isExhausted(state, u1)).toBe(true);
      expect(isReady(state, u1)).toBe(false);
    });
    
    it('should correctly identify ready units', () => {
      const p1 = playerId('p1');
      const u1 = unitId('u1');
      const unit = createUnit(u1, p1, 'Test Unit', { energy: 0, power: [] }, 3);
      unit.exhausted = false;
      
      const state = createMinimalGameState({
        cards: new Map([[u1, unit]]),
        players: new Map([[p1, createMinimalPlayer()]]),
        turnPlayer: p1,
      });
      
      expect(isExhausted(state, u1)).toBe(false);
      expect(isReady(state, u1)).toBe(true);
    });
    
    it('should handle checking non-existent cards', () => {
      const state = createMinimalGameState({
        players: new Map([[playerId('p1'), createMinimalPlayer()]]),
        turnPlayer: playerId('p1'),
      });
      
      expect(isExhausted(state, unitId('nonexistent'))).toBe(false);
      // isReady returns true for non-existent cards (since !isExhausted = true)
      expect(isReady(state, unitId('nonexistent'))).toBe(true);
    });
  });
  
  describe('Awaken Phase Integration (Rule 315.1)', () => {
    it('should ready all permanents during Awaken phase', () => {
      const p1 = playerId('p1');
      const p2 = playerId('p2');
      const u1 = unitId('u1');
      const u2 = unitId('u2');
      const g1 = cardId('g1');
      
      const unit1 = createUnit(u1, p1, 'Unit 1', { energy: 0, power: [] }, 2);
      const unit2 = createUnit(u2, p1, 'Unit 2', { energy: 0, power: [] }, 2);
      const gear1 = createGear(g1, p1, 'Gear 1', { energy: 0, power: [] });
      
      // Exhaust all p1's cards
      unit1.exhausted = true;
      unit2.exhausted = true;
      gear1.exhausted = true;
      
      const state = createMinimalGameState({
        cards: new Map<CardId, any>([[u1, unit1], [u2, unit2], [g1, gear1]]),
        players: new Map([[p1, createMinimalPlayer()], [p2, createMinimalPlayer()]]),
        turnPlayer: p2, // Not p1's turn yet
      });
      
      // Start p1's turn (enters Awaken phase)
      const turnResult = startTurn(state, p1);
      expect(isOk(turnResult)).toBe(true);
      if (!isOk(turnResult)) return;
      
      // Execute Awaken phase actions (readies all permanents)
      const awakenResult = executeAwakenPhase(turnResult.value, p1);
      expect(isOk(awakenResult)).toBe(true);
      if (!isOk(awakenResult)) return;
      
      const newState = awakenResult.value;
      
      // All p1's permanents should be ready after Awaken
      const card1 = newState.cards.get(u1);
      const card2 = newState.cards.get(u2);
      const card3 = newState.cards.get(g1);
      
      if (card1 && isUnit(card1)) expect(card1.exhausted).toBe(false);
      if (card2 && isUnit(card2)) expect(card2.exhausted).toBe(false);
      if (card3 && isGear(card3)) expect(card3.exhausted).toBe(false);
    });
  });
});
