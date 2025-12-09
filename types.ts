
export type EffectType = 'DIRECT_DAMAGE' | 'HEAL_PLAYER' | 'DRAW_CARD' | 'NONE';
export type BattleOutcome = 'win' | 'lose' | 'draw' | null;
export type Attribute = 'passion' | 'calm' | 'harmony';

export interface CardData {
  id: number; // Unique instance ID for this specific card in a game
  definitionId: number; // The ID of the card's template in CARD_DEFINITIONS
  baseDefinitionId: number; // The definitionId of the original Lv.1 card in an evolution line
  name: string;
  attack: number;
  defense: number;
  image: string;
  description: string;
  effect: EffectType;
  effectValue?: number;
  attribute: Attribute;
  level?: number;
  unlocks?: number; // The definitionId of the card it can unlock
}

export type TurnPhase = 'player_turn' | 'waiting_for_opponent' | 'pc_turn' | 'resolution_phase' | 'battle_animation';
// Add 'matchmaking' and 'gamemaster' state
export type GameState = 'login_screen' | 'deck_building' | 'matchmaking' | 'in_game' | 'end' | 'gamemaster';
export type AttributeCounts = { [key in Attribute]: number };

// New Interface for PvP Room
export interface Room {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  createdAt: any; // Firestore Timestamp
  
  // Heartbeat / Connection check
  hostLastActive?: any; // Firestore Timestamp
  guestLastActive?: any; // Firestore Timestamp

  // Initial Sync check
  hostReady: boolean;
  guestReady: boolean;
  
  // Phase 2: Game State Sync
  round: number; // Current round number. Increments to reset turns.
  p1Move: CardData | null; // Host's played card
  p2Move: CardData | null; // Guest's played card
  
  // Phase 3: HP & Result Sync
  p1Hp: number;
  p2Hp: number;
  winnerId: string | null; // 'host', 'guest', or 'draw'
}