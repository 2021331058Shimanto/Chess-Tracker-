import React, { useEffect, useState } from "react";
import axios from "axios";

export default function PlayerDashboard({ token, onLogout }) {
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!token) return;
    const fetch = async () => {
      try {
        const meRes = await axios.get("http://localhost:5000/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        setMe(meRes.data);
        const p = await axios.get(`http://localhost:5000/api/player/${meRes.data.username}`);
        setProfile(p.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, [token]);

  if (!token) return null;

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Player Dashboard</h1>
          <div>
            <button onClick={()=>{localStorage.removeItem('tt_token'); onLogout();}} className="px-4 py-2 bg-red-600 rounded">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-800 rounded">
            <h3 className="font-bold">Profile</h3>
            {me ? (
              <div className="mt-2">
                <p><strong>Username:</strong> {me.username}</p>
                <p><strong>Name:</strong> {me.name}</p>
              </div>
            ) : <p>Loading...</p>}
          </div>

          <div className="p-4 bg-gray-800 rounded md:col-span-2">
            <h3 className="font-bold">Chess.com Profile</h3>
            {profile ? (
              <div className="mt-2">
                <p><strong>Username:</strong> {profile.username}</p>
                <p><strong>Joined:</strong> {new Date(profile.joined * 1000).toLocaleDateString()}</p>
                <p><strong>Followers:</strong> {profile.followers}</p>
              </div>
            ) : <p>Loading...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
