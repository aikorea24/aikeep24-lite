/**
 * AIKeep24-Lite Worker v0.2.0
 * Routes:
 *   POST /api/chunk/save       청크 저장 (upsert)
 *   GET  /api/search?q=        FTS5 키워드 검색
 *   GET  /api/sessions         세션 목록
 *   GET  /api/session/:id      세션 상세 + 청크
 *   POST /api/user/register    API Key 발급
 *   GET  /api/health           상태 확인
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function ok(data) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

function err(msg, status) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: status || 400,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

async function auth(request, env) {
  const key = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!key) return null;
  return await env.DB.prepare(
    'SELECT user_id, plan FROM ext_users WHERE api_key = ?'
  ).bind(key).first();
}

function uuid() {
  return crypto.randomUUID();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // ── 공개 엔드포인트 ──────────────────────────
    if (path === '/api/health') {
      return ok({ version: '0.2.0', ts: new Date().toISOString() });
    }

    if (path === '/api/user/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }

    // ── 인증 필요 엔드포인트 ─────────────────────
    const user = await auth(request, env);
    if (!user) return err('Unauthorized', 401);

    // POST /api/chunk/save
    if (path === '/api/chunk/save' && request.method === 'POST') {
      return handleSaveChunk(request, env, user);
    }

    // GET /api/search
    if (path === '/api/search' && request.method === 'GET') {
      return handleSearch(url, env, user);
    }

    // GET /api/sessions
    if (path === '/api/sessions' && request.method === 'GET') {
      return handleListSessions(url, env, user);
    }

    // GET /api/session/:id
    const sessionMatch = path.match(/^\/api\/session\/(.+)$/);
    if (sessionMatch && request.method === 'GET') {
      return handleGetSession(sessionMatch[1], env, user);
    }

    return err('Not Found', 404);
  }
};

// ── 핸들러 ────────────────────────────────────────

async function handleRegister(request, env) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return err('유효한 이메일 필요');

    // 기존 사용자 확인
    const existing = await env.DB.prepare(
      'SELECT user_id, api_key FROM ext_users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return ok({ user_id: existing.user_id, api_key: existing.api_key, created: false });
    }

    const userId = uuid();
    const apiKey = 'ck_' + uuid().replace(/-/g, '');
    await env.DB.prepare(
      'INSERT INTO ext_users (user_id, email, plan, api_key) VALUES (?, ?, ?, ?)'
    ).bind(userId, email, 'free', apiKey).run();

    return ok({ user_id: userId, api_key: apiKey, created: true });
  } catch (e) { return err(e.message); }
}

async function handleSaveChunk(request, env, user) {
  try {
    const body = await request.json();
    const {
      chunk_id, session_id, session_url, platform,
      raw_content, raw_ngrams, turn_start, turn_end, title
    } = body;

    if (!chunk_id || !session_id || !raw_content) {
      return err('chunk_id, session_id, raw_content 필수');
    }

    // 세션 upsert
    await env.DB.prepare(`
      INSERT INTO ext_sessions (session_id, user_id, platform, url, title, total_turns, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET
        total_turns = excluded.total_turns,
        updated_at  = excluded.updated_at,
        title       = CASE WHEN excluded.title != '' THEN excluded.title ELSE title END
    `).bind(
      session_id, user.user_id, platform || '',
      session_url || '', title || '', turn_end || 0
    ).run();

    // 청크 upsert
    await env.DB.prepare(`
      INSERT INTO ext_chunks
        (chunk_id, session_id, user_id, platform, raw_content, raw_ngrams,
         turn_start, turn_end, session_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(chunk_id) DO UPDATE SET
        raw_content = CASE
          WHEN length(excluded.raw_content) > length(ext_chunks.raw_content)
          THEN excluded.raw_content ELSE ext_chunks.raw_content END,
        raw_ngrams  = excluded.raw_ngrams,
        turn_end    = excluded.turn_end
    `).bind(
      chunk_id, session_id, user.user_id, platform || '',
      raw_content, raw_ngrams || '',
      turn_start || 0, turn_end || 0, session_url || ''
    ).run();

    return ok({ chunk_id, session_id });
  } catch (e) { return err(e.message); }
}

async function handleSearch(url, env, user) {
  try {
    const q = (url.searchParams.get('q') || '').trim();
    const platform = url.searchParams.get('platform') || '';
    const dateFrom = url.searchParams.get('from') || '';
    const dateTo   = url.searchParams.get('to') || '';
    const limit    = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    if (!q || q.length < 2) return err('검색어 2자 이상 필요');

    // FTS5 검색 — raw_ngrams 우선, raw_content 보조
    let ftsQuery = q;
    // 쌍따옴표 이스케이프
    ftsQuery = ftsQuery.replace(/"/g, '""');

    let sql = `
      SELECT
        c.chunk_id, c.session_id, c.session_url, c.platform,
        c.turn_start, c.turn_end, c.created_at,
        snippet(chunks_fts, 0, '<mark>', '</mark>', '...', 20) AS snippet
      FROM chunks_fts
      JOIN ext_chunks c ON chunks_fts.rowid = c.rowid
      WHERE chunks_fts MATCH ? AND c.user_id = ?
    `;
    const binds = [ftsQuery, user.user_id];

    if (platform) { sql += ' AND c.platform = ?'; binds.push(platform); }
    if (dateFrom)  { sql += ' AND c.created_at >= ?'; binds.push(dateFrom); }
    if (dateTo)    { sql += ' AND c.created_at <= ?'; binds.push(dateTo + ' 23:59:59'); }

    sql += ' ORDER BY rank LIMIT ?';
    binds.push(limit);

    const results = await env.DB.prepare(sql).bind(...binds).all();
    return ok({ results: results.results || [], total: (results.results || []).length, q });
  } catch (e) { return err(e.message); }
}

async function handleListSessions(url, env, user) {
  try {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
    const platform = url.searchParams.get('platform') || '';

    let sql = `
      SELECT session_id, platform, url, title, total_turns, created_at, updated_at
      FROM ext_sessions
      WHERE user_id = ?
    `;
    const binds = [user.user_id];
    if (platform) { sql += ' AND platform = ?'; binds.push(platform); }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    binds.push(limit);

    const results = await env.DB.prepare(sql).bind(...binds).all();
    return ok({ sessions: results.results || [] });
  } catch (e) { return err(e.message); }
}

async function handleGetSession(sessionId, env, user) {
  try {
    const session = await env.DB.prepare(
      'SELECT * FROM ext_sessions WHERE session_id = ? AND user_id = ?'
    ).bind(sessionId, user.user_id).first();
    if (!session) return err('Not Found', 404);

    const chunks = await env.DB.prepare(
      'SELECT chunk_id, turn_start, turn_end, raw_content, created_at FROM ext_chunks WHERE session_id = ? ORDER BY turn_start'
    ).bind(sessionId).all();

    return ok({ session, chunks: chunks.results || [] });
  } catch (e) { return err(e.message); }
}
