import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from "axios";

const THEMES = {
  vaporwave: {
    name: 'Vaporwave 🌃',
    bg: 'bg-gray-950',
    primary: 'pink',
    secondary: 'purple',
    accent: 'cyan',
    text: 'text-white',
    cardShadow: 'shadow-purple-900/50',
  },
  cyberpunk: {
    name: 'Cyberpunk 💾',
    bg: 'bg-black',
    primary: 'lime',
    secondary: 'red',
    accent: 'blue',
    text: 'text-gray-100',
    cardShadow: 'shadow-red-700/50',
  },
};

export default function PlayModeEnhanced({ token, currentTheme = 'vaporwave' }) {
  const theme = THEMES[currentTheme];
  const [chesscomId, setChesscomId] = useState("");
  const [fen, setFen] = useState(new Chess().fen());
  const [moveHistory, setMoveHistory] = useState([]);
  const [difficulty, setDifficulty] = useState("Intermediate (Depth 6)");
  const [gameResult, setGameResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const gameRef = useMemo(() => new Chess(), []);

  const allowDrag = (piece) => {
    const tempGame = new Chess(fen);
    const isPlayerTurn = tempGame.turn() === "w";
    const isPlayerPiece = piece.search(/w/) !== -1;
    return isPlayerTurn && isPlayerPiece;
  };

  const safeGameMutate = useCallback(
    (modify) => {
      const tempGame = new Chess(fen);
      const result = modify(tempGame);
      if (result) {
        setFen(tempGame.fen());
        setMoveHistory(tempGame.history({ verbose: true }));
      }
      return result;
    },
    [fen]
  );

  const onDrop = (source, target) => {
    const result = safeGameMutate((game) => {
      return game.move({ from: source, to: target, promotion: "q" });
    });
    return result ? true : false;
  };

  const makeAiMove = useCallback(() => {
    const tempGame = new Chess(fen);
    if (tempGame.isGameOver()) return;
    if (tempGame.turn() !== "b") return;

    const moves = tempGame.moves();
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    safeGameMutate((game) => {
      game.move(randomMove);
      return true;
    });
  }, [fen, safeGameMutate]);

  useEffect(() => {
    const tempGame = new Chess(fen);
    if (tempGame.isGameOver()) {
      let result = "Draw";
      if (tempGame.isCheckmate()) {
        result = tempGame.turn() === "w" ? "Black Wins" : "White Wins";
      }
      setGameResult(result);
      return;
    }

    if (tempGame.turn() === "b") {
      const timer = setTimeout(makeAiMove, 500);
      return () => clearTimeout(timer);
    }
  }, [fen, makeAiMove]);

  const restartGame = useCallback(() => {
    gameRef.reset();
    setFen(gameRef.fen());
    setMoveHistory([]);
    setGameResult(null);
  }, [gameRef]);

  const saveGame = async () => {
    if (!chesscomId) {
      alert("Please enter a Chess.com ID");
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        "http://localhost:5000/api/games/save",
        {
          chesscomUsername: chesscomId,
          moves: moveHistory.map((m) => m.san),
          fen,
          result: gameResult || "in-progress",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Game saved successfully!");
    } catch (err) {
      alert("Failed to save game: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const boardSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.8, 400);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} p-6`}>
      <div className="max-w-7xl mx-auto">
        <h1 className={`text-5xl font-extrabold text-${theme.primary}-500 mb-8 text-center`}>
          PLAY CHESS MODE
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT PANEL: Controls */}
          <div className="lg:col-span-3 space-y-6">
            {/* Chess ID Input */}
            <div className={`bg-gray-800/60 backdrop-blur border border-${theme.secondary}-500/50 p-5 rounded-xl shadow-lg`}>
              <label className={`block text-${theme.primary}-400 font-bold mb-2`}>Chess.com ID</label>
              <input
                type="text"
                value={chesscomId}
                onChange={(e) => setChesscomId(e.target.value)}
                placeholder="Enter Chess.com username"
                className="w-full p-3 bg-gray-700/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Difficulty */}
            <div className={`bg-gray-800/60 backdrop-blur border border-${theme.secondary}-500/50 p-5 rounded-xl shadow-lg`}>
              <label className={`block text-${theme.primary}-400 font-bold mb-2`}>AI Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-3 bg-gray-700/80 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option>Easy (Depth 2)</option>
                <option>Intermediate (Depth 6)</option>
                <option>Hard (Depth 12)</option>
                <option>Grandmaster (Depth 20)</option>
              </select>
            </div>

            {/* Game Stats */}
            <div className={`bg-gray-800/60 backdrop-blur border border-${theme.secondary}-500/50 p-5 rounded-xl shadow-lg`}>
              <h3 className={`text-lg font-bold text-${theme.primary}-400 mb-3`}>GAME STATS</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className={`text-${theme.primary}-400`}>Moves:</span> {Math.ceil(moveHistory.length / 2)}
                </p>
                <p>
                  <span className={`text-${theme.primary}-400`}>Status:</span>{" "}
                  {gameResult ? (
                    <span className="text-green-400 font-bold">{gameResult}</span>
                  ) : (
                    <span className="text-yellow-400">Playing...</span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={restartGame}
                className={`w-full py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-lg transition transform hover:scale-105`}
              >
                🔄 New Game
              </button>
              <button
                onClick={saveGame}
                disabled={saving}
                className={`w-full py-3 bg-gradient-to-r from-${theme.primary}-500 to-${theme.secondary}-600 hover:from-${theme.primary}-600 hover:to-${theme.secondary}-700 text-white font-bold rounded-lg transition transform hover:scale-105 disabled:opacity-50`}
              >
                {saving ? "Saving..." : "💾 Save Game"}
              </button>
            </div>
          </div>

          {/* CENTER PANEL: Board */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div
              className={`bg-gradient-to-br from-${theme.secondary}-900 to-black p-3 rounded-2xl shadow-2xl`}
              style={{ cursor: "pointer", userSelect: "none", touchAction: "none" }}
            >
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                boardWidth={boardSize}
                arePiecesDraggable={true}
                boardOrientation="white"
                allowDrag={allowDrag}
              />
            </div>
            <p className="text-center mt-4 text-gray-400 font-mono text-sm">
              {new Chess(fen).turn() === "w" ? "Your Turn (White)" : "AI Thinking..."}
            </p>
          </div>

          {/* RIGHT PANEL: Move History */}
          <div className="lg:col-span-3">
            <div className={`bg-gray-800/60 backdrop-blur border border-${theme.primary}-500/50 p-5 rounded-xl shadow-lg h-[600px] overflow-y-auto`}>
              <h3 className={`text-lg font-bold text-${theme.primary}-400 mb-4 border-b border-${theme.primary}-500/30 pb-2`}>
                📋 MOVE LOG
              </h3>
              <ol className="space-y-2 text-sm">
                {moveHistory.length === 0 ? (
                  <p className="text-gray-500 italic">Waiting for moves...</p>
                ) : (
                  moveHistory.map((move, idx) => (
                    <li
                      key={idx}
                      className={`p-2 rounded transition hover:bg-gray-700/50 font-mono ${
                        idx % 2 === 0 ? "text-white" : "text-gray-400"
                      }`}
                    >
                      {Math.floor(idx / 2) + 1}. {move.san}
                    </li>
                  ))
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
