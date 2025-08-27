import { GameState, GamePlayer, GAME_PHASES } from '../types/game';

export interface AIAction {
  type: 'discardToCrib' | 'cutDeck' | 'playCard' | 'endTurn' | 'claimScore';
  playerId: string;
  cardIndex?: number | number[];
  timestamp: Date;
}

export abstract class AIOpponent {
  protected difficulty: string;
  protected gameState: GameState;

  constructor(difficulty: string, gameState: GameState) {
    this.difficulty = difficulty;
    this.gameState = gameState;
  }

  abstract getNextAction(): AIAction | null;

  protected getCurrentPlayer(): GamePlayer | undefined {
    return this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
  }

  protected getOpponent(): GamePlayer | undefined {
    return this.gameState.players.find(p => p.id !== this.gameState.currentPlayerId);
  }
}

export class BeginnerAIOpponent extends AIOpponent {
  constructor(gameState: GameState) {
    super('beginner', gameState);
  }

  getNextAction(): AIAction | null {
    // Use the current game state from the parent class, not the constructor's stale state
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return null;

    console.log('Beginner AI - getting next action for phase:', {
      phase: this.gameState.phase,
      phaseType: typeof this.gameState.phase,
      GAME_PHASES_DISCARDING: GAME_PHASES.DISCARDING,
      GAME_PHASES_DISCARDING_type: typeof GAME_PHASES.DISCARDING,
      phaseMatches: this.gameState.phase === GAME_PHASES.DISCARDING
    });

    switch (this.gameState.phase) {
      case GAME_PHASES.DISCARDING:
        const discardAction = this.getDiscardAction();
        console.log('Beginner AI - discard action:', discardAction);
        return discardAction;
      case GAME_PHASES.CUTTING:
        const cutAction = this.getCutAction();
        console.log('Beginner AI - cut action:', cutAction);
        return cutAction;
      case GAME_PHASES.PLAYING:
        const playAction = this.getPlayAction();
        console.log('Beginner AI - play action:', playAction);
        return playAction;
      case GAME_PHASES.SCORING:
        const scoreAction = this.getClaimScoreAction();
        console.log('Beginner AI - score action:', scoreAction);
        return scoreAction;
      default:
        console.log('Beginner AI - unknown phase:', this.gameState.phase);
        return null;
    }
  }

  private getDiscardAction(): AIAction | null {
    const currentPlayer = this.getCurrentPlayer();
    console.log('Beginner AI - getDiscardAction debug:', {
      currentPlayer,
      currentPlayerId: this.gameState.currentPlayerId,
      allPlayers: this.gameState.players.map(p => ({ id: p.id, handLength: p.hand.length })),
      phase: this.gameState.phase
    });
    
    if (!currentPlayer) {
      console.log('Beginner AI - no current player found');
      return null;
    }
    
    if (currentPlayer.hand.length !== 6) {
      console.log('Beginner AI - hand length is not 6:', currentPlayer.hand.length);
      return null;
    }

    // Randomly select 2 cards to discard
    const availableIndices = Array.from({ length: currentPlayer.hand.length }, (_, i) => i);
    const selectedIndices: number[] = [];
    
    for (let i = 0; i < 2; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length);
      selectedIndices.push(availableIndices[randomIndex]);
      availableIndices.splice(randomIndex, 1);
    }

    console.log('Beginner AI - selected discard indices:', selectedIndices);
    
    return {
      type: 'discardToCrib',
      playerId: currentPlayer.id,
      cardIndex: selectedIndices,
      timestamp: new Date()
    };
  }

  private getCutAction(): AIAction | null {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || this.gameState.deck.length === 0) return null;

    // Randomly select a cut position
    const cutIndex = Math.floor(Math.random() * this.gameState.deck.length);

    return {
      type: 'cutDeck',
      playerId: currentPlayer.id,
      cardIndex: cutIndex,
      timestamp: new Date()
    };
  }

  private getPlayAction(): AIAction | null {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.isCurrentTurn) return null;

    console.log('AI getPlayAction debug:', {
      currentPlayer: currentPlayer.username,
      handLength: currentPlayer.hand.length,
      currentPlayScore: this.gameState.playScore,
      hand: currentPlayer.hand.map(c => ({ card: c.displayName, value: c.value }))
    });

    // Find playable cards (cards that won't exceed 31)
    const playableCards: number[] = [];
    for (let i = 0; i < currentPlayer.hand.length; i++) {
      const card = currentPlayer.hand[i];
      const wouldExceed = this.gameState.playScore + card.value > 31;
      console.log(`Card ${i}: ${card.displayName} (value: ${card.value}), current score: ${this.gameState.playScore}, would exceed 31: ${wouldExceed}`);
      
      if (!wouldExceed) {
        playableCards.push(i);
      }
    }

    console.log('AI playable cards:', playableCards);

    if (playableCards.length === 0) {
      // No cards can be played, end turn
      console.log('AI cannot play any cards - ending turn (Go)');
      return {
        type: 'endTurn',
        playerId: currentPlayer.id,
        timestamp: new Date()
      };
    }

    // Randomly select a playable card
    const randomIndex = Math.floor(Math.random() * playableCards.length);
    const cardIndex = playableCards[randomIndex];
    const selectedCard = currentPlayer.hand[cardIndex];
    
    console.log(`AI selected card ${cardIndex}: ${selectedCard.displayName} (value: ${selectedCard.value}), new play score will be: ${this.gameState.playScore + selectedCard.value}`);

    return {
      type: 'playCard',
      playerId: currentPlayer.id,
      cardIndex,
      timestamp: new Date()
    };
  }

  private getClaimScoreAction(): AIAction | null {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return null;

    return {
      type: 'claimScore',
      playerId: currentPlayer.id,
      timestamp: new Date()
    };
  }
}

export class AIGameManager {
  private aiOpponent: AIOpponent;
  private gameState: GameState;
  //private isAITurn: boolean = false;

  private getRandomDelay(): number {
    return 1000 + Math.random() * 1000;
  }

  constructor(difficulty: string, gameState: GameState) {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        this.aiOpponent = new BeginnerAIOpponent(gameState);
        break;
      default:
        this.aiOpponent = new BeginnerAIOpponent(gameState);
    }
    this.gameState = gameState;
  }

  updateGameState(newGameState: GameState): void {
    console.log('AI Manager - updating game state:', {
      oldCurrentPlayerId: this.gameState.currentPlayerId,
      newCurrentPlayerId: newGameState.currentPlayerId,
      oldPhase: this.gameState.phase,
      newPhase: newGameState.phase,
      oldPlayScore: this.gameState.playScore,
      newPlayScore: newGameState.playScore,
      oldPlayPile: this.gameState.playPile.map(c => c.displayName),
      newPlayPile: newGameState.playPile.map(c => c.displayName)
    });
    
    this.gameState = newGameState;
    
    // Also update the AI opponent's game state to keep them in sync
    if (this.aiOpponent instanceof BeginnerAIOpponent) {
      // Update the AI opponent's game state reference
      (this.aiOpponent as any).gameState = newGameState;
      
      // Debug: Verify both are using the same state
      console.log('AI Manager - state sync verification:', {
        managerCurrentPlayerId: this.gameState.currentPlayerId,
        opponentCurrentPlayerId: (this.aiOpponent as any).gameState.currentPlayerId,
        statesMatch: this.gameState.currentPlayerId === (this.aiOpponent as any).gameState.currentPlayerId,
        managerPlayScore: this.gameState.playScore,
        opponentPlayScore: (this.aiOpponent as any).gameState.playScore,
        playScoresMatch: this.gameState.playScore === (this.aiOpponent as any).gameState.playScore
      });
    }
  }

  shouldTakeTurn(): boolean {
    const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
    console.log('AI Manager - shouldTakeTurn check:', {
      currentPlayer,
      currentPlayerId: this.gameState.currentPlayerId,
      isAITurn: currentPlayer?.id === 'ai-opponent',
      allPlayers: this.gameState.players.map(p => ({ 
        id: p.id, 
        username: p.username, 
        isCurrentTurn: p.isCurrentTurn,
        handLength: p.hand.length 
      }))
    });
    return currentPlayer?.id === 'ai-opponent';
  }

  getNextAction(): AIAction | null {
    if (!this.shouldTakeTurn()) return null;
    console.log('AI Manager - getting next action...');
    
    // Debug: Show current game state
    console.log('AI Manager - current game state for decision:', {
      phase: this.gameState.phase,
      currentPlayerId: this.gameState.currentPlayerId,
      playScore: this.gameState.playScore,
      playPile: this.gameState.playPile.map(c => c.displayName),
      players: this.gameState.players.map(p => ({
        id: p.id,
        username: p.username,
        handLength: p.hand.length,
        isCurrentTurn: p.isCurrentTurn
      }))
    });
    
    // Debug: Compare AI Manager vs AI Opponent game state
    if (this.aiOpponent instanceof BeginnerAIOpponent) {
      const opponentState = (this.aiOpponent as any).gameState;
      console.log('AI Manager vs AI Opponent state comparison:', {
        managerPlayScore: this.gameState.playScore,
        opponentPlayScore: opponentState.playScore,
        playScoresMatch: this.gameState.playScore === opponentState.playScore,
        managerPlayPile: this.gameState.playPile.map(c => c.displayName),
        opponentPlayPile: opponentState.playPile.map((c: any) => c.displayName),
        playPilesMatch: JSON.stringify(this.gameState.playPile) === JSON.stringify(opponentState.playPile)
      });
    }
    
    const action = this.aiOpponent.getNextAction();
    console.log('AI Manager - next action:', action);
    return action;
  }

  // Simulate AI thinking time
  async takeTurn(): Promise<AIAction | null> {
    if (!this.shouldTakeTurn()) return null;
    
    console.log('AI Manager - taking turn...');
    
    // Add a small delay to make AI moves feel more natural
    await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
    
    const action = this.getNextAction();
    console.log('AI Manager - generated action:', action);
    
    return action;
  }
}
