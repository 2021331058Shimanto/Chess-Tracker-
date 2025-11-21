import { useState, useCallback, useMemo, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

// Helper function to determine the current state of the game
const getGameStatus = (fen) => {
  const game = new Chess(fen);
  
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'Black' : 'White';
    return <span className="text-red-600 font-bold">{winner} wins by Checkmate!</span>;
  } 
  if (game.isDraw()) {
    return <span className="text-yellow-600 font-bold">Draw!</span>;
  }
  if (game.isStalemate()) {
    return <span className="text-gray-600 font-bold">Stalemate!</span>;
  }
  if (game.isCheck()) {
    const player = game.turn() === 'w' ? 'White' : 'Black';
    return <span className="text-orange-500 font-bold">{player} is in Check!</span>;
  }
  
  const turn = game.turn() === 'w' ? 'White' : 'Black';
  return <span className="text-blue-600 font-bold">Current Turn: {turn}</span>;
};

// Dedicated Chess Game Component
const ChessGame = ({ fen, setFen, safeGameMutate, restartGame }) => {
  
  // Checks if a piece is allowed to be dragged (only white pieces on white's turn)
  const allowDrag = (piece) => {
    // Check if the current turn is white ('w')
    const isPlayerTurn = new Chess(fen).turn() === 'w';
    // Check if the piece being dragged is a white piece ('w')
    const isPlayerPiece = piece.search(/w/) !== -1;

    return isPlayerTurn && isPlayerPiece;
  };

  // Handles the successful drop of a chess piece (Player move)
  const onDrop = (source, target) => {
    console.log(`Attempting move: ${source} to ${target}`);

    // Attempt the player's move using safeGameMutate
    const moveResult = safeGameMutate((game) => {
      // Use 'q' for automatic queen promotion as a standard default
      return game.move({ from: source, to: target, promotion: "q" });
    });

    // If move was illegal, return false to trigger piece snapback
    if (!moveResult) return false;

    // The AI move is now handled by the useEffect hook watching the FEN.
    
    // Return true if the move was successful
    return true;
  };

  // Determine board size based on window dimensions for responsiveness
  const boardSize = Math.min(
    window.innerWidth * 0.9, 
    window.innerHeight * 0.8,
    450 // Max size limit
  );

  return (
    <div className="flex flex-col items-center justify-start pt-8 w-full">
      
      {/* Game Status Display */}
      <div className="mb-4 text-xl font-semibold p-2 bg-white rounded-lg shadow-md border border-gray-200">
        {getGameStatus(fen)}
      </div>

      {/* Container with high z-index to ensure it sits on top of any potential blockers */}
      <div 
        style={{ cursor: 'pointer', userSelect: 'none', touchAction: 'none' }} // Aggressive CSS Fixes
        className="relative z-20 w-full max-w-sm p-4 bg-white rounded-xl shadow-2xl border-4 border-gray-400"
      >
        <Chessboard 
          id="PlayBoard" 
          position={fen} 
          onPieceDrop={onDrop} 
          boardWidth={boardSize} 
          arePiecesDraggable={true} 
          boardOrientation="white" 
          allowDrag={allowDrag} // Enables the initial drag check
        />
      </div>
      
      <button
        onClick={restartGame}
        className="mt-8 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full shadow-lg transition duration-200 transform hover:scale-105"
      >
        Restart Game
      </button>
    </div>
  );
};


function App() {
  const [page, setPage] = useState("dashboard");
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);

  // Use FEN string to control the Chessboard component, which is the most reliable method
  const [fen, setFen] = useState(new Chess().fen());

  // Use useMemo to hold the reference to the game object for logic
  const gameRef = useMemo(() => new Chess(), []);

  // Reset the FEN and the game reference object
  const restartGame = useCallback(() => {
    gameRef.reset();
    setFen(gameRef.fen());
  }, [gameRef]);

  // Helper function to safely apply a move and update the FEN
  const safeGameMutate = useCallback((modify) => {
    const tempGame = new Chess(fen);
    
    // Apply the modification function (the move)
    const result = modify(tempGame);

    // If the modification was successful, update the FEN state
    if (result) {
      setFen(tempGame.fen());
    }
    
    return result;
  }, [fen]);

  const makeAiMove = useCallback(() => {
    const tempGame = new Chess(fen);
    
    // 1. Check if game is over
    if (tempGame.isGameOver()) return; 
    
    // 2. CRITICAL CHECK: Ensure it is Black's turn before the AI moves
    if (tempGame.turn() !== 'b') return; // AI plays black
    
    const moves = tempGame.moves();
    if (moves.length === 0) return;
    
    const randomMove = moves[Math.floor(Math.random() * moves.length)];

    // Apply the AI's move using safeGameMutate
    safeGameMutate((game) => {
      game.move(randomMove);
      return true; // Indicate success
    });
  }, [fen, safeGameMutate]);

  // CRITICAL FIX: Use useEffect to trigger the AI move ONLY when FEN changes and it's Black's turn.
  useEffect(() => {
    const tempGame = new Chess(fen);
    
    // Only proceed if it is Black's turn and the game is not over
    if (tempGame.turn() === 'b' && !tempGame.isGameOver()) {
      // Set a short delay for the AI move for better user experience
      const timer = setTimeout(makeAiMove, 500); 
      return () => clearTimeout(timer); // Cleanup function to prevent multiple calls
    }
  }, [fen, makeAiMove]);


  // Fetch user data
  const fetchData = async () => {
    // NOTE: Using localhost:5000 will not work in this environment. 
    try {
      const profileRes = await axios.get(`http://localhost:5000/api/player/${username}`);
      const statsRes = await axios.get(`http://localhost:5000/api/player/${username}/stats`);
      const gamesRes = await axios.get(`http://localhost:5000/api/player/${username}/games`);

      setProfile(profileRes.data);
      setStats(statsRes.data);
      setGames(gamesRes.data);
    } catch (err) {
      console.error(err);
      console.error("User not found or API failed. Check that your backend server is running."); 
    }
  };

  // Prepare chart data
  const chartData = stats
    ? [
        { name: "Blitz", rating: stats.chess_blitz?.last?.rating || 0 },
        { name: "Rapid", rating: stats.chess_rapid?.last?.rating || 0 },
        { name: "Bullet", rating: stats.chess_bullet?.last?.rating || 0 },
      ]
    : [];

  return (
    <div className="bg-gray-100 p-8 font-sans">
      <h1 className="text-3xl font-extrabold mb-6 text-gray-800 border-b pb-2">
        <span className="text-blue-600">Chess</span> Tracker
      </h1>

      {/* Page Switch Buttons */}
      <div className="mb-8 space-x-3 flex justify-center">
        <button
          onClick={() => setPage("dashboard")}
          className={`px-6 py-2 rounded-full font-medium transition-colors duration-200 shadow-md ${
            page === "dashboard" ? "bg-blue-600 text-white shadow-blue-400/50" : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setPage("play")}
          className={`px-6 py-2 rounded-full font-medium transition-colors duration-200 shadow-md ${
            page === "play" ? "bg-blue-600 text-white shadow-blue-400/50" : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Play Chess
        </button>
      </div>

      {page === "dashboard" && (
        <div className="max-w-4xl mx-auto">
          {/* Username input */}
          <div className="mb-6 flex justify-center items-center p-4 bg-white rounded-xl shadow-lg">
            <input
              type="text"
              placeholder="Enter Chess.com username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-gray-300 p-3 rounded-l-lg flex-grow max-w-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button 
              onClick={fetchData} 
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-r-lg font-semibold transition duration-200"
            >
              Fetch Data
            </button>
          </div>

          {/* Profile & Stats */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Profile */}
            {profile && (
              <div className="bg-white p-6 rounded-xl shadow-xl border-t-4 border-blue-500">
                <h2 className="text-2xl font-bold mb-3 text-gray-800">Profile</h2>
                <p><strong className="text-gray-600">Username:</strong> {profile.username}</p>
                <p><strong className="text-gray-600">Name:</strong> {profile.name || "N/A"}</p>
                <p><strong className="text-gray-600">Location:</strong> {profile.location || "N/A"}</p>
                <p><strong className="text-gray-600">Joined:</strong> {new Date(profile.joined * 1000).toLocaleDateString()}</p>
              </div>
            )}

            {/* Ratings Chart */}
            {stats && (
              <div className="bg-white p-6 rounded-xl shadow-xl border-t-4 border-purple-500">
                <h2 className="text-2xl font-bold mb-3 text-gray-800">Ratings Trend</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="rating" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
          {/* Recent Games */}
          {games.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-xl mt-6 border-t-4 border-yellow-500">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Recent Games</h2>
              <div className="overflow-x-auto">
                <ul className="divide-y divide-gray-200">
                  {games.slice(0, 10).map((gameItem, idx) => (
                    <li key={idx} className="py-3 flex justify-between items-center hover:bg-gray-50 transition duration-150 rounded-md px-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-700">
                          {gameItem.white.username} ({gameItem.white.rating}) vs {gameItem.black.username} ({gameItem.black.rating})
                        </p>
                        <p className="text-sm text-gray-500">
                          Result: <span className={`font-medium ${gameItem.white.result === 'win' ? 'text-green-600' : gameItem.black.result === 'win' ? 'text-red-600' : 'text-gray-500'}`}>
                            {gameItem.white.result}
                          </span>
                          , Time Control: {gameItem.time_control}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 ml-4">
                        {new Date(gameItem.end_time * 1000).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {page === "play" && (
        <ChessGame 
          fen={fen} 
          setFen={setFen} 
          safeGameMutate={safeGameMutate} 
          // Removed makeAiMove prop as it's now handled by useEffect
          restartGame={restartGame} 
        />
      )}
    </div>
  );
}

export default App;
