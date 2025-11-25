
import React, { useState, useMemo } from 'react';
import type { CardData } from '../types';
import Card from './Card';
import { DECK_SIZE, MAX_DUPLICATES } from '../constants';

interface DeckBuilderProps {
  unlockedCards: CardData[];
  onDeckSubmit: (deck: CardData[], mode: 'cpu' | 'pvp') => void;
  isGuest: boolean;
}

const DeckBuilder: React.FC<DeckBuilderProps> = ({ unlockedCards, onDeckSubmit, isGuest }) => {
  const [deck, setDeck] = useState<CardData[]>([]);
  
  const deckCardCounts = useMemo(() => {
    return deck.reduce((acc, card) => {
      acc[card.definitionId] = (acc[card.definitionId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }, [deck]);
  
  const poolCardCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const card of unlockedCards) {
        counts[card.definitionId] = MAX_DUPLICATES - (deckCardCounts[card.definitionId] || 0)
    }
    return counts;
  }, [unlockedCards, deckCardCounts]);

  const addCardToDeck = (cardDef: CardData) => {
    if (deck.length >= DECK_SIZE) {
      alert(`デッキは${DECK_SIZE}枚までです。`);
      return;
    }
    if ((deckCardCounts[cardDef.definitionId] || 0) >= MAX_DUPLICATES) {
      alert(`同じカードは${MAX_DUPLICATES}枚までしか入れられません。`);
      return;
    }
    setDeck(prev => [...prev, cardDef]);
  };

  const removeCardFromDeck = (cardToRemove: CardData, index: number) => {
    setDeck(prev => prev.filter((_, i) => i !== index));
  };
  
  const isDeckValid = deck.length === DECK_SIZE;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-white">
      <h1 className="text-5xl font-bold text-amber-300 drop-shadow-lg mb-2">デッキ構築</h1>
      <p className="text-lg text-gray-300 mb-6">アンロックしたカードから、{DECK_SIZE}枚のデッキを構築しよう！</p>
      
      <div className="w-full max-w-7xl flex-grow flex gap-6 overflow-hidden">
        {/* Card Pool */}
        <div className="w-1/2 flex flex-col bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h2 className="text-2xl font-bold text-amber-400 mb-4 text-center">カードプール ({unlockedCards.length}種類)</h2>
          <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2 custom-scrollbar">
            {unlockedCards.map((cardDef) => {
              const count = poolCardCounts[cardDef.definitionId] || 0;
              const isDimmed = count <= 0;
              return (
                 <div key={cardDef.definitionId} className="relative transform hover:scale-105 transition-transform" onClick={() => !isDimmed && addCardToDeck(cardDef)}>
                   <div className={`${isDimmed ? 'opacity-30' : 'cursor-pointer'}`}>
                      <Card card={cardDef} />
                   </div>
                   {!isDimmed && (
                     <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
                       {count}
                     </div>
                   )}
                 </div>
              );
            })}
          </div>
        </div>
        
        {/* Current Deck */}
        <div className="w-1/2 flex flex-col bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h2 className="text-2xl font-bold text-amber-400 mb-4 text-center">あなたのデッキ ({deck.length}/{DECK_SIZE})</h2>
          <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2 custom-scrollbar">
             {deck.map((card, index) => (
                <div key={index} className="relative transform hover:scale-105 transition-transform" onClick={() => removeCardFromDeck(card, index)}>
                    <div className="cursor-pointer">
                        <Card card={card} />
                    </div>
                </div>
             ))}
          </div>
        </div>
      </div>
      
       <div className="flex gap-4 mt-6">
          <button
            onClick={() => onDeckSubmit(deck, 'cpu')}
            disabled={!isDeckValid}
            className={`bg-gray-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 border border-gray-500
              ${!isDeckValid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'}`}
          >
            {isDeckValid ? 'CPU対戦 (練習)' : `あと ${DECK_SIZE - deck.length} 枚`}
          </button>

          <button
            onClick={() => onDeckSubmit(deck, 'pvp')}
            disabled={!isDeckValid || isGuest}
            className={`bg-gradient-to-r from-amber-600 to-red-600 text-white font-bold py-4 px-12 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg
              ${!isDeckValid || isGuest ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:shadow-amber-500/50'}`}
          >
            {isGuest ? '対人戦 (ログイン必須)' : isDeckValid ? 'ランクマッチ (対人戦)' : `あと ${DECK_SIZE - deck.length} 枚`}
          </button>
       </div>
    </div>
  );
};

export default DeckBuilder;
