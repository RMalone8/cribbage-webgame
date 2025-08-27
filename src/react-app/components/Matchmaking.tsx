import React, { useState, useEffect } from 'react';
import { Player, GameInvite } from '../types/game';
import './Matchmaking.css';

interface MatchmakingProps {
  currentPlayer: Player;
  onGameStart: (gameId: string) => void;
  onBackToMenu: () => void;
}

export const Matchmaking: React.FC<MatchmakingProps> = ({ 
  currentPlayer, 
  onGameStart, 
  onBackToMenu 
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
  const [pendingInvites, setPendingInvites] = useState<GameInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<GameInvite[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    // Simulate finding online players
    const mockPlayers: Player[] = [
      { id: '1', username: 'Player1', isOnline: true, lastSeen: new Date() },
      { id: '2', username: 'Player2', isOnline: true, lastSeen: new Date() },
      { id: '3', username: 'Player3', isOnline: true, lastSeen: new Date() },
    ];
    setOnlinePlayers(mockPlayers.filter(p => p.id !== currentPlayer.id));

    // Simulate pending invites
    const mockInvites: GameInvite[] = [
      {
        id: '1',
        fromPlayer: { id: '4', username: 'Player4', isOnline: true, lastSeen: new Date() },
        toPlayer: currentPlayer,
        status: 'pending',
        timestamp: new Date()
      }
    ];
    setPendingInvites(mockInvites);
  }, [currentPlayer]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTime(prev => prev + 1);
        
        // Simulate finding a match after 5 seconds
        if (searchTime >= 5) {
          handleMatchFound();
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching, searchTime]);

  const startSearching = () => {
    setIsSearching(true);
    setSearchTime(0);
    
    // Simulate API call to join matchmaking
    console.log('Joining matchmaking queue...');
  };

  const stopSearching = () => {
    setIsSearching(false);
    setSearchTime(0);
    
    // Simulate API call to leave matchmaking
    console.log('Leaving matchmaking queue...');
  };

  const handleMatchFound = () => {
    setIsSearching(false);
    setSearchTime(0);
    
    // Simulate game creation
    const gameId = crypto.randomUUID();
    console.log(`Match found! Starting game: ${gameId}`);
    
    onGameStart(gameId);
  };

  const sendInvite = (toPlayer: Player) => {
    if (!inviteMessage.trim()) return;
    
    // Simulate sending invite
    const invite: GameInvite = {
      id: crypto.randomUUID(),
      fromPlayer: currentPlayer,
      toPlayer,
      status: 'pending',
      timestamp: new Date()
    };
    
    setSentInvites(prev => [...prev, invite]);
    setSelectedPlayer(null);
    setInviteMessage('');
    
    console.log(`Invite sent to ${toPlayer.username}`);
  };

  const acceptInvite = (invite: GameInvite) => {
    // Simulate accepting invite
    console.log(`Accepting invite from ${invite.fromPlayer.username}`);
    
    // Remove from pending invites
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    
    // Simulate game creation
    const gameId = crypto.randomUUID();
    onGameStart(gameId);
  };

  const declineInvite = (invite: GameInvite) => {
    // Simulate declining invite
    console.log(`Declining invite from ${invite.fromPlayer.username}`);
    
    // Remove from pending invites
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
  };

  const cancelInvite = (invite: GameInvite) => {
    // Simulate canceling invite
    console.log(`Canceling invite to ${invite.toPlayer.username}`);
    
    // Remove from sent invites
    setSentInvites(prev => prev.filter(i => i.id !== invite.id));
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="matchmaking">
      <div className="matchmaking-header">
        <h2>Find a Game</h2>
        <button className="back-button" onClick={onBackToMenu}>
          ← Back to Menu
        </button>
      </div>

      <div className="matchmaking-content">
        {/* Quick Match */}
        <div className="quick-match-section">
          <h3>Quick Match</h3>
          <p>Find an opponent quickly from the matchmaking queue</p>
          
          {!isSearching ? (
            <button 
              className="search-button primary"
              onClick={startSearching}
            >
              🎯 Find Match
            </button>
          ) : (
            <div className="searching-status">
              <div className="searching-spinner">🔍</div>
              <div className="searching-text">Searching for opponent...</div>
              <div className="search-time">{formatTime(searchTime)}</div>
              <button 
                className="search-button secondary"
                onClick={stopSearching}
              >
                Stop Searching
              </button>
            </div>
          )}
        </div>

        {/* Online Players */}
        <div className="online-players-section">
          <h3>Online Players</h3>
          <p>Challenge a specific player</p>
          
          <div className="players-list">
            {onlinePlayers.map(player => (
              <div key={player.id} className="player-item">
                <div className="player-info">
                  <span className="player-name">{player.username}</span>
                  <span className="player-status online">● Online</span>
                </div>
                <button 
                  className="invite-button"
                  onClick={() => setSelectedPlayer(player)}
                >
                  Challenge
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="pending-invites-section">
            <h3>Game Invites</h3>
            <div className="invites-list">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="invite-item">
                  <div className="invite-info">
                    <span className="invite-from">{invite.fromPlayer.username}</span>
                    <span className="invite-time">
                      {Math.floor((Date.now() - invite.timestamp.getTime()) / 1000)}s ago
                    </span>
                  </div>
                  <div className="invite-actions">
                    <button 
                      className="accept-button"
                      onClick={() => acceptInvite(invite)}
                    >
                      Accept
                    </button>
                    <button 
                      className="decline-button"
                      onClick={() => declineInvite(invite)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent Invites */}
        {sentInvites.length > 0 && (
          <div className="sent-invites-section">
            <h3>Sent Invites</h3>
            <div className="invites-list">
              {sentInvites.map(invite => (
                <div key={invite.id} className="invite-item">
                  <div className="invite-info">
                    <span className="invite-to">To: {invite.toPlayer.username}</span>
                    <span className="invite-time">
                      {Math.floor((Date.now() - invite.timestamp.getTime()) / 1000)}s ago
                    </span>
                  </div>
                  <div className="invite-actions">
                    <button 
                      className="cancel-button"
                      onClick={() => cancelInvite(invite)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {selectedPlayer && (
        <div className="invite-modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div className="invite-modal" onClick={e => e.stopPropagation()}>
            <h3>Challenge {selectedPlayer.username}</h3>
            <div className="invite-form">
              <label htmlFor="invite-message">Message (optional):</label>
              <textarea
                id="invite-message"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Add a friendly message..."
                rows={3}
              />
              <div className="invite-actions">
                <button 
                  className="send-invite-button primary"
                  onClick={() => sendInvite(selectedPlayer)}
                  disabled={!inviteMessage.trim()}
                >
                  Send Challenge
                </button>
                <button 
                  className="cancel-button secondary"
                  onClick={() => setSelectedPlayer(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
