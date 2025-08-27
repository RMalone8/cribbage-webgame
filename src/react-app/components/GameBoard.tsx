import React, { useState, useEffect } from 'react';
import { GameState, GamePlayer, Card, GAME_PHASES } from '../types/game';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  currentPlayerId: string;
  onAction: (action: any) => void;
  scoringNotification?: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, currentPlayerId, onAction, scoringNotification }) => {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [cutIndex, setCutIndex] = useState<number>(0);

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const opponent = gameState.players.find(p => p.id !== currentPlayerId);
  const isCurrentTurn = currentPlayer?.isCurrentTurn;

  useEffect(() => {
    // Reset selections when phase changes
    setSelectedCards([]);
    setCutIndex(0);
  }, [gameState.phase]);

  // Debug logging
  useEffect(() => {
    console.log('Game state updated:', {
      phase: gameState.phase,
      playerHands: gameState.players.map(p => ({ id: p.id, handLength: p.hand.length })),
      cribLength: gameState.crib.length,
      currentPlayerId: gameState.currentPlayerId
    });
  }, [gameState]);

  const handleCardClick = (cardIndex: number) => {
    if (gameState.phase === GAME_PHASES.DISCARDING) {
      // Toggle card selection for crib
      if (selectedCards.includes(cardIndex)) {
        setSelectedCards(selectedCards.filter(i => i !== cardIndex));
      } else if (selectedCards.length < 2) {
        setSelectedCards([...selectedCards, cardIndex]);
      }
    } else if (gameState.phase === GAME_PHASES.PLAYING && isCurrentTurn) {
      // Check if card can be played
      const card = currentPlayer?.hand[cardIndex];
      if (card && gameState.playScore + card.value <= 31) {
        // Play card
        onAction({
          type: 'playCard',
          playerId: currentPlayerId,
          cardIndex,
          timestamp: new Date()
        });
      } else if (card) {
        // Show feedback that card cannot be played
        console.log(`Cannot play ${card.displayName} - would exceed 31 (current: ${gameState.playScore}, card: ${card.value})`);
      }
    }
  };

  const handleDiscardToCrib = () => {
    if (selectedCards.length === 2) {
      console.log('Discarding cards:', selectedCards);
      console.log('Current player hand before discard:', currentPlayer?.hand);
      onAction({
        type: 'discardToCrib',
        playerId: currentPlayerId,
        cardIndex: selectedCards,
        timestamp: new Date()
      });
      setSelectedCards([]); // Clear selection after discarding
    }
  };

  const handleCutDeck = () => {
    onAction({
      type: 'cutDeck',
      playerId: currentPlayerId,
      cardIndex: cutIndex,
      timestamp: new Date()
    });
  };

  const handleEndTurn = () => {
    onAction({
      type: 'endTurn',
      playerId: currentPlayerId,
      timestamp: new Date()
    });
    setSelectedCards([]);
  };

  const renderCard = (card: Card, index: number, isSelectable: boolean = false, isSelected: boolean = false, isUnplayable: boolean = false) => (
    <div
      key={index}
      className={`card ${isSelectable ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isUnplayable ? 'unplayable' : ''}`}
      onClick={() => isSelectable && handleCardClick(index)}
    >
      <div className="card-content">
        <div className={`card-rank ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
          {card.rank}
        </div>
        <div className={`card-suit ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
          {card.suit === 'hearts' && '♥'}
          {card.suit === 'diamonds' && '♦'}
          {card.suit === 'clubs' && '♣'}
          {card.suit === 'spades' && '♠'}
        </div>
      </div>
    </div>
  );

  const renderCribbageBoard = () => (
    <div className="cribbage-board">
      <div className="board-header">
        <h3>Cribbage Board</h3>
        <div className="round-info">Round {gameState.round}</div>
      </div>
      
      <div className="board-grid">
        {/* Player 1 track */}
        <div className="player-track">
          <div className="player-name">{gameState.players[0]?.username}</div>
          <div className="track">
            {Array.from({ length: 121 }, (_, i) => (
              <div key={i} className={`hole ${i % 5 === 0 ? 'marker' : ''}`}>
                {gameState.players[0]?.pegs.some(peg => peg.position === i) && (
                  <div className={`peg ${gameState.players[0]?.pegs.find(p => p.position === i)?.isFrontPeg ? 'front' : 'back'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Player 2 track */}
        <div className="player-track">
          <div className="player-name">{gameState.players[1]?.username}</div>
          <div className="track">
            {Array.from({ length: 121 }, (_, i) => (
              <div key={i} className={`hole ${i % 5 === 0 ? 'marker' : ''}`}>
                {gameState.players[1]?.pegs.some(peg => peg.position === i) && (
                  <div className={`peg ${gameState.players[1]?.pegs.find(p => p.position === i)?.isFrontPeg ? 'front' : 'back'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlayerHand = (player: GamePlayer, isCurrentPlayer: boolean) => (
    <div className={`player-hand ${isCurrentPlayer ? 'current-player' : 'opponent'}`}>
      <div className="player-info">
        <h3>{player.username}</h3>
        <div className="player-status">
          {player.isCurrentTurn && <span className="turn-indicator">🎯 Your Turn</span>}
          {player.isDealer && <span className="dealer-indicator">👑 Dealer</span>}
          {player.hand.length === 4 && <span className="discarded-indicator">✅ Discarded</span>}
        </div>
      </div>
      
      <div className="hand-cards">
        {isCurrentPlayer ? (
          // Show current player's cards normally
          player.hand.map((card, index) => {
            // Check if card can be played during pegging phase
            const isPlayable = gameState.phase === GAME_PHASES.PLAYING ? 
              (gameState.playScore + card.value <= 31) : true;
            
            return renderCard(card, index, true, selectedCards.includes(index), !isPlayable);
          })
        ) : (
          // Show opponent's cards as face-down
          player.hand.map((_, index) => (
            <div key={index} className="card face-down">
              <div className="card-back">
                <div className="card-pattern">♠️</div>
              </div>
            </div>
          ))
        )}
        
        {/* Show played cards stacked on top of hand during pegging */}
        {gameState.phase === GAME_PHASES.PLAYING && gameState.playPile.length > 0 && (
          <div className="played-cards-overlay">
            {gameState.playPile
              .filter((_, pileIndex) => {
                // Only show cards played by this player
                const playerIndex = gameState.players.findIndex(p => p.id === player.id);
                const isPlayerTurn = pileIndex % 2 === playerIndex;
                return isPlayerTurn;
              })
              .map((card, index) => (
                <div 
                  key={`played-${index}`} 
                  className="played-card-overlay"
                  style={{
                    position: 'absolute',
                    top: `${Math.random() * 20 - 10}px`,
                    left: `${Math.random() * 40 - 20}px`,
                    zIndex: 100 + index
                  }}
                >
                  {renderCard(card, index, false, false)}
                </div>
              ))
            }
          </div>
        )}
      </div>
      
      <div className="hand-count">Cards: {player.hand.length}</div>
    </div>
  );

  const renderPlayArea = () => (
    <div className="play-area">
      <div className="play-info">
        <div className="play-score">
          <span className="score-label">Play Score:</span>
          <span className="score-value">{gameState.playScore}</span>
          <span className="score-limit">/ 31</span>
        </div>
        <div className="current-phase">Phase: {gameState.phase}</div>
      </div>
      
      <div className="play-pile">
        {gameState.playPile.length > 0 && (
          <div className="pile-header">Cards in Play:</div>
        )}
        {gameState.playPile.map((card, index) => (
          <div key={index} className="played-card">
            {renderCard(card, index, false, false)}
            <div className="card-index">{index + 1}</div>
          </div>
        ))}
      </div>
      
      {gameState.cutCard && (
        <div className="cut-card">
          <div className="cut-label">Cut Card:</div>
          {renderCard(gameState.cutCard, -1, false, false)}
        </div>
      )}
    </div>
  );

  const renderActionButtons = () => {
    switch (gameState.phase) {
      case GAME_PHASES.DISCARDING:
        return (
          <div className="action-buttons">
            <button
              className="action-button primary"
              disabled={selectedCards.length !== 2 || !currentPlayer || currentPlayer.hand.length === 4}
              onClick={handleDiscardToCrib}
            >
              {!currentPlayer || currentPlayer.hand.length === 4 ? 'Already Discarded' : `Discard to Crib (${selectedCards.length}/2)`}
            </button>
            {!currentPlayer?.isCurrentTurn && (
              <div className="ai-thinking">🤖 AI is thinking...</div>
            )}
          </div>
        );
        
      case GAME_PHASES.CUTTING:
        return (
          <div className="action-buttons">
            {currentPlayer?.isCurrentTurn ? (
              <>
                <div className="cut-controls">
                  <label>Cut at position:</label>
                  <input
                    type="range"
                    min="0"
                    max={gameState.deck.length - 1}
                    value={cutIndex}
                    onChange={(e) => setCutIndex(parseInt(e.target.value))}
                  />
                  <span>{cutIndex}</span>
                </div>
                <button
                  className="action-button primary"
                  onClick={handleCutDeck}
                >
                  Cut Deck
                </button>
              </>
            ) : (
              <div className="ai-thinking">🤖 AI is cutting the deck...</div>
            )}
          </div>
        );
        
      case GAME_PHASES.PLAYING:
        return (
          <div className="action-buttons">
            {currentPlayer?.isCurrentTurn ? (
              // Check if player has any playable cards
              (() => {
                const hasPlayableCards = currentPlayer.hand.some(card => 
                  gameState.playScore + card.value <= 31
                );
                
                if (hasPlayableCards) {
                  return (
                    <div className="play-instruction">
                      Click a card to play, or click "That's a Go!" if you can't play
                    </div>
                  );
                } else {
                  return (
                    <button
                      className="action-button secondary"
                      onClick={handleEndTurn}
                    >
                      That's a Go!
                    </button>
                  );
                }
              })()
            ) : (
              <div className="ai-thinking">🤖 AI is playing...</div>
            )}
          </div>
        );
        
      case GAME_PHASES.SCORING:
        return (
          <div className="action-buttons">
            <div className="scoring-options">
              <button
                className="action-button primary"
                onClick={() => onAction({
                  type: 'scoreHand',
                  playerId: currentPlayerId,
                  timestamp: new Date()
                })}
              >
                Score My Hand
              </button>
              <button
                className="action-button secondary"
                onClick={() => onAction({
                  type: 'scoreCrib',
                  playerId: currentPlayerId,
                  timestamp: new Date()
                })}
              >
                Score Crib
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (!currentPlayer || !opponent) {
    return <div className="game-board-error">Error: Player not found</div>;
  }

  return (
    <div className="game-board">
      <div className="game-header">
        <h2>Cribbage Game</h2>
        <div className="game-controls">
          <div className="game-status">
            Status: {gameState.status} | Phase: {gameState.phase}
          </div>
          {scoringNotification && (
            <div className="scoring-notification">
              🎉 {scoringNotification}
            </div>
          )}
          <button className="exit-button" onClick={() => onAction({
            type: 'exitGame',
            playerId: currentPlayerId,
            timestamp: new Date()
          })}>
            🚪 Exit & Save
          </button>
        </div>
      </div>
      
      <div className="game-layout">
        <div className="opponent-section">
          {renderPlayerHand(opponent, false)}
        </div>
        
        <div className="center-section">
          {renderCribbageBoard()}
          {renderPlayArea()}
          {renderActionButtons()}
        </div>
        
        <div className="current-player-section">
          {renderPlayerHand(currentPlayer, true)}
        </div>
      </div>
      
      <div className="game-info">
        <div className="crib-info">
          <h4>Crib ({gameState.crib.length}/4 cards)</h4>
          <div className="crib-cards">
            {gameState.crib.map((_, index) => (
              <div key={index} className="crib-card">
                <div className="card face-down">
                  <div className="card-back">
                    <div className="card-pattern">♠️</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
