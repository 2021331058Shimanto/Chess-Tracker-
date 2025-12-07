// server.js (merged: API + Auth + Socket.IO multiplayer)
import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";
import { Chess } from "chess.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// Resolve users.json location
const candidateA = path.join(process.cwd(), "chess-tracker-backend", "users.json");
const candidateB = path.join(process.cwd(), "users.json");
let USERS_FILE = fs.existsSync(candidateA) ? candidateA : candidateB;

console.log("USERS_FILE ->", USERS_FILE);

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      const dir = path.dirname(USERS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(USERS_FILE, "[]", "utf8");
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "[]");
  } catch {
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
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ----------------- Chess.com API endpoints -----------------
app.get("/api/player/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await axios.get(`https://api.chess.com/pub/player/${username}`);
    res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({ message: error.response.data?.message || "Player not found" });
    }
    res.status(500).json({ message: "Player not found or API error" });
  }
});

app.get("/api/player/:username/stats", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await axios.get(`https://api.chess.com/pub/player/${username}/stats`);
    res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({ message: error.response.data?.message || "Stats not found" });
    }
    res.status(500).json({ message: "Stats not found or API error" });
  }
});

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
      return res.status(error.response.status).json({ message: error.response.data?.message || "Games not found" });
    }
    res.status(500).json({ message: "Games not found or API error" });
  }
});

// ----------------- Auth endpoints -----------------
app.post("/api/auth/register", async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password required" });
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
  const users = readUsers();
  let user = users.find(u => u.username === username);
  if (!user) {
    // NOTE: Your original login code registers the user if they don't exist.
    const hash = await bcrypt.hash(password || "", 10);
    user = { username, password: hash, name: username, createdAt: Date.now() };
    users.push(user);
    writeUsers(users);
  }
  const token = generateToken(user);
  res.json({ token, user: { username: user.username, name: user.name } });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ username: user.username, name: user.name, createdAt: user.createdAt });
});

// ----------------- Socket.IO multiplayer -----------------
const httpServer = http.createServer(app);

// 💡 FIX: Changed origin from "http://localhost:3000" to "*" to allow 192.168.0.169 connections.
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Rooms structure: Tracks players by explicit color slots
const rooms = new Map(); 

function makeRoomId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Create room
  socket.on("create-room", ({ username }, cb) => {
    console.log(`[CREATE] User ${username} attempting to create room.`);
    let roomId;
    do roomId = makeRoomId();
    while (rooms.has(roomId));
    
    const chess = new Chess();
    rooms.set(roomId, { 
      chess, 
      players: { 
        white: { socketId: socket.id, username: username }, 
        black: null 
      }, 
      spectators: new Set() 
    });
    
    socket.join(roomId);
    
    console.log(`[CREATE] Room ${roomId} created. ${username} is White.`);
    
    cb?.({ ok: true, roomId, color: "white", fen: chess.fen(), opponent: null });
  });

  // Join room
  socket.on("join-room", ({ roomId, username }, cb) => {
    console.log(`[JOIN] User ${username} attempting to join room ${roomId}.`);
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });

    let assignedColor = null;
    let opponentUsername = null;
    let isRejoin = false;

    // 1. Check if the user is already in a slot (re-joining)
    if (room.players.white && room.players.white.username === username) {
        assignedColor = "white";
        opponentUsername = room.players.black?.username || null;
        room.players.white.socketId = socket.id; 
        isRejoin = true;
    } else if (room.players.black && room.players.black.username === username) {
        assignedColor = "black";
        opponentUsername = room.players.white?.username || null;
        room.players.black.socketId = socket.id; 
        isRejoin = true;
    } 
    // 2. Assign color for a new player
    else if (!room.players.white) {
        assignedColor = "white";
    } else if (!room.players.black) {
        assignedColor = "black";
    } else {
        // Full, join as a spectator
        room.spectators.add(socket.id);
        socket.join(roomId);
        console.log(`[JOIN] ${username} joined as spectator.`);
        return cb?.({ ok: true, role: "spectator", fen: room.chess.fen() });
    }

    if (assignedColor) {
        const slot = assignedColor === "white" ? "white" : "black";
        
        if (!isRejoin) {
            // Assign new player to the empty slot
            room.players[slot] = { socketId: socket.id, username: username };
            
            // Determine opponent for the new player
            const opponentSlot = slot === "white" ? "black" : "white";
            opponentUsername = room.players[opponentSlot]?.username || null;
        }

        socket.join(roomId);
        console.log(`[JOIN] User ${username} assigned ${assignedColor} in room ${roomId}.`);
        
        // CRITICAL: Send back the assigned color
        cb?.({ ok: true, role: "player", color: assignedColor, fen: room.chess.fen(), opponent: opponentUsername });
        
        if (!isRejoin) {
            // Only emit start-game to everyone else if a new player joined (not a re-join)
            const playerList = [room.players.white?.username, room.players.black?.username].filter(Boolean);
            if (playerList.length === 2) {
                // Notify the opponent the game is starting
                socket.to(roomId).emit("start-game", { fen: room.chess.fen(), players: playerList });
            }
        }
    }
 });

  // Move
  socket.on("move", ({ roomId, from, to, promotion }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    
    // Determine player color based on username in the slot
    const username = socket.id === room.players.white?.socketId ? room.players.white.username : 
                     (socket.id === room.players.black?.socketId ? room.players.black.username : null);
    
    if (!username) return cb?.({ ok: false, error: "Not a player" });
    
    const color = username === room.players.white?.username ? "white" : "black";
    
    const chess = room.chess;
    if (chess.turn() !== (color === "white" ? "w" : "b")) return cb?.({ ok: false, error: "Not your turn" });

    const moveObj = { from, to };
    if (promotion) moveObj.promotion = promotion;
    const result = chess.move(moveObj);
    if (!result) return cb?.({ ok: false, error: "Invalid move" });

    io.to(roomId).emit("move-made", { from, to, promotion, fen: chess.fen(), san: result.san, color });

    // 💡 FIX: Using correct chess.js API functions (isCheckmate, isDraw, etc.)
    if (chess.isCheckmate()) {
      io.to(roomId).emit("game-over", { reason: "checkmate", winner: color });
      rooms.delete(roomId);
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
      io.to(roomId).emit("game-over", { reason: "draw" });
      rooms.delete(roomId);
    } else {
      cb?.({ ok: true });
    }
  });

  socket.on("resign", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const isWhite = room.players.white?.socketId === socket.id;
    const isBlack = room.players.black?.socketId === socket.id;

    if (!isWhite && !isBlack) return; 
    
    const resignedColor = isWhite ? "white" : "black";
    const winner = isWhite ? "black" : "white";
    io.to(roomId).emit("game-over", { reason: "resign", winner, resignedColor });
    rooms.delete(roomId);
  });

  socket.on("chat", ({ roomId, text }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit("chat", { from: socket.id, text });
  });

  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    
    const isWhite = room.players.white?.socketId === socket.id;
    const isBlack = room.players.black?.socketId === socket.id;

    if (isWhite) {
        room.players.white = null;
        io.to(roomId).emit("opponent-left", { color: "white" });
    } else if (isBlack) {
        room.players.black = null;
        io.to(roomId).emit("opponent-left", { color: "black" });
    } else if (room.spectators.has(socket.id)) {
      room.spectators.delete(socket.id);
    }
    
    if (!room.players.white && !room.players.black && room.spectators.size === 0) {
        rooms.delete(roomId);
    }
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        
        const isWhite = room.players.white?.socketId === socket.id;
        const isBlack = room.players.black?.socketId === socket.id;

        if (isWhite) {
            room.players.white = null;
            io.to(roomId).emit("opponent-left", { color: "white" });
        } else if (isBlack) {
            room.players.black = null;
            io.to(roomId).emit("opponent-left", { color: "black" });
        } else if (room.spectators.has(socket.id)) {
          room.spectators.delete(socket.id);
        }
        
        if (!room.players.white && !room.players.black && room.spectators.size === 0) {
            rooms.delete(roomId);
        }
      }
    }
  });
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Start HTTP + Socket.IO server (LAN-ready)
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
