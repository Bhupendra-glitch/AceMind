
export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum HandType {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9
}

export interface HandEvaluation {
  type: HandType;
  value: number; // For tie-breaking
  label: string;
}

export enum Action {
  Fold = 'FOLD',
  Check = 'CHECK',
  Call = 'CALL',
  Raise = 'RAISE'
}

export enum GameStage {
  PreFlop = 'PRE_FLOP',
  Flop = 'FLOP',
  Turn = 'TURN',
  River = 'RIVER',
  Showdown = 'SHOWDOWN'
}

export interface PlayerStats {
  handsPlayed: number;
  vpipCount: number; // Voluntarily Put In Pot
  pfrCount: number;  // Pre-Flop Raise
  totalProfit: number;
}

export interface Player {
  id: string;
  name: string;
  stack: number;
  hand: Card[];
  currentBet: number;
  isFolded: boolean;
  isBot: boolean;
  position: number; 
  stats: PlayerStats;
}

export interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  stage: GameStage;
  dealerIndex: number;
  activePlayerIndex: number;
  lastRaiseAmount: number;
  minRaise: number;
  handId: string;
}

export interface PerformanceLog {
  handId: string;
  timestamp: number;
  result: number;
  handType: HandType;
  actionSummary: string;
  winProb: number;
}
