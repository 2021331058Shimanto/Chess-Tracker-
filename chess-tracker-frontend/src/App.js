import { useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";

function App() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);

  const fetchData = async () => {
    try {
      const profileRes = await axios.get(`http://localhost:5000/api/player/${username}`);
      const statsRes = await axios.get(`http://localhost:5000/api/player/${username}/stats`);
      const gamesRes = await axios.get(`http://localhost:5000/api/player/${username}/games`);

      setProfile(profileRes.data);
      setStats(statsRes.data);
      setGames(gamesRes.data);
    } catch (err) {
      console.error(err);
      alert("User not found!");
    }
  };

  // Prepare chart data
  const chartData = stats
    ? [
        {
          name: "Blitz",
          rating: stats.chess_blitz?.last?.rating || 0,
        },
        {
          name: "Rapid",
          rating: stats.chess_rapid?.last?.rating || 0,
        },
        {
          name: "Bullet",
          rating: stats.chess_bullet?.last?.rating || 0,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Chess Tracker Dashboard</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter Chess.com username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 rounded mr-2"
        />
        <button onClick={fetchData} className="bg-blue-500 text-white px-4 py-2 rounded">
          Fetch
        </button>
      </div>

      {profile && (
        <div className="bg-white p-6 rounded shadow mb-4">
          <h2 className="text-xl font-bold">Profile</h2>
          <p>Username: {profile.username}</p>
          <p>Name: {profile.name}</p>
          <p>Location: {profile.location}</p>
          <p>Joined: {new Date(profile.joined * 1000).toLocaleDateString()}</p>
        </div>
      )}

      {stats && (
        <div className="bg-white p-6 rounded shadow mb-4">
          <h2 className="text-xl font-bold mb-2">Ratings</h2>

          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="rating" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {games.length > 0 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-2">Recent Games</h2>
          <ul>
            {games.slice(0, 10).map((game, idx) => (
              <li key={idx} className="border-b py-2">
                <p>
                  <strong>White:</strong> {game.white.username} ({game.white.result}){" "}
                  <strong>vs</strong> <strong>Black:</strong> {game.black.username} ({game.black.result})
                </p>
                <p>Time Control: {game.time_control}, Ended: {new Date(game.end_time * 1000).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
