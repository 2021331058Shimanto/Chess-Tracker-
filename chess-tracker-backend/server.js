import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
// Resolve users.json: prefer a users.json in the backend folder, but fall back
// to a users.json in the current working directory.
const candidateA = path.join(process.cwd(), "chess-tracker-backend", "users.json");
const candidateB = path.join(process.cwd(), "users.json");
let USERS_FILE = candidateB;
if (fs.existsSync(candidateA)) USERS_FILE = candidateA;
else USERS_FILE = candidateB;

console.log("USERS_FILE ->", USERS_FILE);

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      // ensure parent dir exists
      const dir = path.dirname(USERS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(USERS_FILE, "[]", "utf8");
    }
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function generateToken(user) {
  return jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "Missing auth" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

// Profile endpoint
app.get("/api/player/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await axios.get(`https://api.chess.com/pub/player/${username}`);
    res.json(response.data);
  } catch (error) {
    // Forward chess.com status when available, otherwise respond 500
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({ message: error.response.data?.message || 'Player not found' });
    }
    res.status(500).json({ message: "Player not found or API error" });
  }
});

// Stats endpoint
app.get("/api/player/:username/stats", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await axios.get(`https://api.chess.com/pub/player/${username}/stats`);
    res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({ message: error.response.data?.message || 'Stats not found' });
    }
    res.status(500).json({ message: "Stats not found or API error" });
  }
});

// Recent games endpoint
app.get("/api/player/:username/games", async (req, res) => {
  const { username } = req.params;
  try {
    const archivesRes = await axios.get(`https://api.chess.com/pub/player/${username}/games/archives`);
    const archives = archivesRes.data.archives;
    if (!archives || archives.length === 0) return res.json([]);
    const latestArchiveUrl = archives[archives.length - 1];
    const gamesRes = await axios.get(latestArchiveUrl);
    res.json(gamesRes.data.games || []);
  } catch (error) {
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({ message: error.response.data?.message || 'Games not found' });
    }
    res.status(500).json({ message: "Games not found or API error" });
  }
});

// --- AUTH ENDPOINTS ---
app.post("/api/auth/register", async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password required" });
  console.log("Register attempt ->", username);
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ message: "User exists" });
  const hash = await bcrypt.hash(password, 10);
  const newUser = { username, password: hash, name: name || username, createdAt: Date.now() };
  users.push(newUser);
  writeUsers(users);
  const token = generateToken(newUser);
  res.json({ token, user: { username: newUser.username, name: newUser.name } });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ message: "username required" });
  // DEV-FRIENDLY: accept any password and auto-create users if missing
  // This allows logging in with any id/password for local testing.
  console.log("Login attempt (dev-mode) ->", username);
  const users = readUsers();
  let user = users.find(u => u.username === username);
  if (!user) {
    // auto-create user with hashed (possibly empty) password
    const hash = await bcrypt.hash(password || "", 10);
    user = { username, password: hash, name: username, createdAt: Date.now() };
    users.push(user);
    writeUsers(users);
    console.log("Auto-created user ->", username, "at", USERS_FILE);
  }
  // In dev mode accept any password; return token
  const token = generateToken(user);
  res.json({ token, user: { username: user.username, name: user.name } });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ username: user.username, name: user.name, createdAt: user.createdAt });
});

// --- GAME RECORDS ENDPOINTS ---
const GAMES_FILE = path.join(process.cwd(), "chess-tracker-backend", "games.json");

function readGames() {
  try {
    if (!fs.existsSync(GAMES_FILE)) {
      fs.writeFileSync(GAMES_FILE, "[]", "utf8");
    }
    const raw = fs.readFileSync(GAMES_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function writeGames(games) {
  const dir = path.dirname(GAMES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2));
}

// Save a game/moves for the authenticated user
app.post("/api/games/save", authMiddleware, (req, res) => {
  const { chesscomUsername, moves, fen, result } = req.body;
  if (!chesscomUsername) return res.status(400).json({ message: "chesscomUsername required" });
  
  const games = readGames();
  const gameRecord = {
    id: Date.now(),
    username: req.user.username,
    chesscomUsername,
    moves,
    fen,
    result: result || "in-progress",
    createdAt: Date.now(),
  };
  games.push(gameRecord);
  writeGames(games);
  res.json({ message: "Game saved", gameRecord });
});

// Get all games for the authenticated user
app.get("/api/games/my-games", authMiddleware, (req, res) => {
  const games = readGames();
  const userGames = games.filter(g => g.username === req.user.username);
  res.json(userGames);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
