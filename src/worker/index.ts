import { Hono } from "hono";
import { cors } from "hono/cors";
import bcrypt from "bcryptjs";

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  last_login: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  code: string;
  newPassword: string;
}

interface CustomContext {
  requestBody?: any;
  user?: any;
  sessionId?: string;
}

const app = new Hono<{ Bindings: Env; Variables: CustomContext }>();

// Enable CORS
app.use("*", cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "https://your-domain.com"],
  credentials: true,
}));

// Middleware to parse JSON
app.use("*", async (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT") {
    try {
      const body = await c.req.json();
      c.set("requestBody", body);
    } catch (e) {
      // Ignore parsing errors for non-JSON requests
    }
  }
  await next();
});

// Initialize database tables using inline schema
app.post("/api/init-db", async (c) => {
  try {
    const { DB } = c.env;
    
    // Create users table
    await DB.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Create password reset codes table
    await DB.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create user sessions table
    await DB.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create user profiles table
    await DB.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        preferences TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create game statistics table
    await DB.exec(`
      CREATE TABLE IF NOT EXISTS game_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        games_lost INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        highest_score INTEGER DEFAULT 0,
        average_score REAL DEFAULT 0.0,
        last_game_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await DB.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await DB.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await DB.exec(`CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified)`);

    return c.json({ success: true, message: "Database initialized successfully" });
  } catch (error) {
    console.error("Database initialization error:", error);
    return c.json({ success: false, error: "Failed to initialize database" }, 500);
  }
});

// Generate secure random code (6 digits)
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send password reset email using Resend
async function sendPasswordResetEmail(email: string, username: string, code: string, env: Env) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Reset Your Cribbage Game Password',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello ${username},</p>
          <p>You requested a password reset for your Cribbage Game account.</p>
          <p>Use the verification code below to reset your password:</p>
          <div style="background: #f8f9fa; border: 2px solid #e74c3c; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-family: monospace; font-size: 24px; font-weight: bold; color: #e74c3c;">
            ${code}
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this reset, you can safely ignore this email.</p>
        `
      })
    });

    if (response.ok) {
      return true;
    } else {
      console.error('Resend API error:', await response.text());
      return false;
    }
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return false;
  }
}

// User registration without email verification
app.post("/api/auth/register", async (c) => {
  try {
    const { DB } = c.env;
    const body = c.get("requestBody") as RegisterRequest;
    
    if (!body.username || !body.email || !body.password) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    // Validate input
    if (body.username.length < 3 || body.username.length > 20) {
      return c.json({ success: false, error: "Username must be 3-20 characters" }, 400);
    }

    if (body.password.length < 8) {
      return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
    }

    if (!body.email.includes("@")) {
      return c.json({ success: false, error: "Invalid email format" }, 400);
    }

    // Check if user already exists
    const existingUser = await DB.prepare(
      "SELECT id FROM users WHERE username = ? OR email = ?"
    ).bind(body.username, body.email).first();

    if (existingUser) {
      return c.json({ success: false, error: "Username or email already exists" }, 409);
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    // Insert new user (no email verification required)
    const result = await DB.prepare(
      "INSERT INTO users (username, email, password_hash, email_verified) VALUES (?, ?, ?, TRUE)"
    ).bind(body.username, body.email, passwordHash).run();

    if (result.success) {
      return c.json({ 
        success: true, 
        message: "Account created successfully! You can now log in.",
        user: {
          id: result.meta.last_row_id,
          username: body.username,
          email: body.email
          }
        }
      );
    } else {
      return c.json({ success: false, error: "Failed to create user" }, 500);
    }
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// User login without email verification requirement
app.post("/api/auth/login", async (c) => {
  try {
    const { DB } = c.env;
    const body = c.get("requestBody") as LoginRequest;
    
    if (!body.username || !body.password) {
      return c.json({ success: false, error: "Missing username or password" }, 400);
    }

    // Find user by username
    const user = await DB.prepare(
      "SELECT id, username, email, password_hash FROM users WHERE username = ? AND is_active = TRUE"
    ).bind(body.username).first<{ password_hash: string } & User>();

    if (!user) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, user.password_hash);
    if (!isValidPassword) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }

    // Update last login
    await DB.prepare(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(user.id).run();

    // Create session
    const sessionId = generateCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    
    await DB.prepare(
      "INSERT INTO user_sessions (user_id, session_id, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)"
    ).bind(user.id, sessionId, expiresAt, c.req.header("User-Agent") || "", c.req.header("CF-Connecting-IP") || "").run();

    // Set session cookie
    c.header("Set-Cookie", `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// Session authentication middleware
const authenticateSession = async (c: any, next: any) => {
  try {
    const { DB } = c.env;
    const sessionId = c.req.header("Cookie")?.match(/session=([^;]+)/)?.[1];
    
    if (!sessionId) {
      return c.json({ success: false, error: "Session required" }, 401);
    }

    // Find valid session
    const session = await DB.prepare(
      "SELECT user_id, expires_at FROM user_sessions WHERE session_id = ? AND expires_at > datetime('now')"
    ).bind(sessionId).first();

    if (!session) {
      return c.json({ success: false, error: "Invalid or expired session" }, 401);
    }

    // Get user data
    const user = await DB.prepare(
      "SELECT id, username, email FROM users WHERE id = ? AND is_active = TRUE"
    ).bind(session.user_id).first();

    if (!user) {
      return c.json({ success: false, error: "User not found" }, 401);
    }

    // Update session activity
    await DB.prepare(
      "UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = ?"
    ).bind(sessionId).run();

    c.set("user", user);
    c.set("sessionId", sessionId);
    await next();
  } catch (error) {
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
};

// Forgot password
app.post("/api/auth/forgot-password", async (c) => {
  try {
    const { DB } = c.env;
    const body = c.get("requestBody") as ForgotPasswordRequest;
    
    if (!body.email) {
      return c.json({ success: false, error: "Email required" }, 400);
    }

    // Find user by email
    const user = await DB.prepare(
      "SELECT id, username, email FROM users WHERE email = ? AND is_active = TRUE"
    ).bind(body.email).first<User>();

    if (!user) {
      // Don't reveal if email exists or not
      return c.json({ success: true, message: "If an account with that email exists, a password reset code has been sent." });
    }

    // Generate reset code
    const resetCode = generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store reset code
    await DB.prepare(
      "INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES (?, ?, ?)"
    ).bind(user.id, resetCode, expiresAt).run();

    // Send reset email
    const emailSent = await sendPasswordResetEmail(user.email, user.username, resetCode, c.env);
    
    if (emailSent) {
      return c.json({ success: true, message: "Password reset code sent to your email" });
    } else {
      return c.json({ success: false, error: "Failed to send reset email. Please try again." }, 500);
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// Reset password with code
app.post("/api/auth/reset-password", async (c) => {
  try {
    const { DB } = c.env;
    const body = c.get("requestBody") as ResetPasswordRequest;
    
    if (!body.code || !body.newPassword) {
      return c.json({ success: false, error: "Code and new password required" }, 400);
    }

    if (body.newPassword.length < 8) {
      return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
    }

    // Find valid reset code
    const resetCode = await DB.prepare(
      "SELECT user_id FROM password_reset_codes WHERE code = ? AND expires_at > datetime('now') AND used = FALSE"
    ).bind(body.code).first<{ user_id: number }>();

    if (!resetCode) {
      return c.json({ success: false, error: "Invalid or expired reset code" }, 400);
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(body.newPassword, saltRounds);

    // Update password
    await DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    ).bind(newPasswordHash, resetCode.user_id).run();

    // Mark code as used
    await DB.prepare(
      "UPDATE password_reset_codes SET used = TRUE WHERE code = ?"
    ).bind(body.code).run();

    return c.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// Get user profile (protected)
app.get("/api/user/profile", authenticateSession, async (c) => {
  try {
    const user = c.get("user");
    const { DB } = c.env;

    // Get user profile and stats
    const profile = await DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first();

    const stats = await DB.prepare(
      "SELECT * FROM game_stats WHERE user_id = ?"
    ).bind(user.id).first();

    return c.json({
      success: true,
      user: {
        ...user,
        profile,
        stats
      }
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// Logout (destroy session)
app.post("/api/auth/logout", authenticateSession, async (c) => {
  try {
    const sessionId = c.get("sessionId");
    const { DB } = c.env;

    // Delete session
    await DB.prepare(
      "DELETE FROM user_sessions WHERE session_id = ?"
    ).bind(sessionId).run();

    // Clear session cookie
    c.header("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");

    return c.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// Change password (protected)
app.post("/api/auth/change-password", authenticateSession, async (c) => {
  try {
    const user = c.get("user");
    const { DB } = c.env;
    const body = c.get("requestBody") as { currentPassword: string; newPassword: string };
    
    if (!body.currentPassword || !body.newPassword) {
      return c.json({ success: false, error: "Missing password fields" }, 400);
    }

    if (body.newPassword.length < 8) {
      return c.json({ success: false, error: "New password must be at least 8 characters" }, 400);
    }

    // Get current password hash
    const currentUser = await DB.prepare(
      "SELECT password_hash FROM users WHERE id = ?"
    ).bind(user.id).first<{ password_hash: string }>();

    if (!currentUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(body.currentPassword, currentUser.password_hash);
    if (!isValidPassword) {
      return c.json({ success: false, error: "Current password is incorrect" }, 401);
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(body.newPassword, saltRounds);

    // Update password
    await DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    ).bind(newPasswordHash, user.id).run();

    return c.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// Health check
app.get("/api/health", (c) => c.json({ status: "healthy", timestamp: new Date().toISOString() }));

export default app;
