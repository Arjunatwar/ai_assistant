const express = require("express");
const cors = require("cors");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://YOUR-FRONTEND.netlify.app"
    ],
    credentials: true
  })
);
const OpenAI = require("openai");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");

require("dotenv").config();
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing from .env");
  process.exit(1);
}
const {
  MailerSend,
  EmailParams,
  Sender,
  Recipient,
} = require("mailersend");

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

// ============================================================
// CONFIG
// ============================================================

const app = express();

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret";

const MODEL =
  process.env.AI_MODEL || "agnes-2.5-flash";

const MAX_HISTORY = 30;

const MAX_IMAGE_COUNT = 4;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "15mb",
  })
);

app.use(cookieParser());


// ============================================================
// DATABASE
// ============================================================

const db = new Database("ai-chat.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");


// Users

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT UNIQUE,

    email TEXT UNIQUE,

    name TEXT,

    password_hash TEXT,

    google_id TEXT UNIQUE,

    provider TEXT DEFAULT 'local',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// Chats

db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,

    user_id INTEGER NOT NULL,

    title TEXT DEFAULT 'New conversation',

    context TEXT DEFAULT '',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  )
`);


// Messages

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    chat_id TEXT NOT NULL,

    role TEXT NOT NULL,

    content TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (chat_id)
      REFERENCES chats(id)
      ON DELETE CASCADE
  )
`);


// Indexes

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chats_user
  ON chats(user_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages(chat_id)
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  )
`);


// ============================================================
// DEFAULT ADMIN
// ============================================================

async function createDefaultAdmin() {
  try {
    const existingAdmin = db
      .prepare(`
        SELECT id
        FROM users
        WHERE username = ?
      `)
      .get("admin");

    if (!existingAdmin) {
      const passwordHash =
        await bcrypt.hash("admin@123", 12);

      db.prepare(`
        INSERT INTO users
        (
          username,
          name,
          password_hash,
          provider
        )
        VALUES (?, ?, ?, ?)
      `).run(
        "admin",
        "Administrator",
        passwordHash,
        "local"
      );

    }
  } catch (error) {
    console.error(
      "Admin creation error:",
      error
    );
  }
}


// ============================================================
// OPENAI CLIENT
// ============================================================

const client = new OpenAI({
  baseURL: "https://router.bynara.id/v1",
  apiKey: process.env.OPENAI_API_KEY,
});


// ============================================================
// GOOGLE
// ============================================================

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);


// ============================================================
// HELPERS
// ============================================================

function generateId() {
  return crypto.randomUUID();
}


function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}


function setAuthCookie(res, token) {
  res.cookie("auth_token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000
});
}


function getUserById(userId) {
  return db
    .prepare(`
      SELECT
        id,
        username,
        email,
        name,
        provider,
        created_at
      FROM users
      WHERE id = ?
    `)
    .get(userId);
}


function getUserChat(chatId, userId) {
  return db
    .prepare(`
      SELECT *
      FROM chats
      WHERE id = ?
      AND user_id = ?
    `)
    .get(chatId, userId);
}


function getChatMessages(chatId) {
  return db
    .prepare(`
      SELECT
        id,
        chat_id,
        role,
        content,
        created_at
      FROM messages
      WHERE chat_id = ?
      ORDER BY id ASC
    `)
    .all(chatId);
}


function saveMessage(
  chatId,
  role,
  content
) {
  const result = db
    .prepare(`
      INSERT INTO messages
      (
        chat_id,
        role,
        content,
        created_at
      )
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .run(
      chatId,
      role,
      content
    );

  db.prepare(`
    UPDATE chats
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(chatId);

  return result.lastInsertRowid;
}

function cleanAiText(text) {
  if (!text) return "";

  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}


function parseJsonResponse(text) {
  const cleaned =
    cleanAiText(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting JSON object
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {
      const possibleJson =
        cleaned.slice(
          start,
          end + 1
        );

      return JSON.parse(
        possibleJson
      );
    }

    throw new Error(
      "AI did not return valid JSON."
    );
  }
}


// ============================================================
// IMPORTANT:
// BUILD USER CONTENT CORRECTLY
// ============================================================

function buildUserContent(
  text,
  images = []
) {
  const validImages =
    Array.isArray(images)
      ? images.filter(
          (image) =>
            typeof image === "string" &&
            image.startsWith("data:image/")
        )
      : [];


  // ----------------------------------------------------------
  // TEXT ONLY
  // ----------------------------------------------------------
  //
  // THIS IS THE IMPORTANT FIX.
  //
  // We return a STRING.
  //
  // We do NOT create image_url here.
  //

  if (validImages.length === 0) {
    return text || "";
  }


  // ----------------------------------------------------------
  // IMAGE REQUEST
  // ----------------------------------------------------------

  const content = [];


  if (text && text.trim()) {
    content.push({
      type: "text",
      text: text.trim(),
    });
  } else {
    content.push({
      type: "text",
      text: "Please analyze the uploaded image.",
    });
  }


  for (
    const image of validImages.slice(
      0,
      MAX_IMAGE_COUNT
    )
  ) {
    content.push({
      type: "image_url",

      image_url: {
        url: image,
      },
    });
  }


  return content;
}


// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

function authenticate(
  req,
  res,
  next
) {
  try {

    const token =
      req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({
        error: "Not authenticated",
      });
    }


    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );


    const user =
      getUserById(
        decoded.userId
      );


    if (!user) {
      return res.status(401).json({
        error: "User not found",
      });
    }


    req.user = user;

    next();

  } catch (error) {

    return res.status(401).json({
      error: "Invalid or expired session",
    });

  }
}


// ============================================================
// AUTH - LOGIN
// ============================================================

app.post(
  "/api/auth/login",
  async (req, res) => {

    try {

      const {
        username,
        password,
      } = req.body;


      if (
        !username ||
        !password
      ) {
        return res.status(400).json({
          error:
            "Username and password are required",
        });
      }


      const cleanUsername =
        username
          .trim()
          .toLowerCase();


      const user =
        db
          .prepare(`
            SELECT *
            FROM users
            WHERE username = ?
          `)
          .get(cleanUsername);


      if (!user) {
        return res.status(401).json({
          error:
            "Invalid username or password",
        });
      }


      if (!user.password_hash) {
        return res.status(401).json({
          error:
            "This account uses Google login",
        });
      }


      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!valid) {
        return res.status(401).json({
          error:
            "Invalid username or password",
        });
      }


      const token =
        createToken(user);


      setAuthCookie(
        res,
        token
      );


      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          provider: user.provider,
        },
      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        error:
          "Login failed",
      });

    }

  }
);


// ============================================================
// AUTH - REGISTER
// ============================================================

app.post("/api/auth/register", async (req, res) => {
  try {

    const { username, password, name, email } = req.body || {};

    if (!username || !password || !name) {
      return res.status(400).json({
        error: "Name, username and password are required.",
      });
    }

    const cleanUsername = String(username).trim();
    const cleanName = String(name).trim();
    const cleanEmail = email
      ? String(email).trim().toLowerCase()
      : null;

    // Reserved admin username
    if (cleanUsername.toLowerCase() === "admin") {
      return res.status(400).json({
        error: "This username is reserved.",
      });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        error: "Username must be at least 3 characters.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters.",
      });
    }

    // Check username
    const existingUsername = db
      .prepare("SELECT id, username FROM users WHERE username = ?")
      .get(cleanUsername);

    if (existingUsername) {
      return res.status(409).json({
        error: "Username already exists.",
      });
    }

    // Check email only if provided
    if (cleanEmail) {
      const existingEmail = db
        .prepare("SELECT id, email FROM users WHERE email = ?")
        .get(cleanEmail);

      if (existingEmail) {
        return res.status(409).json({
          error: "Email already exists.",
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = db
      .prepare(`
        INSERT INTO users (
          username,
          email,
          name,
          password_hash,
          provider,
          created_at
        )
        VALUES (?, ?, ?, ?, 'local', CURRENT_TIMESTAMP)
      `)
      .run(
        cleanUsername,
        cleanEmail,
        cleanName,
        passwordHash
      );

    const user = db
      .prepare(`
        SELECT
          id,
          username,
          email,
          name,
          provider,
          created_at
        FROM users
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    // Create JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Save JWT in cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: "Account created successfully.",
      user,
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "Username or email already exists.",
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to create account.",
    });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        error: "Email is required.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const user = db
      .prepare(`
        SELECT id, name, email
        FROM users
        WHERE LOWER(email) = ?
        AND provider = 'local'
      `)
      .get(cleanEmail);

    // Don't reveal whether an email exists
    if (!user) {
      return res.json({
        message:
          "If an account exists with this email, an OTP has been sent.",
      });
    }

    // Delete old OTPs
    db.prepare(`
      DELETE FROM password_resets
      WHERE user_id = ?
    `).run(user.id);

    // Generate OTP
    const otp = generateOTP();

    // Hash OTP before storing
    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    // 10 minutes
    const expiresAt =
      Date.now() + 10 * 60 * 1000;

    db.prepare(`
      INSERT INTO password_resets (
        user_id,
        otp_hash,
        expires_at,
        attempts,
        used
      )
      VALUES (?, ?, ?, 0, 0)
    `).run(
      user.id,
      otpHash,
      expiresAt
    );

    // Email
    const sentFrom = new Sender(
      process.env.MAIL_FROM_EMAIL,
      process.env.MAIL_FROM_NAME || "AI Chat"
    );

    const recipients = [
      new Recipient(
        user.email,
        user.name || "User"
      ),
    ];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject("Your AI Chat password reset OTP")
      .setHtml(`
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
          <h2>Password Reset</h2>

          <p>Hello ${user.name || "there"},</p>

          <p>
            We received a request to reset your AI Chat password.
          </p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            padding: 20px;
            text-align: center;
            background: #f3f4f6;
            border-radius: 10px;
            margin: 20px 0;
          ">
            ${otp}
          </div>

          <p>
            This OTP will expire in <strong>10 minutes</strong>.
          </p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p>— AI Chat</p>
        </div>
      `)
      .setText(`
Your AI Chat password reset OTP is: ${otp}

This OTP will expire in 10 minutes.

If you did not request this password reset, ignore this email.
      `);

    await mailerSend.email.send(emailParams);

    return res.json({
      message:
        "If an account exists with this email, an OTP has been sent.",
    });

  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      error: "Failed to send OTP.",
    });
  }
});
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP are required.",
      });
    }

    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const user = db
      .prepare(`
        SELECT id
        FROM users
        WHERE LOWER(email) = ?
        AND provider = 'local'
      `)
      .get(cleanEmail);

    if (!user) {
      return res.status(400).json({
        error: "Invalid OTP.",
      });
    }

    const reset = db
      .prepare(`
        SELECT *
        FROM password_resets
        WHERE user_id = ?
        AND used = 0
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(user.id);

    if (!reset) {
      return res.status(400).json({
        error: "OTP is invalid or expired.",
      });
    }

    if (Date.now() > reset.expires_at) {
      return res.status(400).json({
        error: "OTP has expired.",
      });
    }

    if (reset.attempts >= 5) {
      return res.status(429).json({
        error: "Too many incorrect attempts.",
      });
    }

    const otpHash = crypto
      .createHash("sha256")
      .update(String(otp).trim())
      .digest("hex");

    if (otpHash !== reset.otp_hash) {
      db.prepare(`
        UPDATE password_resets
        SET attempts = attempts + 1
        WHERE id = ?
      `).run(reset.id);

      return res.status(400).json({
        error: "Invalid OTP.",
      });
    }

    // Mark OTP as used
    db.prepare(`
      UPDATE password_resets
      SET used = 1
      WHERE id = ?
    `).run(reset.id);

    return res.json({
      message: "OTP verified successfully.",
      verified: true,
    });

  } catch (error) {
    console.error(
      "VERIFY OTP ERROR:",
      error
    );

    return res.status(500).json({
      error: "Failed to verify OTP.",
    });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and new password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "Password must be at least 6 characters.",
      });
    }

    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const user = db
      .prepare(`
        SELECT id
        FROM users
        WHERE LOWER(email) = ?
        AND provider = 'local'
      `)
      .get(cleanEmail);

    if (!user) {
      return res.status(400).json({
        error: "Unable to reset password.",
      });
    }

    // Make sure an OTP was successfully verified
    const verifiedReset = db
      .prepare(`
        SELECT id
        FROM password_resets
        WHERE user_id = ?
        AND used = 1
        AND expires_at > ?
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(user.id, Date.now());

    if (!verifiedReset) {
      return res.status(400).json({
        error:
          "Please verify your OTP first.",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `).run(
      passwordHash,
      user.id
    );

    // Delete reset records
    db.prepare(`
      DELETE FROM password_resets
      WHERE user_id = ?
    `).run(user.id);

    return res.json({
      message:
        "Password reset successfully.",
    });

  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      error: "Failed to reset password.",
    });
  }
});

// ============================================================
// AUTH - GOOGLE
// ============================================================

app.post(
  "/api/auth/google",
  async (req, res) => {

    try {

      const {
        credential,
      } = req.body;


      if (!credential) {
        return res.status(400).json({
          error:
            "Google credential is required",
        });
      }


      const ticket =
        await googleClient.verifyIdToken({
          idToken: credential,

          audience:
            process.env.GOOGLE_CLIENT_ID,
        });


      const payload =
        ticket.getPayload();


      if (!payload) {
        return res.status(401).json({
          error:
            "Invalid Google credential",
        });
      }


      const googleId =
        payload.sub;

      const email =
        payload.email ||
        null;

      const name =
        payload.name ||
        "Google User";


      let user =
        db
          .prepare(`
            SELECT *
            FROM users
            WHERE google_id = ?
          `)
          .get(googleId);


      // -------------------------------------------------------
      // Existing account by email
      // -------------------------------------------------------

      if (!user && email) {

        user =
          db
            .prepare(`
              SELECT *
              FROM users
              WHERE email = ?
            `)
            .get(email);


        if (user) {

          db.prepare(`
            UPDATE users
            SET
              google_id = ?,
              provider = ?
            WHERE id = ?
          `).run(
            googleId,
            "google",
            user.id
          );

          user =
            getUserById(
              user.id
            );

        }

      }


      // -------------------------------------------------------
      // New Google account
      // -------------------------------------------------------

      if (!user) {

        let username =
          email
            ? email
                .split("@")[0]
                .replace(
                  /[^a-zA-Z0-9_]/g,
                  ""
                )
            : `google_${googleId.slice(
                0,
                8
              )}`;


        if (
          !username ||
          username.length < 3
        ) {
          username =
            `google_${googleId.slice(
              0,
              8
            )}`;
        }


        const originalUsername =
          username;


        let counter = 1;


        while (
          db
            .prepare(`
              SELECT id
              FROM users
              WHERE username = ?
            `)
            .get(username)
        ) {

          username =
            `${originalUsername}${counter}`;

          counter++;

        }


        const result =
          db
            .prepare(`
              INSERT INTO users
              (
                username,
                email,
                name,
                google_id,
                provider
              )
              VALUES (?, ?, ?, ?, ?)
            `)
            .run(
              username,
              email,
              name,
              googleId,
              "google"
            );


        user =
          getUserById(
            result.lastInsertRowid
          );

      }


      const token =
        createToken(user);


      setAuthCookie(
        res,
        token
      );


      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          provider: user.provider,
        },
      });

    } catch (error) {

      console.error(
        "Google login error:",
        error
      );

      res.status(401).json({
        error:
          "Google authentication failed",
      });

    }

  }
);


// ============================================================
// AUTH - ME
// ============================================================

app.get(
  "/api/auth/me",
  authenticate,
  (req, res) => {

    res.json({
      user: req.user,
    });

  }
);


// ============================================================
// AUTH - LOGOUT
// ============================================================

app.post(
  "/api/auth/logout",
  (req, res) => {

    res.clearCookie(
      "auth_token",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      }
    );


    res.json({
      message:
        "Logged out successfully",
    });

  }
);


// ============================================================
// CHAT - CREATE
// ============================================================

app.post("/api/chats", authenticate, (req, res) => {
  try {
    const { context = "" } = req.body;

    const chatId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO chats (
        id,
        user_id,
        title,
        context,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      chatId,
      req.user.id,
      "New conversation",
      context
    );

    const chat = db.prepare(`
      SELECT
        id,
        title,
        context,
        created_at,
        updated_at
      FROM chats
      WHERE id = ? AND user_id = ?
    `).get(chatId, req.user.id);

    res.status(201).json(chat);
  } catch (error) {
    console.error("CREATE CHAT ERROR:", error);

    res.status(500).json({
      error: error.message || "Failed to create chat"
    });
  }
});

// ============================================================
// CHAT - GET ALL
// ============================================================

app.get(
  "/api/chats",
  authenticate,
  (req, res) => {

    try {

      const chats =
        db
          .prepare(`
            SELECT
              id,
              title,
              context,
              created_at,
              updated_at
            FROM chats
            WHERE user_id = ?
            ORDER BY
              updated_at DESC
          `)
          .all(
            req.user.id
          );


      res.json(chats);

    } catch (error) {

      console.error(
        "Get chats error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load chats",
      });

    }

  }
);


// ============================================================
// CHAT - GET ONE
// ============================================================

app.get(
  "/api/chats/:chatId",
  authenticate,
  (req, res) => {

    try {

      const chat =
        getUserChat(
          req.params.chatId,
          req.user.id
        );


      if (!chat) {
        return res.status(404).json({
          error:
            "Chat not found",
        });
      }


      const messages =
        getChatMessages(
          chat.id
        );


      res.json({
        chat,
        messages,
      });

    } catch (error) {

      console.error(
        "Get chat error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load chat",
      });

    }

  }
);


// ============================================================
// CHAT - DELETE
// ============================================================

app.delete(
  "/api/chats/:chatId",
  authenticate,
  (req, res) => {

    try {

      const chat =
        getUserChat(
          req.params.chatId,
          req.user.id
        );


      if (!chat) {
        return res.status(404).json({
          error:
            "Chat not found",
        });
      }


      db.prepare(`
        DELETE FROM messages
        WHERE chat_id = ?
      `).run(
        chat.id
      );


      db.prepare(`
        DELETE FROM chats
        WHERE id = ?
        AND user_id = ?
      `).run(
        chat.id,
        req.user.id
      );


      res.json({
        message:
          "Chat deleted successfully",
      });

    } catch (error) {

      console.error(
        "Delete chat error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to delete chat",
      });

    }

  }
);


// ============================================================
// AI - GENERATE FIRST RESPONSE
// ============================================================

async function generateFirstResponse({
  text,
  images,
}) {

  const systemPrompt = `
You are the AI assistant inside a personal AI chat application.

This is the first message in a new conversation.

Automatically determine:

1. A short conversation title.
2. A useful conversation context.
3. A complete answer to the user's message.

Return ONLY valid JSON in exactly this structure:

{
  "title": "Short Conversation Title",
  "context": "Brief useful description of what this conversation is about",
  "answer": "Complete answer to the user"
}

Rules:

- Title should normally be 2-6 words.
- Context should be concise.
- Never ask the user for a title.
- Never ask the user for context.
- Infer the title and context automatically.
- Answer the user's actual question normally.
- Do not include markdown code fences around the JSON.
`;


  const userContent =
    buildUserContent(
      text,
      images
    );


  const response =
    await client.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },

        {
          role: "user",
          content: userContent,
        },
      ],
    });


  const raw =
    response?.choices?.[0]
      ?.message?.content;


  if (!raw) {
    throw new Error(
      "AI returned an empty response."
    );
  }


  const parsed =
    parseJsonResponse(raw);


  return {
    title:
      parsed.title ||
      "New conversation",

    context:
      parsed.context ||
      "",

    answer:
      parsed.answer ||
      raw,
  };

}


// ============================================================
// AI - NORMAL RESPONSE
// ============================================================

async function generateNormalResponse({
  chat,
  history,
  text,
  images,
}) {

  const systemPrompt = `
You are the AI assistant inside a personal AI chat application.

You are continuing an existing conversation.

Conversation title:
${chat.title || "New conversation"}

Conversation context:
${chat.context || "No additional context available."}

Use the conversation history to maintain continuity.

Important:

- Stay focused on this conversation.
- Do not use information from unrelated chats.
- Answer naturally and accurately.
- If the user asks about something from earlier in this conversation, use the stored history.
- Do not ask for a conversation title or context.
`;


  const userContent =
    buildUserContent(
      text,
      images
    );


  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },

    ...history,

    {
      role: "user",
      content: userContent,
    },
  ];


  const response =
    await client.chat.completions.create({
      model: MODEL,
      messages,
    });


  const answer =
    response?.choices?.[0]
      ?.message?.content;


  if (!answer) {
    throw new Error(
      "AI returned an empty response."
    );
  }


  return answer;

}


// ============================================================
// CHAT MESSAGE
// ============================================================

app.post(
  "/api/chats/:chatId/message",
  authenticate,
  async (req, res) => {

    try {

      const {
        message = "",
        images = [],
      } = req.body;


      const text =
        typeof message === "string"
          ? message.trim()
          : "";


      const validImages =
        Array.isArray(images)
          ? images
              .filter(
                (image) =>
                  typeof image ===
                    "string" &&
                  image.startsWith(
                    "data:image/"
                  )
              )
              .slice(
                0,
                MAX_IMAGE_COUNT
              )
          : [];


      // -------------------------------------------------------
      // VALIDATION
      // -------------------------------------------------------

      if (
        !text &&
        validImages.length === 0
      ) {

        return res.status(400).json({
          error:
            "Message or image is required",
        });

      }


      // -------------------------------------------------------
      // VERIFY CHAT OWNERSHIP
      // -------------------------------------------------------

      const chat =
        getUserChat(
          req.params.chatId,
          req.user.id
        );


      if (!chat) {

        return res.status(404).json({
          error:
            "Chat not found",
        });

      }


      // -------------------------------------------------------
      // GET HISTORY
      // -------------------------------------------------------

      const storedMessages =
        getChatMessages(
          chat.id
        );


      const history =
        storedMessages
          .slice(-MAX_HISTORY)
          .map(
            (item) => ({
              role: item.role,
              content: item.content,
            })
          );


      // -------------------------------------------------------
      // SAVE USER MESSAGE
      // -------------------------------------------------------
      //
      // IMPORTANT:
      // We do NOT save base64 images.
      //

      const savedUserContent =
        text ||
        "[Image uploaded]";


      const userMessageId =
        saveMessage(
          chat.id,
          "user",
          savedUserContent
        );


      // -------------------------------------------------------
      // FIRST MESSAGE
      // -------------------------------------------------------

      let answer;

      let title =
        chat.title;

      let context =
        chat.context;


      const isFirstMessage =
        storedMessages.length === 0;


      if (isFirstMessage) {

        const result =
          await generateFirstResponse({
            text,
            images:
              validImages,
          });


        answer =
          result.answer;

        title =
          result.title;

        context =
          result.context;


        db.prepare(`
          UPDATE chats
          SET
            title = ?,
            context = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          title,
          context,
          chat.id
        );

      }


      // -------------------------------------------------------
      // NORMAL MESSAGE
      // -------------------------------------------------------

      else {

        answer =
          await generateNormalResponse({
            chat,
            history,
            text,
            images:
              validImages,
          });

      }


      // -------------------------------------------------------
      // SAVE AI RESPONSE
      // -------------------------------------------------------

      const assistantMessageId =
        saveMessage(
          chat.id,
          "assistant",
          answer
        );


      // -------------------------------------------------------
      // RESPONSE
      // -------------------------------------------------------

      res.json({

        answer,

        title,

        context,

        userMessageId,

        assistantMessageId,

        source: "ai",

      });

    } catch (error) {

      console.error(
        "Message error:",
        error
      );


      res.status(500).json({
        error:
          error?.message ||
          "Failed to process message",
      });

    }

  }
);


// ============================================================
// TRANSLATION
// ============================================================

app.post(
  "/api/translate",
  authenticate,
  async (req, res) => {

    try {

      const {
        text,
        language,
      } = req.body;


      if (
        !text ||
        !language
      ) {

        return res.status(400).json({
          error:
            "Text and language are required",
        });

      }


      const response =
        await client.chat.completions.create({
          model: MODEL,

          messages: [
            {
              role: "system",

              content: `
Translate the provided text into ${language}.

Preserve:

- Meaning
- Formatting
- Markdown
- Code blocks
- Technical terminology

Return only the translated text.
`,
            },

            {
              role: "user",

              content: text,
            },
          ],
        });


      const translation =
        response?.choices?.[0]
          ?.message?.content;


      if (!translation) {

        throw new Error(
          "Translation returned an empty response."
        );

      }


      res.json({
        translation,
      });

    } catch (error) {

      console.error(
        "Translation error:",
        error
      );

      res.status(500).json({
        error:
          error?.message ||
          "Translation failed",
      });

    }

  }
);


// ============================================================
// CODE CONVERSION
// ============================================================

app.post(
  "/api/convert-code",
  authenticate,
  async (req, res) => {

    try {

      const {
        code,
        fromLanguage,
        toLanguage,
      } = req.body;


      if (
        !code ||
        !toLanguage
      ) {

        return res.status(400).json({
          error:
            "Code and target language are required",
        });

      }


      const response =
        await client.chat.completions.create({
          model: MODEL,

          messages: [
            {
              role: "system",

              content: `
You are an expert programmer.

Convert the provided code from
${fromLanguage || "the original language"}
to
${toLanguage}.

Return ONLY the converted code.

Do not add explanations.
Do not add markdown fences.
`,
            },

            {
              role: "user",

              content: code,
            },
          ],
        });


      const converted =
        response?.choices?.[0]
          ?.message?.content;


      if (!converted) {

        throw new Error(
          "Code conversion returned an empty response."
        );

      }


      res.json({
        code:
          cleanAiText(
            converted
          ),
      });

    } catch (error) {

      console.error(
        "Code conversion error:",
        error
      );

      res.status(500).json({
        error:
          error?.message ||
          "Code conversion failed",
      });

    }

  }
);


// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      status: "ok",
      model: MODEL,
      database: "SQLite",
    });

  }
);


// ============================================================
// START SERVER
// ============================================================

async function startServer() {

  await createDefaultAdmin();

  const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

}

startServer();