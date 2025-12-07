import React, { useState, useCallback, useMemo } from 'react';

// This component expects the following props from App.js:
// { onCreateRoom, onJoinRoom, username, roomId, socket, theme }
const MultiplayerDashboard = ({ onCreateRoom, onJoinRoom, username, roomId, socket, theme }) => {
    const [roomIdInput, setRoomIdInput] = useState('');
    
    // Determine status text based on current socket/room state
    const status = useMemo(() => {
        // --- CRITICAL CHECK: if username is null/empty, this is where the error originates ---
        if (!username) {
            return {
                text: 'SYSTEM ERROR: USERNAME NOT LOADED. Please check login.',
                color: 'text-red-400',
                icon: '⚠️'
            };
        }
        
        if (roomId && socket) {
            // Player 1: Room created, waiting for opponent
            return { 
                text: `Room created! Share ID: ${roomId}. Waiting for Black player...`, 
                color: `text-${theme.primary}-400`,
                icon: '⏳' 
            };
        }
        if (socket && !roomId) {
            // Should not happen, but serves as a general connected state
            return { 
                text: 'Connected to server. Ready to join or create.', 
                color: 'text-green-400',
                icon: '⚡' 
            };
        }
        // Initial state
        return { 
            text: 'Connect to the Matrix to begin matchmaking...', 
            color: 'text-gray-500',
            icon: '🔌' 
        };
    }, [roomId, socket, theme.primary, username]);

    const handleCreateClick = useCallback(() => {
        if (username) {
            onCreateRoom();
        } else {
            // This alert should ideally not fire now that username is passed from App.js
            alert("Error: Username not loaded. Please log in again.");
        }
    }, [onCreateRoom, username]);

    const handleJoinClick = useCallback(() => {
        if (username && roomIdInput) {
            onJoinRoom(roomIdInput.toUpperCase());
        } else if (!username) {
            alert("Error: Username not loaded. Please log in again.");
        } else {
            alert("Please enter a valid Room ID.");
        }
    }, [onJoinRoom, username, roomIdInput]);

    return (
        <div className="max-w-4xl mx-auto space-y-10 pt-10">
            
            {/* --- Status Bar --- */}
            <div className={`p-6 neo-flat-card shadow-lg ${theme.cardShadow} text-center`}>
                <h2 className={`text-3xl font-extrabold ${status.color} mb-2 flex items-center justify-center`}>
                    <span className="mr-3">{status.icon}</span> {status.text}
                </h2>
                <p className="text-gray-400 text-sm font-mono">
                    User: <span className="text-white font-bold">{username || 'N/A'}</span> | 
                    Server: <span className="text-green-400">ONLINE</span>
                </p>
            </div>
            
            {/* --- Action Cards --- */}
            <div className="grid md:grid-cols-2 gap-8">
                
                {/* 1. Create New Room */}
                <div className="neo-flat-card p-8 flex flex-col items-center">
                    <h3 className={`text-2xl font-bold mb-4 text-${theme.primary}-400`}>CREATE NEW SESSION</h3>
                    <p className="text-gray-400 mb-6 text-center">
                        Initiate a new game. You will be assigned **White**.
                    </p>
                    <button
                        onClick={handleCreateClick}
                        disabled={!!roomId || !username} // Disable if in room or no username
                        className={`w-full px-6 py-3 bg-gradient-to-r from-${theme.primary}-600 to-${theme.secondary}-600 text-white font-extrabold rounded-full transition duration-300 transform hover:scale-[1.05] active:scale-95 shadow-xl shadow-${theme.primary}-700/50 glow-button disabled:opacity-50`}
                    >
                        {roomId ? `ROOM ID: ${roomId}` : "CREATE NEW ROOM"}
                    </button>
                    {roomId && (
                        <p className={`mt-4 text-sm text-${theme.accent}-400 font-mono`}>
                            Share this ID with your opponent.
                        </p>
                    )}
                </div>

                {/* 2. Join Existing Room */}
                <div className="neo-flat-card p-8 flex flex-col items-center">
                    <h3 className={`text-2xl font-bold mb-4 text-${theme.secondary}-400`}>JOIN EXISTING SESSION</h3>
                    <p className="text-gray-400 mb-4 text-center">
                        Enter a friend's Room ID. You will be assigned **Black**.
                    </p>
                    
                    <input
                        type="text"
                        placeholder="ENTER 6-DIGIT ROOM ID"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        maxLength={6}
                        className={`w-full border border-${theme.accent}-600 p-3 rounded-lg text-lg text-center font-mono focus:ring-${theme.accent}-500 focus:border-${theme.accent}-500 bg-gray-800/70 text-white placeholder-gray-500 outline-none mb-4`}
                    />
                    
                    <button
                        onClick={handleJoinClick}
                        disabled={!!roomId || !username} // Disable if in room or no username
                        className={`w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-extrabold rounded-full transition duration-300 transform hover:scale-[1.05] active:scale-95 shadow-xl shadow-cyan-700/50 glow-button disabled:opacity-50`}
                    >
                        JOIN ROOM
                    </button>
                </div>

            </div>
            
            {/* --- Instructions/Info --- */}
            <div className="mt-10 p-6 bg-gray-900/50 rounded-xl border border-gray-700 shadow-inner">
                <h3 className="text-xl font-bold text-white mb-3">PROTOCOL DETAILS</h3>
                <ul className="list-disc list-inside text-gray-400 space-y-2 text-sm">
                    <li>The first player to join/create a room is always assigned **White ('w')**.</li>
                    <li>The second player to join the same Room ID is always assigned **Black ('b')**.</li>
                    <li>After joining, the system will automatically navigate you to the **'PLAY'** tab with the correct board orientation.</li>
                </ul>
            </div>
            
        </div>
    );
};

export default MultiplayerDashboard;