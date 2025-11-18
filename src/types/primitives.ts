/**
 * Primitive Types - Complete
 * 
 * All core game primitives from Riftbound rules
 */

/**
 * Branded types for type safety
 */
export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type CardId = string & { readonly __brand: 'CardId' };
export type UnitId = CardId & { readonly __brand: 'UnitId' };
export type GearId = CardId & { readonly __brand: 'GearId' };
export type RuneId = CardId & { readonly __brand: 'RuneId' };
export type BattlefieldId = string & { readonly __brand: 'BattlefieldId' };
export type LegendId = string & { readonly __brand: 'LegendId' };
export type AbilityId = string & { readonly __brand: 'AbilityId' };
export type TokenId = CardId & { readonly __brand: 'TokenId' };

/**
 * Helpers to create branded types
 */
export function playerId(id: string): PlayerId {
  return id as PlayerId;
}

export function cardId(id: string): CardId {
  return id as CardId;
}

export function unitId(id: string): UnitId {
  return id as UnitId;
}

export function gearId(id: string): GearId {
  return id as GearId;
}

export function runeId(id: string): RuneId {
  return id as RuneId;
}

export function battlefieldId(id: string): BattlefieldId {
  return id as BattlefieldId;
}

export function legendId(id: string): LegendId {
  return id as LegendId;
}

export function abilityId(id: string): AbilityId {
  return id as AbilityId;
}

export function tokenId(id: string): TokenId {
  return id as TokenId;
}

/**
 * Domain - the six magic domains in Riftbound
 * Each domain has a color, symbol, and shorthand ([R], [G], [B], [O], [P], [Y])
 */
export enum Domain {
  Fury = 'Fury',       // Red [R]
  Calm = 'Calm',       // Green [G]
  Mind = 'Mind',       // Blue [B]
  Body = 'Body',       // Orange [O]
  Chaos = 'Chaos',     // Purple [P]
  Order = 'Order',     // Yellow [Y]
}

/**
 * Card Category - main type classification
 */
export enum CardCategory {
  // Main Deck Cards
  Unit = 'Unit',
  Spell = 'Spell',
  Gear = 'Gear',
  
  // Rune Deck Cards
  Rune = 'Rune',
  
  // Non-Deck Cards
  Battlefield = 'Battlefield',
  Legend = 'Legend',
}

/**
 * Supertype - applies to multiple card types
 */
export enum Supertype {
  Champion = 'Champion',     // Champion units for deckbuilding
  Signature = 'Signature',   // Signature cards linked to champion
  Token = 'Token',           // Temporary game objects
}

/**
 * Phase - complete turn structure
 * 
 * Turn structure (Rule 315):
 * - Awaken: Ready all game objects (Rule 315.1)
 * - Beginning: Beginning Step + Scoring Step for Hold (Rule 315.2)
 * - Channel: Channel 2 runes from Rune Deck (Rule 315.3)
 * - Draw: Draw 1 card, then Rune Pool empties (Rule 315.4)
 * - Action: Main phase for playing cards and taking actions (Rule 316)
 * - Combat: Assign and resolve combat (not fully implemented)
 * - Ending: End of turn cleanup, Rune Pool empties (Rule 317)
 */
export enum Phase {
  Awaken = 'Awaken',
  Beginning = 'Beginning',
  Channel = 'Channel',
  Draw = 'Draw',
  Action = 'Action',
  Combat = 'Combat',
  Ending = 'Ending',
}

/**
 * Zone - all locations where cards can exist
 */
export enum Zone {
  // Board Zones
  Base = 'Base',
  Battlefield = 'Battlefield',
  FacedownZone = 'FacedownZone',  // Associated with each battlefield
  LegendZone = 'LegendZone',
  
  // Non-Board Zones
  Hand = 'Hand',
  Deck = 'Deck',           // Main Deck
  RuneDeck = 'RuneDeck',
  ChampionZone = 'ChampionZone',
  Trash = 'Trash',
  Banishment = 'Banishment',
}

/**
 * Privacy Level - determines who can see card faces
 */
export enum PrivacyLevel {
  Secret = 'Secret',      // No one can see (facedown deck)
  Private = 'Private',    // Only controller/owner can see (hand, facedown at battlefield)
  Public = 'Public',      // Everyone can see (board, trash, banishment)
}

/**
 * Keywords - from Riftbound core rules 716-733
 * All official keywords as defined in the game
 */
export enum Keyword {
  // Timing Keywords (722, 729)
  Action = 'Action',              // Can be played during showdowns on any turn
  Reaction = 'Reaction',          // Can be played during closed states on any turn
  
  // Unit Keywords
  Accelerate = 'Accelerate',      // Pay additional cost to enter ready (721)
  Assault = 'Assault',            // +X might while attacker (723)
  Deflect = 'Deflect',            // Opponents pay extra power to target (725)
  Ganking = 'Ganking',            // Can move battlefield to battlefield (726)
  Shield = 'Shield',              // +X might while defender (730)
  Tank = 'Tank',                  // Must be assigned lethal before non-Tank units (731)
  
  // Permanent Keywords
  Deathknell = 'Deathknell',      // Triggered when permanent dies (724)
  Temporary = 'Temporary',        // Killed at start of controller's beginning phase (732)
  Vision = 'Vision',              // Look at top of deck when played, may recycle (733)
  
  // Multi-card Keywords
  Hidden = 'Hidden',              // Can be played facedown at battlefield (727)
  Legion = 'Legion',              // Conditional effect if played another card this turn (728)
}

/**
 * Combat Designation - roles in combat
 */
export enum CombatDesignation {
  Attacker = 'Attacker',
  Defender = 'Defender',
}

/**
 * Game State Status
 */
export enum GameStateStatus {
  OpenState = 'OpenState',      // Players can play cards
  ClosedState = 'ClosedState',  // Only reactions allowed
  Showdown = 'Showdown',         // Action phase special timing
}

/**
 * Numeric game values
 */
export type Energy = number;
export type Damage = number;
export type Armor = number;
export type Health = number;

/**
 * Might - single combat statistic for units (Rule 140.2)
 * Units with damage >= Might are killed (Rule 140.2.a)
 */
export type Might = number;

/**
 * Power - domain-specific resource for paying costs
 * Power can be of a specific domain or [A] (any domain)
 */
export interface Power {
  domain: Domain | 'Any';  // 'Any' represents [A] - any domain power
  amount: number;
}

/**
 * Cost - what must be paid to play a card
 */
export interface Cost {
  energy: Energy;
  power: Power[];  // Power requirements (e.g., [R][R][B] for 2 Fury + 1 Mind)
}

/**
 * Tags - categories referenced by game rules and effects
 * Tags have no inherent meaning but may be referenced
 * Champion Tags link Legends, Champion Units, and Signature cards
 */
export type Tag = string;

/**
 * Points - victory points earned through Conquer and Hold
 * Used to determine game winner (Rule 445)
 */
export type Points = number;

/**
 * Victory Score - point total needed to win
 * Varies by Mode of Play (typically 8 for standard constructed)
 */
export type VictoryScore = number;
