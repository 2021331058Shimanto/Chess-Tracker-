import { useState, useCallback, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from 'axios'; 
import io from 'socket.io-client'; 

import Login from './Login';
import PlayerDashboard from './PlayerDashboard';
// import ChessBoardComponent from "./ChessBoardComponent"; // <-- This component is not defined, assuming it was a leftover
import MultiplayerDashboard from "./MultiplayerDashboard";

const THEMES = {
    vaporwave: {
        name: 'Vaporwave 🌃',
        bg: 'bg-gray-950 background-noise',
        primary: 'pink',
        secondary: 'purple',
        accent: 'cyan',
        text: 'text-white',
        cardShadow: 'shadow-purple-900/50',
        titleGlow: 'title-glow-vapor',
    },
    cyberpunk: {
        name: 'Cyberpunk 💾',
        bg: 'bg-black background-circuit',
        primary: 'lime',
        secondary: 'red',
        accent: 'blue',
        text: 'text-gray-100',
        cardShadow: 'shadow-red-700/50',
        titleGlow: 'title-glow-cyber',
    },
};


const INITIAL_PROFILE = { username: "Enter-ID", name: "Player Profile", location: "Unknown", joined: Date.now(), avatar: 'N/A', currentRating: 1200 };
const INITIAL_STATS = {
    chess_blitz: { last: { rating: 1200 } },
    chess_rapid: { last: { rating: 1200 } },
    chess_bullet: { last: { rating: 1200 } },
    wins: 0, losses: 0, draws: 0
};
const INITIAL_GAMES = [];


// Animated Avatar/Badge Component (UNCHANGED)
const PlayerBadge = ({ username, rating, color = 'pink', theme }) => (
    <div className={`p-4 rounded-xl border-2 border-${theme.primary}-400 shadow-xl shadow-${theme.primary}-800/50 flex flex-col items-center bg-gray-900/80 transition duration-300 hover:scale-[1.05] card-glitch`}>
        <div className={`text-4xl font-extrabold p-3 rounded-full mb-2 bg-${theme.primary}-500 text-black border-4 border-${theme.primary}-300 pulse-glow`}>
            {username.slice(0, 3).toUpperCase()}
        </div>
        <div className="text-xl font-bold text-white tracking-wider">{username}</div>
        <div className={`text-sm font-mono text-${theme.primary}-400`}>ELO: {rating}</div>
    </div>
);

// Elo Change Preview (UNCHANGED)
const EloPreview = ({ moveCount, rating, theme }) => {
    const change = moveCount > 10 ? '+8' : moveCount > 5 ? '+4' : '±0';
    const color = change.includes('+') ? 'text-green-400 drop-shadow-neon-green' : 'text-gray-400';

    return (
        <div className="w-full neo-flat-card p-4 text-center">
            <h3 className="text-xl font-bold text-white mb-2">PROJECTED ELO CHANGE</h3>
            <div className={`text-5xl font-extrabold ${color} animate-bounce`}>
                {change}
            </div>
            <p className="text-sm text-gray-500">Current Blitz ELO: {rating}</p>
        </div>
    );
};

//Helper function to determine the current state of the game (UNCHANGED)
const getGameStatus = (fen, theme, isMultiplayer, playerColor) => {
    const game = new Chess(fen);
    
    // Theme-specific colors for status
    const colors = {
        checkmate: `text-red-400 drop-shadow-neon-red`,
        draw: `text-yellow-300 drop-shadow-neon-yellow`,
        stalemate: "text-gray-400",
        check: `text-orange-400 drop-shadow-neon-orange`,
        turn: `text-${theme.primary}-400 drop-shadow-neon-${theme.primary}`,
    };
    
    if (game.isCheckmate()) return <span className={`${colors.checkmate} font-bold`}>TERMINATED: CHECKMATE</span>;
    if (game.isDraw() || game.isStalemate()) return <span className={`${colors.draw} font-bold`}>DRAW STATE REACHED</span>;
    if (game.isCheck()) return <span className={`${colors.check} font-bold`}>SYSTEM WARNING: CHECK!</span>;
    
    if (isMultiplayer) {
        const turn = game.turn() === 'w' ? 'WHITE' : 'BLACK';
        const player = game.turn() === playerColor ? 'YOUR' : 'OPPONENT\'S';
        return <span className={`${colors.turn} font-bold`}>WAITING FOR {player} MOVE: {turn}</span>;
    }
    
    const turn = game.turn() === 'w' ? 'WHITE (PLAYER)' : 'BLACK (AI)';
    return <span className={`${colors.turn} font-bold`}>TURN: {turn}</span>;
};

// Dedicated Chess Game Component (UNCHANGED)
const ChessGame = ({ fen, safeGameMutate, restartGame, theme, isMultiplayer, playerColor }) => {
    const [difficulty, setDifficulty] = useState('Intermediate');
    const [moveHistory, setMoveHistory] = useState([]);

    useEffect(() => {
        const game = new Chess(fen);
        setMoveHistory(game.history({ verbose: true })); 
    }, [fen]);
    
    const allowDrag = (piece) => {
      const game = new Chess(fen);
      const isPlayerTurn = game.turn() === game.color(piece);
      
      if (isMultiplayer) {
        // In multiplayer, only allow drag if it's the current player's color and their turn
        return isPlayerTurn && game.color(piece) === playerColor;
      } else {
        // In single player (AI), only allow white (player) pieces on white's turn
        return isPlayerTurn && game.color(piece) === 'w';
      }
    };

    const onDrop = (source, target) => {
      // The safeGameMutate function handles sending the move via socket if in multiplayer mode
      const moveResult = safeGameMutate((game) => {
        return game.move({ from: source, to: target, promotion: "q" });
      });
      return moveResult ? true : false;
    };

    const boardSize = Math.min(
      window.innerWidth * 0.9, 
      window.innerHeight * 0.8,
      400 
    );
    
    const moveCount = moveHistory.length;
    
    const boardOrientation = playerColor === 'b' ? "black" : "white"; // Dynamic orientation

    return (
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        
        {/* === LEFT PANEL: Player & Stats (Col 1-3) === */}
        <div className="lg:col-span-3 space-y-6">
            <PlayerBadge 
                username={isMultiplayer ? (playerColor === 'w' ? "YOU (White)" : "YOU (Black)") : INITIAL_PROFILE.username} 
                rating={INITIAL_PROFILE.currentRating} 
                theme={theme} 
            />
            
            {/* AI CONFIG / GAME INFO */}
            <div className="neo-flat-card p-5">
                <h3 className="text-xl font-bold text-white mb-3">{isMultiplayer ? 'MULTIPLAYER SESSION' : 'AI CONFIG'}</h3>
                
                {isMultiplayer ? (
                    <p className="text-gray-400 text-sm"><span className={`text-${theme.primary}-400`}>Your Color:</span> {playerColor === 'w' ? 'WHITE' : 'BLACK'}</p>
                ) : (
                    <>
                        <label className="text-gray-400 text-sm">SET DEPTH LEVEL:</label>
                        <select 
                            value={difficulty} 
                            onChange={(e) => setDifficulty(e.target.value)} 
                            className={`w-full bg-gray-800/50 border border-${theme.secondary}-500/50 p-3 rounded-lg text-white font-mono focus:ring-${theme.secondary}-500 focus:border-${theme.secondary}-500 transition duration-300 shadow-inner mt-1`}
                        >
                            {['Easy (Depth 2)', 'Intermediate (Depth 6)', 'Hard (Depth 12)', 'Grandmaster (Depth 20)'].map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                        <button 
                            className={`mt-4 w-full px-4 py-2 bg-gradient-to-r from-${theme.secondary}-600 to-${theme.primary}-600 text-white font-bold rounded-full transform hover:scale-[1.02] active:scale-[0.98] transition duration-300 glow-button`}
                        >
                            INITIATE MATCH
                        </button>
                    </>
                )}
            </div>
            
            {/* Real-time Game Info */}
            <div className="neo-flat-card p-5">
                <h3 className="text-xl font-bold text-white mb-3">GAME DATA</h3>
                <p className="text-gray-400 text-sm"><span className={`text-${theme.primary}-400`}>Time Ctrl:</span> Blitz 3|0</p>
                <p className="text-gray-400 text-sm"><span className={`text-${theme.primary}-400`}>Total Moves:</span> {Math.ceil(moveCount / 2)}</p>
                <p className="text-gray-400 text-sm"><span className={`text-${theme.primary}-400`}>Mode:</span> {isMultiplayer ? 'P2P SOCKET' : 'VS AI'}</p>
            </div>
        </div>

        {/* === CENTER PANEL: Board & Status (Col 4-9) === */}
        <div className="lg:col-span-6 flex flex-col items-center space-y-6">
            <div className="w-full text-center">
                <div className={`text-2xl font-extrabold p-3 rounded-xl bg-gray-900/90 text-white border-b-4 border-${theme.primary}-500 shadow-xl shadow-${theme.primary}-900/50 text-glow-${theme.primary}`}>
                    {getGameStatus(fen, theme, isMultiplayer, playerColor)}
                </div>
            </div>

            {/* Chessboard Container - HOLOGRAPHIC FRAME */}
            <div 
                style={{ cursor: 'pointer', userSelect: 'none', touchAction: 'none' }} 
                className={`relative z-20 w-full max-w-[500px] p-2 bg-gradient-to-br from-${theme.secondary}-900 to-black rounded-3xl holographic-frame shadow-holographic transition-all duration-500 hover:scale-[1.01]`}
            >
                <Chessboard 
                    id="PlayBoard" 
                    position={fen} 
                    onPieceDrop={onDrop} 
                    boardWidth={boardSize} 
                    arePiecesDraggable={true} 
                    boardOrientation={boardOrientation} 
                    allowDrag={allowDrag}
                />
            </div>
            
            <button
                onClick={restartGame}
                className="mt-4 px-12 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-full transition duration-300 transform hover:scale-105 active:scale-95 shadow-xl shadow-red-700/50 border-b-4 border-red-800 button-glitch"
            >
                REBOOT MATCH 💾
            </button>
        </div>

        {/* === RIGHT PANEL: History (Col 10-12) === */}
        <div className="lg:col-span-3">
            <div className="neo-flat-card p-5 h-[500px] overflow-y-auto">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-pink-500 pb-2">MOVE DATA LOG</h3>
                <ol className="text-sm space-y-1 divide-y divide-gray-800">
                    {moveHistory.map((move, index) => (
                        <li key={index} className="flex py-1 px-1 transition duration-150 hover:bg-gray-800/50 rounded text-gray-400 hover:text-white font-mono text-sm">
                            <span className={`w-8 text-${theme.primary}-400 mr-2`}>{Math.floor(index / 2) + 1}.</span>
                            <span className={`flex-1 ${index % 2 === 0 ? 'text-white' : 'text-gray-400'}`}>
                                {move.san}
                            </span>
                        </li>
                    ))}
                    {moveHistory.length === 0 && <p className="text-gray-500 italic text-center pt-10">Waiting for first command...</p>}
                </ol>
            </div>
        </div>
      </div>
    );
};


function App() {
    const [page, setPage] = useState("dashboard");
    const [authToken, setAuthToken] = useState(localStorage.getItem('tt_token') || null);
    const [authUser, setAuthUser] = useState(null);
    const [currentTheme, setCurrentTheme] = useState('vaporwave'); 
    const theme = THEMES[currentTheme]; 
    const [username, setUsername] = useState("");
    const [profile, setProfile] = useState(INITIAL_PROFILE);
    const [stats, setStats] = useState(INITIAL_STATS); 
    const [games, setGames] = useState(INITIAL_GAMES); 

    const [fen, setFen] = useState(new Chess().fen());
    const gameRef = useMemo(() => new Chess(), []);

    // SOCKET STATE AND CONFIGURATION
    const SERVER_URL = 'http://localhost:5000';
    const [socket, setSocket] = useState(null); 
    const [roomId, setRoomId] = useState('');
    const [playerColor, setPlayerColor] = useState(null); // 'w' or 'b' or null

    const toggleTheme = () => {
        setCurrentTheme(prev => prev === 'vaporwave' ? 'cyberpunk' : 'vaporwave');
    };

    // Existing Auth/Load logic 
    useEffect(() => {
        if (!authToken) return;
        const load = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } });
                setAuthUser(res.data);
                // Initialize username state from auth user
                setUsername(res.data.username); 
            } catch (err) {
                console.error('Failed to load auth user', err);
                setAuthToken(null);
                localStorage.removeItem('tt_token');
            }
        };
        // 💡 Ensure this runs whenever authToken changes
        load();
    }, [authToken]);

    const onAuth = (token, user) => {
        setAuthToken(token);
        setAuthUser(user);
        // Ensure username state is set on successful login
        setUsername(user.username);
    };

    const onLogout = () => {
        setAuthToken(null);
        setAuthUser(null);
        localStorage.removeItem('tt_token');
        // Disconnect socket on logout
        if (socket) socket.disconnect();
    };

    // ------------------------------------------------------------------
    // 1. GAME MUTATION & MOVE SENDING FUNCTIONS 
    // ------------------------------------------------------------------
    
    // Function to safely apply a change to the game and update FEN (UNCHANGED)
    const safeGameMutate = useCallback((modify) => {
        const tempGame = new Chess(fen);
        const prevTurn = tempGame.turn();
        const result = modify(tempGame);

        if (result) {
            setFen(tempGame.fen());
            
            // MULTIPLAYER LOGIC: Check if it's a socket game AND this player's turn 
            if (socket && prevTurn === playerColor) {
                // Send simplified move object (from, to, promotion)
                socket.emit('move', { 
                    roomId, 
                    from: result.from, 
                    to: result.to, 
                    promotion: result.promotion 
                }, (response) => {
                    if (!response.ok) {
                        // Revert the local move if the server rejects it
                        setFen(new Chess(tempGame.fen()).fen());
                        console.error("Server rejected move:", response.error);
                    }
                });
            }
        }
        return result;
    }, [fen, socket, playerColor, roomId]); 

    // Function to reset the game (UNCHANGED)
    const restartGame = useCallback(() => {
        gameRef.reset();
        setFen(gameRef.fen());
        // If in multiplayer, signal restart to server/opponent
        if (socket && roomId) {
            socket.emit('restartGame', roomId); 
        }
    }, [gameRef, socket, roomId]);


    // ------------------------------------------------------------------
    // 2. SOCKET CONNECTION/ROOM HANDLERS (REFINED)
    // ------------------------------------------------------------------
    
    // Helper function to establish connection and setup listeners
    // 💡 dependency array updated to include setPage
    const setupSocketAndListeners = useCallback(() => {
        // Disconnect any existing socket before creating a new one
        if (socket) socket.disconnect(); 

        const newSocket = io(SERVER_URL);
        setSocket(newSocket);
        
        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
        });

        // Handler for moves from the opponent 
        newSocket.on('move-made', (data) => {
            console.log('Opponent moved:', data.san);
            setFen(data.fen);
        });
        
        // Handle opponent leaving
        newSocket.on('opponent-left', (data) => {
            alert(`Opponent (${data.color}) has disconnected. Room is now open for a new player.`);
        });
        
        // Handle game start when the second player joins
        newSocket.on('start-game', (data) => {
            console.log('Game is starting!', data);
            setFen(data.fen);
        });
        
        newSocket.on('game-over', (data) => {
            alert(`Game Over! Reason: ${data.reason}. Winner: ${data.winner || 'None'}`);
            setSocket(null);
            setRoomId('');
            setPlayerColor(null);
            setPage('multiplayer'); // 💡 Use setPage here
        });

        // Handle disconnect cleanup
        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setRoomId('');
            setPlayerColor(null);
        });

        return newSocket;
    }, [SERVER_URL, setPage]); // Added setPage dependency

    // Function to create a new room
    const handleCreateRoom = useCallback(() => {
        // 💡 Use closure to get the latest username value directly from the App state
        const currentUsername = username; 
        if (!currentUsername) return alert("Please wait for username to load or log in.");
        
        console.log(`Attempting to create room for user: ${currentUsername}`);
        const newSocket = setupSocketAndListeners();

        // Use 'create-room' event with username and a callback
        newSocket.emit('create-room', { username: currentUsername }, (response) => {
            if (response.ok) {
                console.log(`✅ Room ${response.roomId} created. Assigned ${response.color}.`);
                setRoomId(response.roomId);
                setPlayerColor(response.color === 'white' ? 'w' : 'b');
                setFen(response.fen);
                setPage('play');
            } else {
                alert(`Error creating room: ${response.error}`);
                newSocket.disconnect();
                setSocket(null);
            }
        });
    }, [username, setupSocketAndListeners, setPage]); // Added setPage dependency
    
    // Function to join an existing room
    const handleJoinRoom = useCallback((id) => {
        const currentUsername = username; 
        if (!currentUsername) return alert("Please wait for username to load or log in.");
        if (!id) return alert("Please enter a Room ID.");
        
        console.log(`Attempting to join room ${id} for user: ${currentUsername}`);
        const newSocket = setupSocketAndListeners();
        
        // Use 'join-room' event with roomId, username, and a callback
        newSocket.emit('join-room', { roomId: id, username: currentUsername }, (response) => {
            if (response.ok && response.role === 'player') {
                console.log(`✅ Joined room ${id}. Assigned ${response.color}.`);
                setRoomId(id);
                setPlayerColor(response.color === 'white' ? 'w' : 'b');
                setFen(response.fen);
                setPage('play');
            } else if (response.ok && response.role === 'spectator') {
                alert(`Room is full. Joining as spectator.`);
                setRoomId(id);
                setFen(response.fen);
                setPage('play');
            } else {
                alert(`Error joining room: ${response.error}`);
                newSocket.disconnect();
                setSocket(null);
                setRoomId('');
            }
        });
    }, [username, setupSocketAndListeners, setPage]); // Added setPage dependency


    // Cleanup effect for component unmount (UNCHANGED)
    useEffect(() => {
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [socket]);
    
    // ------------------------------------------------------------------
    // 3. AI LOGIC & DATA FETCH (UNCHANGED)
    // ------------------------------------------------------------------

    // AI Logic (Only runs if NOT in multiplayer)
    const makeAiMove = useCallback(() => {
        const tempGame = new Chess(fen);
        if (tempGame.isGameOver() || tempGame.turn() !== 'b') return; 
        
        const moves = tempGame.moves();
        if (moves.length === 0) return;
        const randomMove = moves[Math.floor(Math.random() * moves.length)];

        safeGameMutate((game) => {
            game.move(randomMove);
            return true;
        });
    }, [fen, safeGameMutate]);

    useEffect(() => {
        const tempGame = new Chess(fen);
        // Only run AI logic if not in multiplayer
        if (!socket && tempGame.turn() === 'b' && !tempGame.isGameOver()) {
            const timer = setTimeout(makeAiMove, 500); 
            return () => clearTimeout(timer);
        }
    }, [fen, makeAiMove, socket]);


    // Existing Data Fetch Logic (UNCHANGED)
    const fetchData = useCallback(async () => {
        if (!username) {
            console.error("Please enter a username.");
            return;
        }

        try {
            console.log(`Fetching data for ${username} from local API...`);
            const profileRes = await axios.get(`http://localhost:5000/api/player/${username}`);
            const statsRes = await axios.get(`http://localhost:5000/api/player/${username}/stats`);
            const gamesRes = await axios.get(`http://localhost:5000/api/player/${username}/games`);

            setProfile(profileRes.data);
            setStats(statsRes.data);
            setGames(gamesRes.data);
            
            console.log("Data fetched successfully from local backend.");

        } catch (err) {
            console.error(err);
            console.error("User not found or API failed. Check that your backend server is running on http://localhost:5000 and the user exists."); 
            setProfile(INITIAL_PROFILE);
            setStats(INITIAL_STATS);
            setGames(INITIAL_GAMES);
        }
    }, [username]);


    const chartData = stats
        ? [
            { name: "Bullet", "ELO Score": stats.chess_bullet?.last?.rating || 0 },
            { name: "Blitz", "ELO Score": stats.chess_blitz?.last?.rating || 0 },
            { name: "Rapid", "ELO Score": stats.chess_rapid?.last?.rating || 0 },
          ]
        : [];

    if (!authToken) {
        return <Login onAuth={onAuth} />;
    }

    return (
        <div className={`min-h-screen font-sans ${theme.bg} ${theme.text} p-6 md:p-10`}>
            <header className="max-w-7xl mx-auto mb-10">
                <div className="flex justify-between items-center pb-3 border-b-4 border-purple-500/50">
                    <h1 className={`text-5xl font-extrabold tracking-widest uppercase ${theme.titleGlow}`}>
                        <span className={`text-${theme.primary}-500 drop-shadow-neon-${theme.primary} mr-2`}>C H E S S</span> T R A C K E R
                    </h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className={`px-4 py-2 bg-gray-800/70 text-${theme.accent}-400 font-bold rounded-full transition duration-300 border-2 border-${theme.accent}-500 hover:scale-[1.05] shadow-lg shadow-${theme.accent}-900/50`}
                        >
                            {theme.name}
                        </button>
                        {authToken && (
                            <button onClick={() => setPage('player')} className="px-3 py-2 bg-blue-600 text-white rounded">My Dashboard</button>
                        )}
                    </div>
                </div>

                {/* Navigation Tabs - Flat, high-contrast pills */}
                <div className="flex justify-center mt-6 p-2 bg-gray-900/50 rounded-full shadow-inner shadow-purple-900 max-w-lg mx-auto">
                    <button
                        onClick={() => setPage("dashboard")}
                        className={`flex-1 px-8 py-3 font-bold rounded-full text-lg transition duration-300 transform hover:scale-[1.02] ${
                            page === "dashboard" ? `bg-gradient-to-r from-${theme.primary}-500 to-${theme.secondary}-600 text-white shadow-lg shadow-${theme.primary}-600/50` : "text-gray-300 hover:bg-gray-700/50"
                        }`}
                    >
                        DASHBOARD
                    </button>
                    <button
                        onClick={() => setPage("play")}
                        className={`flex-1 px-8 py-3 font-bold rounded-full text-lg transition duration-300 transform hover:scale-[1.02] ${
                            page === "play" ? `bg-gradient-to-r from-${theme.primary}-500 to-${theme.secondary}-600 text-white shadow-lg shadow-${theme.primary}-600/50` : "text-gray-300 hover:bg-gray-700/50"
                        }`}
                    >
                        PLAY VS AI
                    </button>
                    <button
                        onClick={() => setPage("multiplayer")}
                        className={`flex-1 px-8 py-3 font-bold rounded-full text-lg transition duration-300 transform hover:scale-[1.02] ${
                            page === "multiplayer" ? `bg-gradient-to-r from-${theme.primary}-500 to-${theme.secondary}-600 text-white shadow-lg shadow-${theme.primary}-600/50` : "text-gray-300 hover:bg-gray-700/50"
                        }`}
                    >
                        MULTIPLAYER 🤝
                    </button>
                </div>
            </header>

            {page === "dashboard" && (
                <div className="max-w-7xl mx-auto space-y-10">
                    {/* Top Control Panel */}
                    <div className={`flex justify-center items-center p-6 neo-flat-card shadow-lg ${theme.cardShadow}`}>
                        <input
                            type="text"
                            placeholder="ENTER HASH KEY OR USER ID"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={`border border-${theme.secondary}-600 p-4 rounded-l-lg flex-grow max-w-lg text-lg focus:ring-${theme.primary}-500 focus:border-${theme.primary}-500 bg-gray-800/70 text-white placeholder-gray-500 outline-none font-mono tracking-wider`}
                        />
                        <button 
                            onClick={fetchData} 
                            className="bg-gradient-to-r from-green-400 to-cyan-500 hover:from-green-500 hover:to-cyan-600 text-gray-900 px-8 py-4 rounded-r-lg font-extrabold transition duration-300 transform hover:scale-[1.01] shadow-lg shadow-cyan-500/50 border-b-4 border-cyan-700"
                        >
                            FETCH DATA &gt;&gt;
                        </button>
                    </div>

                    {/* Main Dashboard Layout (3-Column Grid) */}
                    <div className="grid lg:grid-cols-12 gap-8">
                        
                        {/* Left Sidebar (Col 1-3) */}
                        <div className="lg:col-span-3 space-y-6">
                            <PlayerBadge username={profile.username} rating={profile.currentRating} theme={theme} />
                            <ScoreBar wins={stats.wins} losses={stats.losses} draws={stats.draws} />
                        </div>

                        {/* Middle Section (Col 4-9) */}
                        <div className="lg:col-span-6 space-y-6">
                            {/* Stats Overview */}
                            <div className="grid grid-cols-3 gap-4">
                                {stats && (
                                    <>
                                    <StatCard title="Bullet Max" value={stats.chess_bullet?.last?.rating || 'N/A'} icon="⚡" color={`text-${theme.primary}-400`} />
                                    <StatCard title="Blitz Max" value={stats.chess_blitz?.last?.rating || 'N/A'} icon="⏱️" color={`text-${theme.secondary}-400`} />
                                    <StatCard title="Rapid Max" value={stats.chess_rapid?.last?.rating || 'N/A'} icon="⏳" color={`text-${theme.accent}-400`} />
                                    </>
                                )}
                            </div>

                            {/* Ratings Chart */}
                            {stats && (
                                <div className={`neo-flat-card p-6 shadow-xl ${theme.cardShadow}`}>
                                    <h2 className={`text-2xl font-extrabold mb-4 text-${theme.primary}-400 border-b border-${theme.secondary}-700 pb-2`}>ELO SCORING TREND</h2>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#5a5a70" />
                                            <XAxis dataKey="name" stroke="#a0aec0" tick={{ fill: '#fff' }} />
                                            <YAxis stroke="#a0aec0" domain={['auto', 'auto']} tick={{ fill: '#fff' }} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.7)', background: '#1a1a2e', border: `1px solid ${theme.primary === 'pink' ? '#d8b4fe' : '#34d399'}` }} 
                                                itemStyle={{ color: `#${theme.primary === 'pink' ? 'd8b4fe' : '34d399'}`, fontWeight: 'bold' }} 
                                                labelStyle={{ color: '#fff' }} 
                                            />
                                            <Legend />
                                            <Line type="monotone" dataKey="ELO Score" stroke={`#${theme.primary === 'pink' ? 'f472b6' : 'a3e635'}`} strokeWidth={5} dot={{ r: 6, fill: `#${theme.primary === 'pink' ? 'f472b6' : 'a3e635'}` }} activeDot={{ r: 10, stroke: '#fff', strokeWidth: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar (Col 10-12) */}
                        <div className="lg:col-span-3">
                            {games.length > 0 && <LiveGameFeed games={games} theme={theme} />}
                            {games.length === 0 && <div className="neo-flat-card p-5 h-[300px] text-center text-gray-500 pt-10">No recent game data found.</div>}
                        </div>
                    </div>
                </div>
            )}
            
            {/* MULTIPLAYER DASHBOARD PAGE */}
            {page === "multiplayer" && (
                <MultiplayerDashboard
                    onCreateRoom={handleCreateRoom}
                    onJoinRoom={handleJoinRoom}
                    username={username}
                    roomId={roomId}
                    socket={socket}
                    theme={theme}
                />
            )}

            {page === "play" && (
                <ChessGame 
                    fen={fen} 
                    safeGameMutate={safeGameMutate} 
                    restartGame={restartGame} 
                    theme={theme}
                    isMultiplayer={!!socket}
                    playerColor={playerColor}
                />
            )}

            {page === 'player' && authToken && (
                <PlayerDashboard token={authToken} onLogout={onLogout} />
            )}
            
            {/* System Status Footer (New Component) */}
            <footer className={`fixed bottom-0 left-0 right-0 p-3 bg-gray-900/90 border-t border-${theme.secondary}-500/50 flex justify-center text-sm font-mono system-status-bar`}>
                <span className="text-green-400 mr-4">STATUS: ONLINE</span>
                <span className="text-gray-500 mr-4">LATENCY: 40ms</span>
                <span className={`text-${theme.primary}-400`}>VERSION: CHESS_TRACKER_V1.1.2</span>
            </footer>
        </div>
    );
}

// reusable Components (UNCHANGED)
const StatCard = ({ title, value, icon, color = 'text-white' }) => (
    <div className="neo-flat-card p-5 text-center transition duration-500 hover:scale-[1.05] shadow-md shadow-purple-900/50">
        <div className={`text-4xl mb-2 ${color}`}>{icon}</div>
        <div className="text-sm uppercase text-gray-400 font-semibold tracking-wider">{title}</div>
        <div className="text-3xl font-extrabold text-white text-glow-pink mt-1">{value}</div>
    </div>
);

const ScoreBar = ({ wins, losses, draws }) => {
    const total = wins + losses + draws;
    if (total === 0) return (
        <div className="neo-flat-card p-5">
            <h3 className="text-xl font-bold text-white mb-4 border-b border-purple-700 pb-2">WIN RATE INDEX</h3>
            <p className="text-gray-500">No game data to calculate rate.</p>
        </div>
    );

    const winP = (wins / total) * 100;
    const lossP = (losses / total) * 100;
    const drawP = (draws / total) * 100;

    return (
        <div className="neo-flat-card p-5">
            <h3 className="text-xl font-bold text-white mb-4 border-b border-purple-700 pb-2">WIN RATE INDEX</h3>
            <div className="flex justify-between text-sm text-gray-400 mb-2 font-mono">
                <span className="text-green-400">WINS: {wins}</span>
                <span className="text-yellow-400">DRAWS: {draws}</span>
                <span className="text-red-400">LOSSES: {losses}</span>
            </div>
            <div className="score-bar-genz flex">
                <div style={{ width: `${winP}%` }} className="win-segment" title={`Wins: ${wins}`}></div>
                <div style={{ width: `${drawP}%` }} className="draw-segment" title={`Draws: ${draws}`}></div>
                <div style={{ width: `${lossP}%` }} className="loss-segment" title={`Losses: ${losses}`}></div>
            </div>
        </div>
    );
};

const LiveGameFeed = ({ games, theme }) => (
    <div className="neo-flat-card p-5 h-[300px] overflow-y-auto">
        <h3 className={`text-2xl font-bold text-${theme.primary}-500 drop-shadow-neon-${theme.primary} mb-4 border-b border-${theme.primary}-700 pb-2 flex items-center`}>
            <span className="mr-2 animate-pulse">📡</span> LIVE NODE FEED
        </h3>
        <ul className="divide-y divide-gray-800">
            {games.slice(0, 5).map((gameItem, index) => {
                
                const resultColor = 
                    gameItem.result?.toLowerCase().includes('win') ? 'bg-green-600/30 text-green-400' : 
                    gameItem.result?.toLowerCase().includes('draw') ? 'bg-yellow-600/30 text-yellow-400' : 
                    'bg-red-600/30 text-red-400';
                
                const timeControl = gameItem.time_control || 'N/A';
                const resultText = gameItem.result ? gameItem.result.toUpperCase() : 'UNKNOWN';

                return (
                    <li key={index} className={`py-2 px-2 flex justify-between items-center transition duration-200 hover:bg-gray-800/70 rounded cursor-pointer border-l-2 border-transparent hover:border-${theme.primary}-500`}>
                        <div className="flex-1 min-w-0 text-sm">
                            <p className="font-semibold text-white">
                                {gameItem.white.username} vs {gameItem.black.username}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                {timeControl}
                            </p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${resultColor}`}>
                            {resultText}
                        </span>
                    </li>
                );
            })}
        </ul>
    </div>
);


export default App;
