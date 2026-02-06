
import React from 'react';
import { Card as CardType } from '../types';
import { SUIT_ICON } from '../constants.tsx';

interface CardProps {
  card?: CardType;
  hidden?: boolean;
  className?: string;
}

const CardUI: React.FC<CardProps> = ({ card, hidden, className = "" }) => {
  if (hidden || !card) {
    return (
      <div className={`w-12 h-16 md:w-16 md:h-24 bg-slate-700 border-2 border-slate-600 rounded-lg flex items-center justify-center text-slate-500 shadow-lg ${className}`}>
        <i className="fas fa-ghost opacity-20"></i>
      </div>
    );
  }

  const isRed = card.suit === 'H' || card.suit === 'D';

  return (
    <div className={`w-12 h-16 md:w-16 md:h-24 bg-white border-2 border-slate-200 rounded-lg flex flex-col justify-between p-1 md:p-2 shadow-lg transition-transform hover:-translate-y-1 ${className}`}>
      <div className={`text-xs md:text-sm font-bold flex justify-between ${isRed ? 'text-red-500' : 'text-slate-900'}`}>
        <span>{card.rank}</span>
        <span>{SUIT_ICON[card.suit]}</span>
      </div>
      <div className="flex justify-center text-lg md:text-2xl">
        {SUIT_ICON[card.suit]}
      </div>
      <div className={`text-xs md:text-sm font-bold flex justify-between rotate-180 ${isRed ? 'text-red-500' : 'text-slate-900'}`}>
        <span>{card.rank}</span>
        <span>{SUIT_ICON[card.suit]}</span>
      </div>
    </div>
  );
};

export default CardUI;
