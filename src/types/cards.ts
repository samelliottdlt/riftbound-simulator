/**
 * Card Types - Complete
 * 
 * Full card representation with all properties from rules
 */

import {
  CardId,
  PlayerId,
  Might,
  Domain,
  CardCategory,
  Supertype,
  Tag,
  Cost,
  Keyword,
  Armor,
  Damage,
} from './primitives.js';
import { Ability } from './abilities.js';

/**
 * Base Card - properties common to all cards
 */
export interface BaseCard {
  id: CardId;
  owner: PlayerId;
  name: string;
  category: CardCategory;
  domains: Domain[];        // One or more domains (or none for colorless)
  supertypes: Supertype[];  // Champion, Signature, Token, etc.
  tags: Tag[];              // Champion tags and other tags
}

/**
 * Unit Card - permanents with might (Rule 140.2)
 * Units track damage; when damage >= might, they are killed (Rule 140.2.a)
 */
export interface UnitCard extends BaseCard {
  category: CardCategory.Unit;
  cost: Cost;
  might: Might;        // Single combat statistic
  damage?: Damage;     // Damage marked on unit (Rule 140.3)
  armor?: Armor;       // If present, reduces damage taken
  keywords: Keyword[];
  abilities: Ability[]; // Triggered, activated, and passive abilities
  rulesText: string;
}

/**
 * Spell Card - non-permanent cards that execute then go to trash
 */
export interface SpellCard extends BaseCard {
  category: CardCategory.Spell;
  cost: Cost;
  keywords: Keyword[];
  instructions: string[]; // Will be replaced with proper Instruction type later
  rulesText: string;
}

/**
 * Gear Card - permanents that attach to units
 */
export interface GearCard extends BaseCard {
  category: CardCategory.Gear;
  cost: Cost;
  keywords: Keyword[];
  abilities: Ability[]; // Triggered, activated, and passive abilities
  rulesText: string;
}

/**
 * Rune Card - channeled from Rune Deck, not played
 */
export interface RuneCard extends BaseCard {
  category: CardCategory.Rune;
  abilities: Ability[]; // Rune abilities
  rulesText: string;
}

/**
 * Battlefield Card - starts on board, provides location
 */
export interface BattlefieldCard extends BaseCard {
  category: CardCategory.Battlefield;
  abilities: Ability[];
  rulesText: string;
}

/**
 * Legend Card - starts in Legend Zone, cannot leave
 */
export interface LegendCard extends BaseCard {
  category: CardCategory.Legend;
  abilities: Ability[];
  rulesText: string;
}

/**
 * Card - discriminated union of all card types
 */
export type Card =
  | UnitCard
  | SpellCard
  | GearCard
  | RuneCard
  | BattlefieldCard
  | LegendCard;

/**
 * Type guards
 */
export function isUnit(card: Card): card is UnitCard {
  return card.category === CardCategory.Unit;
}

export function isSpell(card: Card): card is SpellCard {
  return card.category === CardCategory.Spell;
}

export function isGear(card: Card): card is GearCard {
  return card.category === CardCategory.Gear;
}

export function isRune(card: Card): card is RuneCard {
  return card.category === CardCategory.Rune;
}

export function isBattlefield(card: Card): card is BattlefieldCard {
  return card.category === CardCategory.Battlefield;
}

export function isLegend(card: Card): card is LegendCard {
  return card.category === CardCategory.Legend;
}

/**
 * Permanent - cards that stay on board (Units and Gear from Main Deck)
 */
export type PermanentCard = UnitCard | GearCard;

export function isPermanent(card: Card): card is PermanentCard {
  return isUnit(card) || isGear(card);
}

/**
 * Main Deck Card - cards that start in Main Deck
 */
export type MainDeckCard = UnitCard | SpellCard | GearCard;

export function isMainDeckCard(card: Card): card is MainDeckCard {
  return isUnit(card) || isSpell(card) || isGear(card);
}

/**
 * Helper functions to create cards
 */

export function createUnit(
  id: CardId,
  owner: PlayerId,
  name: string,
  cost: Cost,
  might: Might,
  domains: Domain[] = [],
  keywords: Keyword[] = [],
  supertypes: Supertype[] = [],
  tags: Tag[] = []
): UnitCard {
  return {
    id,
    owner,
    name,
    category: CardCategory.Unit,
    cost,
    might,
    domains,
    keywords,
    supertypes,
    tags,
    abilities: [],
    rulesText: '',
  };
}

export function createSpell(
  id: CardId,
  owner: PlayerId,
  name: string,
  cost: Cost,
  domains: Domain[] = [],
  keywords: Keyword[] = [],
  supertypes: Supertype[] = [],
  tags: Tag[] = []
): SpellCard {
  return {
    id,
    owner,
    name,
    category: CardCategory.Spell,
    cost,
    domains,
    keywords,
    supertypes,
    tags,
    instructions: [],
    rulesText: '',
  };
}

export function createGear(
  id: CardId,
  owner: PlayerId,
  name: string,
  cost: Cost,
  domains: Domain[] = [],
  keywords: Keyword[] = [],
  supertypes: Supertype[] = [],
  tags: Tag[] = []
): GearCard {
  return {
    id,
    owner,
    name,
    category: CardCategory.Gear,
    cost,
    domains,
    keywords,
    supertypes,
    tags,
    abilities: [],
    rulesText: '',
  };
}

/**
 * Simple helper for tests (backward compatible with vertical slice)
 */
export function createCard(
  id: CardId,
  owner: PlayerId,
  name: string,
  might?: Might
): UnitCard {
  return createUnit(
    id,
    owner,
    name,
    { energy: 0, power: [] },
    (might ?? 1) as Might
  );
}
