// src/App.tsx

import { useState, useEffect } from "react";
import "./App.css";

type GameState = 'menu' | 'game' | 'settings' | 'rules' | 'login' | 'register' | 'forgot-password';

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

  const handleMenuAction = (action: GameState) => {
    setGameState(action);
    setAuthError('');
    setAuthSuccess('');
    setShowResetForm(false);
    setResetPasswordForm({ code: '', newPassword: '', confirmPassword: '' });
  };

  const handleBackToMenu = () => {
    setGameState('menu');
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
  };

  const renderMenu = () => (
    <div className="menu-container">
      <div className="game-title">
        <h1>♠️ Cribbage ♥️</h1>
        <p className="subtitle">The classic card game of strategy and luck</p>
      </div>
      
      <div className="menu-buttons">
        <button 
          className="menu-button play-button"
          onClick={() => handleMenuAction('game')}
        >
          🎮 Play Game
        </button>
        
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
        
        {!isLoggedIn ? (
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
        ) : (
          <div className="user-section">
            <span className="username">Welcome, {user?.username}!</span>
            <button 
              className="menu-button logout-button"
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderGame = () => (
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
          <li><strong>Nob:</strong> Jack of the same suit as the starter card (1 point)</li>
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
    </div>
  );
}

export default App;
