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

    // GET /status — 서비스 상태 공지 페이지 (공개)
    if (path === '/status' && request.method === 'GET') {
      return handleStatus(env);
    }

    // POST /api/notify — 관리자 공지 등록
    if (path === '/api/notify' && request.method === 'POST') {
      return handleNotify(request, env);
    }

    // GET /api/selectors — 공개 (인증 불필요)
    if (path === '/api/selectors' && request.method === 'GET') {
      return handleGetSelectors(env);
    }

    // POST /api/selectors — 관리자 전용 (X-API-Secret 인증)
    if (path === '/api/selectors' && request.method === 'POST') {
      return handleUpdateSelectors(request, env);
    }

    // POST /api/report — 공개 (인증 불필요)
    if (path === '/api/report' && request.method === 'POST') {
      return handleReport(request, env);
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


// ── 셀렉터 복원력 핸들러 ──────────────────────────────────

// 기본 셀렉터 (DB에 저장된 값이 없을 때 사용)
function defaultSelectors() {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    platforms: {
      genspark:  { turnSelector: '.conversation-item-desc' },
      chatgpt:   { turnSelector: '[data-message-author-role]' },
      claude:    { turnSelector: null },
      grok:      { userSelector: '[data-testid="user-message"]',
                   assistantSelector: '.response-content-markdown' },
      metaai:    { userSelector: '[data-message-type="user"]',
                   assistantSelector: '.ur-markdown' },
      gemini:    { userSelector: 'user-query',
                   assistantSelector: 'model-response' },
      deepseek:  { turnSelector: '[class*="ds-message"]',
                   roleKey: 'ds-assistant-message-main' }
    }
  };
}

async function handleGetSelectors(env) {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM ck_config WHERE key = 'selectors'"
    ).first();
    const data = row ? JSON.parse(row.value) : defaultSelectors();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json',
                 'Cache-Control': 'no-store', ...CORS }
    });
  } catch (e) {
    // DB에 ck_config 테이블이 없는 경우 기본값 반환
    return new Response(JSON.stringify(defaultSelectors()), {
      headers: { 'Content-Type': 'application/json',
                 'Cache-Control': 'no-store', ...CORS }
    });
  }
}

async function handleUpdateSelectors(request, env) {
  const secret = request.headers.get('X-API-Secret');
  if (!secret || secret !== env.API_SECRET) {
    return err('Unauthorized', 401);
  }
  try {
    const body = await request.json();
    const row = await env.DB.prepare(
      "SELECT value FROM ck_config WHERE key = 'selectors'"
    ).first().catch(() => null);
    const current = row ? JSON.parse(row.value) : { version: 0 };
    body.version = (current.version || 0) + 1;
    body.updated_at = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO ck_config (key, value) VALUES ('selectors', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(JSON.stringify(body)).run();
    return ok({ version: body.version, updated_at: body.updated_at });
  } catch (e) { return err(e.message); }
}

async function handleReport(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare(
      "INSERT INTO ck_reports (platform, page_url, selector, reported_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(
      body.platform || 'unknown',
      body.url || '',
      body.selector || ''
    ).run();

    // 최근 1시간 내 동일 플랫폼 신고 수 집계
    const count = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM ck_reports WHERE platform = ? AND reported_at >= datetime('now', '-1 hour')"
    ).bind(body.platform || 'unknown').first();

    const cnt = count ? count.cnt : 0;
    // 1건째, 5건째, 10건째마다 Telegram 알림
    if (cnt === 1 || cnt === 5 || cnt === 10 || cnt % 20 === 0) {
      await sendTelegram(env,
        `🚨 <b>[AIKeep24] 셀렉터 신고</b>\n` +
        `플랫폼: <b>${body.platform || 'unknown'}</b>\n` +
        `1시간 내 신고: ${cnt}건\n` +
        `셀렉터: ${body.selector || '없음'}\n` +
        `URL: ${(body.url || '').slice(0, 80)}`
      );
    }
    return ok({ received: true });
  } catch (e) {
    return ok({ received: true });
  }
}


// ── Telegram 알림 ─────────────────────────────────────────

async function sendTelegram(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  }).catch(() => {});
}

// ── /status 공지 페이지 ───────────────────────────────────

async function handleStatus(env) {
  let incidents = [];
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM ck_config WHERE key = 'incidents'"
    ).first();
    if (row) incidents = JSON.parse(row.value);
  } catch(e) {}

  const incidentHtml = incidents.length === 0
    ? '<div class="ok">✅ 모든 플랫폼 정상 작동 중</div>'
    : incidents.map(i =>
        `<div class="incident">
          <span class="badge ${i.level}">${i.level === 'error' ? '🔴 장애' : '⚠️ 주의'}</span>
          <b>${i.platform}</b> — ${i.message}
          <span class="time">${i.reported_at ? i.reported_at.slice(0,16).replace('T',' ') : ''}</span>
        </div>`
      ).join('')
  ;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIKeep24-Lite 서비스 상태</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 60px auto;
         padding: 0 20px; background: #f8fafc; color: #1e293b; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #64748b; font-size: 13px; margin-bottom: 32px; }
  .ok { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
        padding: 16px; color: #166534; font-weight: 600; }
  .incident { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
              padding: 14px 16px; margin-bottom: 10px; font-size: 14px; line-height: 1.6; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px;
           font-size: 11px; font-weight: 700; margin-right: 8px; }
  .badge.error { background: #fef2f2; color: #dc2626; }
  .badge.warn  { background: #fffbeb; color: #d97706; }
  .time { float: right; font-size: 11px; color: #94a3b8; }
  .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
</style>
</head>
<body>
<h1>🛡 AIKeep24-Lite 서비스 상태</h1>
<div class="sub">업데이트: ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC</div>
${incidentHtml}
<div class="footer">
  셀렉터 이상 감지 시 자동으로 이 페이지가 업데이트됩니다.<br>
  문의: <a href="mailto:support@aikeep24.com">support@aikeep24.com</a>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' }
  });
}

// ── POST /api/notify (관리자 공지 등록) ──────────────────

async function handleNotify(request, env) {
  const secret = request.headers.get('X-API-Secret');
  if (!secret || secret !== env.API_SECRET) return err('Unauthorized', 401);
  try {
    const body = await request.json();
    // incidents 저장
    const row = await env.DB.prepare(
      "SELECT value FROM ck_config WHERE key = 'incidents'"
    ).first().catch(() => null);
    const current = row ? JSON.parse(row.value) : [];
    const incident = {
      platform: body.platform || 'all',
      message:  body.message || '',
      level:    body.level || 'warn',
      reported_at: new Date().toISOString()
    };
    current.unshift(incident);
    await env.DB.prepare(
      "INSERT INTO ck_config (key, value) VALUES ('incidents', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(JSON.stringify(current.slice(0, 20))).run();

    // Telegram 알림
    await sendTelegram(env,
      `📢 <b>[AIKeep24] 공지 등록</b>
플랫폼: ${incident.platform}
수준: ${incident.level}
내용: ${incident.message}`
    );
    return ok({ posted: true });
  } catch(e) { return err(e.message); }
}
