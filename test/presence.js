import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createTracker, createQueue } = createRequire(import.meta.url)('../presence.cjs');
const ok = (n) => console.log('ok -', n);
const S = 1000;

/* 1. сидит — событий нет */
{ const t = createTracker(); let n = 0; for (let i = 0; i < 100; i++) if (t.observe(true, i * 2500)) n++; assert.equal(n, 0); ok('на месте — событий нет'); }

/* 2. отошёл меньше 30 секунд — не считается */
{ const t = createTracker(); t.observe(true, 0); let ev = []; for (let s = 2.5; s <= 25; s += 2.5) ev.push(t.observe(false, s * S)); ev.push(t.observe(true, 27.5 * S)); assert.ok(ev.every((e) => e === null)); ok('короткий выход до 30 с игнорируется'); }

/* 3. отошёл на 5 минут — одно «вышел» и одно «вернулся» с длительностью от последнего момента в кадре */
{ const t = createTracker(); t.observe(true, 10 * S);
  const out = []; for (let s = 12.5; s <= 300; s += 2.5) { const e = t.observe(false, s * S); if (e) out.push(e); }
  assert.equal(out.length, 1); assert.equal(out[0].type, 'operator_away'); assert.equal(out[0].since, 10 * S);
  const back = t.observe(true, 310 * S); assert.equal(back.type, 'operator_returned'); assert.equal(back.seconds, 300); assert.equal(back.since, 10 * S);
  assert.equal(t.observe(true, 312.5 * S), null); ok('выход 5 минут: одно вышел, одно вернулся, 300 с'); }

/* 4. пауза (вкладка скрыта) не превращается в отсутствие */
{ const t = createTracker(); t.observe(true, 0); t.resume(3600 * S); assert.equal(t.observe(false, 3602.5 * S), null); ok('пауза вкладки не считается отсутствием'); }

/* 5. нет в кадре с самого начала */
{ const t = createTracker(); t.observe(false, 0); let first = null; for (let s = 2.5; s <= 40; s += 2.5) { const e = t.observe(false, s * S); if (e && !first) first = e; } assert.equal(first.type, 'operator_away'); ok('нет в кадре с начала — «вышел» через 30 с'); }

/* 6. очередь: порядок, повтор после сбоя, переживает перезагрузку, потолок */
{ const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const sent = []; let up = false;
  const q = createQueue(st, 'q', async (ev) => { if (!up) return false; sent.push(ev.id); return true; });
  q.push({ id: 'a' }); q.push({ id: 'b' }); q.push({ id: 'c' });
  await q.flush(); assert.equal(q.size(), 3); assert.deepEqual(sent, []);
  const q2 = createQueue(st, 'q', async (ev) => { sent.push(ev.id); return true; }); // «страницу перезагрузили»
  await q2.flush(); assert.deepEqual(sent, ['a', 'b', 'c']); assert.equal(q2.size(), 0); ok('очередь: порядок и переживает перезагрузку'); }
{ const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const q = createQueue(st, 'q', async () => true, 5); for (let i = 0; i < 9; i++) q.push({ id: 'e' + i }); assert.equal(q.size(), 5); ok('очередь не растёт сверх потолка'); }
{ const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const q = createQueue(st, 'q', async () => false); q.push({ id: 'x' }); for (let i = 0; i < 25; i++) await q.flush(); assert.equal(q.size(), 0); ok('событие, которое сервер не принимает, не блокирует очередь вечно'); }
console.log('presence: всё прошло');
