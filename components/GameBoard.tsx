
import React, { useState, useEffect, useRef } from 'react';
import type { CardData, TurnPhase, BattleOutcome, AttributeCounts } from '../types';
import Card, { CardBack } from './Card';
import GameLog from './GameLog';
import { PassionIcon, CalmIcon, HarmonyIcon } from './Icons';

interface GameBoardProps {
  turnPhase: TurnPhase;
  playerHP: number;
  pcHP: number;
  playerHand: CardData[];
  pcHandSize: number;
  pcAttributeCount: AttributeCounts;
  playerDeckSize: number;
  pcDeckSize: number;
  playerPlayedCard: CardData | null;
  pcPlayedCard: CardData | null;
  onCardSelect: (card: CardData) => void;
  onBoardClick: () => void;
  selectedCardId: number | null;
  gameLog: string[];
  playerIsCasting: boolean;
  pcIsCasting: boolean;
  battleOutcome: { player: BattleOutcome; pc: BattleOutcome } | null;
}

const usePrevious = <T,>(value: T): T | undefined => {
    // FIX: Provide an initial value to `useRef` to fix the "Expected 1 arguments, but got 0" error.
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
};


const HealthBar: React.FC<{ current: number; max: number; label: string }> = ({ current, max, label }) => {
    const percentage = Math.max(0, (current / max) * 100);
    const [animationClass, setAnimationClass] = useState('');
    const prevHp = usePrevious(current);

    useEffect(() => {
        if (prevHp === undefined) return;
        if (current < prevHp) {
            setAnimationClass('animate-glow-red animate-shake');
        } else if (current > prevHp) {
            setAnimationClass('animate-glow-green');
        }

        if (animationClass) {
            const timer = setTimeout(() => setAnimationClass(''), 1000);
            return () => clearTimeout(timer);
        }
    }, [current, prevHp]);

    return (
        <div className={`w-64 bg-gray-700 rounded-full h-8 border-2 border-gray-600 shadow-inner p-1 ${animationClass}`}>
            <div className="relative h-full">
                <div
                    className="bg-gradient-to-r from-red-500 to-red-700 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                ></div>
                <div className="absolute inset-0 flex justify-between items-center px-4">
                    <span className="font-bold text-white text-sm drop-shadow-md">{label}</span>
                    <span className="font-bold text-white text-lg drop-shadow-md">{current} / {max}</span>
                </div>
            </div>
        </div>
    );
};

const AttributeTracker: React.FC<{ counts: AttributeCounts }> = ({ counts }) => {
  return (
    <div className="flex items-center space-x-3 bg-black/30 px-3 py-1 rounded-full border border-gray-600 h-8">
      <div className="flex items-center space-x-1" title={`Passion: ${counts.passion}`}>
        <PassionIcon className="w-5 h-5 text-red-400" />
        <span className="text-white font-bold text-sm">{counts.passion}</span>
      </div>
      <div className="flex items-center space-x-1" title={`Calm: ${counts.calm}`}>
        <CalmIcon className="w-5 h-5 text-blue-400" />
        <span className="text-white font-bold text-sm">{counts.calm}</span>
      </div>
      <div className="flex items-center space-x-1" title={`Harmony: ${counts.harmony}`}>
        <HarmonyIcon className="w-5 h-5 text-green-400" />
        <span className="text-white font-bold text-sm">{counts.harmony}</span>
      </div>
    </div>
  );
};


const DeckCounter: React.FC<{ count: number }> = ({ count }) => (
    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-sm font-bold px-3 py-1 rounded-tl-lg">
        山札: {count}
    </div>
);


const GameBoard: React.FC<GameBoardProps> = ({
  turnPhase,
  playerHP,
  pcHP,
  playerHand,
  pcHandSize,
  pcAttributeCount,
  playerDeckSize,
  pcDeckSize,
  playerPlayedCard,
  pcPlayedCard,
  onCardSelect,
  onBoardClick,
  selectedCardId,
  gameLog,
  playerIsCasting,
  pcIsCasting,
  battleOutcome
}) => {
  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-4 relative overflow-hidden" onClick={onBoardClick}>
      
      {/* Waiting Indicator */}
      {turnPhase === 'waiting_for_opponent' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-black/70 px-6 py-4 rounded-xl border border-amber-500/50 flex flex-col items-center gap-2 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                <div className="text-amber-200 font-bold text-lg animate-pulse shadow-black drop-shadow-md">
                   対戦相手のカード選択を<br/>待っています...
                </div>
            </div>
        </div>
      )}

      {/* PC Area */}
      <div className="w-full flex justify-center items-center flex-col space-y-4">
        <div className="flex items-center space-x-4">
            <HealthBar current={pcHP} max={20} label="相手" />
            <AttributeTracker counts={pcAttributeCount} />
        </div>
        <div className="flex justify-center items-center h-40 space-x-2">
            {[...Array(pcHandSize)].map((_, i) => (
              <div key={i} className="opacity-70 relative">
                <CardBack />
                {i === 0 && <DeckCounter count={pcDeckSize} />}
              </div>
            ))}
        </div>
      </div>

      {/* Battle Field */}
      <div className="w-full flex justify-center items-center h-[18rem] space-x-8">
        <div className="w-48 h-72 flex items-center justify-center">
            {playerPlayedCard && (
              <Card 
                card={playerPlayedCard} 
                isCastingEffect={playerIsCasting}
                isBattling={turnPhase === 'battle_animation'}
                battleOutcome={battleOutcome?.player ?? null}
                owner='player'
              />
            )}
        </div>
        <div className="text-amber-400 text-4xl font-black">VS</div>
        <div className="w-48 h-72 flex items-center justify-center">
            {pcPlayedCard && (
              <Card 
                card={pcPlayedCard} 
                isCastingEffect={pcIsCasting}
                isBattling={turnPhase === 'battle_animation'}
                battleOutcome={battleOutcome?.pc ?? null}
                owner='pc'
              />
            )}
        </div>
      </div>

      {/* Player Area */}
      <div className="w-full flex justify-center items-center flex-col space-y-4">
         <div className="h-72 flex justify-center items-end space-x-[-4rem] pb-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative mr-4">
                <CardBack />
                <DeckCounter count={playerDeckSize} />
            </div>
            {playerHand.map(card => (
              <Card 
                key={card.id} 
                card={card}
                onClick={() => onCardSelect(card)}
                isPlayable={turnPhase === 'player_turn'}
                inHand={true}
                isSelected={selectedCardId === card.id}
              />
            ))}
        </div>
        <HealthBar current={playerHP} max={20} label="あなた" />
      </div>

      <GameLog messages={gameLog} />
    </div>
  );
};

export default GameBoard;
