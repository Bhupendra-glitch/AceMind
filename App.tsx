
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  GameState, Player, Card, GameStage, Action, PerformanceLog, HandType, PlayerStats
} from './types';
import { 
  createDeck, evaluateHand, simulateWinProbability 
} from './services/pokerEngine';
import { getBotAction } from './services/aiStrategy';
import { analyzeHand } from './services/geminiService';
import CardUI from './components/CardUI';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { INITIAL_STACK, SMALL_BLIND, BIG_BLIND } from './constants.tsx';

const initialPlayerStats: PlayerStats = { handsPlayed: 0, vpipCount: 0, pfrCount: 0, totalProfit: 0 };

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceLog[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [cheatMode, setCheatMode] = useState(false);
  
  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  const startNewHand = useCallback(() => {
    setGameState(prev => {
      const deck = createDeck();
      let cardsIdx = 0;
      
      const prevPlayers = prev?.players || [];
      const getStats = (id: string) => prevPlayers.find(p => p.id === id)?.stats || { ...initialPlayerStats };

      const players: Player[] = [
        { id: 'bot-1', name: 'Bot α (Shark)', stack: prevPlayers[0]?.stack || INITIAL_STACK, hand: [deck[cardsIdx++], deck[cardsIdx++]], currentBet: 0, isFolded: false, isBot: true, position: 1, stats: getStats('bot-1') },
        { id: 'bot-2', name: 'Bot β (Fish)', stack: prevPlayers[1]?.stack || INITIAL_STACK, hand: [deck[cardsIdx++], deck[cardsIdx++]], currentBet: 0, isFolded: false, isBot: true, position: 2, stats: getStats('bot-2') },
        { id: 'player', name: 'Hero', stack: prevPlayers[2]?.stack || INITIAL_STACK, hand: [deck[cardsIdx++], deck[cardsIdx++]], currentBet: 0, isFolded: false, isBot: false, position: 0, stats: getStats('player') },
      ];

      // Reset for bankrupt players
      players.forEach(p => { if (p.stack < BIG_BLIND) p.stack = INITIAL_STACK; });

      return {
        players,
        communityCards: [],
        pot: 0,
        stage: GameStage.PreFlop,
        dealerIndex: 0,
        activePlayerIndex: 1, // Start with SB
        lastRaiseAmount: 0,
        minRaise: BIG_BLIND,
        handId: Date.now().toString()
      };
    });
    
    setAiAnalysis("");
    addLog("--- New Hand Started ---");
  }, []);

  useEffect(() => {
    startNewHand();
  }, [startNewHand]);

  const updateStats = (playerId: string, action: Action, isPreFlop: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      const next = { ...prev };
      const p = next.players.find(p => p.id === playerId);
      if (p) {
        if (action === Action.Call || action === Action.Raise) p.stats.vpipCount++;
        if (action === Action.Raise && isPreFlop) p.stats.pfrCount++;
        if (isPreFlop) p.stats.handsPlayed++;
      }
      return next;
    });
  };

  const handleAction = (playerId: string, action: Action, amount: number = 0) => {
    if (!gameState) return;
    
    // Update Tracking Stats
    if (gameState.stage === GameStage.PreFlop) {
      updateStats(playerId, action, true);
    }

    setGameState(prev => {
      if (!prev) return null;
      const next = { ...prev };
      const playerIdx = next.players.findIndex(p => p.id === playerId);
      const player = next.players[playerIdx];

      if (action === Action.Fold) {
        player.isFolded = true;
        addLog(`${player.name} folds.`);
      } else if (action === Action.Call || action === Action.Check) {
        const callAmount = next.lastRaiseAmount - player.currentBet;
        player.stack -= callAmount;
        player.currentBet += callAmount;
        next.pot += callAmount;
        addLog(`${player.name} ${callAmount === 0 ? 'checks' : 'calls $' + callAmount}.`);
      } else if (action === Action.Raise) {
        const totalToPutIn = amount - player.currentBet;
        player.stack -= totalToPutIn;
        player.currentBet = amount;
        next.pot += totalToPutIn;
        next.lastRaiseAmount = amount;
        addLog(`${player.name} raises to $${amount}.`);
      }

      // Move to next active player
      let nextActive = (next.activePlayerIndex + 1) % next.players.length;
      let loopSafe = 0;
      while (next.players[nextActive].isFolded && loopSafe < 10) {
        nextActive = (nextActive + 1) % next.players.length;
        loopSafe++;
      }
      next.activePlayerIndex = nextActive;

      // Check for round completion
      const activePlayers = next.players.filter(p => !p.isFolded);
      const allActed = activePlayers.every(p => p.currentBet === next.lastRaiseAmount && p.currentBet >= (next.stage === GameStage.PreFlop ? BIG_BLIND : 0));

      if (allActed || activePlayers.length === 1) {
        if (activePlayers.length === 1) {
          const winner = activePlayers[0];
          addLog(`${winner.name} wins $${next.pot} unopposed.`);
          winner.stack += next.pot;
          if (winner.id === 'player') {
             setPerformanceHistory(h => [...h, { handId: next.handId, timestamp: Date.now(), result: next.pot, handType: HandType.HighCard, actionSummary: 'Bluff/Uncontested', winProb: 1 }]);
          }
          setTimeout(startNewHand, 2000);
          return next;
        }

        next.players.forEach(p => p.currentBet = 0);
        next.lastRaiseAmount = 0;

        if (next.stage === GameStage.PreFlop) {
          next.stage = GameStage.Flop;
          const deck = createDeck();
          next.communityCards = deck.slice(15, 18);
        } else if (next.stage === GameStage.Flop) {
          next.stage = GameStage.Turn;
          const deck = createDeck();
          next.communityCards.push(deck[19]);
        } else if (next.stage === GameStage.Turn) {
          next.stage = GameStage.River;
          const deck = createDeck();
          next.communityCards.push(deck[20]);
        } else {
          // Showdown logic
          const results = next.players
            .filter(p => !p.isFolded)
            .map(p => ({ player: p, eval: evaluateHand([...p.hand, ...next.communityCards]) }));
          
          results.sort((a, b) => b.eval.value - a.eval.value);
          const winner = results[0].player;
          addLog(`Showdown! ${winner.name} wins with ${results[0].eval.label}.`);
          winner.stack += next.pot;
          
          if (winner.id === 'player' || results.some(r => r.player.id === 'player')) {
            const playerRes = next.players.find(p => p.id === 'player')!;
            const myEval = results.find(r => r.player.id === 'player')?.eval;
            setPerformanceHistory(h => [...h, { 
              handId: next.handId, 
              timestamp: Date.now(), 
              result: winner.id === 'player' ? next.pot : -100, 
              handType: myEval?.type || HandType.HighCard, 
              actionSummary: myEval?.label || 'Folded',
              winProb: simulateWinProbability(playerRes.hand, next.communityCards, activePlayers.length - 1)
            }]);
          }

          setTimeout(startNewHand, 4000);
        }
      }

      return next;
    });
  };

  useEffect(() => {
    if (gameState && gameState.players[gameState.activePlayerIndex].isBot && !gameState.players[gameState.activePlayerIndex].isFolded) {
      const bot = gameState.players[gameState.activePlayerIndex];
      const thinkingTime = 1000 + Math.random() * 2000; // Human-like delay
      const timer = setTimeout(() => {
        const decision = getBotAction(gameState, bot);
        handleAction(bot.id, decision.action, decision.amount);
      }, thinkingTime);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const requestAiAnalysis = async () => {
    if (!gameState) return;
    setLoadingAi(true);
    const analysis = await analyzeHand(gameState, 'player');
    setAiAnalysis(analysis);
    setLoadingAi(false);
  };

  const cumulativeProfit = useMemo(() => performanceHistory.reduce((acc, log) => {
    const last = acc.length > 0 ? acc[acc.length - 1].value : 0;
    acc.push({ name: acc.length.toString(), value: last + log.result });
    return acc;
  }, [] as { name: string, value: number }[]), [performanceHistory]);

  const playerWinProb = useMemo(() => {
    if (!gameState) return 0;
    const hero = gameState.players.find(p => p.id === 'player')!;
    if (hero.isFolded) return 0;
    return simulateWinProbability(hero.hand, gameState.communityCards, gameState.players.filter(p => !p.isFolded && p.id !== 'player').length, 200);
  }, [gameState]);

  if (!gameState) return null;

  const isActive = gameState.activePlayerIndex === gameState.players.findIndex(p => p.id === 'player');
  const hero = gameState.players.find(p => p.id === 'player')!;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row p-4 gap-4">
      {/* Sidebar: Analytics */}
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
              <i className="fas fa-microchip"></i>
              System Core
            </h2>
            <button 
              onClick={() => setCheatMode(!cheatMode)}
              className={`text-[10px] px-2 py-1 rounded-full font-bold border transition-all ${cheatMode ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
            >
              PRO HUD {cheatMode ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="h-40 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeProfit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis hide />
                <YAxis hide />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                   itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
               <div className="flex justify-between text-xs text-slate-400 mb-1">
                 <span>ROI (Est.)</span>
                 <span className="text-emerald-400">+12.4%</span>
               </div>
               <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                 <div className="bg-emerald-500 h-full" style={{ width: '65%' }}></div>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                 <p className="text-slate-500 text-[10px] uppercase font-bold">VPIP</p>
                 <p className="text-lg font-mono">
                   {hero.stats.handsPlayed > 0 ? Math.round((hero.stats.vpipCount / hero.stats.handsPlayed) * 100) : 0}%
                 </p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                 <p className="text-slate-500 text-[10px] uppercase font-bold">PFR</p>
                 <p className="text-lg font-mono">
                   {hero.stats.handsPlayed > 0 ? Math.round((hero.stats.pfrCount / hero.stats.handsPlayed) * 100) : 0}%
                 </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl overflow-hidden flex flex-col">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fas fa-stream text-blue-400"></i>
            Telemetry
          </h2>
          <div className="flex-grow overflow-y-auto space-y-2 text-xs font-mono custom-scrollbar pr-2">
            {logs.map((log, i) => (
              <div key={i} className={`p-2 rounded border-l-2 ${log.includes('wins') ? 'bg-emerald-900/10 border-emerald-500 text-emerald-300' : 'bg-slate-800/30 border-slate-600 text-slate-400'}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: The Table */}
      <div className="flex-grow flex flex-col gap-4">
        <div className="poker-felt relative w-full aspect-[4/3] rounded-[180px] md:rounded-[240px] flex items-center justify-center shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* HUD Overlay */}
          {cheatMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-50 animate-pulse">
               <span className="text-xs font-bold text-white/70">PROBABILITY: </span>
               <span className={`text-sm font-black ${(playerWinProb * 100) > 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                 {(playerWinProb * 100).toFixed(1)}%
               </span>
            </div>
          )}

          {/* Center Display */}
          <div className="text-center z-10 select-none">
            <div className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] mb-1">Live Pot</div>
            <div className="text-5xl md:text-7xl font-black text-white drop-shadow-2xl tracking-tighter">
              ${gameState.pot}
            </div>
            <div className="flex gap-2 justify-center mt-6 md:mt-10">
              {[0, 1, 2, 3, 4].map(i => (
                <CardUI key={i} card={gameState.communityCards[i]} hidden={i >= gameState.communityCards.length} className="scale-90 md:scale-100" />
              ))}
            </div>
          </div>

          {/* Players */}
          {gameState.players.map((p, i) => {
            const angle = (i * 360) / gameState.players.length;
            const x = Math.cos((angle - 90) * (Math.PI / 180)) * 40;
            const y = Math.sin((angle - 90) * (Math.PI / 180)) * 42;
            const isTurn = gameState.activePlayerIndex === i;

            return (
              <div 
                key={p.id}
                className="absolute transition-all duration-700"
                style={{ top: `${50 + y}%`, left: `${50 + x}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className={`flex flex-col items-center group ${p.isFolded ? 'opacity-30 grayscale scale-90' : ''}`}>
                  <div className={`flex -space-x-6 mb-3 transition-transform ${isTurn ? 'scale-110 -translate-y-2' : ''}`}>
                    {p.hand.map((c, j) => (
                      <CardUI key={j} card={c} hidden={p.isBot && gameState.stage !== GameStage.Showdown && !cheatMode} />
                    ))}
                  </div>
                  <div className={`relative px-4 py-2 rounded-2xl border-2 transition-all shadow-xl min-w-[100px] text-center ${
                    isTurn ? 'bg-slate-800 border-amber-400' : 'bg-slate-900 border-slate-700'
                  }`}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{p.name}</div>
                    <div className="text-md font-black text-white">${p.stack}</div>
                    {isTurn && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-400 rounded-full animate-pulse"></div>}
                  </div>
                  {p.currentBet > 0 && (
                     <div className="mt-2 bg-black/40 px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-mono text-amber-300">
                       BET: ${p.currentBet}
                     </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Console Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={() => handleAction('player', Action.Fold)}
                disabled={!isActive || hero.isFolded}
                className="flex-1 md:flex-none px-8 py-3 bg-slate-800 hover:bg-red-900/40 hover:text-red-400 hover:border-red-500/50 border border-slate-700 rounded-xl font-black text-sm transition-all disabled:opacity-30"
              >
                FOLD
              </button>
              <button 
                onClick={() => handleAction('player', gameState.lastRaiseAmount > hero.currentBet ? Action.Call : Action.Check)}
                disabled={!isActive || hero.isFolded}
                className="flex-1 md:flex-none px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-black text-sm transition-all disabled:opacity-30"
              >
                {gameState.lastRaiseAmount > hero.currentBet ? `CALL $${gameState.lastRaiseAmount - hero.currentBet}` : 'CHECK'}
              </button>
              <button 
                onClick={() => handleAction('player', Action.Raise, Math.max(gameState.lastRaiseAmount * 2, BIG_BLIND))}
                disabled={!isActive || hero.isFolded || hero.stack < BIG_BLIND}
                className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 rounded-xl font-black text-sm transition-all disabled:opacity-30"
              >
                RAISE
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={requestAiAnalysis}
                disabled={loadingAi || !isActive}
                className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-30"
              >
                {loadingAi ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain"></i>}
                GEMINI ADVICE
              </button>
              <div className="w-px h-10 bg-slate-800"></div>
              <button onClick={startNewHand} className="p-3 text-slate-500 hover:text-white transition-colors">
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: AI Lab */}
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col overflow-hidden">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-violet-400">
             <i className="fas fa-terminal"></i>
             Strategist Output
          </h2>
          <div className="flex-grow overflow-y-auto custom-scrollbar bg-black/30 rounded-xl p-4 text-[13px] font-mono leading-relaxed text-slate-300">
             {aiAnalysis ? (
               <div className="animate-in fade-in slide-in-from-bottom-2">
                 {aiAnalysis}
               </div>
             ) : (
               <div className="text-slate-600 italic text-center mt-20">
                 Awaiting strategic request...
                 <p className="text-[10px] mt-2 not-italic opacity-50 uppercase tracking-widest">Connect to neural link</p>
               </div>
             )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Risk Constraints</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Stop Loss</span>
              <span className="text-red-400 font-mono">-$2.5K</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Max Exposure</span>
              <span className="text-amber-400 font-mono">25% Pot</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Bot Logic</span>
              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold text-[10px]">EV-MONTE-CARLO</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .poker-felt {
          background: radial-gradient(circle at center, #065f46 0%, #064e3b 60%, #022c22 100%);
          box-shadow: inset 0 0 100px rgba(0,0,0,0.6);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
