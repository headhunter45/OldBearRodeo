import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createSession, getSession, getAllSessions, initSessionsFromDb } from './session.js';
import { setupWebSocket } from './signaling.js';
import { fetchDnDCharacter } from './dndbeyond.js';
import { initDb, isDbConnected, getDbPool } from './db.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint (both /health and /api/health for direct and proxied requests)
const healthHandler = async (_req: express.Request, res: express.Response) => {
  let dbStatus: 'connected' | 'in-memory' | 'error' = isDbConnected() ? 'connected' : 'in-memory';
  let dbDetails: any = null;

  if (isDbConnected()) {
    try {
      const pool = getDbPool();
      const testRes = await pool?.query('SELECT NOW() as now, count(*)::int as sessions_count FROM sessions');
      dbDetails = {
        dbTime: testRes?.rows[0]?.now,
        persistedSessions: testRes?.rows[0]?.sessions_count ?? 0,
      };
    } catch (err: any) {
      dbStatus = 'error';
      dbDetails = { error: err.message };
    }
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    uptime: process.uptime(),
    dbDetails,
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// List all active sessions
app.get('/api/sessions', (_req, res) => {
  res.json({ sessions: getAllSessions() });
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

async function start() {
  // Attempt PostgreSQL initialization if configured
  try {
    const connected = await initDb(5, 2000);
    if (connected) {
      await initSessionsFromDb();
    }
  } catch (err: any) {
    console.warn('[OldBear Server] Database initialization notice:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`[OldBear Server] Running on http://localhost:${PORT}`);
    console.log(`[OldBear Server] WebSocket listening on ws://localhost:${PORT}`);
    console.log(`[OldBear Server] Database mode: ${isDbConnected() ? 'PostgreSQL (Persistent)' : 'In-Memory'}`);
  });
}

start();
