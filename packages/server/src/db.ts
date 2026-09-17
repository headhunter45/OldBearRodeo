import pg from 'pg';
import { GameSession } from '@oldbear/shared';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isConnected = false;

export function isDbConnected(): boolean {
  return isConnected;
}

export function getDbPool(): pg.Pool | null {
  return pool;
}

/**
 * Initialize PostgreSQL connection pool and ensure required schemas exist.
 * Supports automatic retry logic for containerized startups.
 */
export async function initDb(maxRetries = 5, retryDelayMs = 2000): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log('[Database] No DATABASE_URL provided. Operating in in-memory mode.');
    isConnected = false;
    return false;
  }

  pool = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle PostgreSQL client:', err);
  });

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`[Database] Connecting to PostgreSQL (attempt ${attempt}/${maxRetries})...`);
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT current_database(), current_user, version()');
        console.log(`[Database] Connected successfully to DB: ${res.rows[0].current_database} as user: ${res.rows[0].current_user}`);

        // Ensure schema exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(255) PRIMARY KEY,
            gm_key VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            session_data JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
        `);
        console.log('[Database] Schema migrations verified (sessions table ready).');

        isConnected = true;
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn(`[Database] Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  console.warn('[Database] Unable to establish PostgreSQL connection after retries. Falling back to in-memory mode.');
  isConnected = false;
  return false;
}

/**
 * Persist or update a game session in PostgreSQL.
 */
export async function saveSessionToDb(session: GameSession, gmKey: string): Promise<void> {
  if (!isConnected || !pool) return;

  try {
    const query = `
      INSERT INTO sessions (id, gm_key, name, session_data, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        session_data = EXCLUDED.session_data,
        updated_at = CURRENT_TIMESTAMP;
    `;
    await pool.query(query, [session.id, gmKey, session.name, JSON.stringify(session)]);
  } catch (err: any) {
    console.error(`[Database] Failed to save session ${session.id}:`, err.message);
  }
}

/**
 * Load a single session by room ID from PostgreSQL.
 */
export async function loadSessionFromDb(id: string): Promise<{ session: GameSession; gmKey: string } | null> {
  if (!isConnected || !pool) return null;

  try {
    const res = await pool.query('SELECT id, gm_key, session_data FROM sessions WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const session: GameSession = typeof row.session_data === 'string'
      ? JSON.parse(row.session_data)
      : row.session_data;

    return { session, gmKey: row.gm_key };
  } catch (err: any) {
    console.error(`[Database] Failed to load session ${id}:`, err.message);
    return null;
  }
}

/**
 * Preload all sessions from PostgreSQL into memory on server boot.
 */
export async function loadAllSessionsFromDb(): Promise<Map<string, { session: GameSession; gmKey: string }>> {
  const result = new Map<string, { session: GameSession; gmKey: string }>();
  if (!isConnected || !pool) return result;

  try {
    const res = await pool.query('SELECT id, gm_key, session_data FROM sessions ORDER BY updated_at DESC');
    for (const row of res.rows) {
      const session: GameSession = typeof row.session_data === 'string'
        ? JSON.parse(row.session_data)
        : row.session_data;
      result.set(row.id, { session, gmKey: row.gm_key });
    }
    console.log(`[Database] Preloaded ${result.size} sessions from PostgreSQL.`);
  } catch (err: any) {
    console.error('[Database] Failed to preload sessions from database:', err.message);
  }

  return result;
}

/**
 * Delete a session from PostgreSQL.
 */
export async function deleteSessionFromDb(id: string): Promise<void> {
  if (!isConnected || !pool) return;

  try {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  } catch (err: any) {
    console.error(`[Database] Failed to delete session ${id}:`, err.message);
  }
}

/**
 * Close database pool on shutdown.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
  }
}
