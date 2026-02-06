
import React from 'react';
import { Suit, Rank } from './types';

export const SUITS: Suit[] = ['H', 'D', 'C', 'S'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const SUIT_ICON: Record<Suit, React.ReactNode> = {
  'H': <i className="fas fa-heart text-red-500"></i>,
  'D': <i className="fas fa-diamond text-red-500"></i>,
  'C': <i className="fas fa-club text-slate-800"></i>,
  'S': <i className="fas fa-spade text-slate-800"></i>
};

export const INITIAL_STACK = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
