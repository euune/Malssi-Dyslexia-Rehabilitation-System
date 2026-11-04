/*
 * 말씨 웹 서버
 * - HTML/JS/CSS 파일을 그대로 제공하고
 * - /api/... 로 들어오는 요청을 MySQL에 저장·조회합니다.
 *
 * 실행: npm install → .env 작성 → npm start → http://localhost:3000
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'malssi',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'malssi',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

const app = express();
app.use(express.json({ limit: '16kb' }));

// 프로젝트 폴더의 화면 파일 제공 (서버 설정 파일은 막기)
const BLOCKED = /^\/(\.env|\.git|node_modules|server\.js|package(-lock)?\.json|db\/)/i;
app.use((req, res, next) => (BLOCKED.test(req.path) ? res.sendStatus(404) : next()));
app.use(express.static(__dirname, { index: 'level1.html' }));

// ───────── 입력 검사 도우미 ─────────
const toInt = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const toText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: '서버 오류' });
});
async function userExists(id) {
  const [rows] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
  return rows.length > 0;
}

// 서버·DB 연결 확인
app.get('/api/health', wrap(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true });
}));

// 별명으로 학습자 찾기(없으면 새로 만들기)
app.post('/api/users', wrap(async (req, res) => {
  const nickname = toText(req.body.nickname, 30);
  if (!nickname) return res.status(400).json({ error: '별명을 입력해 주세요' });
  await db.query('INSERT IGNORE INTO users (nickname) VALUES (?)', [nickname]);
  const [rows] = await db.query('SELECT id, nickname FROM users WHERE nickname = ?', [nickname]);
  res.json(rows[0]);
}));

// 게임(활동) 목록 – DB의 activities 테이블에 있는 것만 받습니다
let activityCache = { at: 0, codes: new Set() };
async function isActivity(code) {
  if (typeof code !== 'string') return false;
  if (Date.now() - activityCache.at > 60000 || !activityCache.codes.has(code)) {
    const [rows] = await db.query('SELECT code FROM activities');
    activityCache = { at: Date.now(), codes: new Set(rows.map((r) => r.code)) };
  }
  return activityCache.codes.has(code);
}
// 게임마다 다른 추가 정보(JSON)는 객체만, 4KB까지 받습니다
function toJson(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return undefined;
  const s = JSON.stringify(v);
  return s.length <= 4000 ? s : undefined;
}
// MySQL은 JSON을 객체로, MariaDB는 문자열로 돌려줘서 맞춰 줍니다
const fromJson = (v) => {
  if (typeof v !== 'string') return v ?? null;
  try { return JSON.parse(v); } catch (e) { return null; }
};

app.get('/api/activities', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT code, name FROM activities ORDER BY sort_order, code');
  res.json(rows);
}));

// 진행 상황 불러오기
app.get('/api/users/:id/progress/:activity', wrap(async (req, res) => {
  const id = toInt(req.params.id, 1, 2147483647);
  if (!id || !(await isActivity(req.params.activity))) return res.status(400).json({ error: '잘못된 값' });
  const [rows] = await db.query('SELECT cleared, state, updated_at FROM progress WHERE user_id = ? AND activity = ?', [id, req.params.activity]);
  if (!rows.length) return res.json(null); // 아직 저장된 기록 없음
  res.json({ cleared: rows[0].cleared, state: fromJson(rows[0].state), updatedAt: rows[0].updated_at });
}));

// 진행 상황 저장 { cleared, state }
app.put('/api/users/:id/progress/:activity', wrap(async (req, res) => {
  const id = toInt(req.params.id, 1, 2147483647);
  const cleared = toInt(req.body.cleared, 0, 10000);
  const state = toJson(req.body.state);
  if (!id || cleared === null || state === undefined || !(await isActivity(req.params.activity))) {
    return res.status(400).json({ error: '잘못된 값' });
  }
  if (!(await userExists(id))) return res.status(404).json({ error: '없는 학습자' });
  await db.query(
    `INSERT INTO progress (user_id, activity, cleared, state) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cleared = VALUES(cleared), state = VALUES(state)`,
    [id, req.params.activity, cleared, state],
  );
  res.json({ ok: true });
}));

// 시도 기록 저장 { activity, stage, target, answer, score, outcome, retries, detail }
app.post('/api/users/:id/attempts', wrap(async (req, res) => {
  const id = toInt(req.params.id, 1, 2147483647);
  const b = req.body;
  const outcome = ['reached', 'not_yet', 'no_input'].includes(b.outcome) ? b.outcome : null;
  const target = toText(b.target, 255);
  const score = typeof b.score === 'number' && b.score >= 0 && b.score <= 1 ? Math.round(b.score * 1000) / 1000 : null;
  const detail = toJson(b.detail);
  if (!id || !outcome || !target || detail === undefined || !(await isActivity(b.activity))) {
    return res.status(400).json({ error: '잘못된 값' });
  }
  if (!(await userExists(id))) return res.status(404).json({ error: '없는 학습자' });
  await db.query(
    `INSERT INTO attempts (user_id, activity, stage, target_text, answer_text, score, outcome, retry_count, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, b.activity, toInt(b.stage, 0, 10000), target, toText(b.answer, 255), score, outcome, toInt(b.retries, 0, 1000) ?? 0, detail],
  );
  res.json({ ok: true });
}));

// 시도 기록 조회 (선생님·보호자 확인용) ?activity=writing_word&limit=100
app.get('/api/users/:id/attempts', wrap(async (req, res) => {
  const id = toInt(req.params.id, 1, 2147483647);
  if (!id) return res.status(400).json({ error: '잘못된 학습자 번호' });
  const limit = toInt(req.query.limit, 1, 500) || 100;
  const where = ['user_id = ?'];
  const args = [id];
  if (req.query.activity) {
    if (!(await isActivity(req.query.activity))) return res.status(400).json({ error: '없는 게임' });
    where.push('activity = ?');
    args.push(req.query.activity);
  }
  const [rows] = await db.query(
    `SELECT activity, stage, target_text, answer_text, score, outcome, retry_count, detail, created_at
     FROM attempts WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
    [...args, limit],
  );
  res.json(rows.map((r) => ({ ...r, score: r.score === null ? null : Number(r.score), detail: fromJson(r.detail) })));
}));

// 게임별 요약 (학습자 한 명) – 시도 수, 도달 수, 평균 점수
app.get('/api/users/:id/summary', wrap(async (req, res) => {
  const id = toInt(req.params.id, 1, 2147483647);
  if (!id) return res.status(400).json({ error: '잘못된 학습자 번호' });
  const [rows] = await db.query(
    `SELECT a.code AS activity, a.name,
            COUNT(t.id) AS attempts,
            COALESCE(SUM(t.outcome = 'reached'), 0) AS reached,
            ROUND(AVG(t.score), 3) AS avg_score,
            p.cleared, MAX(t.created_at) AS last_at
     FROM activities a
     LEFT JOIN attempts t ON t.activity = a.code AND t.user_id = ?
     LEFT JOIN progress p ON p.activity = a.code AND p.user_id = ?
     GROUP BY a.code, a.name, a.sort_order, p.cleared
     ORDER BY a.sort_order`,
    [id, id],
  );
  res.json(rows.map((r) => ({ ...r, attempts: Number(r.attempts), reached: Number(r.reached), avg_score: r.avg_score === null ? null : Number(r.avg_score) })));
}));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`말씨 서버 실행 중: http://localhost:${PORT}`));
