import React, { useState } from 'react';
import type { BattleOutcome, CardData } from '../types';
import { AttackIcon, DefenseIcon } from './Icons';

interface CardProps {
  card: CardData;
  onClick?: () => void;
  isPlayable?: boolean;
  inHand?: boolean;
  isSelected?: boolean;
  isCastingEffect?: boolean;
  isBattling?: boolean;
  battleOutcome?: BattleOutcome;
  owner?: 'player' | 'pc';
}

const Card: React.FC<CardProps> = ({ 
  card, 
  onClick, 
  isPlayable = false, 
  inHand = false,
  isSelected = false,
  isCastingEffect = false,
  isBattling = false,
  battleOutcome = null,
  owner = 'player'
}) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `Image2/${card.image}`;

  const handleImageError = () => {
    setImageError(true);
  };

  const attributeStyles = {
    passion: 'border-red-500 hover:shadow-red-500/50',
    calm: 'border-blue-500 hover:shadow-blue-500/50',
    harmony: 'border-green-500 hover:shadow-green-500/50',
  };

  let battleAnimationClass = '';
  if (isBattling) {
    if (battleOutcome === 'win') {
      battleAnimationClass = owner === 'player' ? 'animate-attack-win-player' : 'animate-attack-win-pc';
    } else if (battleOutcome === 'lose') {
      battleAnimationClass = 'animate-lose-battle';
    } else if (battleOutcome === 'draw') {
      battleAnimationClass = 'animate-shake';
    }
  }

  const cardClasses = `
    w-48 h-72 bg-gray-800 border-2 rounded-lg shadow-lg flex flex-col justify-between p-2 transition-all duration-300 transform relative
    ${attributeStyles[card.attribute]}
    ${isPlayable ? 'cursor-pointer hover:shadow-amber-400/50' : ''}
    ${isSelected ? 'scale-125 -translate-y-8 z-50 shadow-amber-400/50' : inHand ? 'hover:scale-125 hover:-translate-y-8 hover:z-50' : ''}
    ${isCastingEffect ? 'animate-glow-gold z-10' : ''}
    ${battleAnimationClass}
  `;

  return (
    <div className={cardClasses} onClick={isPlayable ? onClick : undefined}>
      {card.level && card.level > 1 && (
        <div className="absolute top-1 right-1 bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg border-2 border-white/50 z-10" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }}>
          Lv.{card.level}
        </div>
      )}
      <div className="text-center text-white font-bold text-sm truncate">{card.name}</div>
      <div className="flex-grow my-1 bg-gray-900 rounded-md flex items-center justify-center overflow-hidden">
        {imageError ? (
          <div className="text-gray-400 text-xs text-center p-2">画像がまだありません</div>
        ) : (
          <img 
            src={imageUrl} 
            alt={card.name} 
            className="w-full h-full object-cover" 
            onError={handleImageError} 
          />
        )}
      </div>
       <div className="h-12 flex items-center justify-center p-1">
        <p className="text-gray-300 text-xs text-center italic">{card.description}</p>
      </div>
      <div className="flex justify-around items-center text-white">
        <div className="flex items-center space-x-1 bg-red-500/50 px-2 py-1 rounded-full">
          <AttackIcon className="w-4 h-4" />
          <span className="font-bold text-lg">{card.attack}</span>
        </div>
        <div className="flex items-center space-x-1 bg-blue-500/50 px-2 py-1 rounded-full">
          <DefenseIcon className="w-4 h-4" />
          <span className="font-bold text-lg">{card.defense}</span>
        </div>
      </div>
    </div>
  );
};

export const CardBack: React.FC = () => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `Image2/11.jpg`;

  const handleError = () => {
    setImageError(true);
  };
  
  return (
    <div className="w-48 h-72 bg-gray-800 border-2 border-purple-500 rounded-lg shadow-lg flex items-center justify-center p-1 overflow-hidden">
       {imageError ? (
         <div className="w-full h-full border-2 border-purple-400/50 rounded-md flex items-center justify-center">
            <svg className="w-16 h-16 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
         </div>
       ) : (
         <img src={imageUrl} alt="Card Back" className="w-full h-full object-cover rounded-md" onError={handleError} />
       )}
    </div>
  );
}

export default Card;