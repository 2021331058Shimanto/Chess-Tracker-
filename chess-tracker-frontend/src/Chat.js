import React, { useEffect, useState, useRef } from 'react';

// Simple chat component that polls the backend for messages and posts new ones.
// Usage: import Chat from './Chat' and render <Chat backendUrl="http://localhost:5000" />
// chat box frontend
export default function Chat({ backendUrl = '' }) {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('Anonymous');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchMessages = async () => {
    try {
      // use relative API path so frontend can be served from same origin as backend
      const res = await fetch(`/api/chat/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Chat fetch error:', err);
    }
  };

  useEffect(() => {
    // initial load
    fetchMessages();
    // poll every 2s
    pollRef.current = setInterval(fetchMessages, 2000);
    return () => clearInterval(pollRef.current);
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, text: text.trim() }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setText('');
      await fetchMessages();
    } catch (err) {
      console.error('Chat send error:', err);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto neo-flat-card p-4">
      <h3 className="text-lg font-bold mb-3">Live Chat</h3>

      <div className="h-48 overflow-y-auto mb-3 p-2 bg-gray-900/60 rounded-md border border-gray-800">
        {messages.length === 0 && <div className="text-gray-400 text-sm">No messages yet.</div>}
        {messages.map((m) => (
          <div key={m.id} className="mb-2">
            <div className="text-xs text-gray-400">{new Date(m.timestamp).toLocaleTimeString()}</div>
            <div className="text-sm"><strong className="mr-2">{m.username}:</strong>{m.text}</div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="w-28 p-2 rounded bg-gray-800/70 border border-gray-700 text-sm text-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-label="username"
        />
        <input
          className="flex-1 p-2 rounded bg-gray-800/70 border border-gray-700 text-sm text-white"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say hi to friends..."
          aria-label="message"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 bg-green-500 hover:bg-green-600 rounded text-black font-bold"
        >
          Send
        </button>
      </form>
    </div>
  );
}

