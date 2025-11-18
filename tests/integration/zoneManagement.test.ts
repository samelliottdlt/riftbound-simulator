/**
 * Zone Management Tests
 * 
 * Tests card movement between zones with proper rule enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  playerId,
  cardId,
  Phase,
  Zone,
  createCard,
  isOk,
  unwrap,
} from '../../src/index.js';
import { createMinimalPlayer, createMinimalGameState } from '../utils/testHelpers.js';
import {
  getCardLocation,
  moveCard,
  recycleCard,
  discardCard,
  killCard,
  banishCard,
  getZonePrivacy,
  isOnBoard,
  shouldClearTemporaryMods,
} from '../../src/core/zoneManagement.js';
import { PrivacyLevel } from '../../src/types/primitives.js';

describe('Zone Management', () => {
  describe('getCardLocation', () => {
    it('should find card in hand', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');

      const state = createMinimalGameState({
        cards: new Map([[card1, createCard(card1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1] })]]),
        turnPlayer: p1,
      });

      const result = getCardLocation(state, card1);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.zone).toBe(Zone.Hand);
        expect(result.value.owner).toBe(p1);
        expect(result.value.position).toBe(0);
      }
    });

    it('should find card in deck with correct position', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');
      const card2 = cardId('card2');
      const card3 = cardId('card3');

      const state = createMinimalGameState({
        cards: new Map([
          [card1, createCard(card1, p1, 'Card 1')],
          [card2, createCard(card2, p1, 'Card 2')],
          [card3, createCard(card3, p1, 'Card 3')],
        ]),
        players: new Map([[p1, createMinimalPlayer(p1, { deck: [card1, card2, card3] })]]),
        turnPlayer: p1,
      });

      // Card 2 should be at position 1
      const result = getCardLocation(state, card2);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.zone).toBe(Zone.Deck);
        expect(result.value.position).toBe(1);
      }
    });

    it('should return error for nonexistent card', () => {
      const p1 = playerId('p1');
      const state = createMinimalGameState({
        cards: new Map(),
        players: new Map([[p1, createMinimalPlayer(p1)]]),
        turnPlayer: p1,
      });

      const result = getCardLocation(state, cardId('nonexistent'));
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.code).toBe('CARD_NOT_FOUND');
      }
    });
  });

  describe('Zone Privacy Levels', () => {
    it('should return correct privacy for each zone', () => {
      expect(getZonePrivacy(Zone.Deck)).toBe(PrivacyLevel.Secret);
      expect(getZonePrivacy(Zone.RuneDeck)).toBe(PrivacyLevel.Secret);
      expect(getZonePrivacy(Zone.Hand)).toBe(PrivacyLevel.Private);
      expect(getZonePrivacy(Zone.FacedownZone)).toBe(PrivacyLevel.Private);
      expect(getZonePrivacy(Zone.Base)).toBe(PrivacyLevel.Public);
      expect(getZonePrivacy(Zone.Trash)).toBe(PrivacyLevel.Public);
      expect(getZonePrivacy(Zone.Banishment)).toBe(PrivacyLevel.Public);
    });
  });

  describe('Zone Classification', () => {
    it('should correctly identify board zones', () => {
      expect(isOnBoard(Zone.Base)).toBe(true);
      expect(isOnBoard(Zone.Battlefield)).toBe(true);
      expect(isOnBoard(Zone.FacedownZone)).toBe(true);
      expect(isOnBoard(Zone.LegendZone)).toBe(true);

      expect(isOnBoard(Zone.Hand)).toBe(false);
      expect(isOnBoard(Zone.Deck)).toBe(false);
      expect(isOnBoard(Zone.Trash)).toBe(false);
    });

    it('should determine when temporary mods should clear', () => {
      // Board to non-board: should clear
      expect(shouldClearTemporaryMods(Zone.Base, Zone.Hand)).toBe(true);
      expect(shouldClearTemporaryMods(Zone.Battlefield, Zone.Trash)).toBe(true);

      // Non-board to board: should clear
      expect(shouldClearTemporaryMods(Zone.Hand, Zone.Base)).toBe(true);
      expect(shouldClearTemporaryMods(Zone.Deck, Zone.Battlefield)).toBe(true);

      // Board to board: should NOT clear
      expect(shouldClearTemporaryMods(Zone.Base, Zone.Battlefield)).toBe(false);
      expect(shouldClearTemporaryMods(Zone.Battlefield, Zone.Base)).toBe(false);

      // Non-board to non-board: should NOT clear
      expect(shouldClearTemporaryMods(Zone.Hand, Zone.Trash)).toBe(false);
      expect(shouldClearTemporaryMods(Zone.Deck, Zone.Banishment)).toBe(false);
    });
  });

  describe('moveCard', () => {
    it('should move card from deck to hand', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');

      const state = createMinimalGameState({
        cards: new Map([[card1, createCard(card1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { deck: [card1] })]]),
        turnPlayer: p1,
      });

      const result = moveCard(state, card1, Zone.Hand);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newState = result.value;
        const player = newState.players.get(p1)!;

        // Card should be in hand
        expect(player.hand).toContain(card1);
        expect(player.hand.length).toBe(1);

        // Card should NOT be in deck
        expect(player.deck).not.toContain(card1);
        expect(player.deck.length).toBe(0);
      }
    });

    it('should move card to top of deck', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');
      const card2 = cardId('card2');

      const state = createMinimalGameState({
        cards: new Map([
          [card1, createCard(card1, p1, 'Card 1')],
          [card2, createCard(card2, p1, 'Card 2')],
        ]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1], deck: [card2] })]]),
        turnPlayer: p1,
      });

      const result = moveCard(state, card1, Zone.Deck, p1, 'top');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const player = result.value.players.get(p1)!;
        // card1 should be at top (index 0)
        expect(player.deck[0]).toBe(card1);
        expect(player.deck[1]).toBe(card2);
        expect(player.hand.length).toBe(0);
      }
    });

    it('should move card to bottom of deck', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');
      const card2 = cardId('card2');

      const state = createMinimalGameState({
        cards: new Map([
          [card1, createCard(card1, p1, 'Card 1')],
          [card2, createCard(card2, p1, 'Card 2')],
        ]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1], deck: [card2] })]]),
        turnPlayer: p1,
      });

      const result = moveCard(state, card1, Zone.Deck, p1, 'bottom');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const player = result.value.players.get(p1)!;
        // card1 should be at bottom (last index)
        expect(player.deck[0]).toBe(card2);
        expect(player.deck[1]).toBe(card1);
      }
    });
  });

  describe('recycleCard', () => {
    it('should move card from hand to bottom of deck', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');
      const card2 = cardId('card2');

      const state = createMinimalGameState({
        cards: new Map([
          [card1, createCard(card1, p1, 'Card 1')],
          [card2, createCard(card2, p1, 'Card 2')],
        ]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1], deck: [card2] })]]),
        turnPlayer: p1,
      });

      const result = recycleCard(state, card1);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const player = result.value.players.get(p1)!;
        expect(player.deck[0]).toBe(card2);
        expect(player.deck[1]).toBe(card1);
        expect(player.hand.length).toBe(0);
      }
    });
  });

  describe('discardCard', () => {
    it('should move card from hand to trash', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');

      const state = createMinimalGameState({
        cards: new Map([[card1, createCard(card1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1] })]]),
        turnPlayer: p1,
      });

      const result = discardCard(state, card1);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const player = result.value.players.get(p1)!;
        expect(player.trash).toContain(card1);
        expect(player.hand).not.toContain(card1);
      }
    });

    it('should reject discarding card not in hand', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');

      const state = createMinimalGameState({
        cards: new Map([[card1, createCard(card1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { deck: [card1] })]]),
        turnPlayer: p1,
      });

      const result = discardCard(state, card1);
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.code).toBe('NOT_IN_HAND');
      }
    });
  });

  describe('killCard', () => {
    it('should move card from base to trash', () => {
      const p1 = playerId('p1');
      const unit1 = cardId('unit1');

      const state = createMinimalGameState({
        cards: new Map([[unit1, createCard(unit1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { base: [unit1 as any] })]]),
        turnPlayer: p1,
      });

      const result = killCard(state, unit1);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const player = result.value.players.get(p1)!;
        expect(player.trash).toContain(unit1);
        expect(player.base.has(unit1 as any)).toBe(false);
      }
    });

    it('should reject killing card not on board', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');

      const state = createMinimalGameState({
        cards: new Map([[card1, createCard(card1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1] })]]),
        turnPlayer: p1,
      });

      const result = killCard(state, card1);
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.code).toBe('NOT_ON_BOARD');
      }
    });
  });

  describe('banishCard', () => {
    it('should move card to banishment from any zone', () => {
      const p1 = playerId('p1');
      const card1 = cardId('card1');

      const state = createMinimalGameState({
        cards: new Map([[card1, createCard(card1, p1, 'Test Unit')]]),
        players: new Map([[p1, createMinimalPlayer(p1, { hand: [card1] })]]),
        turnPlayer: p1,
      });

      const result = banishCard(state, card1);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const player = result.value.players.get(p1)!;
        expect(player.banishment).toContain(card1);
        expect(player.hand).not.toContain(card1);
      }
    });
  });
});
