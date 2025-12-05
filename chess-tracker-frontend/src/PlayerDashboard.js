import React, { useEffect, useState } from "react";
import axios from "axios";

export default function PlayerDashboard({ token, onLogout }) {
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [chesscomId, setChesscomId] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetch = async () => {
      try {
        const meRes = await axios.get("http://localhost:5000/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        setMe(meRes.data);
        
        const gamesRes = await axios.get("http://localhost:5000/api/games/my-games", { headers: { Authorization: `Bearer ${token}` } });
        setGames(gamesRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, [token]);

  const fetchProfile = async () => {
    if (!chesscomId) {
      alert("Please enter a Chess.com ID");
      return;
    }
    setLoadingProfile(true);
    try {
      const p = await axios.get(`http://localhost:5000/api/player/${chesscomId}`);
      setProfile(p.data);
    } catch (err) {
      alert("User not found");
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen p-6 bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10 border-b border-purple-500/30 pb-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            📊 PLAYER DASHBOARD
          </h1>
          <button onClick={()=>{localStorage.removeItem('tt_token'); onLogout();}} className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition">
            🚪 Logout
          </button>
        </div>

        {/* My Profile Card */}
        {me && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-gradient-to-br from-purple-900/50 to-black border border-purple-500/30 p-6 rounded-xl shadow-lg">
              <div className="text-center">
                <div className="text-5xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                  {me.username.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-2xl font-bold text-white">{me.username}</h3>
                <p className="text-gray-400 text-sm mt-2">Local Account</p>
                <p className="text-xs text-gray-500 mt-1">Joined: {new Date(me.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Chess.com Search */}
            <div className="md:col-span-2 bg-gray-800/60 backdrop-blur border border-cyan-500/30 p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-bold text-cyan-400 mb-4">🔍 Search Chess.com Profile</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chesscomId}
                  onChange={(e) => setChesscomId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchProfile()}
                  placeholder="Enter Chess.com username"
                  className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={fetchProfile}
                  disabled={loadingProfile}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
                >
                  {loadingProfile ? "Loading..." : "Search"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chess.com Profile */}
        {profile && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-gradient-to-br from-lime-900/50 to-black border border-lime-500/30 p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-bold text-lime-400 mb-3">📋 PROFILE INFO</h3>
              <p className="text-white"><strong>Username:</strong> {profile.username}</p>
              <p className="text-gray-400"><strong>Title:</strong> {profile.title || "None"}</p>
              <p className="text-gray-400"><strong>Followers:</strong> {profile.followers || 0}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-900/50 to-black border border-blue-500/30 p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-bold text-blue-400 mb-3">⏱️ STATS</h3>
              <p className="text-white"><strong>Joined:</strong> {new Date(profile.joined * 1000).toLocaleDateString()}</p>
              <p className="text-gray-400"><strong>Status:</strong> {profile.status}</p>
              <p className="text-gray-400"><strong>Country:</strong> {profile.country || "Unknown"}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-900/50 to-black border border-amber-500/30 p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-bold text-amber-400 mb-3">🎯 RATINGS</h3>
              <p className="text-white"><strong>Last Online:</strong> {new Date(profile.last_online * 1000).toLocaleDateString()}</p>
              <p className="text-gray-400"><strong>Avatar:</strong> {profile.avatar ? "✓" : "None"}</p>
            </div>
          </div>
        )}

        {/* Saved Games */}
        <div className="bg-gray-800/60 backdrop-blur border border-pink-500/30 p-6 rounded-xl shadow-lg">
          <h3 className="text-2xl font-bold text-pink-400 mb-4">📚 SAVED GAMES ({games.length})</h3>
          {games.length === 0 ? (
            <p className="text-gray-400 italic">No saved games yet. Play a game and save it!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((game) => (
                <div key={game.id} className="bg-gray-700/50 border border-gray-600 p-4 rounded-lg hover:bg-gray-700 transition">
                  <p className="text-white font-bold">Chess.com: {game.chesscomUsername}</p>
                  <p className="text-gray-400 text-sm">Moves: {game.moves?.length || 0}</p>
                  <p className={`text-sm font-semibold ${
                    game.result === "in-progress" ? "text-yellow-400" :
                    game.result === "Draw" ? "text-gray-400" :
                    game.result.includes("Wins") ? "text-green-400" : "text-gray-400"
                  }`}>
                    {game.result}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{new Date(game.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
