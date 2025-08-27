import { CribbageEngine } from './CribbageEngine';
import { GameState, GamePlayer, GameAction, GameEvent, GAME_PHASES } from '../types/game';

export class GameLoop {
  private gameEngine: CribbageEngine;
  private gameState: GameState;
  private actionQueue: GameAction[] = [];
  private eventHistory: GameEvent[] = [];
  private turnTimeout: number = 30000; // 30 seconds per turn
  private turnTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(gameEngine: CribbageEngine) {
    this.gameEngine = gameEngine;
    this.gameState = gameEngine.getGameState();
  }

  // Start the game loop
  start(): void {
    if (this.gameState.status !== 'waiting') return;
    
    this.gameState.status = 'playing';
    this.gameState.phase = GAME_PHASES.DISCARDING;
    
    // Start first player's turn
    this.startPlayerTurn();
    
    console.log(`Game ${this.gameState.id} started`);
  }

  // Process a player action
  processAction(action: GameAction): boolean {
    if (this.isProcessing) return false;
    
    // Validate action
    if (!this.validateAction(action)) return false;
    
    // Add to action queue
    this.actionQueue.push(action);
    
    // Process immediately if not already processing
    if (!this.isProcessing) {
      this.processActionQueue();
    }
    
    return true;
  }

  // Validate an action
  private validateAction(action: GameAction): boolean {
    const player = this.gameState.players.find(p => p.id === action.playerId);
    if (!player || !player.isOnline) return false;
    
    // Check if it's the player's turn
    if (action.type !== 'discardToCrib' && !player.isCurrentTurn) return false;
    
    // Check game phase
    switch (action.type) {
      case 'discardToCrib':
        return this.gameState.phase === GAME_PHASES.DISCARDING;
      case 'cutDeck':
        return this.gameState.phase === GAME_PHASES.CUTTING;
      case 'playCard':
        return this.gameState.phase === GAME_PHASES.PLAYING;
      case 'endTurn':
        return true; // Can end turn at any time
      case 'claimScore':
        return this.gameState.phase === GAME_PHASES.SCORING;
      default:
        return false;
    }
  }

  // Process the action queue
  private async processActionQueue(): Promise<void> {
    if (this.isProcessing || this.actionQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift()!;
      await this.executeAction(action);
    }
    
    this.isProcessing = false;
  }

  // Execute a single action
  private async executeAction(action: GameAction): Promise<void> {
    try {
      let success = false;
      
      switch (action.type) {
        case 'discardToCrib':
          success = this.handleDiscardToCrib(action);
          break;
        case 'cutDeck':
          success = this.handleCutDeck(action);
          break;
        case 'playCard':
          success = this.handlePlayCard(action);
          break;
        case 'endTurn':
          success = this.handleEndTurn(action);
          break;
        case 'claimScore':
          success = this.handleClaimScore(action);
          break;
      }
      
      if (success) {
        // Record event
        this.recordEvent(action);
        
        // Update game state
        this.gameState = this.gameEngine.getGameState();
        
        // Check for game over
        if (this.gameEngine.isGameOver()) {
          this.endGame();
          return;
        }
        
        // Move to next phase if needed
        this.checkPhaseTransition();
      }
      
    } catch (error) {
      console.error('Error executing action:', error);
    }
  }

  // Handle discarding cards to crib
  private handleDiscardToCrib(action: GameAction): boolean {
    if (!action.cardIndex || !Array.isArray(action.cardIndex) || action.cardIndex.length !== 2) return false;
    
    const success = this.gameEngine.discardToCrib(action.playerId, action.cardIndex);
    
    console.log('handleDiscardToCrib', action);
    console.log('success', success);

    if (success) {
      // Check if both players have discarded
      const allDiscarded = this.gameState.players.every(player => 
        player.hand.length === 4
      );
      
      if (allDiscarded) {
        this.gameState.phase = GAME_PHASES.CUTTING;
        this.startCuttingPhase();
      }
    }
    
    return success;
  }

  // Handle cutting the deck
  private handleCutDeck(action: GameAction): boolean {
    if (typeof action.cardIndex !== 'number') return false;
    
    const success = this.gameEngine.cutDeck(action.cardIndex);
    
    if (success) {
      this.gameState.phase = GAME_PHASES.PLAYING;
      this.startPlayingPhase();
    }
    
    return success;
  }

  // Handle playing a card
  private handlePlayCard(action: GameAction): boolean {
    if (typeof action.cardIndex !== 'number') return false;
    
    const success = this.gameEngine.playCard(action.playerId, action.cardIndex);
    
    if (success) {
      // Reset turn timer
      this.resetTurnTimer();
    }
    
    return success;
  }

  // Handle ending turn
  private handleEndTurn(_action: GameAction): boolean {
    // End current player's turn
    this.endPlayerTurn();
    return true;
  }

  // Handle claiming score
  private handleClaimScore(action: GameAction): boolean {
    // Calculate and award score using the engine's claim method
    const score = this.gameEngine.claimHandScore(action.playerId);
    
    if (score > 0) {
      console.log(`Player ${action.playerId} scored ${score} points`);
    }
    
    // Move to next phase if all players have scored
    this.checkScoringComplete();
    
    return true;
  }

  // Start the cutting phase
  private startCuttingPhase(): void {
    this.gameState.phase = GAME_PHASES.CUTTING;
    
    // Find the non-dealer to cut
    const nonDealer = this.gameState.players.find(p => !p.isDealer);
    if (nonDealer) {
      nonDealer.isCurrentTurn = true;
      this.gameState.currentPlayerId = nonDealer.id;
    }
    
    console.log('Cutting phase started');
  }

  // Start the playing phase
  private startPlayingPhase(): void {
    this.gameState.phase = GAME_PHASES.PLAYING;
    this.gameState.playScore = 0;
    this.gameState.playPile = [];
    
    // Find the non-dealer to start
    const nonDealer = this.gameState.players.find(p => !p.isDealer);
    if (nonDealer) {
      nonDealer.isCurrentTurn = true;
      this.gameState.currentPlayerId = nonDealer.id;
    }
    
    // Start turn timer
    this.startTurnTimer();
    
    console.log('Playing phase started');
  }

  // Start a player's turn
  private startPlayerTurn(): void {
    const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
    if (!currentPlayer) return;
    
    currentPlayer.isCurrentTurn = true;
    
    // Start turn timer
    this.startTurnTimer();
    
    console.log(`${currentPlayer.username}'s turn started`);
  }

  // End a player's turn
  private endPlayerTurn(): void {
    const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
    if (!currentPlayer) return;
    
    currentPlayer.isCurrentTurn = false;
    
    // Stop turn timer
    this.stopTurnTimer();
    
    // Move to next player
    this.nextPlayer();
    
    console.log(`${currentPlayer.username}'s turn ended`);
  }

  // Move to next player
  private nextPlayer(): void {
    const currentIndex = this.gameState.players.findIndex(p => p.id === this.gameState.currentPlayerId);
    const nextIndex = (currentIndex + 1) % this.gameState.players.length;
    
    this.gameState.currentPlayerId = this.gameState.players[nextIndex].id;
    this.startPlayerTurn();
  }

  // Start turn timer
  private startTurnTimer(): void {
    this.stopTurnTimer(); // Clear any existing timer
    
    this.turnTimer = setTimeout(() => {
      console.log('Turn timeout - auto-ending turn');
      this.handleEndTurn({
        type: 'endTurn',
        playerId: this.gameState.currentPlayerId!,
        timestamp: new Date()
      });
    }, this.turnTimeout);
  }

  // Stop turn timer
  private stopTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  // Reset turn timer
  private resetTurnTimer(): void {
    this.startTurnTimer();
  }

  // Check if phase transition is needed
  private checkPhaseTransition(): void {
    switch (this.gameState.phase) {
      case GAME_PHASES.DISCARDING:
        // Check if both players have discarded
        const allDiscarded = this.gameState.players.every(player => 
          player.hand.length === 4
        );
        if (allDiscarded) {
          this.startCuttingPhase();
        }
        break;
        
      case GAME_PHASES.CUTTING:
        // Check if deck has been cut
        if (this.gameState.cutCard) {
          this.startPlayingPhase();
        }
        break;
        
      case GAME_PHASES.PLAYING:
        // Check if play phase should end
        if (this.gameState.playScore === 31 || this.allPlayersCannotPlay()) {
          this.endPlayPhase();
        }
        break;
        
      case GAME_PHASES.SCORING:
        // Check if scoring is complete
        this.checkScoringComplete();
        break;
    }
  }

  // Check if all players cannot play
  private allPlayersCannotPlay(): boolean {
    return this.gameState.players.every(player => 
      player.hand.every(card => this.gameState.playScore + card.value > 31)
    );
  }

  // End the play phase
  private endPlayPhase(): void {
    this.gameState.phase = GAME_PHASES.SCORING;
    this.gameState.playScore = 0;
    this.gameState.playPile = [];
    
    // Stop turn timer
    this.stopTurnTimer();
    
    console.log('Play phase ended, moving to scoring');
  }

  // Check if scoring is complete
  private checkScoringComplete(): void {
    // This would check if both players have scored their hands
    // For now, we'll move to next round after a delay
    setTimeout(() => {
      this.nextRound();
    }, 5000);
  }

  // Move to next round
  private nextRound(): void {
    this.gameState.round++;
    
    // Check if game should end (after 6 rounds or when someone reaches 121)
    if (this.gameState.round > 6 || this.gameEngine.isGameOver()) {
      this.endGame();
      return;
    }
    
    // Start new round
    this.startNewRound();
  }

  // Start a new round
  private startNewRound(): void {
    // Reset game state for new round
    this.gameState.phase = GAME_PHASES.DISCARDING;
    this.gameState.playScore = 0;
    this.gameState.playPile = [];
    
    // Deal new cards (this would be handled by the engine)
    // For now, we'll just reset the phase
    
    console.log(`Round ${this.gameState.round} started`);
  }

  // End the game
  private endGame(): void {
    this.gameState.status = 'finished';
    this.stopTurnTimer();
    
    const winner = this.gameEngine.getWinner();
    if (winner) {
      console.log(`Game ended! Winner: ${winner.username}`);
    }
    
    // Record final event
    this.recordEvent({
      type: 'endTurn',
      playerId: winner?.id || '',
      timestamp: new Date()
    });
  }

  // Record a game event
  private recordEvent(action: GameAction): void {
    const event: GameEvent = {
      type: this.getEventType(action),
      playerId: action.playerId,
      data: action,
      timestamp: new Date()
    };
    
    this.eventHistory.push(event);
    
    // Keep only last 100 events
    if (this.eventHistory.length > 100) {
      this.eventHistory.shift();
    }
  }

  // Get event type from action
  private getEventType(action: GameAction): GameEvent['type'] {
    switch (action.type) {
      case 'playCard':
        return 'cardPlayed';
      case 'claimScore':
        return 'scoreClaimed';
      case 'endTurn':
        return 'turnEnded';
      default:
        return 'turnEnded';
    }
  }

  // Get current game state
  getGameState(): GameState {
    return { ...this.gameState };
  }

  // Get event history
  getEventHistory(): GameEvent[] {
    return [...this.eventHistory];
  }

  // Check if game is over
  isGameOver(): boolean {
    return this.gameState.status === 'finished';
  }

  // Get current phase
  getCurrentPhase(): string {
    return this.gameState.phase;
  }

  // Get current player
  getCurrentPlayer(): GamePlayer | undefined {
    return this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
  }

  // Cleanup
  destroy(): void {
    this.stopTurnTimer();
    this.actionQueue = [];
    this.eventHistory = [];
  }
}
