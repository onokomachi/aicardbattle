
import React from 'react';

interface MatchmakingProps {
  onCancel: () => void;
  statusMessage: string;
}

const Matchmaking: React.FC<MatchmakingProps> = ({ onCancel, statusMessage }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-900/90 text-white relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
      
      <div className="z-10 flex flex-col items-center space-y-8 max-w-md w-full bg-gray-800 p-8 rounded-2xl border-2 border-amber-500/50 shadow-2xl animate-pulse">
        <h2 className="text-3xl font-bold text-amber-400">対戦相手を検索中...</h2>
        
        <div className="relative w-32 h-32">
           <div className="absolute inset-0 border-4 border-t-amber-500 border-r-transparent border-b-amber-500 border-l-transparent rounded-full animate-spin"></div>
           <div className="absolute inset-4 border-4 border-t-transparent border-r-blue-500 border-b-transparent border-l-blue-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
           <div className="absolute inset-0 flex items-center justify-center text-4xl">⚔️</div>
        </div>

        <p className="text-gray-300 text-center animate-bounce">{statusMessage}</p>

        <button 
          onClick={onCancel}
          className="mt-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded-full text-gray-300 transition-colors"
        >
          キャンセルして戻る
        </button>
      </div>
    </div>
  );
};

export default Matchmaking;
