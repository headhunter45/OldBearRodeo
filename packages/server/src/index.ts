import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createSession, getSession } from './session.js';
import { setupWebSocket } from './signaling.js';
import { fetchDnDCharacter } from './dndbeyond.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Create new game session
app.post('/api/sessions', (req, res) => {
  const { name } = req.body || {};
  const { session, gmKey } = createSession(name);
  res.json({
    roomId: session.id,
    gmKey,
    session,
  });
});

// Get session details
app.get('/api/sessions/:roomId', (req, res) => {
  const session = getSession(req.params.roomId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ session });
});

// Proxy and normalize D&D Beyond character data
app.get('/api/dndbeyond/:characterId', async (req, res) => {
  try {
    const character = await fetchDnDCharacter(req.params.characterId);
    if (!character) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }
    res.json(character);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch character from D&D Beyond' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

server.listen(PORT, () => {
  console.log(`[OldBear Server] Running on http://localhost:${PORT}`);
  console.log(`[OldBear Server] WebSocket listening on ws://localhost:${PORT}`);
});
