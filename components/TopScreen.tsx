
import React from 'react';
import { User } from 'firebase/auth';

interface TopScreenProps {
  currentUser: User | null;
  onLogin: () => void;
  onGuestPlay: () => void;
  onStartGame: () => void;
  onLogout: () => void;
  onOpenGameMaster?: () => void; // Added prop
}

const TopScreen: React.FC<TopScreenProps> = ({ currentUser, onLogin, onGuestPlay, onStartGame, onLogout, onOpenGameMaster }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="z-10 text-center space-y-8 max-w-md w-full bg-gray-900/60 p-8 rounded-2xl border border-gray-700 backdrop-blur-sm shadow-2xl">
        {/* Title Section */}
        <div className="space-y-2">
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 drop-shadow-lg animate-glow-gold pb-2">
            AI CARD<br/>BATTLER
            </h1>
            <p className="text-gray-400 text-sm tracking-widest uppercase">Strategic Card Battle</p>
        </div>

        {/* Action Section */}
        <div className="space-y-4 pt-8">
          {currentUser ? (
            <div className="space-y-4 animate-level-up-reveal">
              <div className="flex flex-col items-center gap-2 mb-6">
                 {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="User" className="w-20 h-20 rounded-full border-4 border-amber-500 shadow-lg" />
                 ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-700 border-4 border-amber-500 flex items-center justify-center text-3xl">👤</div>
                 )}
                 <div className="text-white text-xl font-bold">
                    Welcome, <span className="text-amber-400">{currentUser.displayName}</span>!
                 </div>
              </div>
              
              <button
                onClick={onStartGame}
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold py-4 px-8 rounded-xl text-xl shadow-lg transform transition-all hover:scale-105 hover:shadow-amber-500/50 ring-2 ring-offset-2 ring-offset-gray-900 ring-amber-500"
              >
                冒険を続ける
              </button>
              
              <div className="flex justify-center gap-4 mt-4">
                 <button
                    onClick={onLogout}
                    className="text-gray-400 hover:text-white text-sm underline"
                 >
                    ログアウト
                 </button>
                 {onOpenGameMaster && (
                    <button
                        onClick={onOpenGameMaster}
                        className="text-red-400 hover:text-red-300 text-sm underline font-bold"
                    >
                        Game Master
                    </button>
                 )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-level-up-reveal">
              <button
                onClick={onLogin}
                className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-105"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                Googleアカウントで開始
              </button>
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-xs">または</span>
                <div className="flex-grow border-t border-gray-600"></div>
              </div>

              <button
                onClick={onGuestPlay}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 px-6 rounded-xl shadow transition-colors border border-gray-600"
              >
                ゲストとしてプレイ
                <span className="block text-xs font-normal text-gray-500 mt-1">データはブラウザに保存されます</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-4 text-gray-600 text-xs">
        Powered by Gemini & Firebase
      </div>
    </div>
  );
};

export default TopScreen;