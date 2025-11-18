/**
 * Rune and Resource System
 * 
 * Handles the rune-based resource system in Riftbound:
 * - Rune Deck: 12 runes per player (Rule 154.2.a)
 * - Channeling: Taking runes from deck and putting them on board (Rule 417)
 * - Rune Pool: Conceptual collection of Energy and Power (Rule 159)
 * - Basic Runes: Have [E]: Add [1] and Recycle: Add [C] abilities (Rule 157.2)
 * 
 * Key Rules:
 * - Channel 2 runes per turn during Channel Phase (Rule 315.3)
 * - Runes produce Energy (numeric) and Power (domain-specific) (Rule 156)
 * - Rune Pool empties at end of draw phase and end of turn (Rule 160)
 * - Energy and Power are independent resources (Rule 156.1, 156.2)
 */

import { GameState, getPlayer, updatePlayer, getCard } from '../types/gameState.js';
import { Result, ok, err, validationError } from '../types/result.js';
import { PlayerId, RuneId, Energy, Power, Domain, CardCategory, cardId } from '../types/primitives.js';
import { RuneCard } from '../types/cards.js';

/**
 * Basic Rune names corresponding to the six domains (Rule 157.1)
 */
const BASIC_RUNE_NAMES: Record<Domain, string> = {
  [Domain.Fury]: 'Fury Rune',
  [Domain.Calm]: 'Calm Rune',
  [Domain.Mind]: 'Mind Rune',
  [Domain.Body]: 'Body Rune',
  [Domain.Chaos]: 'Chaos Rune',
  [Domain.Order]: 'Order Rune',
};

/**
 * Create a basic rune card for a given domain (Rule 157)
 * Basic Runes have two abilities:
 * - [E]: Add [1] (exhaust to add 1 energy)
 * - Recycle: Add [C] (recycle to add domain power)
 */
export function createBasicRune(domain: Domain, idSuffix: string): RuneCard {
  const name = BASIC_RUNE_NAMES[domain];
  
  return {
    id: cardId(`rune-${domain.toLowerCase()}-${idSuffix}`) as RuneId,
    name,
    category: CardCategory.Rune,
    owner: '' as any, // Will be set when added to player
    domains: [domain],
    tags: [],
    supertypes: [],
    abilities: [], // TODO: Implement rune abilities when ability system is complete
    rulesText: `[E]: Add [1]\nRecycle this: Add [${domain.charAt(0)}]`,
  };
}

/**
 * Initialize a rune deck with 12 basic runes (Rule 154.2.a)
 * Standard configuration: 2 of each domain
 */
export function createRuneDeck(playerIdStr: string): RuneCard[] {
  const runes: RuneCard[] = [];
  
  // Create 2 runes of each domain
  Object.values(Domain).forEach((domain, index) => {
    runes.push(createBasicRune(domain, `${playerIdStr}-${index * 2}`));
    runes.push(createBasicRune(domain, `${playerIdStr}-${index * 2 + 1}`));
  });
  
  return runes;
}

/**
 * Channel runes from the top of the rune deck (Rule 417)
 * Takes runes from deck and puts them on the board
 * 
 * @param count - Number of runes to channel (typically 2 per turn)
 */
export function channelRunes(
  state: GameState,
  playerId: PlayerId,
  count: number
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  const runesChanneled: RuneId[] = [];
  let updatedState = state;

  // Channel up to 'count' runes from the top of the deck
  for (let i = 0; i < count && i < player.runeDeck.length; i++) {
    const runeIdToChannel = player.runeDeck[i];
    const runeCard = getCard(state, runeIdToChannel as any);
    
    if (!runeCard || runeCard.category !== CardCategory.Rune) {
      continue;
    }

    runesChanneled.push(runeIdToChannel);

    // TODO: Update rune to be exhausted if needed
    // Note: Rune exhaustion system not yet implemented in card types
  }

  // Update player state: remove from runeDeck, add to runesInPlay
  const updatedPlayer = getPlayer(updatedState, playerId)!;
  const newRuneDeck = updatedPlayer.runeDeck.filter(id => !runesChanneled.includes(id));
  const newRunesInPlay = new Set(updatedPlayer.runesInPlay);
  runesChanneled.forEach(id => newRunesInPlay.add(id));

  const finalPlayer = {
    ...updatedPlayer,
    runeDeck: newRuneDeck,
    runesInPlay: newRunesInPlay,
  };

  return ok(updatePlayer(updatedState, playerId, finalPlayer));
}

/**
 * Add energy to a player's Rune Pool (Rule 159)
 * Energy is a numeric resource with no domain
 */
export function addEnergy(
  state: GameState,
  playerId: PlayerId,
  amount: Energy
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  const updatedPlayer = {
    ...player,
    energy: (player.energy + amount) as Energy,
    energyGenerated: (player.energyGenerated + amount) as Energy,
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}

/**
 * Add power to a player's Rune Pool (Rule 159)
 * Power has a domain (or 'Any' for universal power)
 */
export function addPower(
  state: GameState,
  playerId: PlayerId,
  power: Power
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  const updatedPlayer = {
    ...player,
    runePool: [...player.runePool, power],
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}

/**
 * Empty a player's Rune Pool (Rule 160)
 * Called at end of draw phase and end of turn
 * All unspent energy and power are lost
 */
export function emptyRunePool(
  state: GameState,
  playerId: PlayerId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  const updatedPlayer = {
    ...player,
    energy: 0 as Energy,
    energyGenerated: 0 as Energy,
    runePool: [],
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}

/**
 * Spend energy from a player's Rune Pool
 * Used when paying costs (Rule 130.2)
 */
export function spendEnergy(
  state: GameState,
  playerId: PlayerId,
  amount: Energy
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (player.energy < amount) {
    return err(validationError(
      'INSUFFICIENT_ENERGY',
      `Player ${playerId} has ${player.energy} energy but needs ${amount}`,
      ['players', playerId],
      [{ description: `Available: ${player.energy}, Required: ${amount}` }]
    ));
  }

  const updatedPlayer = {
    ...player,
    energy: (player.energy - amount) as Energy,
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}

/**
 * Spend power from a player's Rune Pool
 * Used when paying costs (Rule 130.3)
 * 
 * @param powerRequired - Array of power requirements to pay
 * @returns Updated state with power removed from pool
 */
export function spendPower(
  state: GameState,
  playerId: PlayerId,
  powerRequired: Power[]
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  // Check if player has enough power to pay
  const availablePower = [...player.runePool];
  const powerToSpend: Power[] = [];

  for (const required of powerRequired) {
    // Find matching power in pool
    const matchIndex = availablePower.findIndex(p => 
      p.domain === required.domain || p.domain === 'Any' || required.domain === 'Any'
    );

    if (matchIndex === -1) {
      return err(validationError(
        'INSUFFICIENT_POWER',
        `Player ${playerId} lacks power of domain ${required.domain}`,
        ['players', playerId],
        [{ description: `Required: ${required.domain}, Available: ${availablePower.map(p => p.domain).join(', ')}` }]
      ));
    }

    powerToSpend.push(availablePower[matchIndex]);
    availablePower.splice(matchIndex, 1);
  }

  // Update player's rune pool
  const updatedPlayer = {
    ...player,
    runePool: availablePower,
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}

/**
 * Check if a player has enough energy
 */
export function hasEnergy(
  state: GameState,
  playerId: PlayerId,
  amount: Energy
): boolean {
  const player = getPlayer(state, playerId);
  if (!player) {
    return false;
  }

  return player.energy >= amount;
}

/**
 * Check if a player has enough power
 */
export function hasPower(
  state: GameState,
  playerId: PlayerId,
  powerRequired: Power[]
): boolean {
  const player = getPlayer(state, playerId);
  if (!player) {
    return false;
  }

  const availablePower = [...player.runePool];

  for (const required of powerRequired) {
    const matchIndex = availablePower.findIndex(p => 
      p.domain === required.domain || p.domain === 'Any' || required.domain === 'Any'
    );

    if (matchIndex === -1) {
      return false;
    }

    availablePower.splice(matchIndex, 1);
  }

  return true;
}

/**
 * Get current energy for a player
 */
export function getEnergy(state: GameState, playerId: PlayerId): Energy {
  const player = getPlayer(state, playerId);
  return player?.energy ?? (0 as Energy);
}

/**
 * Get current power pool for a player
 */
export function getPowerPool(state: GameState, playerId: PlayerId): Power[] {
  const player = getPlayer(state, playerId);
  return player?.runePool ?? [];
}

/**
 * Get total energy generated this turn
 */
export function getEnergyGenerated(state: GameState, playerId: PlayerId): Energy {
  const player = getPlayer(state, playerId);
  return player?.energyGenerated ?? (0 as Energy);
}

/**
 * Recycle a rune back to the rune deck (Rule 154.2.b)
 * Used when paying recycle costs
 */
export function recycleRune(
  state: GameState,
  playerId: PlayerId,
  runeIdToRecycle: RuneId
): Result<GameState> {
  const player = getPlayer(state, playerId);
  if (!player) {
    return err(validationError('PLAYER_NOT_FOUND', `Player ${playerId} not found`));
  }

  if (!player.runesInPlay.has(runeIdToRecycle)) {
    return err(validationError(
      'RUNE_NOT_IN_PLAY',
      `Rune ${runeIdToRecycle} is not in play for player ${playerId}`
    ));
  }

  const updatedRunesInPlay = new Set(player.runesInPlay);
  updatedRunesInPlay.delete(runeIdToRecycle);

  const updatedPlayer = {
    ...player,
    runesInPlay: updatedRunesInPlay,
    runeDeck: [...player.runeDeck, runeIdToRecycle],
  };

  return ok(updatePlayer(state, playerId, updatedPlayer));
}
