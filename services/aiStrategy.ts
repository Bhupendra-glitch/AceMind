
import { GameState, Action, HandType, Player } from '../types';
import { evaluateHand, simulateWinProbability } from './pokerEngine';

export const getBotAction = (gameState: GameState, bot: Player): { action: Action, amount: number, ev: number, winProb: number } => {
  const activeOpponents = gameState.players.filter(p => !p.isFolded && p.id !== bot.id).length;
  const winProb = simulateWinProbability(bot.hand, gameState.communityCards, activeOpponents, 300);
  
  const pot = gameState.pot;
  const callAmount = gameState.lastRaiseAmount - bot.currentBet;
  
  // Pot Odds = Call / (Pot + Call)
  const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;
  
  // Expected Value Estimation
  // EV = (WinProb * Pot) - (LossProb * CallAmount)
  const ev = (winProb * pot) - ((1 - winProb) * callAmount);

  // Position modifier (0 = Dealer, 1 = SB, 2 = BB)
  const isInPosition = bot.position === 0;
  const posAggression = isInPosition ? 1.2 : 0.9;

  // 1. Check for Monster Hands (Showdown value)
  if (winProb > 0.8) {
    // Slow play occasionally (20% of time)
    if (Math.random() < 0.2 && gameState.stage !== 'RIVER') return { action: Action.Check, amount: 0, ev, winProb };
    const raiseSize = Math.floor(pot * 0.75 * posAggression);
    return { action: Action.Raise, amount: Math.max(gameState.minRaise, raiseSize), ev, winProb };
  }

  // 2. Mathematical Call/Fold based on Pot Odds & EV
  if (callAmount > 0) {
    if (winProb > potOdds || ev > 0) {
      return { action: Action.Call, amount: callAmount, ev, winProb };
    }
    // Bluffing logic: Bluffs dry boards or late position
    if (Math.random() < 0.1 && gameState.communityCards.length > 0) {
       return { action: Action.Raise, amount: Math.max(gameState.minRaise, Math.floor(pot * 0.5)), ev, winProb };
    }
    return { action: Action.Fold, amount: 0, ev, winProb };
  }

  // 3. Checking/Probing when no bet is in front
  if (winProb > 0.55) {
    const probeBet = Math.floor(pot * 0.4 * posAggression);
    return { action: Action.Raise, amount: Math.max(gameState.minRaise, probeBet), ev, winProb };
  }

  return { action: Action.Check, amount: 0, ev, winProb };
};
