# Riftbound Simulator

A pure functional game state simulator for the Riftbound card game. This simulator resolves complex game states while maintaining 100% rule accuracy.

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

## Contributing

- Unit tests for all existing new functionality
- Rules are in core_rules.md. All new features must strictly implement the rules with no exceptions. The simulator is intended to be 100% rules accurate.

## License

MIT
