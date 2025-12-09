
import React from 'react';
import type { Room } from '../types';

interface MatchmakingProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
  onCancel: () => void;
  currentRoomId: string | null;
}

const Matchmaking: React.FC<MatchmakingProps> = ({ rooms, onJoinRoom, onCancel, currentRoomId }) => {
  // 1〜15番の部屋IDを生成
  const roomIds = Array.from({ length: 15 }, (_, i) => `room-${i + 1}`);

  const getRoomInfo = (roomId: string) => {
    // 自分がこの部屋にいるかどうか
    const isMyRoom = currentRoomId === roomId;
    // 自分がどこかの部屋に入っているか（操作ロック用）
    const isLocked = currentRoomId !== null && !isMyRoom;

    const room = rooms.find(r => r.roomId === roomId);
    
    // 部屋データがない、または終了している場合は「空室」扱い
    if (!room || room.status === 'finished') {
        return {
            statusText: isMyRoom ? '待機中...' : '空室 (0/2)',
            styleClass: isMyRoom 
                ? 'bg-amber-900/80 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-pulse'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-300',
            icon: isMyRoom ? '⏳' : '🚪',
            isClickable: !isLocked, // ロックされてなければクリック可
            isLocked: isLocked
        };
    }
    
    // 誰かが待機中
    if (room.status === 'waiting') {
        return {
            statusText: isMyRoom ? '待機中...' : '募集中 (1/2)',
            styleClass: isMyRoom 
                 ? 'bg-amber-900/80 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-pulse'
                 : 'bg-green-900/80 hover:bg-green-800 border-green-500 text-green-200 animate-pulse',
            icon: isMyRoom ? '⏳' : '👤',
            isClickable: !isLocked,
            isLocked: isLocked
        };
    }
    
    // 対戦中
    return {
        statusText: '対戦中 (2/2)',
        styleClass: 'bg-red-900/50 border-red-800 text-red-400 opacity-60 cursor-not-allowed',
        icon: '⚔️',
        isClickable: false,
        isLocked: isLocked
    };
  };

  return (
    <div className="w-full h-full flex flex-col items-center p-4 bg-gray-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-6xl flex flex-col h-full">
         <div className="flex justify-between items-center mb-6 p-4 border-b border-gray-700 bg-gray-900/80 backdrop-blur-sm rounded-t-lg">
             <div>
                <h2 className="text-3xl font-bold text-amber-400">バトルロビー</h2>
                <p className="text-gray-400 text-sm">
                    {currentRoomId 
                        ? '対戦相手を待っています... (退出するには右上のボタンを押してください)' 
                        : '空いている部屋を選んで入室してください'}
                </p>
             </div>
             <button 
                onClick={onCancel} 
                className={`
                    px-6 py-2 rounded-full text-sm font-bold transition-all border
                    ${currentRoomId 
                        ? 'bg-red-900 hover:bg-red-800 border-red-500 text-white animate-pulse' 
                        : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-200'
                    }
                `}
             >
                {currentRoomId ? '退出する' : 'デッキ構築に戻る'}
             </button>
         </div>
         
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-y-auto p-4 custom-scrollbar flex-grow bg-gray-800/30 rounded-b-lg border border-t-0 border-gray-700">
             {roomIds.map(roomId => {
                 const info = getRoomInfo(roomId);
                 return (
                     <div 
                        key={roomId}
                        onClick={() => info.isClickable && onJoinRoom(roomId)}
                        className={`
                            relative h-40 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200
                            ${info.styleClass}
                            ${info.isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20' : ''}
                            ${info.isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                        `}
                     >
                        <div className="absolute top-2 left-3 font-mono text-xs opacity-50">{roomId.replace('room-', 'NO.')}</div>
                        <div className="text-4xl filter drop-shadow-md">{info.icon}</div>
                        <div className="font-bold text-lg tracking-wider">ROOM {roomId.replace('room-', '')}</div>
                        <div className="text-xs font-bold px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                            {info.statusText}
                        </div>
                     </div>
                 );
             })}
         </div>
      </div>
    </div>
  );
};

export default Matchmaking;
