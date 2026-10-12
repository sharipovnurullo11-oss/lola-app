import fs from 'node:fs';

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

// Postgres adapter
async function pgDb() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(schema);
  const one = async (sql, p) => (await pool.query(sql, p)).rows[0] || null;
  return {
    createUser: (u) => one(
      `INSERT INTO users (email,name,password_hash,lang,terms_accepted_at,is_owner)
       VALUES ($1,$2,$3,$4,now(),$5) RETURNING id,email,name,lang,status,is_owner`,
      [u.email, u.name, u.passwordHash, u.lang, !!u.isOwner]),
    userByEmail: (email) => one('SELECT * FROM users WHERE lower(email)=lower($1)', [email]),
    userCount: async () => Number((await one('SELECT count(*) c FROM users')).c),
    createSession: (tokenHash, userId, ttlSec) => pool.query(
      `INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+($3||' seconds')::interval)`,
      [tokenHash, userId, String(ttlSec)]),
    userBySession: (tokenHash) => one(
      `SELECT u.id,u.email,u.name,u.lang,u.status,u.is_owner FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now()`, [tokenHash]),
    deleteSession: (tokenHash) => pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]),
    setLang: (id, lang) => pool.query('UPDATE users SET lang=$2 WHERE id=$1', [id, lang]),
    recentFailures: async (key, windowSec) => Number((await one(
      `SELECT count(*) c FROM login_attempts WHERE key=$1 AND at>now()-($2||' seconds')::interval`,
      [key, String(windowSec)])).c),
    addFailure: (key) => pool.query('INSERT INTO login_attempts (key) VALUES ($1)', [key]),
    clearFailures: (key) => pool.query('DELETE FROM login_attempts WHERE key=$1', [key]),
    cleanup: () => pool.query(`DELETE FROM sessions WHERE expires_at<now(); DELETE FROM login_attempts WHERE at<now()-interval '1 day'`),
  };
}

// In-memory adapter (только для тестов)
function memoryDb() {
  const users = []; const sessions = new Map(); const fails = new Map();
  return {
    async createUser(u) {
      if (users.some((x) => x.email.toLowerCase() === u.email.toLowerCase())) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { id: users.length + 1, email: u.email, name: u.name, password_hash: u.passwordHash, lang: u.lang, status: 'awaiting_payment', is_owner: !!u.isOwner };
      users.push(row); const { password_hash, ...pub } = row; return pub;
    },
    async userByEmail(e) { return users.find((x) => x.email.toLowerCase() === e.toLowerCase()) || null; },
    async userCount() { return users.length; },
    async createSession(h, id, ttl) { sessions.set(h, { id, exp: Date.now() + ttl * 1000 }); },
    async userBySession(h) {
      const s = sessions.get(h); if (!s || s.exp < Date.now()) return null;
      const { password_hash, ...pub } = users.find((x) => x.id === s.id); return pub;
    },
    async deleteSession(h) { sessions.delete(h); },
    async setLang(id, lang) { users.find((x) => x.id === id).lang = lang; },
    async recentFailures(k, w) { return (fails.get(k) || []).filter((t) => t > Date.now() - w * 1000).length; },
    async addFailure(k) { fails.set(k, [...(fails.get(k) || []), Date.now()]); },
    async clearFailures(k) { fails.delete(k); },
    async cleanup() {},
  };
}

export const openDb = () => (process.env.DB === 'memory' ? memoryDb() : pgDb());
