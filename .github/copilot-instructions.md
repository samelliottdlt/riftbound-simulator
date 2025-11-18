# Copilot Agent Instructions - Riftbound Simulator

## Repository Overview

**Riftbound Simulator** is a pure functional game state simulator for the Riftbound card game. It resolves complex game states with 100% rule accuracy, designed as a companion for judges and players. The project is a TypeScript-based game engine implementing canonical rules from a 3000+ line rules document (`core_rules.md`).

### Key Stats
- **Language**: TypeScript (ES2022, strict mode)
- **Runtime**: Node.js ≥18.0.0
- **Type**: Pure functional library with immutable state
- **Size**: ~13 TypeScript modules, 194 passing tests across 15 test suites
- **Dependencies**: Minimal (seedrandom for deterministic RNG)
- **Architecture**: Pure functions only - same input → same output, no side effects

---

## Build & Validation Commands

### Working Commands

**ALWAYS run in this order when making changes:**

```powershell
# 1. Install dependencies (always run first in new environment)
npm install

# 2. Run tests
npm test

# 3. Run tests with coverage
npm run test:coverage

# 4. Run tests in watch mode
npm run test:watch

# 5. Clean build artifacts
npm run clean
```

### Commands That Currently Fail

```powershell
npm run build
npm run lint
```

## Project Architecture

### Core Principles
1. **Pure Functions**: Every operation returns new state, never mutates
2. **Immutable State**: GameState is read-only, create new instances
3. **Choice-Based**: Game never auto-resolves player decisions
4. **Result Type**: All operations return `Result<T, ValidationError>` - check with `isOk()` before accessing `.value`
5. **Deterministic RNG**: Use `SeededRNG` in tests for reproducibility

### Directory Structure

```
src/
├── types/                    # Type definitions (6 files)
│   ├── primitives.ts            # Branded types: PlayerId, CardId, Phase, Domain
│   ├── cards.ts                 # Card types: Unit, Spell, Gear, Rune, Battlefield, Legend
│   ├── gameState.ts             # GameState, PlayerState, BattlefieldState
│   ├── result.ts                # Result<T, E>, ok(), err(), validation helpers
│   ├── choices.ts               # PendingChoice, PlayerChoice
│   └── abilities.ts             # Ability system types
├── core/                     # Game logic (12 files)
│   ├── resolver.ts              # Main game loop: resolveGameState()
│   ├── turnStructure.ts         # Turn phases (Awaken → Channel → Draw → Action → Ending)
│   ├── cardPlaying.ts           # Playing cards, cost validation
│   ├── combat.ts                # Combat system with Tank keyword
│   ├── movement.ts              # Unit movement and Ganking
│   ├── runes.ts                 # Rune system (channeling, Rune Pool)
│   ├── scoring.ts               # Conquer and Hold scoring mechanics
│   ├── battlefieldControl.ts    # Battlefield ownership and Contested status
│   ├── victory.ts               # Victory conditions
│   ├── zoneManagement.ts        # Moving cards between zones
│   ├── abilityResolution.ts     # Ability queue and resolution
│   └── triggeredAbilities.ts    # OnPlay, OnDeath, OnScore triggers
├── choices/                  # Choice derivation
│   └── deriveChoices.ts         # Determines available player choices
├── rules/actions/            # Specific game actions
│   ├── draw.ts                  # Drawing cards, Burn Out
│   └── turn.ts                  # Turn phase advancement
└── utils/
    └── rng.ts                   # RNG abstraction (SeededRNG, OverrideRNG, RandomRNG)

tests/
└── integration/              # 15 test suites, 194 tests
    ├── verticalSlice.test.ts    # Basic turn cycle
    ├── turnStructure.test.ts    # Full turn phases
    ├── combat.test.ts           # Combat mechanics
    ├── runes.test.ts            # Rune system (24 tests)
    ├── scoring.test.ts          # Conquer/Hold scoring
    └── ... (11 more test suites)
```

### Key Files

**Entry Point**: `src/index.ts` - Exports public API (90+ exports)
**Main Loop**: `src/core/resolver.ts` - `resolveGameState(state, choice)` function
**Rules Document**: `core_rules.md` - 3115 lines, canonical game rules (Rules 001-733)
**Test Helpers**: `tests/utils/testHelpers.ts` - Utilities for creating test states

---

## Configuration Files

```
tsconfig.json           # TypeScript config: ES2022, strict mode, paths alias @/*
vitest.config.ts        # Vitest config: v8 coverage, node environment
package.json            # Scripts, dependencies (seedrandom), engines (node >=18)
.gitignore              # Standard Node.js + coverage/ + dist/
```

No ESLint, Prettier, or other linters configured. Type checking via `tsc --noEmit`.

---

## Testing Workflow

### Test Structure
- **Location**: `tests/integration/` (no unit tests directory)
- **Framework**: Vitest with v8 coverage
- **Pattern**: Integration tests that validate end-to-end game scenarios

### Writing Tests

**ALWAYS use this pattern**:

```typescript
import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/utils/rng.js';
import { playerId, cardId } from '../../src/types/primitives.js';
import { createGameState } from '../utils/testHelpers.js';

describe('Feature Name', () => {
  it('should validate specific behavior', () => {
    // 1. Create deterministic game state
    const state = createGameState({
      rng: new SeededRNG('test-seed'),
      // ... other state setup
    });
    
    // 2. Execute game action
    const result = resolveGameState(state, { type: 'draw' });
    
    // 3. Validate result
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.players.get(p1)?.hand).toHaveLength(1);
    }
  });
});
```

### Running Tests

```powershell
# Run all tests (fast - 3.25s)
npm test

# Run with coverage (generates HTML report in coverage/)
npm run test:coverage

# Watch mode for TDD
npm run test:watch
```

**Test execution is fast** (~3-4 seconds for 194 tests). Coverage report is in `coverage/index.html`.

---

## Development Patterns

### 1. Creating New Game Actions

When adding actions (e.g., "play unit", "attack"), follow this pattern:

```typescript
// In src/core/[feature].ts
export function myAction(state: GameState, params: Params): Result<GameState> {
  // 1. Validate preconditions
  if (!isValid(state, params)) {
    return err(validationError('INVALID_ACTION', 'Reason', ['Fix 1', 'Fix 2']));
  }
  
  // 2. Create new state (NEVER mutate!)
  const newState: GameState = {
    ...state,
    players: new Map(state.players),  // Copy collections
    // ... update what changed
  };
  
  // 3. Return success
  return ok(newState);
}
```

### 2. Working with Branded Types

Use type constructors, never cast strings:

```typescript
// ✅ CORRECT
const pid = playerId('p1');
const cid = cardId('card-123');

// ❌ WRONG - will fail type checking
const pid = 'p1' as PlayerId;
```

### 3. Handling Results

**ALWAYS check `isOk()` before accessing `.value`**:

```typescript
const result = someFunction(state);
if (!isOk(result)) {
  console.error(result.error.message);
  return result;  // Propagate error
}
const newState = result.value;  // Safe to access
```

### 4. Working with Immutable State

```typescript
// ✅ CORRECT - Create new Map
const newPlayers = new Map(state.players);
newPlayers.set(playerId, updatedPlayer);
const newState = { ...state, players: newPlayers };

// ❌ WRONG - Mutates original state
state.players.set(playerId, updatedPlayer);
```

---

## Rules Implementation Guidelines

### Core Rules Document
The `core_rules.md` file (3115 lines) is the **canonical source of truth**. All game mechanics must match these rules exactly. Before implementing anything, please refer to this document and understand the relevant sections. Do not implement any behavior not defined within the rules. Annotate code with rule references where applicable. Upon making any changes, ensure that the change is compliant with the rules.

**Key Rule Sections**:
- **Rules 100-199**: Game concepts (deck construction, setup, game objects)
- **Rules 300-399**: Turn structure and game actions
- **Rules 400-499**: Actions (Draw, Exhaust, Ready, Recycle, Deal, Heal, Play, Move, Hide, Discard, Kill, Channel, Burn Out)
- **Rules 600-699**: Abilities
- **Rules 700-733**: Keywords (13 implemented: Accelerate, Action, Reaction, Assault, Deflect, Ganking, Shield, Tank, Deathknell, Temporary, Vision, Hidden, Legion)

## Common Pitfalls

### 1. Type Errors with Branded Types
**Problem**: `CardId` vs `RuneId` conflicts in `zoneManagement.ts`
**Solution**: Use proper type guards and narrowing. Check if card is rune before adding to runeDeck.

### 2. Unused Imports
**Problem**: Many files have unused imports causing TS6133 errors
**Solution**: Remove unused imports when editing files. Use IDE's "organize imports" feature.

### 3. Ability Type Mismatches
**Problem**: `'activated'` type not in Ability union (runes.ts)
**Solution**: Update `abilities.ts` type definitions or use 'descriptor'/'function' types.

### 4. State Mutation
**Problem**: Accidentally mutating Maps/Sets in GameState
**Solution**: Always create new collections with `new Map(...)`, `new Set(...)`

### 5. Missing Error Handling
**Problem**: Accessing `.value` without checking `isOk()`
**Solution**: Use `isOk()` check or `flatMap()` for chaining operations.

---

## Validation Checklist

Before submitting changes, verify:

1. ✅ **Tests pass**: `npm test` shows all tests passing
2. ✅ **Coverage maintained**: Run `npm run test:coverage` and check coverage didn't drop significantly
3. ✅ **Build status**: `npm run build` ensures no new TypeScript errors (fix any that arise)
4. ✅ **Pure functions**: No mutations, no side effects
5. ✅ **Result types**: All operations return `Result<T, ValidationError>`
6. ✅ **Rules alignment**: Check `core_rules.md` for rule numbers and verify implementation matches
7. ✅ **Types exported**: New public types added to `src/index.ts`

---

## CI/CD & Automation

**No GitHub Actions or CI configured yet.** The project is in early development. When adding CI:
- Run `npm test` as the validation step
- Do NOT run `npm run build` until type errors are fixed
- Consider running `npm run test:coverage` and posting coverage reports

---

## Performance Notes

- **Test execution**: ~3-4 seconds for full suite (194 tests)
- **npm install**: ~21 seconds (164 packages)
- **Memory**: Game states are copied on every change - watch for large state objects in loops
- **RNG**: Use `SeededRNG` in tests for determinism, `RandomRNG` for production

---

## Quick Reference

### Most Common Commands
```powershell
npm install              # First time setup
npm test                 # Run tests (ALWAYS works)
npm run test:watch       # TDD mode
npm run test:coverage    # Coverage report
npm run clean            # Clean dist/
```

### Most Common Imports
```typescript
import { resolveGameState, getPendingChoices } from './core/resolver.js';
import { ok, err, isOk, validationError } from './types/result.js';
import { playerId, cardId, Phase } from './types/primitives.js';
import { createGameState } from '../tests/utils/testHelpers.js';  // In tests
import { SeededRNG } from './utils/rng.js';
```

### Most Common Patterns
```typescript
// Check Result
if (!isOk(result)) return result;
const value = result.value;

// Update GameState
const newState = { ...state, field: newValue };
```

---

## Trust These Instructions

These instructions were created by thoroughly analyzing the codebase, running all build/test commands, identifying errors, and documenting actual behavior. **Trust this information** - it's accurate as of the current repository state. Only search the codebase if:
1. Implementing a new feature not covered here
2. These instructions conflict with what you observe
3. You need rule-specific details from `core_rules.md`

**When in doubt**: Run `npm test` - if tests pass, you're on the right track. If tests fail, check this document for common patterns before exploring further.
