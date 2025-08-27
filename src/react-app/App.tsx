// src/App.tsx

import { useState, useEffect } from "react";
import "./App.css";
import { GameBoard } from "./components/GameBoard";
import { Matchmaking } from "./components/Matchmaking";
import { GameState as GameStateType, Card } from "./types/game";
import { AIGameManager } from "./game/AIOpponent";

type GameState = 'menu' | 'game' | 'settings' | 'rules' | 'login' | 'register' | 'forgot-password' | 'matchmaking';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: User;
}

function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  // Game state
  const [currentGameState, setCurrentGameState] = useState<GameStateType | null>(null);
  const [isInGame, setIsInGame] = useState(false);
  const [discardedPlayers, setDiscardedPlayers] = useState<Set<string>>(new Set());
  const [aiManager, setAiManager] = useState<AIGameManager | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<string>('beginner');
  const [scoringNotification, setScoringNotification] = useState<string>('');
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [forgotPasswordForm, setForgotPasswordForm] = useState({ email: '' });
  const [resetPasswordForm, setResetPasswordForm] = useState({ code: '', newPassword: '', confirmPassword: '' });
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');
  const [showResetForm, setShowResetForm] = useState(false);

  // Check if user is already logged in on app load
  useEffect(() => {
    // Check for session cookie instead of localStorage
    const hasSession = document.cookie.includes('session=');
    if (hasSession) {
      // Verify session with backend
      checkSession();
    }
  }, []);

  // Check session validity
  const checkSession = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
  };

  // Handle AI turns automatically
  useEffect(() => {
    console.log('AI useEffect triggered:', {
      hasAiManager: !!aiManager,
      hasGameState: !!currentGameState,
      currentPlayerId: currentGameState?.currentPlayerId,
      shouldTakeTurn: aiManager?.shouldTakeTurn(),
      gameState: currentGameState,
      phase: currentGameState?.phase,
      players: currentGameState?.players.map(p => ({
        id: p.id,
        username: p.username,
        isCurrentTurn: p.isCurrentTurn,
        handLength: p.hand.length
      }))
    });
    
    if (aiManager && currentGameState && aiManager.shouldTakeTurn()) {
      console.log('AI should take turn. Current state:', {
        currentPlayerId: currentGameState.currentPlayerId,
        phase: currentGameState.phase,
        playerHands: currentGameState.players.map(p => ({ id: p.id, handLength: p.hand.length, isCurrentTurn: p.isCurrentTurn }))
      });
      
      const handleAITurn = async () => {
        console.log('AI is taking turn...');
        const aiAction = await aiManager.takeTurn();
        
        if (aiAction) {
          console.log('AI action:', aiAction);
          // Process the AI action
          handleGameAction(aiAction);
        }
      };
      
      // Small delay to make AI moves feel more natural
      const timer = setTimeout(handleAITurn, 500);
      return () => clearTimeout(timer);
    }
  }, [aiManager, currentGameState?.currentPlayerId, currentGameState?.phase]);

  // Debug game state changes
  useEffect(() => {
    if (currentGameState) {
      console.log('Game state changed:', {
        currentPlayerId: currentGameState.currentPlayerId,
        phase: currentGameState.phase,
        players: currentGameState.players.map(p => ({ id: p.id, handLength: p.hand.length, isCurrentTurn: p.isCurrentTurn }))
      });
    }
  }, [currentGameState]);

  // Debug currentPlayerId changes specifically
  useEffect(() => {
    if (currentGameState?.currentPlayerId) {
      console.log('Current player ID changed to:', currentGameState.currentPlayerId);
      
      // Check if AI should take turn
      if (aiManager) {
        const shouldTakeTurn = aiManager.shouldTakeTurn();
        console.log('AI should take turn?', shouldTakeTurn);
      }
    }
  }, [currentGameState?.currentPlayerId, aiManager]);

  const handleMenuAction = (action: GameState) => {
    setGameState(action);
    setAuthError('');
    setAuthSuccess('');
    setShowResetForm(false);
    setResetPasswordForm({ code: '', newPassword: '', confirmPassword: '' });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(loginForm),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
        setIsLoggedIn(true);
        setGameState('menu');
        setLoginForm({ username: '', password: '' });
        setAuthSuccess(data.message || 'Login successful!');
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (error) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        setAuthSuccess(data.message || 'Registration successful! You can now log in to your account.');
        setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
        // Redirect to login after a delay
        setTimeout(() => {
          handleMenuAction('login');
        }, 2000);
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch (error) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forgotPasswordForm),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        console.log('Password reset code sent successfully, setting showResetForm to true');
        setAuthSuccess(data.message || 'Password reset code sent! Check your email and enter the code below.');
        setShowResetForm(true);
        console.log('showResetForm should now be true');
      } else {
        setAuthError(data.error || 'Failed to send reset code');
      }
    } catch (error) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: resetPasswordForm.code,
          newPassword: resetPasswordForm.newPassword,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        setAuthSuccess(data.message || 'Password reset successfully!');
        setResetPasswordForm({ code: '', newPassword: '', confirmPassword: '' });
        setShowResetForm(false);
        // Redirect to login after a delay
        setTimeout(() => {
          handleMenuAction('login');
        }, 2000);
      } else {
        setAuthError(data.error || 'Password reset failed');
      }
    } catch (error) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear local state
    setUser(null);
    setIsLoggedIn(false);
    setGameState('menu');
    setIsInGame(false);
    setCurrentGameState(null);
    setAiManager(null);
  };

  // Game handling functions
  const handleStartGame = (gameId: string) => {
    // Create a full deck of 52 cards
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
    const deck: Card[] = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        const value = rank === 'A' ? 1 : rank === 'J' || rank === 'Q' || rank === 'K' ? 10 : parseInt(rank);
        const displayName = `${rank}${suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'clubs' ? '♣' : '♠'}`;
        deck.push({ suit, rank, value, displayName });
      }
    }
    
    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Deal 6 cards to each player
    const playerHand = deck.slice(0, 6);
    const opponentHand = deck.slice(6, 12);
    const remainingDeck = deck.slice(12);
    
    // Create the game state object once
    const newGameState: GameStateType = {
      id: gameId,
      status: 'playing' as const,
      players: [
        {
          id: user?.id.toString() || '',
          username: user?.username || 'Player',
          isOnline: true,
          lastSeen: new Date(),
          hand: playerHand,
          score: 0,
          pegs: [{ position: 0, isFrontPeg: true }],
          isDealer: false,
          isCurrentTurn: true
        },
        {
          id: 'ai-opponent',
          username: 'AI Opponent (Beginner)',
          isOnline: true,
          lastSeen: new Date(),
          hand: opponentHand, // This will be hidden in the UI
          score: 0,
          pegs: [{ position: 0, isFrontPeg: true }],
          isDealer: true,
          isCurrentTurn: false
        }
      ],
      currentPlayerId: user?.id.toString() || '',
      deck: remainingDeck,
      discardPile: [],
      cutCard: null,
      crib: [],
      round: 1,
      phase: 'discarding' as const,
      playPile: [],
      playScore: 0,
      completedRounds: [],
      originalHands: [],
      lastPlayTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setIsInGame(true);
    setGameState('game');
    setDiscardedPlayers(new Set()); // Reset discarded players tracking
    
    // Create AI manager with the same game state object
    const newAiManager = new AIGameManager(aiDifficulty, newGameState);
    setAiManager(newAiManager);
    
    // Set the game state after creating the AI manager
    setCurrentGameState(newGameState);
  };

  const handleGameAction = (action: any) => {
    console.log('Game action:', action);
    
    if (!currentGameState) return;
    
    const newGameState = { ...currentGameState };
    let actionProcessed = false;
    
    if (action.type === 'discardToCrib') {
      // Check if player has already discarded
      if (discardedPlayers.has(action.playerId)) {
        console.log('Player has already discarded');
        return;
      }
      
      // Simulate discarding cards
      if (action.cardIndex && action.cardIndex.length === 2) {
        const player = newGameState.players.find(p => p.id === action.playerId);
        if (player) {
          // Store the cards before removing them
          const discardedCards: Card[] = [];
          action.cardIndex.sort((a: number, b: number) => b - a).forEach((index: number) => {
            discardedCards.push(player.hand[index]);
          });
          
          // Remove discarded cards from hand
          action.cardIndex.sort((a: number, b: number) => b - a).forEach((index: number) => {
            player.hand.splice(index, 1);
          });
          
          // Add the actual discarded cards to crib
          newGameState.crib.push(...discardedCards);
          
          // Mark this player as having discarded
          setDiscardedPlayers(prev => new Set([...prev, action.playerId]));
          
          console.log('After discarding - Player hands:', newGameState.players.map(p => ({ id: p.id, handLength: p.hand.length })));
          console.log('Crib contents:', newGameState.crib);
          
          // Check if we're playing against AI (practice mode)
          const isAIPracticeMode = newGameState.players.some(p => p.id === 'ai-opponent');
          
          if (isAIPracticeMode) {
            // In AI practice mode, switch turns after each discard so AI can take its turn
            // Find the AI player and give them the turn
            const aiPlayer = newGameState.players.find(p => p.id === 'ai-opponent');
            if (aiPlayer) {
              // Set AI as current player and give them the turn
              newGameState.currentPlayerId = aiPlayer.id;
              newGameState.players.forEach(p => {
                p.isCurrentTurn = p.id === aiPlayer.id;
              });
              
              console.log('AI Practice Mode - Turn switched to AI after discard:', {
                from: action.playerId,
                to: newGameState.currentPlayerId,
                aiPlayer: aiPlayer.username,
                allPlayers: newGameState.players.map(p => ({
                  id: p.id,
                  username: p.username,
                  isCurrentTurn: p.isCurrentTurn,
                  handLength: p.hand.length
                }))
              });
            }
          } else {
            // In regular multiplayer mode, only check if both players have discarded
            console.log('Multiplayer Mode - Waiting for both players to discard');
          }
          
          // Check if both players have discarded
          if (newGameState.players.every(p => p.hand.length === 4)) {
            console.log('Both players have discarded, moving to cutting phase');
            newGameState.phase = 'cutting';
            // Switch to non-dealer for cutting
            const nonDealer = newGameState.players.find(p => !p.isDealer);
            if (nonDealer) {
              newGameState.currentPlayerId = nonDealer.id;
              newGameState.players.forEach(p => {
                p.isCurrentTurn = p.id === nonDealer.id;
              });
            }
          }
          
          actionProcessed = true;
        }
      }
    } else if (action.type === 'cutDeck') {
      // Simulate cutting the deck
      if (typeof action.cardIndex === 'number' && newGameState.deck.length > 0) {
        const cutIndex = Math.min(action.cardIndex, newGameState.deck.length - 1);
        newGameState.cutCard = newGameState.deck.splice(cutIndex, 1)[0];
        newGameState.phase = 'playing';
        
        // Store the original hands before pegging starts (for scoring later)
        newGameState.originalHands = newGameState.players.map(p => [...p.hand]);
        console.log('Stored original hands for scoring:', newGameState.originalHands.map(hand => hand.map(c => c.displayName)));
        
        // Switch to non-dealer to start playing
        const nonDealer = newGameState.players.find(p => !p.isDealer);
        if (nonDealer) {
          newGameState.currentPlayerId = nonDealer.id;
          newGameState.players.forEach(p => {
            p.isCurrentTurn = p.id === nonDealer.id;
          });
        }
        
        actionProcessed = true;
      }
    } else if (action.type === 'playCard') {
      // Simulate playing a card
      if (typeof action.cardIndex === 'number') {
        const player = newGameState.players.find(p => p.id === action.playerId);
        if (player && player.hand[action.cardIndex] && player.isCurrentTurn) {
          const card = player.hand.splice(action.cardIndex, 1)[0];
          newGameState.playPile.push(card);
          newGameState.playScore += card.value;
          
          console.log(`Card played: ${card.displayName}, new play score: ${newGameState.playScore}`);
          
          // Check for scoring opportunities
          if (newGameState.playScore === 15) {
            // Award 2 points for 15
            const playerIndex = newGameState.players.findIndex(p => p.id === player.id);
            if (playerIndex !== -1) {
              // Move front peg forward by 2
              const frontPeg = newGameState.players[playerIndex].pegs.find(p => p.isFrontPeg);
              if (frontPeg) {
                frontPeg.position = Math.min(120, frontPeg.position + 2);
                // Check for win
                if (frontPeg.position >= 120) {
                  newGameState.status = 'finished';
                }
              }
            }
            console.log(`${player.username} scored 2 points for 15!`);
            setScoringNotification(`${player.username} scored 2 points for 15!`);
            setTimeout(() => setScoringNotification(''), 3000);
          } else if (newGameState.playScore === 31) {
            // Award 2 points for 31
            const playerIndex = newGameState.players.findIndex(p => p.id === player.id);
            if (playerIndex !== -1) {
              // Move front peg forward by 2
              const frontPeg = newGameState.players[playerIndex].pegs.find(p => p.isFrontPeg);
              if (frontPeg) {
                frontPeg.position = Math.min(120, frontPeg.position + 2);
                // Check for win
                if (frontPeg.position >= 120) {
                  newGameState.status = 'finished';
                }
              }
            }
            console.log(`${player.username} scored 2 points for 31!`);
            setScoringNotification(`${player.username} scored 2 points for 31!`);
            setTimeout(() => setScoringNotification(''), 3000);
            // Reset play pile
            // Store the completed round before resetting
            if (newGameState.playPile.length > 0) {
              newGameState.completedRounds.push([...newGameState.playPile]);
              console.log('Stored completed round (31):', newGameState.playPile.map(c => c.displayName));
            }
            newGameState.playPile = [];
            newGameState.playScore = 0;
            console.log('Play pile reset - new round starting');
          } else {
            // Check for other scoring opportunities (pairs, runs, etc.)
            const scoringResult = calculatePeggingScore(newGameState.playPile);
            if (scoringResult.points > 0) {
              const playerIndex = newGameState.players.findIndex(p => p.id === player.id);
              if (playerIndex !== -1) {
                // Move front peg forward by the scored points
                const frontPeg = newGameState.players[playerIndex].pegs.find(p => p.isFrontPeg);
                if (frontPeg) {
                  frontPeg.position = Math.min(120, frontPeg.position + scoringResult.points);
                  // Check for win
                  if (frontPeg.position >= 120) {
                    newGameState.status = 'finished';
                  }
                }
              }
              console.log(`${player.username} scored ${scoringResult.points} points for ${scoringResult.reason}!`);
              setScoringNotification(`${player.username} scored ${scoringResult.points} points for ${scoringResult.reason}!`);
              setTimeout(() => setScoringNotification(''), 3000);
            }
          }
          
          // Switch turns
          newGameState.players.forEach(p => p.isCurrentTurn = !p.isCurrentTurn);
          const nextPlayer = newGameState.players.find(p => p.isCurrentTurn);
          newGameState.currentPlayerId = nextPlayer?.id || '';
          
          console.log('Turn switched:', {
            from: action.playerId,
            to: newGameState.currentPlayerId,
            nextPlayer: nextPlayer?.username
          });
          
          // Check if all cards have been played (both players have empty hands)
          if (newGameState.players.every(p => p.hand.length === 0)) {
            console.log('All cards played - moving to scoring phase');
            
            // Award 1 point for playing the last card
            const lastCardPlayer = newGameState.players.find(p => p.id === action.playerId);
            if (lastCardPlayer) {
              const playerIndex = newGameState.players.findIndex(p => p.id === lastCardPlayer.id);
              if (playerIndex !== -1) {
                const frontPeg = newGameState.players[playerIndex].pegs.find(p => p.isFrontPeg);
                if (frontPeg) {
                  frontPeg.position = Math.min(120, frontPeg.position + 1);
                  console.log(`${lastCardPlayer.username} scored 1 point for playing the last card!`);
                  setScoringNotification(`${lastCardPlayer.username} scored 1 point for playing the last card!`);
                  setTimeout(() => setScoringNotification(''), 3000);
                  
                  // Check for win
                  if (frontPeg.position >= 120) {
                    newGameState.status = 'finished';
                  }
                }
              }
            }
            
            newGameState.phase = 'scoring';
            
            // Restore the original hands for scoring
            newGameState.players.forEach((player, index) => {
              if (newGameState.originalHands[index]) {
                player.hand = [...newGameState.originalHands[index]];
                console.log(`Restored ${player.username}'s hand for scoring:`, player.hand.map(c => c.displayName));
              }
            });
            
            // Reset play pile and score
            newGameState.playPile = [];
            newGameState.playScore = 0;
          }
          
          actionProcessed = true;
        }
      }
    } else if (action.type === 'endTurn') {
      // End current player's turn
      newGameState.players.forEach(p => p.isCurrentTurn = !p.isCurrentTurn);
      const nextPlayer = newGameState.players.find(p => p.isCurrentTurn);
      newGameState.currentPlayerId = nextPlayer?.id || '';
      
      console.log('Turn ended, switching to:', {
        nextPlayer: nextPlayer?.username,
        nextPlayerId: newGameState.currentPlayerId
      });
      
      // Check if the next player also cannot play any cards
      if (nextPlayer) {
        const nextPlayerCanPlay = nextPlayer.hand.some(card => 
          newGameState.playScore + card.value <= 31
        );
        
        if (!nextPlayerCanPlay) {
          // Neither player can play - this is a "Go" situation
          console.log('Neither player can play - resetting play pile for new round');
          
          // Award 1 point to the player who claimed "Go"
          const goClaimer = newGameState.players.find(p => p.id === action.playerId);
          if (goClaimer) {
            const playerIndex = newGameState.players.findIndex(p => p.id === goClaimer.id);
            if (playerIndex !== -1) {
              // Move front peg forward by 1
              const frontPeg = newGameState.players[playerIndex].pegs.find(p => p.isFrontPeg);
              if (frontPeg) {
                frontPeg.position = Math.min(120, frontPeg.position + 1);
                // Check for win
                if (frontPeg.position >= 120) {
                  newGameState.status = 'finished';
                }
              }
            }
            console.log(`${goClaimer.username} scored 1 point for "Go"!`);
            setScoringNotification(`${goClaimer.username} scored 1 point for "Go"!`);
            setTimeout(() => setScoringNotification(''), 3000);
          }
          
          // Reset play pile and score for new round
          // Store the completed round before resetting
          if (newGameState.playPile.length > 0) {
            newGameState.completedRounds.push([...newGameState.playPile]);
            console.log('Stored completed round:', newGameState.playPile.map(c => c.displayName));
          }
          newGameState.playPile = [];
          newGameState.playScore = 0;
          
          // Switch back to the first player to start new round
          const firstPlayer = newGameState.players.find(p => p.id === action.playerId);
          if (firstPlayer) {
            newGameState.currentPlayerId = firstPlayer.id;
            newGameState.players.forEach(p => {
              p.isCurrentTurn = p.id === firstPlayer.id;
            });
            console.log('New round starting with:', firstPlayer.username);
            
            // Force AI manager to recognize the turn change
            if (aiManager) {
              console.log('Forcing AI manager update after Go turn switch');
              aiManager.updateGameState(newGameState);
              
              // If it's now the AI's turn, manually trigger the AI turn
              if (firstPlayer.id === 'ai-opponent') {
                console.log('AI should take turn after Go - manually triggering');
                // Small delay to ensure state is updated
                setTimeout(() => {
                  console.log('Timeout callback - checking AI manager state:', {
                    shouldTakeTurn: aiManager.shouldTakeTurn()
                  });
                  if (aiManager.shouldTakeTurn()) {
                    console.log('Manually triggering AI turn after Go');
                    aiManager.takeTurn().then(aiAction => {
                      if (aiAction) {
                        console.log('Manual AI action:', aiAction);
                        handleGameAction(aiAction);
                      }
                    });
                  } else {
                    console.log('AI manager says it should not take turn - this is unexpected');
                  }
                }, 500); // Increased from 100ms to 500ms
              }
            }
          }
        }
      }
      
      actionProcessed = true;
    } else if (action.type === 'claimScore') {
      // Handle claiming score
      console.log('Player claiming score:', action.playerId);
      actionProcessed = true;
    } else if (action.type === 'scoreHand') {
      // Handle scoring hand
      console.log('Player scoring hand:', action.playerId);
      const player = newGameState.players.find(p => p.id === action.playerId);
      if (player) {
        // Calculate a realistic hand score based on the restored hand
        const handScore = Math.floor(Math.random() * 8) + 2; // Random score between 2-9 for demo
        console.log(`${player.username} scored ${handScore} points for hand:`, player.hand.map(c => c.displayName));
        setScoringNotification(`${player.username} scored ${handScore} points for hand!`);
        setTimeout(() => setScoringNotification(''), 3000);
      }
      actionProcessed = true;
    } else if (action.type === 'scoreCrib') {
      // Handle scoring crib
      console.log('Player scoring crib:', action.playerId);
      const player = newGameState.players.find(p => p.id === action.playerId);
      if (player && player.isDealer) {
        // Only dealer can score crib
        const cribScore = Math.floor(Math.random() * 6) + 1; // Random score between 1-6 for demo
        console.log(`${player.username} scored ${cribScore} points for crib:`, newGameState.crib.map(c => c.displayName));
        setScoringNotification(`${player.username} scored ${cribScore} points for crib!`);
        setTimeout(() => setScoringNotification(''), 3000);
      }
      actionProcessed = true;
    } else if (action.type === 'exitGame') {
      // Handle exiting the game
      console.log('Player exiting game:', action.playerId);
      
      // Save game state (in a real app, this would save to database)
      if (currentGameState) {
        const gameData = {
          gameId: currentGameState.id,
          timestamp: new Date().toISOString(),
          finalState: currentGameState,
          players: currentGameState.players.map(p => ({
            id: p.id,
            username: p.username,
            finalScore: p.score
          }))
        };
        
        // Store in localStorage for now (in a real app, this would be saved to database)
        localStorage.setItem(`cribbage-game-${currentGameState.id}`, JSON.stringify(gameData));
        console.log('Game saved:', gameData);
      }
      
      // Return to menu
      handleBackToMenu();
      return; // Don't process this as a regular game action
    }
    
    if (actionProcessed) {
      // Update AI manager with new game state first
      if (aiManager) {
        console.log('Updating AI manager with new game state:', {
          currentPlayerId: newGameState.currentPlayerId,
          phase: newGameState.phase,
          players: newGameState.players.map(p => ({
            id: p.id,
            username: p.username,
            isCurrentTurn: p.isCurrentTurn,
            handLength: p.hand.length
          }))
        });
        aiManager.updateGameState(newGameState);
        
        // Debug: Check if AI manager now recognizes it should take turn
        console.log('After updating AI manager - shouldTakeTurn:', aiManager.shouldTakeTurn());
      }
      
      // Then update the React state
      setCurrentGameState(newGameState);
    }
  };

  const handleBackToMenu = () => {
    setGameState('menu');
    setAuthError('');
    setAuthSuccess('');
    setShowResetForm(false);
    setResetPasswordForm({ code: '', newPassword: '', confirmPassword: '' });
    
    // Exit game if in one
    if (isInGame) {
      setIsInGame(false);
      setCurrentGameState(null);
      setAiManager(null);
    }
  };

  const handleViewSavedGames = () => {
    // Get all saved games from localStorage
    const savedGames: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cribbage-game-')) {
        try {
          const gameData = JSON.parse(localStorage.getItem(key) || '{}');
          savedGames.push(gameData);
        } catch (e) {
          console.error('Error parsing saved game:', e);
        }
      }
    }
    
    if (savedGames.length === 0) {
      alert('No saved games found.');
    } else {
      console.log('Saved games:', savedGames);
      alert(`Found ${savedGames.length} saved games. Check the console for details.`);
    }
  };

  // Calculate pegging score for the current play pile
  const calculatePeggingScore = (playPile: Card[]): { points: number; reason: string } => {
    if (playPile.length < 2) return { points: 0, reason: '' };
    
    let totalPoints = 0;
    let reasons: string[] = [];
    
    // Check for pairs (last 2, 3, or 4 cards are the same rank)
    const lastCard = playPile[playPile.length - 1];
    let pairCount = 1;
    
    for (let i = playPile.length - 2; i >= 0; i--) {
      if (playPile[i].rank === lastCard.rank) {
        pairCount++;
      } else {
        break;
      }
    }
    
    if (pairCount === 2) {
      totalPoints += 2;
      reasons.push('pair');
    } else if (pairCount === 3) {
      totalPoints += 6;
      reasons.push('three of a kind');
    } else if (pairCount === 4) {
      totalPoints += 12;
      reasons.push('four of a kind');
    }
    
    // Check for runs (last 3+ cards form a sequence)
    if (playPile.length >= 3) {
      const lastThree = playPile.slice(-3);
      const sortedRanks = lastThree.map(c => getRankValue(c.rank)).sort((a, b) => a - b);
      
      if (sortedRanks[2] - sortedRanks[1] === 1 && sortedRanks[1] - sortedRanks[0] === 1) {
        // We have a run of 3
        totalPoints += 3;
        reasons.push('run of 3');
        
        // Check for longer runs
        if (playPile.length >= 4) {
          const lastFour = playPile.slice(-4);
          const sortedRanks4 = lastFour.map(c => getRankValue(c.rank)).sort((a, b) => a - b);
          
          if (sortedRanks4[3] - sortedRanks4[2] === 1 && sortedRanks4[2] - sortedRanks4[1] === 1 && sortedRanks4[1] - sortedRanks4[0] === 1) {
            totalPoints += 1; // Additional point for 4th card in run
            reasons.push('run of 4');
            
            if (playPile.length >= 5) {
              const lastFive = playPile.slice(-5);
              const sortedRanks5 = lastFive.map(c => getRankValue(c.rank)).sort((a, b) => a - b);
              
              if (sortedRanks5[4] - sortedRanks5[3] === 1 && sortedRanks5[3] - sortedRanks5[2] === 1 && sortedRanks5[2] - sortedRanks5[1] === 1 && sortedRanks5[1] - sortedRanks5[0] === 1) {
                totalPoints += 1; // Additional point for 5th card in run
                reasons.push('run of 5');
              }
            }
          }
        }
      }
    }
    
    // Check for flush (last 4+ cards are same suit)
    if (playPile.length >= 4) {
      const lastFour = playPile.slice(-4);
      const suit = lastFour[0].suit;
      if (lastFour.every(c => c.suit === suit)) {
        totalPoints += 4;
        reasons.push('flush of 4');
        
        if (playPile.length >= 5) {
          const lastFive = playPile.slice(-5);
          if (lastFive.every(c => c.suit === suit)) {
            totalPoints += 1; // Additional point for 5th card in flush
            reasons.push('flush of 5');
          }
        }
      }
    }
    
    return { 
      points: totalPoints, 
      reason: reasons.length > 0 ? reasons.join(', ') : '' 
    };
  };
  
  // Helper function to get numeric rank value for run calculations
  const getRankValue = (rank: string): number => {
    if (rank === 'A') return 1;
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
    return parseInt(rank);
  };

  const renderMenu = () => (
    <div className="menu-container">
      <div className="game-title">
        <h1>♠️ Cribbage ♥️</h1>
        <p className="subtitle">The classic card game of strategy and luck</p>
      </div>
      
      <div className="menu-buttons">
        {isLoggedIn ? (
          <>
            <button 
              className="menu-button play-button"
              onClick={() => handleMenuAction('matchmaking')}
            >
              🎮 Find Game
            </button>
            
            <button 
              className="menu-button play-button"
              onClick={() => handleMenuAction('game')}
            >
              🃏 Practice Game
            </button>
            
            <button 
              className="menu-button practice-button"
              onClick={() => handleStartGame('practice-' + Date.now())}
            >
              🤖 Practice vs AI
            </button>
            
            <button 
              className="menu-button saved-games-button"
              onClick={handleViewSavedGames}
            >
              📚 Saved Games
            </button>
            
            <div className="difficulty-selector">
              <label htmlFor="ai-difficulty">AI Difficulty:</label>
              <select
                id="ai-difficulty"
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
                className="difficulty-dropdown"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate" disabled>Intermediate (Coming Soon)</option>
                <option value="expert" disabled>Expert (Coming Soon)</option>
              </select>
            </div>
            
            <button 
              className="menu-button settings-button"
              onClick={() => handleMenuAction('settings')}
            >
              ⚙️ Settings
            </button>
            
            <button 
              className="menu-button rules-button"
              onClick={() => handleMenuAction('rules')}
            >
              📖 Rules
            </button>
            
            <div className="user-section">
              <span className="username">Welcome, {user?.username}!</span>
              <button 
                className="menu-button logout-button"
                onClick={handleLogout}
              >
                🚪 Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <button 
              className="menu-button play-button"
              onClick={() => handleMenuAction('game')}
            >
              🎮 Play Game (Guest)
            </button>
            
            <button 
              className="menu-button practice-button"
              onClick={() => handleStartGame('practice-' + Date.now())}
            >
              🤖 Practice vs AI
            </button>
            
            <button 
              className="menu-button saved-games-button"
              onClick={handleViewSavedGames}
            >
              📚 Saved Games
            </button>
            
            <div className="difficulty-selector">
              <label htmlFor="ai-difficulty-guest">AI Difficulty:</label>
              <select
                id="ai-difficulty-guest"
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
                className="difficulty-dropdown"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate" disabled>Intermediate (Coming Soon)</option>
                <option value="expert" disabled>Expert (Coming Soon)</option>
              </select>
            </div>
            
            <button 
              className="menu-button settings-button"
              onClick={() => handleMenuAction('settings')}
            >
              ⚙️ Settings
            </button>
            
            <button 
              className="menu-button rules-button"
              onClick={() => handleMenuAction('rules')}
            >
              📖 Rules
            </button>
            
            <div className="auth-buttons">
              <button 
                className="menu-button login-button"
                onClick={() => handleMenuAction('login')}
              >
                🔐 Login
              </button>
              <button 
                className="menu-button register-button"
                onClick={() => handleMenuAction('register')}
              >
                ✍️ Register
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderGame = () => {
    if (isInGame && currentGameState) {
      return (
        <GameBoard
          gameState={currentGameState}
          currentPlayerId={user?.id.toString() || ''}
          onAction={handleGameAction}
          scoringNotification={scoringNotification}
        />
      );
    }
    
    return (
      <div className="game-container">
        <div className="game-header">
          <h2>Cribbage Game</h2>
          <button className="back-button" onClick={handleBackToMenu}>
            ← Back to Menu
          </button>
        </div>
        <div className="game-board">
          <p>Game implementation coming soon...</p>
          <p>This will include the cribbage board, cards, and game logic.</p>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="back-button" onClick={handleBackToMenu}>
          ← Back to Menu
        </button>
      </div>
      <div className="settings-content">
        <div className="setting-item">
          <label>Sound Effects</label>
          <input type="checkbox" defaultChecked />
        </div>
        <div className="setting-item">
          <label>Music</label>
          <input type="checkbox" defaultChecked />
        </div>
        <div className="setting-item">
          <label>Difficulty</label>
          <select defaultValue="medium">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderRules = () => (
    <div className="rules-container">
      <div className="rules-header">
        <h2>How to Play Cribbage</h2>
        <button className="back-button" onClick={handleBackToMenu}>
          ← Back to Menu
        </button>
      </div>
      <div className="rules-content">
        <h3>Objective</h3>
        <p>Be the first player to score 121 points by forming card combinations.</p>
        
        <h3>Scoring</h3>
        <ul>
          <li><strong>Fifteens:</strong> Any combination of cards that add up to 15 (2 points)</li>
          <li><strong>Pairs:</strong> Two cards of the same rank (2 points)</li>
          <li><strong>Runs:</strong> Three or more consecutive cards (1 point per card)</li>
          <li><strong>Flush:</strong> Four cards of the same suit (4 points)</li>
          <li><strong>Nob:</strong> Jack of the same suit as the cut card (1 point)</li>
        </ul>
        
        <h3>Gameplay</h3>
        <p>Players take turns playing cards and scoring points during the play phase, then score their hands and crib.</p>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="login-container">
      <div className="login-header">
        <h2>Login</h2>
        <button className="back-button" onClick={handleBackToMenu}>
          ← Back to Menu
        </button>
      </div>
      
      {authError && <div className="error-message">{authError}</div>}
      {authSuccess && <div className="success-message">{authSuccess}</div>}
      
      <form className="login-form" onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            placeholder="Enter your username"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            placeholder="Enter your password"
            required
          />
        </div>
        
        <button type="submit" className="login-submit-button">
          Login
        </button>
      </form>
      
      <div className="auth-switch">
        <p>Don't have an account? <button className="link-button" onClick={() => handleMenuAction('register')}>Register here</button></p>
        <p>Forgot your password? <button className="link-button" onClick={() => handleMenuAction('forgot-password')}>Reset it here</button></p>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="register-container">
      <div className="register-header">
        <h2>Create Account</h2>
        <button className="back-button" onClick={handleBackToMenu}>
          ← Back to Menu
        </button>
      </div>
      
      {authError && <div className="error-message">{authError}</div>}
      {authSuccess && <div className="success-message">{authSuccess}</div>}
      
      <form className="register-form" onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="reg-username">Username:</label>
          <input
            type="text"
            id="reg-username"
            value={registerForm.username}
            onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
            placeholder="Choose a username (3-20 characters)"
            required
            minLength={3}
            maxLength={20}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="reg-email">Email:</label>
          <input
            type="email"
            id="reg-email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
            placeholder="Enter your email address"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="reg-password">Password:</label>
          <input
            type="password"
            id="reg-password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
            placeholder="Choose a password (min 8 characters)"
            required
            minLength={8}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="reg-confirm-password">Confirm Password:</label>
          <input
            type="password"
            id="reg-confirm-password"
            value={registerForm.confirmPassword}
            onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
            placeholder="Confirm your password"
            required
            minLength={8}
          />
        </div>
        
        <button type="submit" className="register-submit-button">
          Create Account
        </button>
      </form>
      
      <div className="auth-switch">
        <p>Already have an account? <button className="link-button" onClick={() => handleMenuAction('login')}>Login here</button></p>
      </div>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="forgot-password-container">
      <div className="forgot-password-header">
        <h2>{showResetForm ? 'Reset Password' : 'Forgot Password'}</h2>
        <button className="back-button" onClick={handleBackToMenu}>
          ← Back to Menu
        </button>
      </div>
      
      {authError && <div className="error-message">{authError}</div>}
      {authSuccess && <div className="success-message">{authSuccess}</div>}
      
      {!showResetForm ? (
        <form className="forgot-password-form" onSubmit={handleForgotPassword}>
          <div className="form-group">
            <label htmlFor="forgot-email">Email Address:</label>
            <input
              type="email"
              id="forgot-email"
              value={forgotPasswordForm.email}
              onChange={(e) => setForgotPasswordForm({ ...forgotPasswordForm, email: e.target.value })}
              placeholder="Enter your email address"
              required
            />
          </div>
          
          <button type="submit" className="forgot-password-submit-button">
            Send Reset Code
          </button>
        </form>
      ) : (
        <div>
          <form className="reset-password-form" onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="reset-code">Reset Code:</label>
              <input
                type="text"
                id="reset-code"
                value={resetPasswordForm.code}
                onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, code: e.target.value })}
                placeholder="Enter the 6-digit code from your email"
                required
                maxLength={6}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="reset-new-password">New Password:</label>
              <input
                type="password"
                id="reset-new-password"
                value={resetPasswordForm.newPassword}
                onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                placeholder="Enter new password (min 8 characters)"
                required
                minLength={8}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="reset-confirm-password">Confirm New Password:</label>
              <input
                type="password"
                id="reset-confirm-password"
                value={resetPasswordForm.confirmPassword}
                onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                required
                minLength={8}
              />
            </div>
            
            <button type="submit" className="reset-password-submit-button">
              Reset Password
            </button>
          </form>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="link-button"
              onClick={() => {
                setShowResetForm(false);
                setAuthSuccess('');
                setResetPasswordForm({ code: '', newPassword: '', confirmPassword: '' });
              }}
            >
              ← Back to Email Form
            </button>
          </div>
        </div>
      )}
      
      <div className="auth-switch">
        <p>Remember your password? <button className="link-button" onClick={() => handleMenuAction('login')}>Login here</button></p>
      </div>
    </div>
  );

  return (
    <div className="app">
      {gameState === 'menu' && renderMenu()}
      {gameState === 'game' && renderGame()}
      {gameState === 'settings' && renderSettings()}
      {gameState === 'rules' && renderRules()}
      {gameState === 'login' && renderLogin()}
      {gameState === 'register' && renderRegister()}
      {gameState === 'forgot-password' && renderForgotPassword()}
      {gameState === 'matchmaking' && (
        <Matchmaking
          currentPlayer={{
            id: user?.id.toString() || 'guest',
            username: user?.username || 'Guest',
            isOnline: true,
            lastSeen: new Date()
          }}
          onGameStart={handleStartGame}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
