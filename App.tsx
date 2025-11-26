
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment, arrayUnion, query, where, limit, getDocs, onSnapshot } from 'firebase/firestore';
import TopScreen from './components/TopScreen';
import DeckBuilder from './components/DeckBuilder';
import Matchmaking from './components/Matchmaking';
import GameBoard from './components/GameBoard';
import RankingBoard from './components/RankingBoard';
import type { CardData, GameState, TurnPhase, BattleOutcome, AttributeCounts, Room, Attribute } from './types';
import { INITIAL_HP, HAND_SIZE, DECK_SIZE, INITIAL_UNLOCKED_CARDS, CardCatalogById, CARD_DEFINITIONS } from './constants';
import LevelUpAnimation from './components/LevelUpAnimation';

// Restore configuration: Use VITE_API_KEY from environment, hardcode others for public client config
const firebaseConfig = {
  // Correctly access VITE_API_KEY with fallback for safety
  apiKey: (import.meta as any)?.env?.VITE_API_KEY || process.env.API_KEY,
  authDomain: "aicardbattle.firebaseapp.com",
  projectId: "aicardbattle",
  storageBucket: "aicardbattle.firebasestorage.app",
  messagingSenderId: "1028749273607",
  appId: "1:1028749273607:web:f58e225bbc1fc68bea58a2"
};

// Initialize Firebase
let app;
let auth: any;
let db: any;
let googleProvider: any;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  // Debug log to confirm correct loading and trigger redeploy
  console.log("Firebase initialized. API Key present:", !!firebaseConfig.apiKey);
} catch (error) {
  console.warn("Firebase initialization skipped or failed. App will run in offline mode.", error);
}

// Helper Functions
const shuffleDeck = (deck: CardData[]): CardData[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const getAttributeMatchup = (attacker: Attribute, defender: Attribute): 'advantage' | 'disadvantage' | 'neutral' => {
  if (attacker === defender) return 'neutral';
  // Passion > Harmony > Calm > Passion
  if (
    (attacker === 'passion' && defender === 'harmony') ||
    (attacker === 'harmony' && defender === 'calm') ||
    (attacker === 'calm' && defender === 'passion')
  ) {
    return 'advantage';
  }
  return 'disadvantage';
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState<GameState>('login_screen');
  const [gameMode, setGameMode] = useState<'cpu' | 'pvp'>('cpu');
  const [unlockedCardIds, setUnlockedCardIds] = useState<number[]>([]);
  
  // Game State
  const [playerDeck, setPlayerDeck] = useState<CardData[]>([]);
  const [pcDeck, setPcDeck] = useState<CardData[]>([]);
  const [playerHand, setPlayerHand] = useState<CardData[]>([]);
  const [pcHand, setPcHand] = useState<CardData[]>([]);
  const [playerHP, setPlayerHP] = useState(INITIAL_HP);
  const [pcHP, setPcHP] = useState(INITIAL_HP);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('player_turn');
  const [pcAttributeCount, setPcAttributeCount] = useState<AttributeCounts>({ passion: 0, calm: 0, harmony: 0 });
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [playerPlayedCard, setPlayerPlayedCard] = useState<CardData | null>(null);
  const [pcPlayedCard, setPcPlayedCard] = useState<CardData | null>(null);
  const [battleOutcome, setBattleOutcome] = useState<{ player: BattleOutcome; pc: BattleOutcome } | null>(null);
  const [playerIsCasting, setPlayerIsCasting] = useState(false);
  const [pcIsCasting, setPcIsCasting] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  // Level Up
  const [levelUpMap, setLevelUpMap] = useState<Record<number, number>>({});
  const [levelUpAnimationData, setLevelUpAnimationData] = useState<{ from: CardData; to: CardData; } | null>(null);
  const nextCardInstanceId = useRef(0);
  const postAnimationCallback = useRef<(() => void) | null>(null);

  // UI State
  const [showRanking, setShowRanking] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  
  // PvP State
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);

  const addLog = useCallback((message: string) => {
    setGameLog(prev => [...prev, message]);
  }, []);

  useEffect(() => {
    if (!auth) {
        const saved = localStorage.getItem('ai-card-battler-unlocked');
        if (saved) {
            setUnlockedCardIds(JSON.parse(saved));
        } else {
            setUnlockedCardIds(INITIAL_UNLOCKED_CARDS);
        }
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        if (db) {
            const userRef = doc(db, "users", u.uid);
            try {
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.unlockedCardIds && Array.isArray(data.unlockedCardIds)) {
                   setUnlockedCardIds(data.unlockedCardIds);
                   localStorage.setItem('ai-card-battler-unlocked', JSON.stringify(data.unlockedCardIds));
                }
                if (data.displayName !== u.displayName || data.photoURL !== u.photoURL) {
                   await updateDoc(userRef, { displayName: u.displayName, photoURL: u.photoURL });
                }
              } else {
                const initialUnlocks = INITIAL_UNLOCKED_CARDS;
                await setDoc(userRef, {
                  displayName: u.displayName || 'Anonymous',
                  photoURL: u.photoURL || '',
                  email: u.email || '',
                  totalWins: 0,
                  totalMatches: 0,
                  unlockedCardIds: initialUnlocks,
                  createdAt: serverTimestamp()
                });
                setUnlockedCardIds(initialUnlocks);
              }
            } catch (e) {
              console.error("Error syncing user profile:", e);
            }
          }
      } else {
        setUser(null);
        const saved = localStorage.getItem('ai-card-battler-unlocked');
        if (saved) setUnlockedCardIds(JSON.parse(saved));
        else setUnlockedCardIds(INITIAL_UNLOCKED_CARDS);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert("ログインに失敗しました。承認済みドメインを確認してください。");
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    setGameState('login_screen');
  };

  const saveUnlockedCard = useCallback(async (newCardId: number) => {
    setUnlockedCardIds(prev => {
      if (prev.includes(newCardId)) return prev;
      const newUnlocked = [...prev, newCardId].sort((a,b) => a - b);
      localStorage.setItem('ai-card-battler-unlocked', JSON.stringify(newUnlocked));
      return newUnlocked;
    });
    addLog(`【カードアンロック！】 「${CardCatalogById[newCardId].name}」がデッキ構築で使えるようになりました！`);
    if (user && db) {
        updateDoc(doc(db, "users", user.uid), { unlockedCardIds: arrayUnion(newCardId) }).catch(console.error);
    }
  }, [addLog, user]);

  // --- Matchmaking Logic ---
  const startMatchmaking = async (deck: CardData[]) => {
    if (!db || !user) return;
    setGameState('matchmaking');
    setMatchStatus('対戦可能な部屋を探しています...');
    setIsHost(false);

    try {
      const roomsRef = collection(db, 'rooms');
      const q = query(roomsRef, where('status', '==', 'waiting'), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Join existing room
        const roomDoc = querySnapshot.docs[0];
        if (roomDoc.data().hostId === user.uid) {
           await updateDoc(doc(db, 'rooms', roomDoc.id), { status: 'finished' });
           // Fallback to create
        } else {
            setMatchStatus('対戦相手が見つかりました！入室中...');
            await updateDoc(doc(db, 'rooms', roomDoc.id), {
              guestId: user.uid,
              guestName: user.displayName,
              status: 'playing',
              guestReady: false,
              p1Hp: INITIAL_HP,
              p2Hp: INITIAL_HP
            });
            setCurrentRoomId(roomDoc.id);
            setIsHost(false);
            listenToRoom(roomDoc.id);
            return;
        }
      }

      // Create new room
      setMatchStatus('対戦相手を待っています...');
      const newRoomRef = await addDoc(collection(db, 'rooms'), {
        status: 'waiting',
        hostId: user.uid,
        hostName: user.displayName,
        guestId: null,
        guestName: null,
        createdAt: serverTimestamp(),
        hostReady: false,
        guestReady: false,
        round: 1,
        p1Move: null,
        p2Move: null,
        p1Hp: INITIAL_HP,
        p2Hp: INITIAL_HP,
        winnerId: null
      });
      setCurrentRoomId(newRoomRef.id);
      setIsHost(true);
      listenToRoom(newRoomRef.id);

    } catch (e) {
      console.error("Matchmaking error:", e);
      setMatchStatus('エラーが発生しました。');
    }
  };

  const listenToRoom = (roomId: string) => {
    if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();

    const roomRef = doc(db, 'rooms', roomId);
    unsubscribeRoomRef.current = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as Room;

      if (data.status === 'playing' && gameState === 'matchmaking') {
        setMatchStatus('マッチング成立！バトルを開始します！');
        setCurrentRound(1);
        setTimeout(() => {
             const pcDeckDefs = CARD_DEFINITIONS.slice(0, 10).flatMap(def => [def, def]);
             startGame(playerDeck, pcDeckDefs); 
             setGameState('in_game');
        }, 1500);
      }

      if (gameState === 'in_game' && data.status === 'playing') {
          // Sync HP
          if (isHost) {
              setPlayerHP(data.p1Hp);
              setPcHP(data.p2Hp);
          } else {
              setPlayerHP(data.p2Hp);
              setPcHP(data.p1Hp);
          }

          // Sync Moves
          const opponentMove = isHost ? data.p2Move : data.p1Move;
          const myMoveOnServer = isHost ? data.p1Move : data.p2Move;

          if (opponentMove && !pcPlayedCard) {
              setPcPlayedCard(opponentMove);
              addLog("相手がカードを選びました。");
          }

          if (myMoveOnServer && opponentMove && turnPhase !== 'resolution_phase' && turnPhase !== 'battle_animation') {
              setTurnPhase('resolution_phase');
          }

          // Round Reset
          if (data.round > currentRound) {
             setCurrentRound(data.round);
             drawCardsAfterBattle();
             setPlayerPlayedCard(null); 
             setPcPlayedCard(null);
             setTurnPhase('player_turn'); 
             addLog(`ターン ${data.round} 開始！`);
          }

          // Game End
          if (data.winnerId) {
             if (data.winnerId === 'draw') setWinner("引き分けです！");
             else if (data.winnerId === 'host' && isHost) setWinner("あなたの勝ちです！");
             else if (data.winnerId === 'guest' && !isHost) setWinner("あなたの勝ちです！");
             else setWinner("あなたの負けです…");
             setGameState('end');
          }
      }
    });
  };

  const cancelMatchmaking = async () => {
    if (unsubscribeRoomRef.current) {
        unsubscribeRoomRef.current();
        unsubscribeRoomRef.current = null;
    }
    if (currentRoomId && db) {
        try {
            const roomRef = doc(db, 'rooms', currentRoomId);
            const snap = await getDoc(roomRef);
            if (snap.exists() && snap.data().hostId === user?.uid && snap.data().status === 'waiting') {
                await updateDoc(roomRef, { status: 'finished' });
            }
        } catch(e) { console.error("Error cancelling room", e); }
    }
    setCurrentRoomId(null);
    setGameState('deck_building');
  };

  const createNewCardInstance = useCallback((definitionId: number): CardData => {
    const definition = CardCatalogById[definitionId];
    const newId = nextCardInstanceId.current++;
    return { ...definition, id: newId };
  }, []);

  const handleDeckSubmit = (deck: CardData[], mode: 'cpu' | 'pvp') => {
      setPlayerDeck(deck);
      setGameMode(mode);
      
      if (mode === 'cpu') {
          const pcDeckDefs = CARD_DEFINITIONS.slice(0, 10).flatMap(def => [def, def]);
          startGame(deck, pcDeckDefs);
          setGameState('in_game');
      } else {
          startMatchmaking(deck);
      }
  };

  const startGame = useCallback((playerDeckSetup: CardData[], pcDeckSetup: CardData[]) => {
    nextCardInstanceId.current = 0;
    
    const pDeck = playerDeckSetup.map(card => createNewCardInstance(card.definitionId));
    const cDeck = pcDeckSetup.map(card => createNewCardInstance(card.definitionId));
    
    const shuffledPlayerDeck = shuffleDeck(pDeck);
    const shuffledPcDeck = shuffleDeck(cDeck);

    setPlayerDeck(shuffledPlayerDeck.slice(HAND_SIZE));
    setPcDeck(shuffledPcDeck.slice(HAND_SIZE));
    setPlayerHand(shuffledPlayerDeck.slice(0, HAND_SIZE));
    setPcHand(shuffledPcDeck.slice(0, HAND_SIZE));
    
    setPlayerHP(INITIAL_HP);
    setPcHP(INITIAL_HP);
    setTurnPhase('player_turn');
    setGameLog(['ゲーム開始！あなたのターンです。']);
    setPlayerPlayedCard(null);
    setPcPlayedCard(null);
    setSelectedCardId(null);
    setWinner(null);
    setBattleOutcome(null);
    setPlayerIsCasting(false);
    setPcIsCasting(false);
    setLevelUpMap({});
    setLevelUpAnimationData(null);
  }, [createNewCardInstance]);

  const getUpgradedCardInstance = useCallback((cardToDraw: CardData): CardData => {
    const baseId = cardToDraw.baseDefinitionId;
    const highestLevelId = levelUpMap[baseId];
    const defId = highestLevelId ? highestLevelId : cardToDraw.definitionId;
    return createNewCardInstance(defId);
  }, [levelUpMap, createNewCardInstance]);

  const endGameByDeckOut = () => {
    addLog("山札が尽きました！HPが高い方の勝利です。");
    if (gameMode === 'pvp') {
       if (isHost && currentRoomId && db) {
           let wId = 'draw';
           if (playerHP > pcHP) wId = 'host';
           else if (pcHP > playerHP) wId = 'guest';
           updateDoc(doc(db, 'rooms', currentRoomId), { winnerId: wId });
       }
       return; 
    }
    // CPU Mode
    if (playerHP > pcHP) setWinner(`あなたの勝ちです！ (${playerHP} vs ${pcHP})`);
    else if (pcHP > playerHP) setWinner(`あなたの負けです… (${playerHP} vs ${pcHP})`);
    else setWinner(`引き分けです！ (${playerHP} vs ${pcHP})`);
    setGameState('end');
  };

  const drawCardsAfterBattle = useCallback(() => {
    setPlayerDeck(d => {
        if(d.length < 1) { endGameByDeckOut(); return d;}
        const card = getUpgradedCardInstance(d[0]);
        setPlayerHand(h => [...h, card]);
        return d.slice(1);
    });
    setPcDeck(d => {
        if(d.length < 1) { endGameByDeckOut(); return d;}
        const card = getUpgradedCardInstance(d[0]);
        setPcHand(h => [...h, card]);
        return d.slice(1);
    });
  }, [getUpgradedCardInstance, gameMode, isHost, currentRoomId, playerHP, pcHP]);


  const resolveBattle = useCallback(() => {
    if (!playerPlayedCard || !pcPlayedCard) return;
    const matchup = getAttributeMatchup(playerPlayedCard.attribute, pcPlayedCard.attribute);
    let playerAttack = playerPlayedCard.attack;
    let pcAttack = pcPlayedCard.attack;
    let pOutcome: BattleOutcome, pcOutcome: BattleOutcome;
    let damageToPc = 0; let damageToPlayer = 0;

    if (matchup === 'advantage') {
      addLog(`【属性有利】 相手の攻撃はあなたに通じない！`);
      damageToPc = Math.max(0, playerAttack - pcPlayedCard.defense);
    } else if (matchup === 'disadvantage') {
      addLog(`【属性不利】 あなたの攻撃は相手に通じない！`);
      damageToPlayer = Math.max(0, pcAttack - playerPlayedCard.defense);
    } else {
      addLog("属性は互角！純粋な力のぶつかり合いだ！");
      damageToPc = Math.max(0, playerAttack - pcPlayedCard.defense);
      damageToPlayer = Math.max(0, pcAttack - playerPlayedCard.defense);
    }

    if (damageToPc > damageToPlayer) { pOutcome = 'win'; pcOutcome = 'lose'; } 
    else if (damageToPlayer > damageToPc) { pOutcome = 'lose'; pcOutcome = 'win'; } 
    else if (damageToPc > 0) { pOutcome = 'win'; pcOutcome = 'lose'; } 
    else if (damageToPlayer > 0) { pOutcome = 'lose'; pcOutcome = 'win'; }
    else { pOutcome = 'draw'; pcOutcome = 'draw'; }

    addLog(`あなたの攻撃は${damageToPc}ダメージ、相手の攻撃は${damageToPlayer}ダメージ。`);
    setBattleOutcome({ player: pOutcome, pc: pcOutcome });

    const newPcHp = pcHP - damageToPc;
    const newPlayerHp = playerHP - damageToPlayer;
    
    const continueGameLogic = () => {
      setBattleOutcome(null);

      // CPU Mode
      if (gameMode === 'cpu') {
         setPcHP(newPcHp); setPlayerHP(newPlayerHp);
         if (newPlayerHp <= 0 || newPcHp <= 0) {
             if (newPlayerHp <= 0 && newPcHp <= 0) setWinner("引き分けです！");
             else if (newPlayerHp <= 0) setWinner("あなたの負けです…");
             else setWinner("あなたの勝ちです！");
             setGameState('end');
         } else {
            drawCardsAfterBattle();
            setPlayerPlayedCard(null); setPcPlayedCard(null);
            setTurnPhase('player_turn'); addLog("あなたのターンです。");
         }
         return;
      }

      // PvP Mode (Host Authority)
      if (gameMode === 'pvp' && currentRoomId && db) {
         if (isHost) {
             let wId = null;
             if (newPlayerHp <= 0 || newPcHp <= 0) {
                 if (newPlayerHp <= 0 && newPcHp <= 0) wId = 'draw';
                 else if (newPlayerHp <= 0) wId = 'guest';
                 else wId = 'host';
             }

             const updates: any = {
                 p1Hp: newPlayerHp,
                 p2Hp: newPcHp
             };
             if (wId) {
                 updates.winnerId = wId;
                 updates.status = 'finished';
             } else {
                 updates.p1Move = null;
                 updates.p2Move = null;
                 updates.round = increment(1);
             }
             updateDoc(doc(db, 'rooms', currentRoomId), updates);
         }
      }
    };
    
    // Level Up Check
    let didLevelUp = false;
    if (pOutcome === 'win' && playerPlayedCard.unlocks) {
       const baseId = playerPlayedCard.baseDefinitionId;
       const currentHighestLevel = levelUpMap[baseId] || playerPlayedCard.definitionId;
       if (playerPlayedCard.unlocks > currentHighestLevel) {
         didLevelUp = true;
         const newLevelId = playerPlayedCard.unlocks;
         const unlockedCardDef = CardCatalogById[newLevelId];
         addLog(`【進化！】「${playerPlayedCard.name}」が「${unlockedCardDef.name}」に進化した！`);
         setLevelUpMap(prev => ({...prev, [baseId]: newLevelId }));
         saveUnlockedCard(newLevelId);
         postAnimationCallback.current = continueGameLogic;
         setLevelUpAnimationData({ from: playerPlayedCard, to: unlockedCardDef });
       }
    }
    if (!didLevelUp) setTimeout(continueGameLogic, 2000);

  }, [playerPlayedCard, pcPlayedCard, playerHP, pcHP, addLog, drawCardsAfterBattle, levelUpMap, saveUnlockedCard, gameMode, isHost, currentRoomId]);


  const resolveTurn = useCallback(async () => {
      if (!playerPlayedCard || !pcPlayedCard) return;
      setTurnPhase('battle_animation');
  }, [playerPlayedCard, pcPlayedCard]);

  useEffect(() => {
    if (turnPhase === 'resolution_phase') {
      const timer = setTimeout(() => resolveTurn(), 500);
      return () => clearTimeout(timer);
    }
  }, [turnPhase, resolveTurn]);
  
  useEffect(() => {
      if(turnPhase !== 'battle_animation') return;
      const timer = setTimeout(() => resolveBattle(), 500);
      return () => clearTimeout(timer);
  }, [turnPhase, resolveBattle]);
  
  // CPU turn logic
  useEffect(() => {
    if (gameMode !== 'cpu') return; 
    if (turnPhase !== 'pc_turn' || pcHand.length === 0 || !playerPlayedCard) return;
    const timer = setTimeout(() => {
      const cardToPlay = pcHand[Math.floor(Math.random() * pcHand.length)];
      setPcPlayedCard(cardToPlay);
      setPcHand(prev => prev.filter(c => c.id !== cardToPlay.id));
      addLog(`相手は「${cardToPlay.name}」を出した。`);
      setTurnPhase('resolution_phase');
    }, 1500);
    return () => clearTimeout(timer);
  }, [turnPhase, pcHand, playerPlayedCard, gameMode, addLog]);


  const handleCardSelect = (card: CardData) => {
      if (turnPhase === 'player_turn') {
          setSelectedCardId(card.id === selectedCardId ? null : card.id);
      }
  };

  const handleBoardClick = () => {
      if (selectedCardId !== null && turnPhase === 'player_turn') {
          const card = playerHand.find(c => c.id === selectedCardId);
          if (card) {
              setPlayerPlayedCard(card);
              setPlayerHand(prev => prev.filter(c => c.id !== selectedCardId));
              setSelectedCardId(null);
              setGameLog(prev => [...prev, `あなたは「${card.name}」を出した！`]);
              
              if (gameMode === 'pvp') {
                  if (!currentRoomId || !db) return;
                  setTurnPhase('pc_turn');
                  const roomRef = doc(db, 'rooms', currentRoomId);
                  updateDoc(roomRef, {
                     [isHost ? 'p1Move' : 'p2Move']: card
                  });
              } else {
                  setTurnPhase('pc_turn');
              }
          }
      }
  };
  
  const unlockedCardsData = unlockedCardIds.map(id => CardCatalogById[id]);

  return (
    <div className="w-full h-screen bg-gray-900 text-white overflow-hidden font-sans select-none relative">
        <div className="absolute inset-0 bg-black/30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"></div>
        
        {/* Header */}
        {gameState !== 'login_screen' && (
          <div className="absolute top-0 w-full p-4 flex justify-between items-center z-50 pointer-events-none">
            <div className="pointer-events-auto">
              {user ? (
                 <div className="flex items-center gap-2 bg-black/60 p-2 rounded-lg border border-gray-600">
                    {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />}
                    <span className="text-white text-sm">{user.displayName}</span>
                    <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded">ログアウト</button>
                 </div>
              ) : (
                 <div className="bg-black/60 p-2 rounded-lg border border-gray-600 text-gray-300 text-sm">ゲストプレイ中</div>
              )}
            </div>
            <div className="pointer-events-auto">
               <button onClick={() => setShowRanking(true)} className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-4 py-2 rounded-lg shadow flex items-center gap-2">
                  <span>🏆</span> ランキング
               </button>
            </div>
          </div>
        )}

        <div className="relative z-10 w-full h-full">
            {gameState === 'login_screen' && (
                <TopScreen 
                    currentUser={user}
                    onLogin={handleLogin}
                    onGuestPlay={() => setGameState('deck_building')}
                    onStartGame={() => setGameState('deck_building')}
                    onLogout={handleLogout}
                />
            )}
            
            {gameState === 'deck_building' && (
                <DeckBuilder 
                    unlockedCards={unlockedCardsData}
                    onDeckSubmit={handleDeckSubmit}
                    isGuest={!user}
                />
            )}

            {gameState === 'matchmaking' && (
                <Matchmaking 
                    onCancel={cancelMatchmaking}
                    statusMessage={matchStatus}
                />
            )}

            {gameState === 'in_game' && (
                <>
                <GameBoard 
                    turnPhase={turnPhase}
                    playerHP={playerHP}
                    pcHP={pcHP}
                    playerHand={playerHand}
                    pcHandSize={pcHand.length}
                    pcAttributeCount={pcAttributeCount}
                    playerDeckSize={playerDeck.length} 
                    pcDeckSize={pcDeck.length}
                    playerPlayedCard={playerPlayedCard}
                    pcPlayedCard={pcPlayedCard}
                    onCardSelect={handleCardSelect}
                    onBoardClick={handleBoardClick}
                    selectedCardId={selectedCardId}
                    gameLog={gameLog}
                    playerIsCasting={playerIsCasting}
                    pcIsCasting={pcIsCasting}
                    battleOutcome={battleOutcome}
                />
                {levelUpAnimationData && <LevelUpAnimation fromCard={levelUpAnimationData.from} toCard={levelUpAnimationData.to} onAnimationComplete={() => {
                    setLevelUpAnimationData(null);
                    if (postAnimationCallback.current) {
                        postAnimationCallback.current();
                        postAnimationCallback.current = null;
                    }
                }} />}
                </>
            )}
            
            {gameState === 'end' && (
                <div className="text-center flex flex-col items-center justify-center h-full">
                    <h1 className="text-6xl font-bold text-amber-300 drop-shadow-lg mb-4">{winner}</h1>
                    <button onClick={() => { setGameState('deck_building'); setGameMode('cpu'); }} className="bg-amber-500 text-gray-900 font-bold py-4 px-8 rounded-lg text-2xl hover:bg-amber-400 transform hover:scale-105">
                    デッキ構築へ
                    </button>
                </div>
            )}
            
            {showRanking && db && (
                <RankingBoard onClose={() => setShowRanking(false)} db={db} />
            )}
        </div>
    </div>
  );
};

export default App;
