// Core game types and interfaces for Cribbage

export interface Player {
  id: string;
  username: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface GamePlayer extends Player {
  hand: Card[];
  score: number;
  pegs: PegPosition[];
  isDealer: boolean;
  isCurrentTurn: boolean;
}

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  value: number; // A=1, 2-10=face value, J/Q/K=10
  displayName: string; // e.g., "A♠", "10♥"
}

export interface PegPosition {
  position: number; // 0-120 on the board
  isFrontPeg: boolean;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished' | 'paused';
  players: GamePlayer[];
  currentPlayerId: string;
  deck: Card[];
  discardPile: Card[];
  cutCard: Card | null;
  crib: Card[];
  round: number;
  phase: 'discarding' | 'cutting' | 'playing' | 'scoring';
  playPile: Card[];
  playScore: number;
  completedRounds: Card[][]; // Track completed pegging rounds
  originalHands: Card[][]; // Store original hands before pegging for scoring
  lastPlayTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameAction {
  type: 'playCard' | 'discardToCrib' | 'cutDeck' | 'endTurn' | 'claimScore' | 'exitGame' | 'scoreHand' | 'scoreCrib';
  playerId: string;
  cardIndex?: number | number[];
  targetCardIndex?: number;
  timestamp: Date;
}

export interface GameEvent {
  type: 'cardPlayed' | 'scoreClaimed' | 'turnEnded' | 'roundEnded' | 'gameEnded';
  playerId: string;
  data: any;
  timestamp: Date;
}

export interface MatchmakingRequest {
  playerId: string;
  username: string;
  timestamp: Date;
}

export interface GameInvite {
  id: string;
  fromPlayer: Player;
  toPlayer: Player;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: Date;
}

// Game scoring constants
export const SCORING = {
  FIFTEEN: 2,
  PAIR: 2,
  TRIPLE: 6,
  QUAD: 12,
  RUN_3: 3,
  RUN_4: 4,
  RUN_5: 5,
  FLUSH_4: 4,
  FLUSH_5: 5,
  NOB: 1,
  GO: 1,
  LAST_CARD: 1
} as const;

// Game phases
export const GAME_PHASES = {
  DEALING: 'dealing',
  DISCARDING: 'discarding',
  CUTTING: 'cutting',
  PLAYING: 'playing',
  SCORING: 'scoring',
  ROUND_END: 'roundEnd'
} as const;
