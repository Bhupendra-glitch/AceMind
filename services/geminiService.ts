
import { GoogleGenAI } from "@google/genai";
import { GameState, Action } from "../types";

export const analyzeHand = async (gameState: GameState, botId: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const bot = gameState.players.find(p => p.id === botId);
  if (!bot) return "Error: Bot not found";

  const prompt = `
    You are a professional poker bot. Analyze the current game state and suggest the optimal action.
    
    Current State:
    - Stage: ${gameState.stage}
    - Pot: ${gameState.pot}
    - Your Hand: ${bot.hand.map(c => c.rank + c.suit).join(', ')}
    - Community Cards: ${gameState.communityCards.map(c => c.rank + c.suit).join(', ')}
    - Your Stack: ${bot.stack}
    - Your Current Bet: ${bot.currentBet}
    - Last Raise in Round: ${gameState.lastRaiseAmount}
    - Min Raise: ${gameState.minRaise}
    
    Rules for your analysis:
    1. Be concise.
    2. Explain the rationale based on pot odds and hand strength.
    3. Suggest one of: FOLD, CALL, CHECK, RAISE (with amount).
    
    Format:
    RATIONALE: <short explanation>
    SUGGESTED ACTION: <ACTION> <AMOUNT if raise>
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Failed to get AI strategic advice.";
  }
};
