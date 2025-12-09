
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import type { Room } from '../types';

interface UserData {
  id: string;
  displayName: string;
  email: string;
  totalWins: number;
  totalMatches: number;
  unlockedCardIds: number[];
  createdAt: any;
}

interface GameMasterProps {
  db: any;
  onClose: () => void;
}

const GameMaster: React.FC<GameMasterProps> = ({ db, onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'rooms'>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // ユーザー監視
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'users'), orderBy('totalWins', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserData[] = [];
      snapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsers(userList);
    });
    return () => unsubscribe();
  }, [db]);

  // ルーム監視
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomList: Room[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // IDの補完
        if (!data.roomId) data.roomId = doc.id;
        roomList.push(data as Room);
      });
      setRooms(roomList);
    });
    return () => unsubscribe();
  }, [db]);

  const handleResetStats = async (userId: string, userName: string) => {
    if (!confirm(`ユーザー「${userName}」の戦績（勝利数・対戦数）をリセットしますか？\nランキングから削除されますが、アカウントやカードは残ります。`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        totalWins: 0,
        totalMatches: 0
      });
      alert('戦績をリセットしました。');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました。');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmation = prompt(`警告：ユーザー「${userName}」を完全に削除しようとしています。\n実行するには削除対象のユーザー名を入力してください。`);
    if (confirmation !== userName) {
      if (confirmation !== null) alert('ユーザー名が一致しません。');
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert('ユーザーを削除しました。');
    } catch (e) {
      console.error(e);
      alert('削除に失敗しました（認証基盤側の削除はFirebase Consoleで行ってください）。');
    }
  };

  const handleForceCloseRoom = async (roomId: string) => {
    if (!confirm(`ルーム「${roomId}」を強制終了しますか？`)) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'finished',
        winnerId: 'admin_terminated' // 管理者による終了
      });
      alert('ルームを終了状態にしました。');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました。');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP');
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white overflow-hidden flex flex-col relative">
       {/* Header */}
       <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center shadow-lg z-10">
         <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-red-500 flex items-center gap-2">
                <span>🛠️</span> Game Master Console
            </h1>
            <div className="flex space-x-2 bg-gray-900 rounded-lg p-1">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-1 rounded-md transition-colors ${activeTab === 'users' ? 'bg-gray-700 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                >
                    ユーザー管理
                </button>
                <button 
                    onClick={() => setActiveTab('rooms')}
                    className={`px-4 py-1 rounded-md transition-colors ${activeTab === 'rooms' ? 'bg-gray-700 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                >
                    ルーム管理
                </button>
            </div>
         </div>
         <button 
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-bold border border-gray-500"
         >
            コンソールを閉じる
         </button>
       </div>

       {/* Content */}
       <div className="flex-grow overflow-hidden p-6 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 pointer-events-none"></div>

          {activeTab === 'users' && (
            <div className="h-full flex flex-col bg-gray-800/80 border border-gray-700 rounded-lg shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="font-bold text-lg text-amber-400">登録ユーザー一覧 ({users.length})</h2>
                    <p className="text-xs text-gray-400">※勝利数順でソートされています。</p>
                </div>
                <div className="flex-grow overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 text-gray-400 text-sm sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-3 w-16 text-center">順位</th>
                                <th className="p-3">ユーザー名 / ID</th>
                                <th className="p-3">戦績 (勝/戦)</th>
                                <th className="p-3">カード取得数</th>
                                <th className="p-3">登録日</th>
                                <th className="p-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {users.map((user, idx) => (
                                <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="p-3 text-center font-mono text-gray-500">{idx + 1}</td>
                                    <td className="p-3">
                                        <div className="font-bold text-white">{user.displayName || '名無し'}</div>
                                        <div className="text-xs text-gray-500 font-mono select-all">{user.id}</div>
                                        <div className="text-xs text-gray-500 select-all">{user.email}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className="text-amber-400 font-bold">{user.totalWins}勝</span> 
                                        <span className="text-gray-400 text-sm"> / {user.totalMatches}戦</span>
                                    </td>
                                    <td className="p-3 text-sm">
                                        {user.unlockedCardIds?.length || 0}枚
                                    </td>
                                    <td className="p-3 text-xs text-gray-400">
                                        {formatDate(user.createdAt)}
                                    </td>
                                    <td className="p-3 text-center space-x-2">
                                        <button 
                                            onClick={() => handleResetStats(user.id, user.displayName)}
                                            className="bg-orange-900/80 hover:bg-orange-800 text-orange-200 border border-orange-700 px-3 py-1 rounded text-xs"
                                            title="ランキングから削除されます"
                                        >
                                            戦績リセット
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id, user.displayName)}
                                            className="bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700 px-3 py-1 rounded text-xs"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {activeTab === 'rooms' && (
             <div className="h-full flex flex-col bg-gray-800/80 border border-gray-700 rounded-lg shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between">
                    <div>
                        <h2 className="font-bold text-lg text-green-400">ルーム一覧 ({rooms.length})</h2>
                        <p className="text-xs text-gray-400">※直近の作成順です。古すぎる「待機中」や「プレイ中」の部屋はゾンビの可能性があります。</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="text-xs bg-gray-700 px-2 py-1 rounded text-white">更新</button>
                </div>
                <div className="flex-grow overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 text-gray-400 text-sm sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-3">Room ID</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Host / Guest</th>
                                <th className="p-3">Active (Updated)</th>
                                <th className="p-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {rooms.map((room) => {
                                const isFinished = room.status === 'finished';
                                const isActive = !isFinished;
                                // 最終更新確認
                                const lastActive = room.hostLastActive || room.createdAt;

                                return (
                                <tr key={room.roomId} className={`hover:bg-gray-700/50 transition-colors ${isFinished ? 'opacity-50 grayscale' : ''}`}>
                                    <td className="p-3 font-mono text-xs select-all text-gray-300">
                                        {room.roomId}
                                        <div className="text-gray-500 text-[10px]">Round: {room.round}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`
                                            px-2 py-1 rounded text-xs font-bold
                                            ${room.status === 'playing' ? 'bg-red-900 text-red-200' : ''}
                                            ${room.status === 'waiting' ? 'bg-green-900 text-green-200' : ''}
                                            ${room.status === 'finished' ? 'bg-gray-700 text-gray-400' : ''}
                                        `}>
                                            {room.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm">
                                        <div className="text-amber-200">Host: {room.hostName || room.hostId}</div>
                                        <div className="text-blue-200">Guest: {room.guestName || (room.guestId ? room.guestId : '---')}</div>
                                    </td>
                                    <td className="p-3 text-xs text-gray-400">
                                        Last: {formatDate(lastActive)}
                                        <div className="text-[10px]">Created: {formatDate(room.createdAt)}</div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {isActive && (
                                            <button 
                                                onClick={() => handleForceCloseRoom(room.roomId)}
                                                className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs shadow"
                                            >
                                                強制終了
                                            </button>
                                        )}
                                        {isFinished && room.winnerId && (
                                            <span className="text-xs text-gray-500">Winner: {room.winnerId}</span>
                                        )}
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
          )}
       </div>
    </div>
  );
};

export default GameMaster;
