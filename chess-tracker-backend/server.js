import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Profile endpoint
app.get("/api/player/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await axios.get(`https://api.chess.com/pub/player/${username}`);
    res.json(response.data);
  } catch (error) {
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
    res.status(500).json({ message: "Stats not found or API error" });
  }
});

// Recent games endpoint
app.get("/api/player/:username/games", async (req, res) => {
  const { username } = req.params;
  try {
    const archivesRes = await axios.get(`https://api.chess.com/pub/player/${username}/games/archives`);
    const archives = archivesRes.data.archives;
    if (!archives || archives.length === 0) return res.status(404).json({ message: "No games found" });
    const latestArchiveUrl = archives[archives.length - 1];
    const gamesRes = await axios.get(latestArchiveUrl);
    res.json(gamesRes.data.games);
  } catch (error) {
    res.status(500).json({ message: "Games not found or API error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
