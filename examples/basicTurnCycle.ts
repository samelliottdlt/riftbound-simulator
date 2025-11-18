/**
 * Example: Basic Turn Cycle
 * 
 * Demonstrates a complete turn cycle with the Riftbound simulator
 */

import {
  resolveGameState,
  getPendingChoices,
  GameState,
  SeededRNG,
  playerId,
  cardId,
  Phase,
  createCard,
  isOk,
} from '../src/index.js';

// Setup: Create a simple 2-player game
const p1 = playerId('p1'); // Alice
const p2 = playerId('p2'); // Bob

// Create some simple unit cards
const cards = [
  createCard(cardId('card1'), p1, 'Fury Scout', 2),
  createCard(cardId('card2'), p1, 'Calm Healer', 1),
  createCard(cardId('card3'), p2, 'Mind Mage', 3),
  createCard(cardId('card4'), p2, 'Body Guardian', 4),
];

// Initial game state
let gameState: GameState = {
  cards: new Map(cards.map((card) => [card.id, card])),
  players: new Map([
    [
      p1,
      {
        hand: [],
        deck: [cardId('card1'), cardId('card2')],
        base: new Set(),
      },
    ],
    [
      p2,
      {
        hand: [],
        deck: [cardId('card3'), cardId('card4')],
        base: new Set(),
      },
    ],
  ]),
  turnState: {
    phase: Phase.Beginning,
    turnPlayer: p1,
  },
  rng: new SeededRNG('demo-game-123'),
};

console.log('=== Riftbound Simulator Demo ===\n');

// Turn 1: Alice's turn
console.log('Turn 1 - Alice\'s Beginning Phase');
console.log(`Phase: ${gameState.turnState.phase}`);
console.log(`Turn Player: ${gameState.turnState.turnPlayer}`);

const choices1 = getPendingChoices(gameState);
if (isOk(choices1)) {
  console.log(`Available choices: ${choices1.value.map((c) => c.type).join(', ')}`);
  
  // Alice draws a card
  console.log('\nAlice chooses: draw');
  const result1 = resolveGameState(gameState, { type: 'draw' });
  
  if (isOk(result1)) {
    gameState = result1.value;
    const aliceHand = gameState.players.get(p1)?.hand || [];
    console.log(`Alice's hand: ${aliceHand.join(', ')}`);
    console.log(`Alice's deck: ${gameState.players.get(p1)?.deck.length} cards remaining`);
    console.log(`Phase advanced to: ${gameState.turnState.phase}`);
  }
}

// Alice's Action Phase
console.log('\n--- Alice\'s Action Phase ---');
const choices2 = getPendingChoices(gameState);
if (isOk(choices2)) {
  console.log(`Available choices: ${choices2.value.map((c) => c.type).join(', ')}`);
  
  // Alice ends her turn
  console.log('\nAlice chooses: endTurn');
  const result2 = resolveGameState(gameState, { type: 'endTurn' });
  
  if (isOk(result2)) {
    gameState = result2.value;
    console.log(`Turn passed to: ${gameState.turnState.turnPlayer}`);
    console.log(`Phase: ${gameState.turnState.phase}`);
  }
}

// Turn 2: Bob's turn
console.log('\n=== Turn 2 - Bob\'s Beginning Phase ===');
const choices3 = getPendingChoices(gameState);
if (isOk(choices3)) {
  console.log(`Available choices: ${choices3.value.map((c) => c.type).join(', ')}`);
  
  // Bob draws a card
  console.log('\nBob chooses: draw');
  const result3 = resolveGameState(gameState, { type: 'draw' });
  
  if (isOk(result3)) {
    gameState = result3.value;
    const bobHand = gameState.players.get(p2)?.hand || [];
    console.log(`Bob's hand: ${bobHand.join(', ')}`);
    console.log(`Bob's deck: ${gameState.players.get(p2)?.deck.length} cards remaining`);
    console.log(`Phase advanced to: ${gameState.turnState.phase}`);
  }
}

console.log('\n=== Demo Complete ===');
console.log('The vertical slice works! Next: expand horizontally with more game rules.');
