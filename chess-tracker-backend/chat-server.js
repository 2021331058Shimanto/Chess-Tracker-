import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.CHAT_PORT || 6001;

const messages = [];

app.get('/messages', (req, res) => {
  res.json(messages);
});

app.post('/messages', (req, res) => {
  const { username, text } = req.body;
  if (!username || !text) return res.status(400).json({ message: 'username and text are required' });
  const msg = { id: messages.length + 1, username, text, timestamp: Date.now() };
  messages.push(msg);
  res.status(201).json(msg);
});

app.listen(PORT, () => console.log(`Chat server running on port ${PORT}`));
