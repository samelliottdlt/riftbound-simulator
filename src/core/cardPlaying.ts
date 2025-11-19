/**
 * Card Playing System
 * 
 * Handles playing cards from hand with:
 * - Cost validation (energy + power)
 * - Cost payment (spending resources)
 * - Card entering play
 * - Play restrictions (timing, location)
 */

import { GameState, PlayerState, getCard, getPlayer, updatePlayer, updateCard, ChainItem } from '../types/gameState.js';
import { Card, isUnit, isSpell, isGear } from '../types/cards.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { CardId, PlayerId, Cost, Energy, BattlefieldId, Phase, Keyword } from '../types/primitives.js';
import { moveCard, getCardLocation } from './zoneManagement.js';
import { Zone } from '../types/primitives.js';
import { addToChain } from './chain.js';
import { performCleanup } from './cleanup.js';

/**
 * Calculate effective cost of a card accounting for cost reductions
 * 
 * Currently no cost reductions implemented - just returns base cost
 * TODO: Implement cost modifiers when effect system is in place
 */
export function calculateEffectiveCost(
  _state: GameState,
  card: Card,
  _playerId: PlayerId
): Cost {
  // Only cards with costs can have effective costs
  if (!('cost' in card)) {
    return { energy: 0 as Energy, power: [] };
  }

  // Return base cost (no modifiers yet)
  return { ...card.cost };
}

/**
 * Check if player can afford a cost
 */
export function canAffordCost(player: PlayerState, cost: Cost): boolean {
  // Check energy
  if (player.energy < cost.energy) {
    return false;
  }

  // Check power requirements
  for (const powerReq of cost.power) {
    const available = player.runePool.filter(p => 
      p.domain === powerReq.domain || 
      p.domain === 'Any' || 
      powerReq.domain === 'Any'
    );
    
    const totalAvailable = available.reduce((sum, p) => sum + p.amount, 0);
    if (totalAvailable < powerReq.amount) {
      return false;
    }
  }

  return true;
}

/**
 * Pay a cost (spend energy and power)
 */
export function payCost(
  state: GameState,
  playerId: PlayerId,
  cost: Cost
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (!canAffordCost(player, cost)) {
    return err(validationError(
      'INSUFFICIENT_RESOURCES',
      `Player ${playerId} cannot afford cost: ${cost.energy} energy, ${cost.power.length} power`,
      ['players', playerId],
      [
        {
          description: `Available: ${player.energy} energy, ${player.runePool.length} power`,
        },
      ]
    ));
  }

  // Spend energy
  let newEnergy = player.energy - cost.energy;

  // Spend power (simplified - just remove required amount)
  let newRunePool = [...player.runePool];
  for (const powerReq of cost.power) {
    let remaining = powerReq.amount;
    newRunePool = newRunePool.filter(p => {
      if (remaining > 0 && (p.domain === powerReq.domain || p.domain === 'Any' || powerReq.domain === 'Any')) {
        if (p.amount <= remaining) {
          remaining -= p.amount;
          return false; // Remove this power
        } else {
          // Partially consume this power
          p.amount -= remaining;
          remaining = 0;
          return true;
        }
      }
      return true;
    });
  }

  const updatedPlayer: PlayerState = {
    ...player,
    energy: newEnergy,
    runePool: newRunePool,
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}

/**
 * Check if a card can be played in the current game state
 */
export function canPlayCard(
  state: GameState,
  cardId: CardId,
  playerId: PlayerId
): Result<boolean> {
  const card = getCard(state, cardId);
  if (!card) {
    return err(validationError('CARD_NOT_FOUND', `Card ${cardId} not found`));
  }

  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Check card is in hand or champion zone
  const locationResult = getCardLocation(state, cardId);
  if (!locationResult.ok) {
    return locationResult as any;
  }

  const location = locationResult.value;
  if (location.zone !== Zone.Hand && location.zone !== Zone.ChampionZone) {
    return ok(false);
  }

  // Check card is owned by player
  if (card.owner !== playerId) {
    return ok(false);
  }

  // Check it's the player's turn (unless card has Action/Reaction)
  if (state.turnState.turnPlayer !== playerId) {
    // TODO: Check for Action/Reaction keywords
    return ok(false);
  }

  // Check phase restrictions
  if (state.turnState.phase !== Phase.Action) {
    // Most cards can only be played during Action phase
    // TODO: Check for specific timing keywords
    return ok(false);
  }

  // Check cost affordability
  if (isUnit(card) || isSpell(card) || isGear(card)) {
    const effectiveCost = calculateEffectiveCost(state, card, playerId);
    if (!canAffordCost(player, effectiveCost)) {
      return ok(false);
    }
  }

  return ok(true);
}

/**
 * Play a unit card
 */
export function playUnit(
  state: GameState,
  cardId: CardId,
  playerId: PlayerId,
  target?: BattlefieldId  // Where to play the unit (defaults to base)
): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card || !isUnit(card)) {
    return err(validationError('INVALID_CARD_TYPE', 'Card is not a unit'));
  }

  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Validate can play
  const canPlayResult = canPlayCard(state, cardId, playerId);
  if (!canPlayResult.ok) {
    return canPlayResult as any;
  }
  if (!canPlayResult.value) {
    return err(validationError(
      'CANNOT_PLAY_CARD',
      `Cannot play card ${cardId} in current state`
    ));
  }

  // Pay cost (using effective cost for Legion)
  const effectiveCost = calculateEffectiveCost(state, card, playerId);
  const payCostResult = payCost(state, playerId, effectiveCost);
  if (!payCostResult.ok) {
    return payCostResult;
  }
  let newState = payCostResult.value;

  // Move card from hand/champion zone to base (or specified battlefield)
  const targetZone = target ? Zone.Battlefield : Zone.Base;
  const moveResult = moveCard(newState, cardId, targetZone, playerId);
  if (!moveResult.ok) {
    return moveResult;
  }
  newState = moveResult.value;

  // Track card played this turn
  const updatedPlayer = getPlayer(newState, playerId);
  if (updatedPlayer) {
    const newPlayer: PlayerState = {
      ...updatedPlayer,
      cardsPlayedThisTurn: [...updatedPlayer.cardsPlayedThisTurn, cardId],
    };
    newState = updatePlayer(newState, playerId, newPlayer);
  }

  // Unit enters exhausted (Rule 140.4) unless it has Accelerate (Rule 721.6)
  const updatedCard = getCard(newState, cardId);
  if (updatedCard && isUnit(updatedCard)) {
    const hasAccelerate = updatedCard.keywords.includes(Keyword.Accelerate);
    if (!hasAccelerate) {
      // Unit enters exhausted (summoning sickness)
      const exhaustedCard = {
        ...updatedCard,
        exhausted: true,
      };
      newState = updateCard(newState, exhaustedCard);
    }
  }

  // TODO: Trigger OnPlay abilities
  // TODO: Open chain for responses

  return ok(newState);
}

/**
 * Play a spell card (Rules 346-356)
 * 
 * Process:
 * 1. Remove from zone and add to Chain as Pending (Rule 351)
 * 2. Make necessary choices (targets, etc.) (Rule 352)
 * 3. Determine total cost (Rule 353)
 * 4. Pay costs (Rule 354)
 * 5. Check legality - becomes Finalized (Rule 355)
 * 6. OnPlay triggers (Rule 356)
 * 
 * Note: The spell will be resolved when the Chain resolves.
 * After resolution, it moves to trash (Rule 336).
 */
export function playSpell(
  state: GameState,
  cardId: CardId,
  playerId: PlayerId,
  targetIds?: CardId[]  // Targets chosen (Rule 352)
): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card || !isSpell(card)) {
    return err(validationError('INVALID_CARD_TYPE', 'Card is not a spell'));
  }

  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Validate can play
  const canPlayResult = canPlayCard(state, cardId, playerId);
  if (!canPlayResult.ok) {
    return canPlayResult as any;
  }
  if (!canPlayResult.value) {
    return err(validationError(
      'CANNOT_PLAY_CARD',
      `Cannot play card ${cardId} in current state`
    ));
  }

  // Rule 353: Determine total cost (using effective cost)
  const effectiveCost = calculateEffectiveCost(state, card, playerId);
  
  // Rule 354: Pay costs
  const payCostResult = payCost(state, playerId, effectiveCost);
  if (!payCostResult.ok) {
    return payCostResult;
  }
  let newState = payCostResult.value;

  // Track card played this turn
  const updatedPlayer = getPlayer(newState, playerId);
  if (updatedPlayer) {
    const newPlayer: PlayerState = {
      ...updatedPlayer,
      cardsPlayedThisTurn: [...updatedPlayer.cardsPlayedThisTurn, cardId],
    };
    newState = updatePlayer(newState, playerId, newPlayer);
  }

  // Rule 351: Put spell on Chain as Pending Item
  // The spell is added to the Chain and will be resolved through
  // the 4-step Chain Resolution process (Rules 331-336)
  const chainItem: Omit<ChainItem, 'pending'> = {
    id: `spell-${cardId}-${Date.now()}`,
    type: 'spell',
    source: cardId,
    controller: playerId,
    targetIds: targetIds || [],
  };
  
  const addToChainResult = addToChain(newState, chainItem);
  if (!addToChainResult.ok) {
    return addToChainResult;
  }
  newState = addToChainResult.value;

  // Rule 319.1: Cleanup after transitioning to Closed State
  // This will finalize the Pending item per Rule 322.8
  const cleanupResult = performCleanup(newState);
  if (!cleanupResult.ok) {
    return cleanupResult;
  }
  newState = cleanupResult.value;

  // TODO: Rule 355 - Check legality (currently happens during finalize)
  // TODO: Rule 356 - OnPlay triggers
  // TODO: After Chain resolution, spell moves to trash (Rule 336)

  return ok(newState);
}

/**
 * Play a gear card
 */
export function playGear(
  state: GameState,
  cardId: CardId,
  playerId: PlayerId,
  target?: BattlefieldId
): Result<GameState> {
  const card = getCard(state, cardId);
  if (!card || !isGear(card)) {
    return err(validationError('INVALID_CARD_TYPE', 'Card is not gear'));
  }

  // Similar to unit for now
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Validate can play
  const canPlayResult = canPlayCard(state, cardId, playerId);
  if (!canPlayResult.ok) {
    return canPlayResult as any;
  }
  if (!canPlayResult.value) {
    return err(validationError(
      'CANNOT_PLAY_CARD',
      `Cannot play card ${cardId} in current state`
    ));
  }

  // Pay cost (using effective cost)
  const effectiveCost = calculateEffectiveCost(state, card, playerId);
  const payCostResult = payCost(state, playerId, effectiveCost);
  if (!payCostResult.ok) {
    return payCostResult;
  }
  let newState = payCostResult.value;

  // Move card to base (or battlefield)
  const targetZone = target ? Zone.Battlefield : Zone.Base;
  const moveResult = moveCard(newState, cardId, targetZone, playerId);
  if (!moveResult.ok) {
    return moveResult;
  }
  newState = moveResult.value;

  // Track card played this turn
  const updatedPlayer = getPlayer(newState, playerId);
  if (updatedPlayer) {
    const newPlayer: PlayerState = {
      ...updatedPlayer,
      cardsPlayedThisTurn: [...updatedPlayer.cardsPlayedThisTurn, cardId],
    };
    newState = updatePlayer(newState, playerId, newPlayer);
  }

  // TODO: Trigger OnPlay abilities
  // TODO: Attachment logic

  return ok(newState);
}
