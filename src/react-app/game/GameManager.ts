import { CribbageEngine } from './CribbageEngine';
import { GameState, GamePlayer, Player, MatchmakingRequest, GameInvite } from '../types/game';

export class GameManager {
  private static instance: GameManager;
  private activeGames: Map<string, CribbageEngine> = new Map();
  private matchmakingQueue: MatchmakingRequest[] = [];
  private gameInvites: Map<string, GameInvite> = new Map();
  private playerSessions: Map<string, string> = new Map(); // playerId -> gameId

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  // Join matchmaking queue
  joinMatchmaking(player: Player): string {
    const request: MatchmakingRequest = {
      playerId: player.id,
      username: player.username,
      timestamp: new Date()
    };

    this.matchmakingQueue.push(request);
    
    // Try to find a match immediately
    this.tryMatchmaking();
    
    return request.playerId;
  }

  // Leave matchmaking queue
  leaveMatchmaking(playerId: string): boolean {
    const index = this.matchmakingQueue.findIndex(req => req.playerId === playerId);
    if (index !== -1) {
      this.matchmakingQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  // Try to match players
  private tryMatchmaking(): void {
    if (this.matchmakingQueue.length < 2) return;

    // Simple FIFO matching - could be enhanced with skill-based matching
    const player1 = this.matchmakingQueue.shift()!;
    const player2 = this.matchmakingQueue.shift()!;

    // Create game
    this.createGame(player1, player2);
  }

  // Create a new game
  private createGame(player1: MatchmakingRequest, player2: MatchmakingRequest): string {
    const gamePlayer1: GamePlayer = {
      id: player1.playerId,
      username: player1.username,
      isOnline: true,
      lastSeen: new Date(),
      hand: [],
      score: 0,
      pegs: [],
      isDealer: false,
      isCurrentTurn: false
    };

    const gamePlayer2: GamePlayer = {
      id: player2.playerId,
      username: player2.username,
      isOnline: true,
      lastSeen: new Date(),
      hand: [],
      score: 0,
      pegs: [],
      isDealer: false,
      isCurrentTurn: false
    };

    const gameState = CribbageEngine.initializeGame(gamePlayer1, gamePlayer2);
    const gameEngine = new CribbageEngine(gameState);

    this.activeGames.set(gameState.id, gameEngine);
    this.playerSessions.set(player1.playerId, gameState.id);
    this.playerSessions.set(player2.playerId, gameState.id);

    // Notify players that game is ready
    this.notifyGameReady(gameState.id);

    return gameState.id;
  }

  // Get game by ID
  getGame(gameId: string): CribbageEngine | undefined {
    return this.activeGames.get(gameId);
  }

  // Get game by player ID
  getGameByPlayer(playerId: string): CribbageEngine | undefined {
    const gameId = this.playerSessions.get(playerId);
    if (gameId) {
      return this.activeGames.get(gameId);
    }
    return undefined;
  }

  // Get current game state for a player
  getPlayerGameState(playerId: string): GameState | null {
    const game = this.getGameByPlayer(playerId);
    if (!game) return null;

    const gameState = game.getGameState();
    
    // Filter sensitive information for other player
    const filteredState = {
      ...gameState,
      players: gameState.players.map(player => ({
        ...player,
        hand: player.id === playerId ? player.hand : player.hand.map(() => ({ 
          suit: 'hidden' as any, 
          rank: '?' as any, 
          value: 0, 
          displayName: '?' 
        }))
      }))
    };

    return filteredState;
  }

  // Send game invite
  sendGameInvite(fromPlayer: Player, toPlayerId: string): string {
    const invite: GameInvite = {
      id: crypto.randomUUID(),
      fromPlayer,
      toPlayer: { id: toPlayerId, username: '', isOnline: false, lastSeen: new Date() },
      status: 'pending',
      timestamp: new Date()
    };

    this.gameInvites.set(invite.id, invite);
    return invite.id;
  }

  // Accept game invite
  acceptGameInvite(inviteId: string, toPlayer: Player): string | null {
    const invite = this.gameInvites.get(inviteId);
    if (!invite || invite.status !== 'pending') return null;

    invite.status = 'accepted';
    invite.toPlayer = toPlayer;

    // Create game from invite
    const gameId = this.createGameFromInvite(invite);
    
    // Clean up invite
    this.gameInvites.delete(inviteId);
    
    return gameId;
  }

  // Decline game invite
  declineGameInvite(inviteId: string): boolean {
    const invite = this.gameInvites.get(inviteId);
    if (!invite || invite.status !== 'pending') return false;

    invite.status = 'declined';
    this.gameInvites.delete(inviteId);
    return true;
  }

  // Create game from accepted invite
  private createGameFromInvite(invite: GameInvite): string {
    const gamePlayer1: GamePlayer = {
      id: invite.fromPlayer.id,
      username: invite.fromPlayer.username,
      isOnline: true,
      lastSeen: new Date(),
      hand: [],
      score: 0,
      pegs: [],
      isDealer: false,
      isCurrentTurn: false
    };

    const gamePlayer2: GamePlayer = {
      id: invite.toPlayer.id,
      username: invite.toPlayer.username,
      isOnline: true,
      lastSeen: new Date(),
      hand: [],
      score: 0,
      pegs: [],
      isDealer: false,
      isCurrentTurn: false
    };

    const gameState = CribbageEngine.initializeGame(gamePlayer1, gamePlayer2);
    const gameEngine = new CribbageEngine(gameState);

    this.activeGames.set(gameState.id, gameEngine);
    this.playerSessions.set(invite.fromPlayer.id, gameState.id);
    this.playerSessions.set(invite.toPlayer.id, gameState.id);

    return gameState.id;
  }

  // Get pending invites for a player
  getPendingInvites(playerId: string): GameInvite[] {
    return Array.from(this.gameInvites.values()).filter(
      invite => invite.toPlayer.id === playerId && invite.status === 'pending'
    );
  }

  // Get sent invites for a player
  getSentInvites(playerId: string): GameInvite[] {
    return Array.from(this.gameInvites.values()).filter(
      invite => invite.fromPlayer.id === playerId && invite.status === 'pending'
    );
  }

  // Player disconnects
  playerDisconnect(playerId: string): void {
    const gameId = this.playerSessions.get(playerId);
    if (gameId) {
      const game = this.activeGames.get(gameId);
      if (game) {
        // Mark player as offline
        const gameState = game.getGameState();
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
          player.isOnline = false;
          player.lastSeen = new Date();
        }
      }
      
      this.playerSessions.delete(playerId);
    }

    // Remove from matchmaking
    this.leaveMatchmaking(playerId);
  }

  // Player reconnects
  playerReconnect(playerId: string): boolean {
    const gameId = this.playerSessions.get(playerId);
    if (gameId) {
      const game = this.activeGames.get(gameId);
      if (game) {
        const gameState = game.getGameState();
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
          player.isOnline = true;
          player.lastSeen = new Date();
          return true;
        }
      }
    }
    return false;
  }

  // End game
  endGame(gameId: string): void {
    const game = this.activeGames.get(gameId);
    if (game) {
      const gameState = game.getGameState();
      
      // Remove player sessions
      gameState.players.forEach(player => {
        this.playerSessions.delete(player.id);
      });
      
      // Remove game
      this.activeGames.delete(gameId);
    }
  }

  // Get active games count
  getActiveGamesCount(): number {
    return this.activeGames.size;
  }

  // Get matchmaking queue length
  getMatchmakingQueueLength(): number {
    return this.matchmakingQueue.length;
  }

  // Clean up expired invites (older than 24 hours)
  cleanupExpiredInvites(): void {
    const now = new Date();
    const expiredInvites = Array.from(this.gameInvites.entries()).filter(
      ([_, invite]) => now.getTime() - invite.timestamp.getTime() > 24 * 60 * 60 * 1000
    );

    expiredInvites.forEach(([id, _]) => {
      this.gameInvites.delete(id);
    });
  }

  // Notify players that game is ready
  private notifyGameReady(gameId: string): void {
    // This would integrate with your real-time communication system
    // For now, we'll just log it
    console.log(`Game ${gameId} is ready to start`);
  }

  // Get online players
  getOnlinePlayers(): Player[] {
    const onlinePlayers = new Map<string, Player>();
    
    // Get players from active games
    this.activeGames.forEach(game => {
      const gameState = game.getGameState();
      gameState.players.forEach(player => {
        if (player.isOnline) {
          onlinePlayers.set(player.id, {
            id: player.id,
            username: player.username,
            isOnline: player.isOnline,
            lastSeen: player.lastSeen
          });
        }
      });
    });

    return Array.from(onlinePlayers.values());
  }
}
