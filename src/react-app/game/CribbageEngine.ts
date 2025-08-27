import { Card, GameState, GamePlayer, SCORING, GAME_PHASES } from '../types/game';

export class CribbageEngine {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  // Initialize a new game
  static initializeGame(player1: GamePlayer, player2: GamePlayer): GameState {
    const deck = CribbageEngine.createDeck();
    const shuffledDeck = CribbageEngine.shuffleDeck(deck);
    
    // Deal 6 cards to each player
    const player1Hand = shuffledDeck.slice(0, 6);
    const player2Hand = shuffledDeck.slice(6, 12);
    const remainingDeck = shuffledDeck.slice(12);

    return {
      id: crypto.randomUUID(),
      status: 'waiting',
      players: [
        { ...player1, hand: player1Hand, score: 0, pegs: [{ position: 0, isFrontPeg: true }], isDealer: true, isCurrentTurn: false },
        { ...player2, hand: player2Hand, score: 0, pegs: [{ position: 0, isFrontPeg: true }], isDealer: false, isCurrentTurn: true }
      ],
      currentPlayerId: player2.id, // Non-dealer goes first
      deck: remainingDeck,
      discardPile: [],
      cutCard: null,
      crib: [],
      round: 1,
      phase: GAME_PHASES.DISCARDING,
      playPile: [],
      playScore: 0,
      completedRounds: [],
      originalHands: [],
      lastPlayTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Create a standard 52-card deck
  private static createDeck(): Card[] {
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        const value = rank === 'A' ? 1 : rank === 'J' || rank === 'Q' || rank === 'K' ? 10 : parseInt(rank);
        const displayName = `${rank}${this.getSuitSymbol(suit)}`;
        deck.push({ suit, rank, value, displayName });
      }
    }

    return deck;
  }

  // Get suit symbols for display
  private static getSuitSymbol(suit: Card['suit']): string {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    return symbols[suit];
  }

  // Shuffle the deck using Fisher-Yates algorithm
  private static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Discard cards to crib
  discardToCrib(playerId: string, cardIndices: number[]): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player || cardIndices.length !== 2) return false;

    // Check if player has already discarded (hand should have 6 cards initially)
    if (player.hand.length !== 6) {
      console.log('Player has already discarded or hand size is incorrect:', player.hand.length);
      return false;
    }

    console.log('discardToCrib', playerId, cardIndices);
    console.log('player', player);

    const discardedCards: Card[] = [];
    for (const index of cardIndices.sort((a, b) => b - a)) {
      if (index >= 0 && index < player.hand.length) {
        discardedCards.push(player.hand.splice(index, 1)[0]);
      }
    }

    console.log('discardedCards', discardedCards);

    if (discardedCards.length === 2) {
      this.gameState.crib.push(...discardedCards);
      // Don't change phase here - let GameLoop handle it when both players have discarded
      return true;
    }

    return false;
  }

  // Cut the deck to reveal cut card
  cutDeck(cutIndex: number): boolean {
    if (this.gameState.deck.length === 0) return false;
    
    this.gameState.cutCard = this.gameState.deck.splice(cutIndex, 1)[0];
    this.gameState.phase = GAME_PHASES.PLAYING;
    this.gameState.playScore = 0;
    this.gameState.playPile = [];
    
    return true;
  }

  // Play a card during the play phase
  playCard(playerId: string, cardIndex: number): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player || !player.isCurrentTurn || cardIndex < 0 || cardIndex >= player.hand.length) {
      return false;
    }

    const card = player.hand[cardIndex];
    const newPlayScore = this.gameState.playScore + card.value;

    // Check if play would exceed 31
    if (newPlayScore > 31) {
      return false;
    }

    // Remove card from hand and add to play pile
    player.hand.splice(cardIndex, 1);
    this.gameState.playPile.push(card);
    this.gameState.playScore = newPlayScore;

    // Score the play
    const playScore = this.scorePlay(this.gameState.playPile);
    if (playScore > 0) {
      this.addScore(playerId, playScore);
    }

    // Check for "Go" or end of play
    if (newPlayScore === 31) {
      this.addScore(playerId, SCORING.LAST_CARD);
      this.endPlayPhase();
    } else if (this.cannotPlay(playerId)) {
      this.addScore(playerId, SCORING.GO);
      this.endPlayPhase();
    } else {
      this.nextTurn();
    }

    return true;
  }

  // Check if a player cannot play any cards
  private cannotPlay(playerId: string): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return true;

    return player.hand.every(card => this.gameState.playScore + card.value > 31);
  }

  // End the play phase and move to scoring
  private endPlayPhase(): void {
    this.gameState.phase = GAME_PHASES.SCORING;
    this.gameState.playScore = 0;
    this.gameState.playPile = [];
  }

  // Move to next player's turn
  private nextTurn(): void {
    const currentPlayerIndex = this.gameState.players.findIndex(p => p.id === this.gameState.currentPlayerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % this.gameState.players.length;
    
    this.gameState.players[currentPlayerIndex].isCurrentTurn = false;
    this.gameState.players[nextPlayerIndex].isCurrentTurn = true;
    this.gameState.currentPlayerId = this.gameState.players[nextPlayerIndex].id;
  }

  // Score the play pile for combinations
  private scorePlay(playPile: Card[]): number {
    let score = 0;
    
    // Score for 15
    if (this.calculatePlaySum(playPile) === 15) {
      score += SCORING.FIFTEEN;
    }

    // Score for pairs, triples, quads
    score += this.scorePairs(playPile);

    // Score for runs
    score += this.scoreRuns(playPile);

    return score;
  }

  // Calculate sum of play pile
  private calculatePlaySum(playPile: Card[]): number {
    return playPile.reduce((sum, card) => sum + card.value, 0);
  }

  // Score pairs, triples, quads
  private scorePairs(playPile: Card[]): number {
    if (playPile.length < 2) return 0;

    const lastCard = playPile[playPile.length - 1];
    let consecutiveCount = 1;

    for (let i = playPile.length - 2; i >= 0; i--) {
      if (playPile[i].rank === lastCard.rank) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    switch (consecutiveCount) {
      case 2: return SCORING.PAIR;
      case 3: return SCORING.TRIPLE;
      case 4: return SCORING.QUAD;
      default: return 0;
    }
  }

  // Score runs
  private scoreRuns(playPile: Card[]): number {
    if (playPile.length < 3) return 0;

    // Check for runs starting from the end
    for (let runLength = playPile.length; runLength >= 3; runLength--) {
      const endCards = playPile.slice(-runLength);
      if (this.isRun(endCards)) {
        return runLength;
      }
    }

    return 0;
  }

  // Check if cards form a run
  private isRun(cards: Card[]): boolean {
    const sortedCards = [...cards].sort((a, b) => this.getRankValue(a.rank) - this.getRankValue(b.rank));
    
    for (let i = 1; i < sortedCards.length; i++) {
      if (this.getRankValue(sortedCards[i].rank) - this.getRankValue(sortedCards[i-1].rank) !== 1) {
        return false;
      }
    }
    
    return true;
  }

  // Get numeric value of rank for run checking
  private getRankValue(rank: Card['rank']): number {
    if (rank === 'A') return 1;
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
    return parseInt(rank);
  }

  // Score a player's hand
  scoreHand(playerId: string): number {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player || !this.gameState.cutCard) return 0;

    const allCards = [...player.hand, this.gameState.cutCard];
    let score = 0;

    // Score for 15s
    score += this.scoreFifteens(allCards);

    // Score for pairs
    score += this.scoreHandPairs(allCards);

    // Score for runs
    score += this.scoreHandRuns(allCards);

    // Score for flush
    score += this.scoreFlush(allCards);

    // Score for nob
    score += this.scoreNob(player.hand);

    return score;
  }

  // Claim score for a player's hand and add it to their total
  claimHandScore(playerId: string): number {
    const score = this.scoreHand(playerId);
    if (score > 0) {
      this.addScore(playerId, score);
    }
    return score;
  }

  // Score 15s in hand
  private scoreFifteens(cards: Card[]): number {
    let score = 0;
    
    // Generate all combinations of cards
    for (let i = 1; i <= cards.length; i++) {
      const combinations = this.getCombinations(cards, i);
      for (const combo of combinations) {
        if (combo.reduce((sum, card) => sum + card.value, 0) === 15) {
          score += SCORING.FIFTEEN;
        }
      }
    }
    
    return score;
  }

  // Get all combinations of cards of given length
  private getCombinations(cards: Card[], length: number): Card[][] {
    if (length === 0) return [[]];
    if (length > cards.length) return [];
    
    const result: Card[][] = [];
    
    for (let i = 0; i <= cards.length - length; i++) {
      const head = cards[i];
      const tailCombos = this.getCombinations(cards.slice(i + 1), length - 1);
      
      for (const combo of tailCombos) {
        result.push([head, ...combo]);
      }
    }
    
    return result;
  }

  // Score pairs in hand
  private scoreHandPairs(cards: Card[]): number {
    const rankCounts = new Map<Card['rank'], number>();
    
    for (const card of cards) {
      rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    }
    
    let score = 0;
    for (const count of rankCounts.values()) {
      if (count >= 2) {
        score += count * (count - 1) / 2 * SCORING.PAIR;
      }
    }
    
    return score;
  }

  // Score runs in hand
  private scoreHandRuns(cards: Card[]): number {
    const rankCounts = new Map<Card['rank'], number>();
    
    for (const card of cards) {
      rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    }
    
    const sortedRanks = Array.from(rankCounts.keys()).sort((a, b) => this.getRankValue(a) - this.getRankValue(b));
    
    let maxRunLength = 0;
    let currentRunLength = 1;
    
    for (let i = 1; i < sortedRanks.length; i++) {
      if (this.getRankValue(sortedRanks[i]) - this.getRankValue(sortedRanks[i-1]) === 1) {
        currentRunLength++;
      } else {
        maxRunLength = Math.max(maxRunLength, currentRunLength);
        currentRunLength = 1;
      }
    }
    
    maxRunLength = Math.max(maxRunLength, currentRunLength);
    
    if (maxRunLength >= 3) {
      return maxRunLength;
    }
    
    return 0;
  }

  // Score flush in hand
  private scoreFlush(cards: Card[]): number {
    const suitCounts = new Map<Card['suit'], number>();
    
    for (const card of cards) {
      suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
    }
    
    for (const count of suitCounts.values()) {
      if (count >= 4) {
        return count === 5 ? SCORING.FLUSH_5 : SCORING.FLUSH_4;
      }
    }
    
    return 0;
  }

  // Score nob (Jack of same suit as cut card)
  private scoreNob(hand: Card[]): number {
    if (!this.gameState.cutCard) return 0;
    
    const jack = hand.find(card => card.rank === 'J' && card.suit === this.gameState.cutCard!.suit);
    return jack ? SCORING.NOB : 0;
  }

  // Add score to player and update pegs
  private addScore(playerId: string, points: number): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return;

    player.score += points;
    
    // Update pegs (alternating between front and back)
    const currentPeg = player.pegs.find(p => p.isFrontPeg);
    if (currentPeg) {
      currentPeg.position = Math.min(120, currentPeg.position + points);
      
      // Check for win
      if (currentPeg.position >= 120) {
        this.gameState.status = 'finished';
      }
    }
  }

  // Get current game state
  getGameState(): GameState {
    return { ...this.gameState };
  }

  // Check if game is over
  isGameOver(): boolean {
    return this.gameState.status === 'finished';
  }

  // Get winner
  getWinner(): GamePlayer | null {
    if (!this.isGameOver()) return null;
    
    const winner = this.gameState.players.find(p => p.pegs.some(peg => peg.position >= 120));
    return winner || null;
  }
}
