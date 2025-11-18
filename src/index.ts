/**
 * Public API - Vertical Slice
 * 
 * Exports the essential types and functions for using the simulator
 */

// Core resolver
export { resolveGameState, getPendingChoices, autoResolve } from './core/resolver.js';

// Ability system
export {
  initializeAbilitySystem,
  triggerAbilities,
  resolveNextAbility,
  resolveAllQueuedAbilities,
  queueTriggeredAbilities,
  checkTriggeredAbilities,
  getCardAbilities,
  hasKeyword,
  getUnitsWithKeyword,
} from './core/abilityResolution.js';
export {
  triggerOnPlayAbilities,
  triggerOnDeathAbilities,
  triggerOnScoreAbilities,
  triggerOnEnterPlayAbilities,
  triggerOnLeavePlayAbilities,
  triggerOnTurnStartAbilities,
  triggerOnTurnEndAbilities,
  triggerOnAttackAbilities,
  triggerOnDefendAbilities,
  triggerAndResolveAbilities,
  hasDeathknell,
} from './core/triggeredAbilities.js';
export type {
  TriggeredAbilityInstance,
  AbilityQueue,
} from './core/abilityResolution.js';

// Types
export type { GameState, PlayerState, TurnState } from './types/gameState.js';
export type {
  Card,
  BaseCard,
  UnitCard,
  SpellCard,
  GearCard,
  RuneCard,
  BattlefieldCard,
  LegendCard,
  PermanentCard,
  MainDeckCard,
} from './types/cards.js';
export type { PendingChoice, PlayerChoice, DrawChoice, EndTurnChoice } from './types/choices.js';
export type { Result, ValidationError, SuggestedFix } from './types/result.js';
export type { PlayerId, CardId, UnitId, GearId, RuneId, BattlefieldId, LegendId, AbilityId, TokenId, Power, Cost, Tag } from './types/primitives.js';
export { Domain, CardCategory, Supertype, Phase, Zone, PrivacyLevel, Keyword, CombatDesignation, GameStateStatus } from './types/primitives.js';
export { playerId, cardId, unitId, gearId, runeId, battlefieldId, legendId, abilityId, tokenId } from './types/primitives.js';

// Ability types
export type {
  Ability,
  AbilityDescriptor,
  AbilityFunction,
  AbilityContext,
  Effect,
  TargetFilter,
} from './types/abilities.js';
export {
  AbilityTrigger,
  TargetType,
  EffectType,
  descriptorAbility,
  functionAbility,
  shouldTrigger,
  resolveAbility,
} from './types/abilities.js';

// Utilities
export { ok, err, isOk, isErr, unwrap, map, flatMap, validationError } from './types/result.js';
export type { RNG } from './utils/rng.js';
export { SeededRNG, OverrideRNG, RandomRNG } from './utils/rng.js';

// Helpers
export { getCard, getPlayer, updateCard, updatePlayer } from './types/gameState.js';
export {
  createCard,
  createUnit,
  createSpell,
  createGear,
  isUnit,
  isSpell,
  isGear,
  isRune,
  isBattlefield,
  isLegend,
  isPermanent,
  isMainDeckCard,
} from './types/cards.js';
