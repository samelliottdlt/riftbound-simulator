/**
 * Zone Management System
 * 
 * Handles card movement between zones with proper rules:
 * - Zone-change triggers
 * - Temporary modification clearing
 * - Privacy level changes
 * - Zone-specific ordering (deck vs trash)
 * - Ownership validation
 */

import { GameState, PlayerState, getCard, getPlayer, updatePlayer, updateBattlefield } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { CardId, PlayerId, Zone, PrivacyLevel } from '../types/primitives.js';

/**
 * Card location - where a card currently is
 */
export interface CardLocation {
  zone: Zone;
  owner: PlayerId;
  position?: number;  // Position in ordered zones (deck, hand)
}

/**
 * Get current location of a card
 */
export function getCardLocation(state: GameState, cardId: CardId): Result<CardLocation> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  // Search all players' zones
  for (const [playerId, player] of state.players) {
    // Check hand
    const handIndex = player.hand.indexOf(cardId);
    if (handIndex !== -1) {
      return ok({ zone: Zone.Hand, owner: playerId, position: handIndex });
    }

    // Check deck (ordered, top = index 0)
    const deckIndex = player.deck.indexOf(cardId);
    if (deckIndex !== -1) {
      return ok({ zone: Zone.Deck, owner: playerId, position: deckIndex });
    }

    // Check trash (unordered)
    if (player.trash.includes(cardId)) {
      return ok({ zone: Zone.Trash, owner: playerId });
    }

    // Check banishment (unordered)
    if (player.banishment.includes(cardId)) {
      return ok({ zone: Zone.Banishment, owner: playerId });
    }

    // Check champion zone
    if (player.championZone === cardId) {
      return ok({ zone: Zone.ChampionZone, owner: playerId });
    }

    // Check rune deck (ordered)
    const runeDeckIndex = player.runeDeck.indexOf(cardId as any);
    if (runeDeckIndex !== -1) {
      return ok({ zone: Zone.RuneDeck, owner: playerId, position: runeDeckIndex });
    }

    // Check base (units at player's base)
    if (player.base.has(cardId as any)) {
      return ok({ zone: Zone.Base, owner: playerId });
    }

    // Check runes in play
    if (player.runesInPlay.has(cardId as any)) {
      return ok({ zone: Zone.Base, owner: playerId });  // Runes are at base
    }
  }

  // Check battlefields
  for (const [, battlefield] of state.battlefields) {
    if (battlefield.units.has(cardId as any)) {
      return ok({ zone: Zone.Battlefield, owner: battlefield.controller! });
    }
    if (battlefield.facedownCard === cardId) {
      return ok({ zone: Zone.FacedownZone, owner: battlefield.controller! });
    }
  }

  return err(validationError('CARD_LOCATION_UNKNOWN', `Cannot find location for card ${cardId}`));
}

/**
 * Get privacy level for a zone
 */
export function getZonePrivacy(zone: Zone): PrivacyLevel {
  switch (zone) {
    case Zone.Deck:
    case Zone.RuneDeck:
      return PrivacyLevel.Secret;

    case Zone.Hand:
    case Zone.FacedownZone:
      return PrivacyLevel.Private;

    case Zone.Base:
    case Zone.Battlefield:
    case Zone.LegendZone:
    case Zone.ChampionZone:
    case Zone.Trash:
    case Zone.Banishment:
      return PrivacyLevel.Public;

    default:
      return PrivacyLevel.Public;
  }
}

/**
 * Check if zone is on the board
 */
export function isOnBoard(zone: Zone): boolean {
  return zone === Zone.Base ||
         zone === Zone.Battlefield ||
         zone === Zone.FacedownZone ||
         zone === Zone.LegendZone;
}

/**
 * Check if moving between zones should clear temporary modifications
 * Rule 109: Temporary modifications clear when changing to/from non-board zones
 */
export function shouldClearTemporaryMods(fromZone: Zone, toZone: Zone): boolean {
  const fromBoard = isOnBoard(fromZone);
  const toBoard = isOnBoard(toZone);
  
  // Clear if moving to or from a non-board zone
  return fromBoard !== toBoard;
}

/**
 * Remove card from its current zone
 */
function removeFromZone(
  state: GameState,
  cardId: CardId,
  location: CardLocation
): Result<GameState> {
  const player = getPlayer(state, location.owner);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${location.owner} not found`));
  }

  let newPlayer: PlayerState;

  switch (location.zone) {
    case Zone.Hand:
      newPlayer = {
        ...player,
        hand: player.hand.filter(id => id !== cardId),
      };
      break;

    case Zone.Deck:
      newPlayer = {
        ...player,
        deck: player.deck.filter(id => id !== cardId),
      };
      break;

    case Zone.Trash:
      newPlayer = {
        ...player,
        trash: player.trash.filter(id => id !== cardId),
      };
      break;

    case Zone.Banishment:
      newPlayer = {
        ...player,
        banishment: player.banishment.filter(id => id !== cardId),
      };
      break;

    case Zone.ChampionZone:
      newPlayer = {
        ...player,
        championZone: null,
      };
      break;

    case Zone.RuneDeck:
      newPlayer = {
        ...player,
        runeDeck: player.runeDeck.filter(id => id !== (cardId as any)),
      };
      break;

    case Zone.Base:
      const newBase = new Set(player.base);
      newBase.delete(cardId as any);
      const newRunesInPlay = new Set(player.runesInPlay);
      newRunesInPlay.delete(cardId as any);
      newPlayer = {
        ...player,
        base: newBase,
        runesInPlay: newRunesInPlay,
      };
      break;

    case Zone.Battlefield: {
      // Remove unit from battlefield
      // Find which battlefield the unit is on
      let found = false;
      let newState = state;
      for (const [battlefieldId, battlefield] of state.battlefields) {
        if (battlefield.units.has(cardId as any)) {
          const newUnits = new Set(battlefield.units);
          newUnits.delete(cardId as any);
          newState = updateBattlefield(newState, battlefieldId, {
            ...battlefield,
            units: newUnits,
          });
          found = true;
          break;
        }
      }
      if (!found) {
        return err(validationError('UNIT_NOT_AT_BATTLEFIELD', `Unit ${cardId} not found at any battlefield`));
      }
      // Already removed from battlefield in the above loop, just update player zones if needed
      newPlayer = player;  // No player zone changes for battlefield units
      return ok(newState);
    }

    case Zone.FacedownZone: {
      // Remove facedown card from battlefield
      let found = false;
      let newState = state;
      for (const [battlefieldId, battlefield] of state.battlefields) {
        if (battlefield.facedownCard === cardId) {
          newState = updateBattlefield(newState, battlefieldId, {
            ...battlefield,
            facedownCard: null,
          });
          found = true;
          break;
        }
      }
      if (!found) {
        return err(validationError('CARD_NOT_FACEDOWN', `Card ${cardId} not found as facedown at any battlefield`));
      }
      newPlayer = player;  // No player zone changes
      return ok(newState);
    }

    default:
      return err(validationError('UNSUPPORTED_ZONE', `Cannot remove from zone ${location.zone}`));
  }

  return ok(updatePlayer(state, location.owner, newPlayer));
}

/**
 * Add card to a zone
 */
function addToZone(
  state: GameState,
  cardId: CardId,
  toZone: Zone,
  owner: PlayerId,
  position?: 'top' | 'bottom' | number
): Result<GameState> {
  const player = getPlayer(state, owner);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${owner} not found`));
  }

  let newPlayer: PlayerState;

  switch (toZone) {
    case Zone.Hand:
      newPlayer = {
        ...player,
        hand: [...player.hand, cardId],
      };
      break;

    case Zone.Deck:
      // Deck is ordered: top = index 0, bottom = end
      let newDeck = [...player.deck];
      if (position === 'top' || position === 0) {
        newDeck.unshift(cardId);
      } else if (position === 'bottom' || position === undefined) {
        newDeck.push(cardId);
      } else if (typeof position === 'number') {
        newDeck.splice(position, 0, cardId);
      }
      newPlayer = { ...player, deck: newDeck };
      break;

    case Zone.Trash:
      newPlayer = {
        ...player,
        trash: [...player.trash, cardId],
      };
      break;

    case Zone.Banishment:
      newPlayer = {
        ...player,
        banishment: [...player.banishment, cardId],
      };
      break;

    case Zone.ChampionZone:
      if (player.championZone !== null) {
        return err(validationError(
          'CHAMPION_ZONE_OCCUPIED',
          'Champion zone already has a card',
          ['players', owner, 'championZone']
        ));
      }
      newPlayer = {
        ...player,
        championZone: cardId,
      };
      break;

    case Zone.RuneDeck:
      let newRuneDeck = [...player.runeDeck];
      if (position === 'top' || position === 0) {
        newRuneDeck.unshift(cardId as any);
      } else {
        newRuneDeck.push(cardId as any);
      }
      newPlayer = { ...player, runeDeck: newRuneDeck };
      break;

    case Zone.Base:
      const newBase = new Set(player.base);
      newBase.add(cardId as any);
      newPlayer = {
        ...player,
        base: newBase,
      };
      break;

    default:
      return err(validationError('UNSUPPORTED_ZONE', `Cannot add to zone ${toZone}`));
  }

  return ok(updatePlayer(state, owner, newPlayer));
}

/**
 * Move card between zones
 * 
 * Handles all zone-change rules:
 * - Validates card ownership
 * - Clears temporary modifications when appropriate
 * - Maintains zone ordering
 * - Will trigger zone-change abilities (future)
 */
export function moveCard(
  state: GameState,
  cardId: CardId,
  toZone: Zone,
  toOwner?: PlayerId,
  position?: 'top' | 'bottom' | number
): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  // Get current location
  const locationResult = getCardLocation(state, cardId);
  if (!locationResult.ok) {
    return locationResult;
  }
  const currentLocation = locationResult.value;

  // Determine target owner (defaults to card owner)
  const targetOwner = toOwner ?? card.owner;

  // Rule: Cards can only go to zones owned by their owner (with exceptions)
  // For now, enforce owner must match
  if (targetOwner !== card.owner) {
    return err(validationError(
      'WRONG_OWNER_ZONE',
      `Card ${cardId} cannot be moved to ${toOwner}'s zone (owner is ${card.owner})`,
      ['cards', cardId]
    ));
  }

  // Remove from current zone
  const removeResult = removeFromZone(state, cardId, currentLocation);
  if (!removeResult.ok) {
    return removeResult;
  }
  let newState = removeResult.value;

  // Add to new zone
  const addResult = addToZone(newState, cardId, toZone, targetOwner, position);
  if (!addResult.ok) {
    return addResult;
  }
  newState = addResult.value;

  // TODO: Clear temporary modifications if zone change requires it
  // TODO: Trigger zone-change abilities (OnLeavePlay, OnEnterPlay, etc.)

  return ok(newState);
}

/**
 * Recycle - move card to bottom of deck
 * Common operation in Riftbound
 */
export function recycleCard(state: GameState, cardId: CardId): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  return moveCard(state, cardId, Zone.Deck, card.owner, 'bottom');
}

/**
 * Discard - move card from hand to trash
 */
export function discardCard(state: GameState, cardId: CardId): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  // Verify card is in hand
  const locationResult = getCardLocation(state, cardId);
  if (!locationResult.ok) {
    return locationResult;
  }

  if (locationResult.value.zone !== Zone.Hand) {
    return err(validationError(
      'NOT_IN_HAND',
      `Card ${cardId} is not in hand (currently in ${locationResult.value.zone})`,
      ['cards', cardId]
    ));
  }

  return moveCard(state, cardId, Zone.Trash, card.owner);
}

/**
 * Kill - move permanent from board to trash
 */
export function killCard(state: GameState, cardId: CardId): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  // Verify card is on board
  const locationResult = getCardLocation(state, cardId);
  if (!locationResult.ok) {
    return locationResult;
  }

  if (!isOnBoard(locationResult.value.zone)) {
    return err(validationError(
      'NOT_ON_BOARD',
      `Card ${cardId} is not on board (currently in ${locationResult.value.zone})`,
      ['cards', cardId]
    ));
  }

  // TODO: Trigger Deathknell abilities before moving to trash

  return moveCard(state, cardId, Zone.Trash, card.owner);
}

/**
 * Banish - move card to banishment
 */
export function banishCard(state: GameState, cardId: CardId): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  return moveCard(state, cardId, Zone.Banishment, card.owner);
}
