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
      `INSERT INTO users (email,phone,name,password_hash,lang,terms_accepted_at,is_owner)
       VALUES ($1,$2,$3,$4,$5,now(),$6) RETURNING id,email,phone,name,lang,status,is_owner`,
      [u.email || null, u.phone || null, u.name, u.passwordHash || null, u.lang, !!u.isOwner]),
    userByEmail: (email) => one('SELECT * FROM users WHERE lower(email)=lower($1)', [email]),
    userByPhone: (phone) => one('SELECT * FROM users WHERE phone=$1', [phone]),
    userById: (id) => one('SELECT * FROM users WHERE id=$1', [id]),
    setPassword: (id, hash) => pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [id, hash]),
    createSession: (tokenHash, userId, ttlSec) => pool.query(
      `INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+($3||' seconds')::interval)`,
      [tokenHash, userId, String(ttlSec)]),
    userBySession: (tokenHash) => one(
      `SELECT u.id,u.email,u.phone,u.name,u.lang,u.status,u.is_owner FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now()`, [tokenHash]),
    deleteSession: (tokenHash) => pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]),
    setLang: (id, lang) => pool.query('UPDATE users SET lang=$2 WHERE id=$1', [id, lang]),
    recentFailures: async (key, windowSec) => Number((await one(
      `SELECT count(*) c FROM login_attempts WHERE key=$1 AND at>now()-($2||' seconds')::interval`,
      [key, String(windowSec)])).c),
    addFailure: (key) => pool.query('INSERT INTO login_attempts (key) VALUES ($1)', [key]),
    clearFailures: (key) => pool.query('DELETE FROM login_attempts WHERE key=$1', [key]),
    addReceipt: (userId, file, mime) => one('INSERT INTO receipts (user_id,file,mime) VALUES ($1,$2,$3) RETURNING id', [userId, file, mime]),
    receiptCount: async (userId) => Number((await one('SELECT count(*) c FROM receipts WHERE user_id=$1', [userId])).c),
    receiptById: (id) => one('SELECT * FROM receipts WHERE id=$1', [id]),
    pendingReceipts: async () => (await pool.query(
      `SELECT r.id,r.created_at,u.id AS user_id,u.name,u.email,u.phone FROM receipts r JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.created_at`)).rows,
    setReceiptStatus: (id, st) => pool.query('UPDATE receipts SET status=$2 WHERE id=$1', [id, st]),
    setUserStatus: (id, st) => pool.query('UPDATE users SET status=$2 WHERE id=$1', [id, st]),
    setOwner: (id, v) => pool.query('UPDATE users SET is_owner=$2 WHERE id=$1', [id, !!v]),
    saveProfile: (uid, p) => pool.query(
      `INSERT INTO profiles (user_id,business_name,about,services,hours,tone,channels,extra) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET business_name=EXCLUDED.business_name, about=EXCLUDED.about, services=EXCLUDED.services,
       hours=EXCLUDED.hours, tone=EXCLUDED.tone, channels=EXCLUDED.channels, extra=EXCLUDED.extra, updated_at=now()`,
      [uid, p.business_name, p.about, p.services, p.hours, p.tone, p.channels, p.extra]),
    profileByUser: (uid) => one('SELECT * FROM profiles WHERE user_id=$1', [uid]),
    clientById: (id) => one('SELECT id,name,email,phone,status FROM users WHERE id=$1 AND NOT is_owner', [id]),
    clients: async () => (await pool.query(
      `SELECT u.id,u.name,u.email,u.phone,u.status,u.created_at FROM users u WHERE NOT u.is_owner ORDER BY u.created_at DESC LIMIT 500`)).rows,
    cleanup: () => pool.query(`DELETE FROM sessions WHERE expires_at<now(); DELETE FROM login_attempts WHERE at<now()-interval '1 day'`),
  };
}

// In-memory adapter (только для тестов)
function memoryDb() {
  const users = []; const sessions = new Map(); const fails = new Map(); const receipts = []; const profiles = new Map();
  const pub = (row) => { const { password_hash, ...p } = row; return p; };
  return {
    async createUser(u) {
      if ((u.email && users.some((x) => x.email && x.email.toLowerCase() === u.email.toLowerCase())) || (u.phone && users.some((x) => x.phone === u.phone))) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { id: users.length + 1, email: u.email || null, phone: u.phone || null, name: u.name, password_hash: u.passwordHash || null, lang: u.lang, status: 'awaiting_payment', is_owner: !!u.isOwner };
      users.push(row); return pub(row);
    },
    async userByEmail(e) { return users.find((x) => x.email && x.email.toLowerCase() === e.toLowerCase()) || null; },
    async userByPhone(p) { return users.find((x) => x.phone === p) || null; },
    async userById(id) { return users.find((x) => x.id === Number(id)) || null; },
    async setPassword(id, hash) { users.find((x) => x.id === Number(id)).password_hash = hash; },
    async createSession(h, id, ttl) { sessions.set(h, { id, exp: Date.now() + ttl * 1000 }); },
    async userBySession(h) {
      const s = sessions.get(h); if (!s || s.exp < Date.now()) return null;
      return pub(users.find((x) => x.id === s.id));
    },
    async deleteSession(h) { sessions.delete(h); },
    async setLang(id, lang) { users.find((x) => x.id === id).lang = lang; },
    async recentFailures(k, w) { return (fails.get(k) || []).filter((t) => t > Date.now() - w * 1000).length; },
    async addFailure(k) { fails.set(k, [...(fails.get(k) || []), Date.now()]); },
    async clearFailures(k) { fails.delete(k); },
    async addReceipt(userId, file, mime) { const r = { id: receipts.length + 1, user_id: userId, file, mime, status: 'pending', created_at: new Date() }; receipts.push(r); return { id: r.id }; },
    async receiptCount(userId) { return receipts.filter((r) => r.user_id === userId).length; },
    async receiptById(id) { return receipts.find((r) => r.id === Number(id)) || null; },
    async pendingReceipts() { return receipts.filter((r) => r.status === 'pending').map((r) => { const u = users.find((x) => x.id === r.user_id); return { id: r.id, created_at: r.created_at, user_id: u.id, name: u.name, email: u.email, phone: u.phone }; }); },
    async setReceiptStatus(id, st) { const r = receipts.find((x) => x.id === Number(id)); if (r) r.status = st; },
    async setUserStatus(id, st) { users.find((x) => x.id === Number(id)).status = st; },
    async setOwner(id, v) { users.find((x) => x.id === Number(id)).is_owner = !!v; },
    async saveProfile(uid, p) { profiles.set(Number(uid), { user_id: Number(uid), ...p }); },
    async profileByUser(uid) { return profiles.get(Number(uid)) || null; },
    async clientById(id) { const u = users.find((x) => x.id === Number(id) && !x.is_owner); return u ? { id: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status } : null; },
    async clients() { return users.filter((u) => !u.is_owner).map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status, created_at: new Date() })).reverse(); },
    async cleanup() {},
  };
}

export const openDb = () => (process.env.DB === 'memory' ? memoryDb() : pgDb());
