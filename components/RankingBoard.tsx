
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface RankingUser {
  id: string;
  displayName: string;
  totalWins: number;
  totalMatches: number;
}

interface RankingBoardProps {
  onClose: () => void;
  db: any; // Firebase Firestore instance
}

const RankingBoard: React.FC<RankingBoardProps> = ({ onClose, db }) => {
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const usersRef = collection(db, "users");
        // 勝利数の多い順に上位10件を取得
        const q = query(usersRef, orderBy("totalWins", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        const users: RankingUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            id: doc.id,
            displayName: data.displayName || '名無しプレイヤー',
            totalWins: data.totalWins || 0,
            totalMatches: data.totalMatches || 0,
          });
        });
        setRankings(users);
      } catch (error) {
        console.error("Error fetching rankings:", error);
      } finally {
        setLoading(false);
      }
    };

    if (db) {
      fetchRankings();
    }
  }, [db]);

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-gray-800 border-2 border-amber-500 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 rounded-t-lg">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <span className="text-3xl">🏆</span> ランキング (TOP 10)
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold px-2"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="text-center text-white py-10 animate-pulse">データを読み込み中...</div>
          ) : rankings.length === 0 ? (
            <div className="text-center text-gray-400 py-10">ランキングデータがまだありません。</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="p-3 w-16 text-center">順位</th>
                  <th className="p-3">プレイヤー</th>
                  <th className="p-3 text-right">勝利数</th>
                  <th className="p-3 text-right">勝率</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((user, index) => {
                  const winRate = user.totalMatches > 0 
                    ? Math.round((user.totalWins / user.totalMatches) * 100) 
                    : 0;
                  
                  let rankColor = "text-white";
                  let rankIcon = "";
                  if (index === 0) { rankColor = "text-yellow-400"; rankIcon = "👑"; }
                  else if (index === 1) { rankColor = "text-gray-300"; rankIcon = "🥈"; }
                  else if (index === 2) { rankColor = "text-amber-600"; rankIcon = "🥉"; }

                  return (
                    <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className={`p-3 text-center font-bold text-xl ${rankColor}`}>
                        {rankIcon || index + 1}
                      </td>
                      <td className="p-3 font-medium text-white truncate max-w-[150px]">
                        {user.displayName}
                      </td>
                      <td className="p-3 text-right text-amber-300 font-bold">
                        {user.totalWins}勝
                      </td>
                      <td className="p-3 text-right text-gray-300 text-sm">
                        {winRate}% ({user.totalMatches}戦)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg text-center text-gray-400 text-sm">
          ランキングは対戦終了時に更新されます
        </div>
      </div>
    </div>
  );
};

export default RankingBoard;
