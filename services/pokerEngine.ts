
import { Card, Rank, Suit, HandType, HandEvaluation } from '../types';
import { SUITS, RANKS, RANK_VALUE } from '../constants.tsx';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
};

export const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const evaluateHand = (cards: Card[]): HandEvaluation => {
  if (cards.length < 5) return { type: HandType.HighCard, value: 0, label: 'Incomplete' };
  
  // Basic implementation - in a real engine we check all 5-card combinations of 7
  const sorted = [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const counts: Record<string, number> = {};
  const suits: Record<string, number> = {};
  
  sorted.forEach(c => {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
    suits[c.suit] = (suits[c.suit] || 0) + 1;
  });

  const isFlush = Object.values(suits).some(count => count >= 5);
  
  let isStraight = false;
  let straightHigh = 0;
  const uniqueRanks = Array.from(new Set(sorted.map(c => RANK_VALUE[c.rank]))).sort((a,b) => b-a);
  
  for(let i=0; i <= uniqueRanks.length - 5; i++) {
    if(uniqueRanks[i] - uniqueRanks[i+4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[i];
      break;
    }
  }
  if (!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
    isStraight = true;
    straightHigh = 5;
  }

  const duplicates = Object.entries(counts).sort((a, b) => b[1] - a[1] || RANK_VALUE[b[0] as Rank] - RANK_VALUE[a[0] as Rank]);
  
  if (isFlush && isStraight && straightHigh === 14) return { type: HandType.RoyalFlush, value: 900, label: 'Royal Flush' };
  if (isFlush && isStraight) return { type: HandType.StraightFlush, value: 800 + straightHigh, label: 'Straight Flush' };
  if (duplicates[0][1] === 4) return { type: HandType.FourOfAKind, value: 700 + RANK_VALUE[duplicates[0][0] as Rank], label: 'Four of a Kind' };
  if (duplicates[0][1] === 3 && (duplicates[1]?.[1] >= 2)) return { type: HandType.FullHouse, value: 600 + RANK_VALUE[duplicates[0][0] as Rank], label: 'Full House' };
  if (isFlush) return { type: HandType.Flush, value: 500, label: 'Flush' };
  if (isStraight) return { type: HandType.Straight, value: 400 + straightHigh, label: 'Straight' };
  if (duplicates[0][1] === 3) return { type: HandType.ThreeOfAKind, value: 300 + RANK_VALUE[duplicates[0][0] as Rank], label: 'Three of a Kind' };
  if (duplicates[0][1] === 2 && duplicates[1]?.[1] === 2) return { type: HandType.TwoPair, value: 200 + RANK_VALUE[duplicates[0][0] as Rank], label: 'Two Pair' };
  if (duplicates[0][1] === 2) return { type: HandType.Pair, value: 100 + RANK_VALUE[duplicates[0][0] as Rank], label: 'Pair' };
  
  return { type: HandType.HighCard, value: RANK_VALUE[sorted[0].rank], label: `High Card ${sorted[0].rank}` };
};

/**
 * Monte Carlo Simulation
 * Estimating win probability by simulating random future outcomes.
 */
export const simulateWinProbability = (myHand: Card[], community: Card[], opponentCount: number, iterations: number = 500): number => {
  let wins = 0;
  const fullDeck = createDeck();
  
  // Remove cards already seen
  const usedCards = new Set([...myHand, ...community].map(c => `${c.rank}${c.suit}`));
  const availableDeck = fullDeck.filter(c => !usedCards.has(`${c.rank}${c.suit}`));

  for (let i = 0; i < iterations; i++) {
    const simDeck = shuffle([...availableDeck]);
    let simIdx = 0;

    // Deal community cards to fill 5
    const simCommunity = [...community];
    while (simCommunity.length < 5) {
      simCommunity.push(simDeck[simIdx++]);
    }

    // Deal opponent cards
    const myScore = evaluateHand([...myHand, ...simCommunity]).value;
    let isWinner = true;

    for (let j = 0; j < opponentCount; j++) {
      const oppHand = [simDeck[simIdx++], simDeck[simIdx++]];
      const oppScore = evaluateHand([...oppHand, ...simCommunity]).value;
      if (oppScore > myScore) {
        isWinner = false;
        break;
      }
    }

    if (isWinner) wins++;
  }

  return wins / iterations;
};
