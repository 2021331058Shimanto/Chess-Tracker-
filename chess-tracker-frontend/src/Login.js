import React, { useState } from "react";
import axios from "axios";

export default function Login({ onAuth }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const url = `http://localhost:5000/api/auth/${mode}`;
      const res = await axios.post(url, { username, password, name: username });
      const { token, user } = res.data;
      localStorage.setItem("tt_token", token);
      onAuth(token, user);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-4">{mode === 'login' ? 'Login' : 'Register'}</h2>
        {error && <div className="text-red-400 mb-2">{error}</div>}
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" className="w-full p-3 mb-3 rounded bg-gray-700 text-white" />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" type="password" className="w-full p-3 mb-3 rounded bg-gray-700 text-white" />
        <button className="w-full py-3 bg-green-500 rounded font-bold text-white mb-2" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <div className="text-center text-sm text-gray-300">
          <button type="button" className="underline" onClick={()=>setMode(mode==='login'? 'register' : 'login')}>{mode==='login' ? 'Need an account?' : 'Have an account?'} </button>
        </div>
      </form>
    </div>
  );
}
