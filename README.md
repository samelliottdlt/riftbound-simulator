# Riftbound Simulator

A pure functional game state simulator for the Riftbound card game. This simulator resolves complex game states while maintaining 100% rule accuracy, designed to be a companion for judges at events and players resolving complex board states.

## Status: Phase 2 - Energy System Refactored to Rune-Based Resources

The simulator has core game mechanics implemented with focus on canonical Riftbound rules:

- ✅ Complete type system (13 keywords from core rules, 6 card types, all zones)
- ✅ Zone management with 11 zones and privacy levels
- ✅ Card playing mechanics with cost validation
- ✅ **Rune-based resource system (Rules 153-161, 417) - Rune Deck, Channeling, Rune Pool**
- ✅ **Energy and Power as independent resources (Rule 156)**
- ✅ Full turn structure (Setup → Channel → Draw → Action → Combat → Ending)
- ✅ Combat system (attackers, blockers, damage resolution with Assault/Shield)
- ✅ **Victory Score system (Rule 445) - Points and win conditions**
- ✅ **Battlefield Control system (Rule 179) - Ownership and Contested status**
- ✅ **Scoring system (Rule 442) - Conquer and Hold mechanics**
- ✅ **Integrated Scoring - Hold in Draw Phase, Conquer after combat**
- ✅ **Ability System Foundation - Queue, triggers, resolution framework**
- ✅ **Triggered Abilities - OnPlay, OnDeath/Deathknell, OnScore, OnEnterPlay, etc.**
- ✅ **Tank Keyword - Rule 731 damage assignment priority**
- ✅ **Movement System - Rule 141 Standard Move and Rule 726 Ganking**
- ✅ **193 tests passing across 15 test suites**

### Implemented Keywords (From Core Rules 716-733)

- **Accelerate**: Pay additional cost to enter ready (Rule 721)
- **Action**: Can be played during showdowns on any turn (Rule 722)
- **Reaction**: Can be played during closed states on any turn (Rule 729)
- **Assault**: +X might while attacker (Rule 723)
- **Deflect**: Opponents pay extra power to target (Rule 725)
- **Ganking**: Can move battlefield to battlefield (Rule 726)
- **Shield**: +X might while defender (Rule 730)
- **Tank**: Must be assigned lethal before non-Tank units (Rule 731)
- **Deathknell**: Triggered when permanent dies (Rule 724)
- **Temporary**: Killed at start of controller's beginning phase (Rule 732)
- **Vision**: Look at top of deck when played, may recycle (Rule 733)
- **Hidden**: Can be played facedown at battlefield (Rule 727)
- **Legion**: Conditional effect if played another card this turn (Rule 728)

**Next**: Score abilities (Conquer/Hold triggered abilities), Movement system (units moving between battlefields), Ability resolution framework.

## Architecture

```
GameState → derive PendingChoices → player chooses → resolveGameState → new GameState
```

Key principles:

- **Pure functions**: Same input → same output, no side effects
- **Immutable state**: Every operation returns a new GameState
- **Choice-based**: Game never auto-resolves player decisions
- **Type-safe**: Full TypeScript with strict mode
- **Testable**: Deterministic RNG for reproducible tests

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build
```

## Example Usage

```typescript
import {
  resolveGameState,
  getPendingChoices,
  GameState,
  SeededRNG,
  playerId,
  cardId,
  Phase,
  createCard,
} from 'riftbound-simulator';

// Create initial game state
const state: GameState = {
  cards: new Map([
    [cardId('card1'), createCard(cardId('card1'), playerId('p1'), 'Fury Scout', 2)],
  ]),
  players: new Map([
    [playerId('p1'), {
      hand: [],
      deck: [cardId('card1')],
      base: new Set(),
    }],
  ]),
  turnState: {
    phase: Phase.Beginning,
    turnPlayer: playerId('p1'),
  },
  rng: new SeededRNG('game-seed-123'),
};

// Get available choices
const choicesResult = getPendingChoices(state);
if (choicesResult.ok) {
  console.log('Available choices:', choicesResult.value);
  // [{ type: 'draw', player: 'p1' }]
}

// Player chooses to draw
const newStateResult = resolveGameState(state, { type: 'draw' });
if (newStateResult.ok) {
  const newState = newStateResult.value;
  console.log('Phase:', newState.turnState.phase); // 'Action'
  console.log('Hand:', newState.players.get(playerId('p1'))?.hand); // ['card1']
}
```

## RNG System

Three pluggable RNG implementations:

```typescript
// Deterministic (for tests/replays)
const rng = new SeededRNG('seed-123');

// Override specific outcomes (for testing scenarios)
const rng = new OverrideRNG([0.5, 0.3, 0.8]); // Next 3 random values

// True random (for production)
const rng = new RandomRNG();
```

## Error Handling

All operations return `Result<T, ValidationError>`:

```typescript
const result = resolveGameState(state, choice);

if (result.ok) {
  // Success: result.value is the new GameState
  const newState = result.value;
} else {
  // Error: result.error contains details
  console.log(result.error.code);    // 'INVALID_CHOICE'
  console.log(result.error.message); // Human-readable description
  console.log(result.error.fixes);   // Suggested ways to fix
}
```

## Project Structure

```
src/
├── types/                  # Core type definitions
│   ├── primitives.ts          # PlayerId, CardId, Domain, Phase, etc.
│   ├── cards.ts               # Card types (Unit, Spell, Gear, Rune, etc.)
│   ├── gameState.ts           # GameState and helpers
│   └── result.ts              # Result<T, E> and error types
├── core/                   # Game logic
│   ├── abilityResolution.ts   # Ability queue and resolution
│   ├── battlefieldControl.ts  # Control and Contested mechanics
│   ├── cardPlaying.ts         # Playing cards, paying costs
│   ├── combat.ts              # Combat system with Tank keyword
│   ├── movement.ts            # Unit movement and Ganking
│   ├── runes.ts               # Rune system (Rune Pool, channeling)
│   ├── scoring.ts             # Conquer and Hold scoring
│   ├── triggeredAbilities.ts  # Triggered ability system
│   ├── turnStructure.ts       # Turn phases and execution
│   ├── victory.ts             # Victory conditions
│   └── zoneManagement.ts      # Zone tracking and movement
├── utils/                  # Utilities
│   └── rng.ts                 # RNG abstraction
└── index.ts                # Public API

tests/
├── integration/            # End-to-end tests
│   ├── runes.test.ts          # Rune system tests (24 tests)
│   ├── turnStructure.test.ts  # Turn phase tests
│   ├── combat.test.ts         # Combat system tests
│   ├── scoring.test.ts        # Scoring mechanics tests
│   └── ... (11 more test suites)
└── utils/                  # Test helpers
```

## Development Roadmap

### Phase 1: Vertical Slice ✅ COMPLETE
- [x] Project setup
- [x] RNG abstraction
- [x] Result type
- [x] Minimal types (PlayerId, CardId, Phase, etc.)
- [x] Basic turn cycle (draw → end turn)
- [x] Integration tests

### Phase 2: Core Game Systems (~60% Complete)

**✅ Completed Systems:**
- [x] Complete type system (13 keywords, 6 card types, 11 zones)
- [x] Zone management (play, discard, exile, graveyard, etc.)
- [x] Energy system with max energy generation (Rule 300.2)
- [x] Full turn structure (Setup → Beginning → Action → Combat → Ending)
- [x] Combat system (attackers, blockers, damage, Assault/Shield keywords)
- [x] Victory Score system (Rule 445 - points and win conditions)
- [x] Battlefield Control system (Rule 179 - ownership and Contested status)
- [x] Scoring system (Rule 442 - Conquer and Hold mechanics)
- [x] Integrated scoring with turn cycle and combat
- [x] Card playing mechanics with cost validation
- [x] **Ability System Foundation** (queue, triggers, APNAP resolution order)
- [x] **Triggered Abilities** (OnPlay, OnDeath/Deathknell, OnScore, zone changes, turns, combat)
- [x] **Tank Keyword** (Rule 731 - damage assignment priority)
- [x] **Movement System** (Rule 141 Standard Move, Rule 726 Ganking)

**🚧 In Progress:**
- [ ] **Advanced Keywords**
  - [ ] Deflect targeting costs (Rule 725)
  - [ ] Hidden facedown cards (Rule 727)

**📋 Remaining Core Rules:**
- [ ] Mulligan system (Rule 313)
- [ ] Showdown timing windows (Rule 317)
- [ ] Ability timing and priority (Rule 600-series)
- [ ] Replacement effects
- [ ] Continuous effects

### Phase 3: Advanced Features
- [ ] Multiplayer support (>2 players)
- [ ] Game modes (Constructed, Limited, Team)
- [ ] Replay system from game log
- [ ] State serialization/deserialization
- [ ] Performance optimization
- [ ] AI opponent framework

## Contributing

This project follows a vertical-then-horizontal development strategy:
1. Build minimal end-to-end functionality first
2. Expand horizontally to add features
3. Maintain 100% test coverage
4. Never break existing functionality

## License

MIT
