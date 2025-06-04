// generator.js - Card generation and hand evaluation utilities

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

export function drawCards(deck, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    drawn.push(deck.splice(idx, 1)[0]);
  }
  return drawn;
}

export function formatCard(card) {
  // Cards are already formatted with unicode symbols
  return card;
}

export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function evaluateHand(hand, board) {
  // Simplified hand evaluation - returns a score from 1-10
  const allCards = [...hand, ...board];
  const ranks = allCards.map(card => card[0]);
  const suits = allCards.map(card => card.slice(1));
  
  // Count ranks
  const rankCounts = {};
  ranks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });
  
  // Count suits for flush detection
  const suitCounts = {};
  suits.forEach(suit => {
    suitCounts[suit] = (suitCounts[suit] || 0) + 1;
  });
  
  // Check for pairs, trips, quads
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = Object.values(suitCounts).some(count => count >= 5);
  const isStraight = checkStraight(ranks);
  
  // Hand strength scoring
  if (isStraight && isFlush) return { rank: 1, name: 'Straight Flush' };
  if (counts[0] === 4) return { rank: 2, name: 'Four of a Kind' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 3, name: 'Full House' };
  if (isFlush) return { rank: 4, name: 'Flush' };
  if (isStraight) return { rank: 5, name: 'Straight' };
  if (counts[0] === 3) return { rank: 6, name: 'Three of a Kind' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 7, name: 'Two Pair' };
  if (counts[0] === 2) return { rank: 8, name: 'One Pair' };
  
  return { rank: 9, name: 'High Card' };
}

function checkStraight(ranks) {
  const rankValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  
  const uniqueValues = [...new Set(ranks.map(rank => rankValues[rank]))].sort((a, b) => a - b);
  
  // Check for 5 consecutive cards
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    if (uniqueValues[i + 4] - uniqueValues[i] === 4) {
      return true;
    }
  }
  
  // Check for A-2-3-4-5 straight (wheel)
  if (uniqueValues.includes(14) && uniqueValues.includes(2) && 
      uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) {
    return true;
  }
  
  return false;
}

export function generatePuzzle() {
  const deck = createDeck();
  const shuffledDeck = shuffle(deck);
  
  const heroHand = drawCards(shuffledDeck, 2);
  const opponentHand = drawCards(shuffledDeck, 2);
  const board = drawCards(shuffledDeck, 5); // Full board, but we'll only show part
  
  const handEval = evaluateHand(heroHand, board.slice(0, 3)); // Evaluate on flop
  const score = handEval.rank;
  const name = handEval.name;
  
  // Determine best move based on hand strength
  let bestMove;
  let explanation;
  
  if (score <= 3) {
    bestMove = 'Raise';
    explanation = `Strong hand (${name}) - bet for value`;
  } else if (score <= 6) {
    bestMove = 'Call';
    explanation = `Decent hand (${name}) - call to see more cards`;
  } else {
    bestMove = 'Fold';
    explanation = `Weak hand (${name}) - fold to avoid losses`;
  }
  
  return {
    board: board.map(formatCard),
    hand: heroHand.map(formatCard),
    opponentHand: opponentHand.map(formatCard),
    bestMove,
    explanation,
    handStrength: { rank: score, name }
  };
}

export function generatePuzzles(count = 10) {
  return Array.from({ length: count }, generatePuzzle);
}

// Advanced hand analysis functions
export function calculateEquity(heroHand, opponentHand, board) {
  // Simplified equity calculation
  // In a real implementation, this would run Monte Carlo simulations
  const heroStrength = evaluateHand(heroHand, board);
  const oppStrength = evaluateHand(opponentHand, board);
  
  if (heroStrength.rank < oppStrength.rank) {
    return { hero: 75, opponent: 25 };
  } else if (heroStrength.rank > oppStrength.rank) {
    return { hero: 25, opponent: 75 };
  } else {
    return { hero: 50, opponent: 50 };
  }
}

export function getPotOdds(betSize, potSize) {
  return betSize / (potSize + betSize);
}

export function getImpliedOdds(betSize, potSize, effectiveStack) {
  const directOdds = getPotOdds(betSize, potSize);
  const impliedMultiplier = Math.min(2, effectiveStack / potSize);
  return directOdds / impliedMultiplier;
}

// GTO frequency calculations
export function getGTOFrequencies(handStrength, position, street, action) {
  // Simplified GTO frequencies based on hand strength and position
  const baseFrequencies = {
    fold: 40,
    call: 35,
    raise: 25
  };
  
  // Adjust based on hand strength
  if (handStrength <= 3) { // Strong hands
    return { fold: 5, call: 25, raise: 70 };
  } else if (handStrength <= 6) { // Medium hands
    return { fold: 30, call: 50, raise: 20 };
  } else { // Weak hands
    return { fold: 70, call: 20, raise: 10 };
  }
}

export function analyzePlay(action, handStrength, position, street, potOdds) {
  const gtoFreqs = getGTOFrequencies(handStrength, position, street, action);
  const actionFreq = gtoFreqs[action.toLowerCase()] || 0;
  
  return {
    isOptimal: actionFreq >= 50,
    frequency: actionFreq,
    alternatives: gtoFreqs,
    reasoning: getPlayReasoning(action, handStrength, position, street)
  };
}

function getPlayReasoning(action, handStrength, position, street) {
  const reasons = {
    fold: [
      "Hand too weak to continue",
      "Pot odds not favorable",
      "Better to wait for stronger spot"
    ],
    call: [
      "Decent hand with drawing potential",
      "Good pot odds to continue",
      "Control pot size with marginal hand"
    ],
    raise: [
      "Strong hand - bet for value",
      "Semi-bluff with good equity",
      "Apply pressure with position"
    ]
  };
  
  const actionReasons = reasons[action.toLowerCase()] || ["Standard play"];
  return actionReasons[Math.floor(Math.random() * actionReasons.length)];
}