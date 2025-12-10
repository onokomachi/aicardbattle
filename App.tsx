
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment, arrayUnion, query, where, limit, getDocs, onSnapshot, runTransaction } from 'firebase/firestore';
import TopScreen from './components/TopScreen';
import DeckBuilder from './components/DeckBuilder';
import Matchmaking from './components/Matchmaking';
import GameBoard from './components/GameBoard';
import RankingBoard from './components/RankingBoard';
import GameMaster from './components/GameMaster';
import type { CardData, GameState, TurnPhase, BattleOutcome, AttributeCounts, Room, Attribute } from './types';
import { INITIAL_HP, HAND_SIZE, DECK_SIZE, INITIAL_UNLOCKED_CARDS, CardCatalogById, CARD_DEFINITIONS, ADMIN_EMAILS, GAMEMASTER_PASSWORD } from './constants';
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

// Dummy Card for Blind Reveal
const HIDDEN_CARD: CardData = {
    id: -1,
    definitionId: -1,
    baseDefinitionId: -1,
    name: "？？？",
    attack: 0,
    defense: 0,
    image: "11.jpg", // Card Back Image
    description: "相手がカードを選択しました",
    effect: 'NONE',
    attribute: 'passion' // Dummy attribute
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
  const [rooms, setRooms] = useState<Room[]>([]); // Added for Lobby
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);
  
  // --- Refs for solving Stale Closures in Listeners ---
  // イベントリスナー内で最新のStateを参照するためにRefを使用する
  const isHostRef = useRef(isHost);
  const turnPhaseRef = useRef(turnPhase);
  const gameStateRef = useRef(gameState);
  const currentRoundRef = useRef(currentRound);
  const pcPlayedCardRef = useRef(pcPlayedCard); // PvPでは相手のカードとして使用
  const userRef = useRef(user);
  const processedMatchIdRef = useRef<string | null>(null);

  // Ref Syncing
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { turnPhaseRef.current = turnPhase; }, [turnPhase]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
  useEffect(() => { pcPlayedCardRef.current = pcPlayedCard; }, [pcPlayedCard]);
  useEffect(() => { userRef.current = user; }, [user]);


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
  
  // Game Master Access Check
  const canAccessGameMaster = useMemo(() => {
    if (!user) return false;
    // ADMIN_EMAILSが空の場合は、ログインユーザー全員に許可（開発・デモ用）
    if (ADMIN_EMAILS.length === 0) return true;
    return user.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

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

  // --- Task 2: Lobby Room Listener & Zombie Cleanup ---
  useEffect(() => {
    // ロビー画面にいない、またはDBが初期化されていない場合は何もしない
    if ((gameState !== 'matchmaking' && gameState !== 'gamemaster') || !db) return;
    
    // GameMaster画面でもルーム情報は個別に取得しているので、ここではmatchmakingのみをターゲットにするのが理想だが、
    // 既存のロジックがglobalなリスナーを使っているため、一旦matchmaking時のみに絞る
    if (gameState !== 'matchmaking') return;

    // roomsコレクション全体を監視
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedRooms: Room[] = [];
      const now = Date.now();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Room;
        // データにIDが含まれていない場合の保険としてdoc.idを使用
        if (!data.roomId) {
            data.roomId = docSnap.id;
        }
        loadedRooms.push(data);

        // --- ZOMBIE CLEANUP LOGIC (Active Garbage Collection) ---
        // サーバー側で定期実行できないため、クライアントがデータ取得時に古い部屋を掃除する
        let isZombie = false;
        if (data.status === 'waiting' || data.status === 'playing') {
            // Check 1: Heartbeat (High Accuracy)
            // もし hostLastActive があり、かつ60秒以上更新がなければゾンビとみなす
            if (data.hostLastActive) {
                const lastActive = data.hostLastActive.toMillis ? data.hostLastActive.toMillis() : 0;
                if (now - lastActive > 60000) { // 60秒
                    isZombie = true;
                }
            } 
            // Check 2: Legacy / Fallback (Low Accuracy)
            // ハートビートがない古いゾンビの場合、作成日時から5分経過で削除
            else if (data.createdAt) {
                const created = data.createdAt.toMillis ? data.createdAt.toMillis() : 0;
                if (now - created > 300000) { // 5分
                    isZombie = true;
                }
            }
        }

        if (isZombie) {
            console.log(`🧹 Cleaning up zombie room detected: ${data.roomId}`);
            // Firestoreへの書き込みを行う。他のユーザーと競合しても「最後に書き込んだ者」の結果は同じなので問題ない
            updateDoc(docSnap.ref, { 
                status: 'finished',
                guestId: null, 
                hostReady: false,
                guestReady: false,
                winnerId: null 
            }).catch(e => console.warn("Cleanup failed (probably already cleaned):", e));
        }
      });
      setRooms(loadedRooms);
    }, (error) => {
      console.error("Error listening to rooms:", error);
    });

    return () => unsubscribe();
  }, [gameState]);

  // --- Heartbeat Logic (Zombie Prevention during Game) ---
  useEffect(() => {
      if (gameMode !== 'pvp' || gameState !== 'in_game' || !currentRoomId || !db) return;

      const timer = setInterval(() => {
          if (!currentRoomId) return;
          const roomRef = doc(db, 'rooms', currentRoomId);
          // Update my last active timestamp
          const field = isHostRef.current ? 'hostLastActive' : 'guestLastActive';
          updateDoc(roomRef, { [field]: serverTimestamp() }).catch(e => console.error("Heartbeat fail", e));
      }, 5000); // 5 seconds heartbeat

      return () => clearInterval(timer);
  }, [gameMode, gameState, currentRoomId]);


  // --- Helper: Cleanup Game Session ---
  // Fix for "Zombie Listener" / "Flashback" bug
  // keepConnection: true if we are restarting a game (e.g. initial start) and want to keep Room ID/Host status
  const cleanupGameSession = useCallback((keepConnection = false) => {
      // 1. Detach Listener & Reset Connection (Conditional)
      if (!keepConnection) {
          if (unsubscribeRoomRef.current) {
              unsubscribeRoomRef.current();
              unsubscribeRoomRef.current = null;
          }
          setCurrentRoomId(null);
          setIsHost(false);
      }
      
      // 2. Reset Game State Refs & State (Always)
      processedMatchIdRef.current = null;
      setWinner(null);
      setBattleOutcome(null);
      setPlayerPlayedCard(null);
      setPcPlayedCard(null);
      setTurnPhase('player_turn');
      
      // FIX: Do not clear decks here!
      // playerDeck holds the initial deck setup needed for startGame.
      // startGame will eventually overwrite these with the shuffled deck, so it's safe to keep them.
      // setPlayerDeck([]); 
      // setPcDeck([]);
  }, []);

  const getUpgradedCardInstance = useCallback((cardToDraw: CardData): CardData => {
    const baseId = cardToDraw.baseDefinitionId;
    const highestLevelId = levelUpMap[baseId];
    const defId = highestLevelId ? highestLevelId : cardToDraw.definitionId;
    return createNewCardInstance(defId);
  }, [levelUpMap]); // createNewCardInstance is ref-based

  const createNewCardInstance = useCallback((definitionId: number): CardData => {
    const definition = CardCatalogById[definitionId];
    const newId = nextCardInstanceId.current++;
    return { ...definition, id: newId };
  }, []);

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

  const drawCards = useCallback((playerCount: number, pcCount: number) => {
    if (playerCount > 0) {
        setPlayerDeck(currentDeck => {
            if (currentDeck.length < playerCount) { 
                endGameByDeckOut(); 
                return currentDeck; 
            }
            const cardsToDraw = currentDeck.slice(0, playerCount).map(c => getUpgradedCardInstance(c));
            setPlayerHand(h => [...h, ...cardsToDraw]);
            return currentDeck.slice(playerCount);
        });
    }
    if (pcCount > 0) {
        setPcDeck(currentDeck => {
            if (currentDeck.length < pcCount) { 
                endGameByDeckOut(); 
                return currentDeck; 
            }
            const cardsToDraw = currentDeck.slice(0, pcCount).map(c => getUpgradedCardInstance(c));
            setPcHand(h => [...h, ...cardsToDraw]);
            return currentDeck.slice(pcCount);
        });
    }
  }, [getUpgradedCardInstance, gameMode, isHost, currentRoomId, playerHP, pcHP]);

  // --- Room Listening & Game Logic ---
  
  const listenToRoom = (roomId: string) => {
    if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();

    const roomRef = doc(db, 'rooms', roomId);
    unsubscribeRoomRef.current = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as Room;

      const isHostVal = isHostRef.current;
      const currentGameState = gameStateRef.current;

      // --- Heartbeat Check (Disconnect Detection) ---
      if (currentGameState === 'in_game' && data.status === 'playing') {
          const now = Date.now();
          const opponentLastActive = isHostVal ? data.guestLastActive : data.hostLastActive;
          
          if (opponentLastActive) {
             const lastActiveMillis = opponentLastActive.toMillis ? opponentLastActive.toMillis() : 0;
             // If opponent hasn't updated for > 15 seconds, assume disconnect
             if (now - lastActiveMillis > 15000 && lastActiveMillis > 0) {
                 console.log("Opponent Disconnected detected.");
                 // Declare myself winner
                 if (processedMatchIdRef.current !== roomId) {
                    setWinner("対戦相手の接続が切れました。あなたの不戦勝です。");
                    setGameState('end');
                    updateDoc(roomRef, { winnerId: isHostVal ? 'host' : 'guest', status: 'finished' });
                 }
                 return;
             }
          }
      }

      if (data.status === 'playing' && currentGameState === 'matchmaking') {
        setMatchStatus('マッチング成立！バトルを開始します！');
        setCurrentRound(1);
        processedMatchIdRef.current = null; // 新しいゲームのためにリセット
        setTimeout(() => {
             const pcDeckDefs = CARD_DEFINITIONS.slice(0, 10).flatMap(def => [def, def]);
             startGame(playerDeck, pcDeckDefs); 
             setGameState('in_game');
             
             // Initial Heartbeat
             if (db && roomId) {
                const field = isHostVal ? 'hostLastActive' : 'guestLastActive';
                updateDoc(doc(db, 'rooms', roomId), { [field]: serverTimestamp() });
             }
        }, 1500);
      }

      if (currentGameState === 'in_game' && (data.status === 'playing' || data.status === 'finished')) {
          // Sync HP
          if (isHostVal) {
              setPlayerHP(data.p1Hp);
              setPcHP(data.p2Hp);
          } else {
              setPlayerHP(data.p2Hp);
              setPcHP(data.p1Hp);
          }

          // Sync Moves with BLIND REVEAL
          const opponentMove = isHostVal ? data.p2Move : data.p1Move;
          const myMoveOnServer = isHostVal ? data.p1Move : data.p2Move;

          // Note: Ref is used to avoid duplicate state updates or closure issues
          // If opponent moved, but I haven't moved yet (or logic hasn't synced my move), hide the card.
          if (opponentMove) {
              if (myMoveOnServer) {
                  // Both have moved: REVEAL
                  if (JSON.stringify(pcPlayedCardRef.current) !== JSON.stringify(opponentMove)) {
                      setPcPlayedCard(opponentMove);
                  }
              } else {
                  // Only opponent has moved: BLIND (Show card back)
                  // Use a dummy object but ensuring it's not null so UI shows a card
                  if (pcPlayedCardRef.current?.id !== -1) {
                      setPcPlayedCard(HIDDEN_CARD);
                  }
              }
          } else {
              // Opponent hasn't moved yet
              if (pcPlayedCardRef.current !== null) {
                  setPcPlayedCard(null);
              }
          }

          // Phase Transition Logic (The Fix)
          if (myMoveOnServer && opponentMove) {
             const currentTp = turnPhaseRef.current;
             if (currentTp !== 'resolution_phase' && currentTp !== 'battle_animation') {
                 // Ensure we have the REAL card before resolving
                 setPcPlayedCard(opponentMove); 
                 setTurnPhase('resolution_phase');
             }
          }

          // Round Reset
          const currentR = currentRoundRef.current;
          if (data.round > currentR) {
             setCurrentRound(data.round);
             // Standard Turn Draw
             drawCards(1, 1);
             setPlayerPlayedCard(null); 
             setPcPlayedCard(null);
             setTurnPhase('player_turn'); 
             addLog(`ターン ${data.round} 開始！`);
          }

          // Game End & Recording
          if (data.winnerId) {
             // 重複処理防止
             if (processedMatchIdRef.current !== roomId) {
                 processedMatchIdRef.current = roomId;

                 let isWinner = false;
                 if (data.winnerId === 'draw') setWinner("引き分けです！");
                 else if (data.winnerId === 'host' && isHostVal) { setWinner("あなたの勝ちです！"); isWinner = true; }
                 else if (data.winnerId === 'guest' && !isHostVal) { setWinner("あなたの勝ちです！"); isWinner = true; }
                 else setWinner("あなたの負けです…");
                 
                 setGameState('end');

                 // Record stats to Firestore
                 if (userRef.current && db) {
                     const userDocRef = doc(db, 'users', userRef.current.uid);
                     const updates: any = {
                         totalMatches: increment(1)
                     };
                     if (isWinner) {
                         updates.totalWins = increment(1);
                     }
                     updateDoc(userDocRef, updates).catch(err => console.error("Stats update failed", err));
                 }
                 
                 // Mark room as finished to prevent zombies (Double check)
                 if (data.status !== 'finished') {
                     updateDoc(roomRef, { status: 'finished' });
                 }
             }
          }
      }
    });
  };

  const cancelMatchmaking = async () => {
    // Leave room logic
    if (currentRoomId && db && user) {
        try {
            const roomRef = doc(db, 'rooms', currentRoomId);
            const roomSnap = await getDoc(roomRef);
            if (roomSnap.exists()) {
                const data = roomSnap.data() as Room;
                if (data.status === 'waiting' && data.hostId === user.uid) {
                    await updateDoc(roomRef, { status: 'finished' });
                }
            }
        } catch (e) {
            console.error("Error leaving room:", e);
        }
    }
    
    // Strict Cleanup
    cleanupGameSession(false); // Clear connection
    setGameState('deck_building');
  };

  // Browser close cleanup attempt
  useEffect(() => {
    const handleBeforeUnload = () => {
       cleanupGameSession(false); // Clear connection
       if (gameState === 'matchmaking' && isHost && currentRoomId && db) {
           // Basic update attempt (best effort)
           const roomRef = doc(db, 'rooms', currentRoomId);
           updateDoc(roomRef, { status: 'finished' }).catch(() => {});
       }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gameState, isHost, currentRoomId, cleanupGameSession]);

  const handleDeckSubmit = (deck: CardData[], mode: 'cpu' | 'pvp') => {
      setPlayerDeck(deck);
      setGameMode(mode);
      
      if (mode === 'cpu') {
          const pcDeckDefs = CARD_DEFINITIONS.slice(0, 10).flatMap(def => [def, def]);
          startGame(deck, pcDeckDefs);
          setGameState('in_game');
      } else {
          // Switch to Lobby Screen
          setGameState('matchmaking');
      }
  };

  // Task 3 & 4: Transaction-based Join Room Logic with Zombie Cleanup
  const handleJoinRoom = async (roomId: string) => {
    if (!user || !db) return;
    
    // Prevent joining if already in a room
    if (currentRoomId) return;

    // Ensure clean slate before joining
    cleanupGameSession(false); // Clear connection

    try {
        const roomRef = doc(db, 'rooms', roomId);
        
        const result = await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            
            // Function to setup a new room (HOST)
            const setupNewRoom = () => {
                transaction.set(roomRef, {
                    roomId,
                    status: 'waiting',
                    hostId: user.uid,
                    hostName: user.displayName || 'Unknown',
                    guestId: null,
                    guestName: null,
                    createdAt: serverTimestamp(),
                    hostLastActive: serverTimestamp(), // Initialize HB
                    guestLastActive: null,
                    hostReady: true,
                    guestReady: false,
                    round: 1,
                    p1Move: null,
                    p2Move: null,
                    p1Hp: INITIAL_HP,
                    p2Hp: INITIAL_HP,
                    winnerId: null
                });
                return 'host';
            };

            if (!roomDoc.exists()) {
                return setupNewRoom();
            }

            const data = roomDoc.data() as Room;

            if (data.status === 'finished') {
                return setupNewRoom();
            }

            if (data.status === 'waiting') {
                // Task 4: Zombie Check (3 minutes)
                if (data.createdAt) {
                    // Firestore Timestamp to Millis check
                    const createdTime = data.createdAt.toMillis ? data.createdAt.toMillis() : Date.now();
                    const now = Date.now();
                    // 3 minutes = 180000 ms
                    if (now - createdTime > 180000) {
                        console.log("Zombie room detected! Overwriting...", roomId);
                        return setupNewRoom();
                    }
                }

                // Prevent self-match
                if (data.hostId === user.uid) {
                    return 'host'; // Resume hosting
                }
                
                // JOIN AS GUEST
                transaction.update(roomRef, {
                    status: 'playing',
                    guestId: user.uid,
                    guestName: user.displayName || 'Unknown',
                    guestReady: true,
                    guestLastActive: serverTimestamp() // Initialize HB
                });
                return 'guest';
            }

            if (data.status === 'playing') {
                // Reconnect support
                if (data.hostId === user.uid) return 'host';
                if (data.guestId === user.uid) return 'guest';
                throw new Error("Room is full");
            }
            
            return null;
        });

        if (result === 'host') {
            setIsHost(true);
            setCurrentRoomId(roomId);
            addLog(`部屋 ${roomId} を作成しました。対戦相手を待っています...`);
        } else if (result === 'guest') {
            setIsHost(false);
            setCurrentRoomId(roomId);
            addLog(`部屋 ${roomId} に入室しました！`);
        }

    } catch (e) {
        console.error("Join room error:", e);
        alert("入室できませんでした（満員またはエラー）");
    }
  };

  // Task 3: Listen to the room automatically once joined
  useEffect(() => {
    // Only depend on currentRoomId to prevent unnecessary re-subscriptions when gameState changes
    if (currentRoomId) {
        listenToRoom(currentRoomId);
    }
    // Unsubscribe is handled inside listenToRoom wrapper or component unmount
    return () => {
         if (unsubscribeRoomRef.current) {
            unsubscribeRoomRef.current();
            unsubscribeRoomRef.current = null;
         }
    };
  }, [currentRoomId]);

  const startGame = useCallback((playerDeckSetup: CardData[], pcDeckSetup: CardData[]) => {
    // Use keepConnection=true to avoid clearing Room ID/Host status when game starts
    cleanupGameSession(true);

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
    processedMatchIdRef.current = null; // Reset match processing state
  }, [createNewCardInstance, cleanupGameSession]);

  const resolveBattle = useCallback(() => {
    if (!playerPlayedCard || !pcPlayedCard) return;
    // Hidden Card Safety Check: Do not resolve if card is hidden
    if (pcPlayedCard.id === -1) return;

    const matchup = getAttributeMatchup(playerPlayedCard.attribute, pcPlayedCard.attribute);
    let damageToPc = 0; 
    let damageToPlayer = 0;
    let playerHeal = 0;
    let pcHeal = 0;
    let playerDraw = 0;
    let pcDraw = 0;

    // --- EFFECT RESOLUTION ---
    // Player Card Effects
    if (playerPlayedCard.effect === 'DIRECT_DAMAGE') {
        const dmg = playerPlayedCard.effectValue || 0;
        damageToPc += dmg;
        setPlayerIsCasting(true);
        addLog(`【効果】あなたの「${playerPlayedCard.name}」の効果で追加${dmg}ダメージ！`);
    } else if (playerPlayedCard.effect === 'HEAL_PLAYER') {
        playerHeal = playerPlayedCard.effectValue || 0;
        setPlayerIsCasting(true);
        addLog(`【効果】あなたの「${playerPlayedCard.name}」の効果でHPが${playerHeal}回復！`);
    } else if (playerPlayedCard.effect === 'DRAW_CARD') {
        playerDraw = playerPlayedCard.effectValue || 0;
        setPlayerIsCasting(true);
        addLog(`【効果】あなたの「${playerPlayedCard.name}」の効果でカードを${playerDraw}枚ドロー！`);
    }

    // PC Card Effects
    if (pcPlayedCard.effect === 'DIRECT_DAMAGE') {
        const dmg = pcPlayedCard.effectValue || 0;
        damageToPlayer += dmg;
        setPcIsCasting(true);
        addLog(`【効果】相手の「${pcPlayedCard.name}」の効果で追加${dmg}ダメージ！`);
    } else if (pcPlayedCard.effect === 'HEAL_PLAYER') {
        pcHeal = pcPlayedCard.effectValue || 0;
        setPcIsCasting(true);
        addLog(`【効果】相手の「${pcPlayedCard.name}」の効果でHPが${pcHeal}回復！`);
    } else if (pcPlayedCard.effect === 'DRAW_CARD') {
        pcDraw = pcPlayedCard.effectValue || 0;
        setPcIsCasting(true);
        addLog(`【効果】相手の「${pcPlayedCard.name}」の効果でカードを${pcDraw}枚ドロー！`);
    }

    // Turn off effect animations after short delay
    if (playerIsCasting || pcIsCasting) {
        setTimeout(() => {
            setPlayerIsCasting(false);
            setPcIsCasting(false);
        }, 1500);
    }

    // --- BATTLE RESOLUTION ---
    if (matchup === 'advantage') {
      addLog(`【属性有利】 相手の攻撃はあなたに通じない！`);
      damageToPc += Math.max(0, playerPlayedCard.attack - pcPlayedCard.defense);
    } else if (matchup === 'disadvantage') {
      addLog(`【属性不利】 あなたの攻撃は相手に通じない！`);
      damageToPlayer += Math.max(0, pcPlayedCard.attack - playerPlayedCard.defense);
    } else {
      addLog("属性は互角！純粋な力のぶつかり合いだ！");
      damageToPc += Math.max(0, playerPlayedCard.attack - pcPlayedCard.defense);
      damageToPlayer += Math.max(0, pcPlayedCard.attack - playerPlayedCard.defense);
    }

    let pOutcome: BattleOutcome = 'draw', pcOutcome: BattleOutcome = 'draw';
    if (damageToPc > damageToPlayer) { pOutcome = 'win'; pcOutcome = 'lose'; } 
    else if (damageToPlayer > damageToPc) { pOutcome = 'lose'; pcOutcome = 'win'; } 
    else if (damageToPc > 0) { pOutcome = 'win'; pcOutcome = 'lose'; } 
    else if (damageToPlayer > 0) { pOutcome = 'lose'; pcOutcome = 'win'; }

    addLog(`あなたの攻撃は${damageToPc}ダメージ、相手の攻撃は${damageToPlayer}ダメージ。`);
    setBattleOutcome({ player: pOutcome, pc: pcOutcome });

    const newPcHp = Math.min(INITIAL_HP, pcHP - damageToPc + pcHeal);
    const newPlayerHp = Math.min(INITIAL_HP, playerHP - damageToPlayer + playerHeal);
    
    // Process Extra Draws from Effects
    if (playerDraw > 0 || pcDraw > 0) {
        drawCards(playerDraw, pcDraw);
    }

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
            // Standard Turn Draw
            drawCards(1, 1);
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

  }, [playerPlayedCard, pcPlayedCard, playerHP, pcHP, addLog, drawCards, levelUpMap, saveUnlockedCard, gameMode, isHost, currentRoomId, playerIsCasting, pcIsCasting]);


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
                  // CHANGE: Wait for opponent instead of going directly to resolution/pc_turn
                  setTurnPhase('waiting_for_opponent');
                  addLog("対戦相手のカード選択を待っています...");
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
        {gameState !== 'login_screen' && gameState !== 'gamemaster' && (
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
                    onOpenGameMaster={canAccessGameMaster ? () => {
                        const pwd = window.prompt('管理者パスワードを入力してください');
                        if (pwd === GAMEMASTER_PASSWORD) {
                            setGameState('gamemaster');
                        } else if (pwd !== null) {
                            alert('パスワードが違います');
                        }
                    } : undefined}
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
                    rooms={rooms}
                    onJoinRoom={handleJoinRoom}
                    onCancel={cancelMatchmaking}
                    currentRoomId={currentRoomId}
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
                    <button 
                        onClick={() => { 
                            cleanupGameSession(false); 
                            setGameState('deck_building'); 
                            setGameMode('cpu'); 
                        }} 
                        className="bg-amber-500 text-gray-900 font-bold py-4 px-8 rounded-lg text-2xl hover:bg-amber-400 transform hover:scale-105"
                    >
                    デッキ構築へ
                    </button>
                </div>
            )}
            
            {showRanking && db && (
                <RankingBoard onClose={() => setShowRanking(false)} db={db} />
            )}

            {gameState === 'gamemaster' && db && (
                <GameMaster 
                    db={db}
                    onClose={() => setGameState('login_screen')}
                />
            )}
        </div>
    </div>
  );
};

export default App;