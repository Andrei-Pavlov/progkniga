/**
 * StoryWeaver Auth Service
 * - Desktop + website Telegram: Mini App + Tribute
 * - Website: email/password registration, login, subscription (independent)
 *
 * Env: TRIBUTE_API_KEY, TELEGRAM_BOT_TOKEN, AUTH_BASE_URL, WEB_JWT_SECRET, DATA_DIR
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const { isValid, parse } = require('@tma.js/init-data-node');
const { createWebAuth } = require('./webAuth.cjs');
const { sendVerificationEmail, isMailConfigured } = require('./mail.cjs');

const PORT = Number(process.env.PORT) || 3847;
const TRIBUTE_API = (process.env.TRIBUTE_API_URL || 'https://tribute.tg/api/v1').replace(/\/$/, '');
const TRIBUTE_API_KEY = process.env.TRIBUTE_API_KEY || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const AUTH_BASE_URL = (process.env.AUTH_BASE_URL || '').replace(/\/$/, '');
const TELEGRAM_CHANNEL = (process.env.TELEGRAM_CHANNEL || 'WeaverStory').replace(/^@?/, '@');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const WEB_JWT_SECRET = process.env.WEB_JWT_SECRET || '';
const WEB_TRIAL_DAYS = Number(process.env.WEB_TRIAL_DAYS ?? 7);
const PAYMENT_URL = (process.env.PAYMENT_URL || '').trim();

const webAuth = createWebAuth({
  dataDir: DATA_DIR,
  jwtSecret: WEB_JWT_SECRET || undefined,
  trialDays: Number.isFinite(WEB_TRIAL_DAYS) ? WEB_TRIAL_DAYS : 7,
});
if (!WEB_JWT_SECRET) {
  console.warn('[WebAuth] WEB_JWT_SECRET not set — using ephemeral secret (tokens reset on restart)');
}
/** Официальные имена webhook-событий Tribute (OpenAPI webhooks) */
const TRIBUTE_EVENTS = {
  NEW: 'new_subscription',
  RENEWED: 'renewed_subscription',
  CANCELLED: 'cancelled_subscription',
};

let subscriptions = new Map();
const sessions = new Map(); // sessionId -> { telegramId, done, expiresAt, token, subscription }
const sessionChatMap = new Map(); // sessionId -> chatId
const SITE_DIR = process.env.SITE_DIR || path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function loadSubscriptions() {
  try {
    const data = fs.readFileSync(SUBS_FILE, 'utf8');
    const obj = JSON.parse(data);
    subscriptions = new Map(Object.entries(obj));
  } catch (_) {}
}

function saveSubscriptions() {
  try {
    const dir = path.dirname(SUBS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUBS_FILE, JSON.stringify(Object.fromEntries(subscriptions), null, 2));
  } catch (e) {
    console.error('[Auth] save:', e.message);
  }
}

loadSubscriptions();

/**
 * Доступ активен, пока не истёк expiresAt.
 * При cancelled_subscription Tribute оставляет expires_at — доступ до этой даты.
 */
function isSubscriptionValid(sub) {
  if (!sub) return false;
  if (sub.expiresAt) {
    const exp = new Date(sub.expiresAt).getTime();
    if (!Number.isNaN(exp) && exp <= Date.now()) return false;
  }
  if (sub.status === 'cancelled' && !sub.expiresAt) return false;
  return sub.active !== false;
}

function publicTgSubscription(sub) {
  return {
    active: isSubscriptionValid(sub),
    expiresAt: sub?.expiresAt ?? null,
    status: sub?.status ?? null,
    type: sub?.type ?? null,
    plan: sub?.type || (isSubscriptionValid(sub) ? 'tribute' : null),
  };
}

async function resolveTelegramSubscription(telegramId) {
  const id = String(telegramId);
  let sub = subscriptions.get(id);
  if (isSubscriptionValid(sub)) return sub;
  const fromApi = await checkTributeSubscriber(id);
  if (fromApi) return upsertSubscription(id, fromApi);
  const inChannel = await checkChannelMembership(id);
  if (inChannel) {
    return upsertSubscription(id, {
      active: true,
      expiresAt: null,
      status: 'active',
      source: 'channel',
      type: 'tribute',
    });
  }
  return sub || null;
}

function getBearerToken(req, url) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (url.searchParams.get('token') || '').trim();
}

function isAdminAuthorized(req, url) {
  const token = getBearerToken(req, url);
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  const remote = forwarded || req.socket?.remoteAddress || '';
  const isLocal = /^(127\.|::1|::ffff:127\.|localhost)/i.test(remote) || remote === '';
  const hasToken = Boolean(ADMIN_TOKEN) && token === ADMIN_TOKEN;
  return { ok: isLocal || hasToken, isLocal, hasToken };
}

function telegramStats() {
  let active = 0;
  let expired = 0;
  let cancelled = 0;
  const bySource = {};
  const recent = [];
  for (const [telegramId, sub] of subscriptions.entries()) {
    const valid = isSubscriptionValid(sub);
    if (valid) active += 1;
    else expired += 1;
    if (sub?.status === 'cancelled') cancelled += 1;
    const src = sub?.source || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
    recent.push({
      telegramId,
      active: valid,
      status: sub?.status ?? null,
      expiresAt: sub?.expiresAt ?? null,
      type: sub?.type ?? null,
      source: src,
      telegramUsername: sub?.telegramUsername ?? null,
      email: sub?.email ?? null,
      updatedAt: sub?.updatedAt ?? null,
    });
  }
  recent.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return {
    total: subscriptions.size,
    active,
    expired,
    cancelled,
    bySource,
    recent: recent.slice(0, 50),
    channel: TELEGRAM_CHANNEL,
  };
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function tryServeStatic(req, res, urlPath) {
  if (!fs.existsSync(SITE_DIR)) return false;
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const candidate = path.normalize(path.join(SITE_DIR, rel));
  if (!candidate.startsWith(path.normalize(SITE_DIR))) return false;

  let filePath = candidate;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const spaRoutes = ['/download', '/login', '/register', '/account', '/subscribe', '/admin'];
    if (spaRoutes.some((r) => rel === r || rel.startsWith(r + '/'))) {
      filePath = path.join(SITE_DIR, 'index.html');
    } else if (!fs.existsSync(filePath)) {
      return false;
    } else {
      filePath = path.join(filePath, 'index.html');
    }
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
  return true;
}

/** Telegram ID из payload webhook (официально: telegram_user_id) */
function getTelegramId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const direct =
    payload.telegram_user_id ??
    payload.telegramUserId ??
    payload.telegram_id ??
    payload.telegramID;
  if (direct != null && direct !== '') return String(direct);

  const u = payload.user ?? payload.subscriber ?? payload.data?.user ?? payload.data?.subscriber;
  if (u && typeof u === 'object') {
    const id = u.telegram_user_id ?? u.telegramUserId ?? u.telegram_id ?? u.id;
    if (id != null && id !== '') return String(id);
  }
  if (payload.subscription && typeof payload.subscription === 'object') {
    const id =
      payload.subscription.telegram_user_id ??
      payload.subscription.telegramUserId ??
      payload.subscription.telegram_id;
    if (id != null && id !== '') return String(id);
  }
  return null;
}

function extractExpiresAt(payload, raw) {
  return (
    payload?.expires_at ??
    payload?.expiresAt ??
    payload?.expireAt ??
    payload?.expire_at ??
    raw?.expires_at ??
    raw?.expiresAt ??
    null
  );
}

function upsertSubscription(tgId, patch) {
  const prev = subscriptions.get(tgId) || {};
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  subscriptions.set(tgId, next);
  saveSubscriptions();
  return next;
}

async function tributeFetch(pathname, query) {
  if (!TRIBUTE_API_KEY) return null;
  const url = new URL(TRIBUTE_API + pathname);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const r = await fetch(url, {
    headers: { 'Api-Key': TRIBUTE_API_KEY, Accept: 'application/json' },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    console.log('[Tribute API]', pathname, r.status, text.slice(0, 200));
    return null;
  }
  return r.json().catch(() => null);
}

/** GET /subscribers — сверка статуса у Tribute (fallback, если webhook не дошёл) */
async function checkTributeSubscriber(telegramId) {
  const list = await tributeFetch('/subscribers');
  if (!Array.isArray(list)) return null;
  const found = list.find(
    (s) => String(s.telegramUserId ?? s.telegram_user_id) === String(telegramId)
  );
  if (!found) return null;
  const status = (found.status || '').toLowerCase();
  const expiresAt = found.expireAt ?? found.expiresAt ?? found.expires_at ?? null;
  const sub = {
    active: status === 'active' || status === 'pre_cancelled',
    status,
    expiresAt,
    subscriptionId: found.subscriptionId ?? found.subscription_id ?? null,
    trbUserId: found.trbUserId ?? found.trb_user_id ?? null,
    source: 'tribute_api',
  };
  // cancelled, но срок ещё не вышел — доступ остаётся
  if (status === 'cancelled' && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
    sub.active = true;
  }
  if (!isSubscriptionValid(sub)) return null;
  return sub;
}

/** GET /subscriptions — каталог продуктов (для сайта / отладки) */
async function fetchTributeSubscriptionsCatalog() {
  const data = await tributeFetch('/subscriptions');
  if (!data) return null;
  return Array.isArray(data.result) ? data.result : Array.isArray(data) ? data : null;
}

// Проверка initData через @tma.js/init-data-node
function verifyInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    if (!isValid(initData, BOT_TOKEN, { expiresIn: 0 })) return null;
    const data = parse(initData);
    const userId = data?.user?.id;
    return userId ? String(userId) : null;
  } catch (e) {
    console.log('[Auth] initData error:', e.message);
    return null;
  }
}

async function sendTelegramMessage(chatId, text, replyMarkup) {
  if (!BOT_TOKEN) return null;
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

function formatSubscriptionStatus(sub) {
  if (!isSubscriptionValid(sub)) {
    const channel = TELEGRAM_CHANNEL.replace('@', '');
    return `❌ <b>Подписка не активна</b>\n\nЕсли вы уже оплатили — подпишитесь на канал t.me/${channel} (это следующий шаг после оплаты). Затем попробуйте войти снова.`;
  }
  let msg = '✅ <b>Подписка активна</b>';
  if (sub.type && sub.type !== 'regular') {
    msg += `\nТип: ${sub.type}`;
  }
  if (sub.status === 'pre_cancelled' || sub.status === 'cancelled') {
    msg += '\n\n⚠️ Подписка отменена, доступ сохранится до конца оплаченного периода.';
  }
  if (sub.expiresAt) {
    const exp = new Date(sub.expiresAt);
    const dateStr = exp.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    msg += `\n\nСрок действия: до ${dateStr}`;
  } else {
    msg += '\n\nСрок действия: бессрочно';
  }
  return msg;
}

// Проверка подписки через Telegram API (бот должен быть админом канала)
async function checkChannelMembership(telegramId) {
  if (!BOT_TOKEN || !TELEGRAM_CHANNEL) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(TELEGRAM_CHANNEL)}&user_id=${telegramId}`);
    const d = await r.json();
    if (!d.ok) return false;
    const status = (d.result?.status || '').toLowerCase();
    return ['creator', 'administrator', 'member', 'restricted'].includes(status);
  } catch (e) {
    console.log('[Auth] getChatMember error:', e.message);
    return false;
  }
}

const MINI_APP_HTML = (sessionId, baseUrl) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
  <div id="msg" style="padding:20px;font-family:sans-serif;text-align:center;">Проверка...</div>
  <script>
    (function() {
      const sessionId = ${JSON.stringify(sessionId)};
      const baseUrl = ${JSON.stringify(baseUrl)};
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) {
        document.getElementById('msg').textContent = 'Откройте через Telegram';
        return;
      }
      tg.ready();
      fetch(baseUrl + '/auth/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, sessionId })
      })
      .then(r => r.json())
      .then(d => {
        const el = document.getElementById('msg');
        if (d.success) {
          el.textContent = 'Успешно! Вернитесь в приложение.';
          el.style.color = 'green';
          tg.close();
        } else {
          el.textContent = d.error || 'Нет активной подписки';
          el.style.color = 'red';
        }
      })
      .catch(e => {
        document.getElementById('msg').textContent = 'Ошибка: ' + e.message;
      });
    })();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const sendJson = (code, obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(code);
    res.end(JSON.stringify(obj));
  };

  if (url.pathname === '/api/health' || url.pathname === '/api') {
    sendJson(200, {
      service: 'StoryWeaver Auth',
      status: 'ok',
      tributeApi: TRIBUTE_API,
      tributeKeyConfigured: Boolean(TRIBUTE_API_KEY),
      site: fs.existsSync(path.join(SITE_DIR, 'index.html')),
      mailConfigured: isMailConfigured(),
    });
    return;
  }

  // Совместимость: старый JSON на / только если сайта нет
  if ((url.pathname === '/' || url.pathname === '') && !fs.existsSync(path.join(SITE_DIR, 'index.html'))) {
    sendJson(200, {
      service: 'StoryWeaver Auth',
      status: 'ok',
      tributeApi: TRIBUTE_API,
      tributeKeyConfigured: Boolean(TRIBUTE_API_KEY),
    });
    return;
  }

  // Проверка webhook бота
  if (url.pathname === '/bot/status' && req.method === 'GET') {
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const d = await r.json();
      res.writeHead(200);
      res.end(JSON.stringify({ webhook: d.result?.url || null, ok: d.ok }, null, 2));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Mini App — HTML страница
  if (url.pathname === '/auth/telegram/app' && req.method === 'GET') {
    const sessionId = url.searchParams.get('session');
    const base = AUTH_BASE_URL || `http://localhost:${PORT}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(MINI_APP_HTML(sessionId || '', base));
    return;
  }

  // Mini App отправляет initData — верифицируем и проверяем подписку
  if (url.pathname === '/auth/telegram/verify' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { initData, sessionId } = JSON.parse(body);
      const telegramId = verifyInitData(initData);
      if (!telegramId) {
        console.log('[Verify] telegramId not found (invalid initData)');
        const chatId = sessionId ? sessionChatMap.get(sessionId) : null;
        if (chatId) {
          sessionChatMap.delete(sessionId);
          sendTelegramMessage(chatId, '❌ <b>Неверные данные</b>\n\nОткройте Mini App через кнопку в боте.');
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: false, error: 'Неверные данные' }));
        return;
      }
      let sub = subscriptions.get(telegramId);
      if (!isSubscriptionValid(sub)) {
        // 1) Tribute REST /subscribers (если webhook не дошёл)
        const fromApi = await checkTributeSubscriber(telegramId);
        if (fromApi) {
          sub = upsertSubscription(telegramId, fromApi);
          console.log('[Verify] tgId:', telegramId, '→ OK (Tribute API /subscribers)');
        } else {
          // 2) Fallback: членство в канале
          const inChannel = await checkChannelMembership(telegramId);
          if (inChannel) {
            sub = upsertSubscription(telegramId, { active: true, expiresAt: null, status: 'active', source: 'channel' });
            console.log('[Verify] tgId:', telegramId, '→ OK (подтверждено через канал)');
          } else {
            console.log('[Verify] tgId:', telegramId, '→ Нет подписки (subscriptions:', subscriptions.size, 'записей)');
            const chatId = sessionId ? sessionChatMap.get(sessionId) : null;
            if (chatId) {
              sessionChatMap.delete(sessionId);
              sendTelegramMessage(chatId, formatSubscriptionStatus({ active: false }));
            }
            res.writeHead(200);
            res.end(JSON.stringify({ success: false, error: 'Оплатили подписку? Подпишитесь на канал (следующий шаг после оплаты) и попробуйте снова.' }));
            return;
          }
        }
      } else {
        console.log('[Verify] tgId:', telegramId, '→ OK, подписка активна');
      }
      if (sessionId) {
        sessions.set(sessionId, {
          telegramId,
          done: true,
          expiresAt: Date.now() + 60000,
          subscription: publicTgSubscription(sub),
          token: webAuth.signTelegramToken(telegramId),
        });
        const chatId = sessionChatMap.get(sessionId);
        if (chatId) {
          sessionChatMap.delete(sessionId);
          sendTelegramMessage(chatId, formatSubscriptionStatus(sub));
        }
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, error: 'Ошибка сервера' }));
    }
    return;
  }

  // --- Website email auth (independent from Telegram) ---
  if (url.pathname === '/auth/register' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = webAuth.register({
        email: body.email,
        password: body.password,
        passwordConfirm: body.passwordConfirm ?? body.password_confirm,
        name: body.name,
      });
      if (!result.ok) {
        sendJson(400, { success: false, error: result.error });
        return;
      }
      if (!isMailConfigured()) {
        console.warn('[Mail] Not configured — cannot send verification email');
        sendJson(503, {
          success: false,
          error:
            'Почтовый сервер не настроен. Укажите SMTP_* или RESEND_API_KEY на сервере.',
        });
        return;
      }
      const base = AUTH_BASE_URL || `${url.protocol}//${req.headers.host}`;
      const verifyUrl = `${base.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(result.verifyToken)}`;
      try {
        await sendVerificationEmail({
          email: result.email,
          verifyUrl,
          locale: body.locale || 'ru',
        });
      } catch (e) {
        console.error('[Mail] send failed:', e.message);
        sendJson(502, {
          success: false,
          error: 'Не удалось отправить письмо. Попробуйте позже или напишите в поддержку.',
        });
        return;
      }
      sendJson(200, {
        success: true,
        needVerification: true,
        email: result.email,
        message: 'Письмо с подтверждением отправлено на почту',
      });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  if (url.pathname === '/auth/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = webAuth.login({ email: body.email, password: body.password });
      if (!result.ok) {
        sendJson(401, {
          success: false,
          error: result.error,
          needVerification: !!result.needVerification,
          email: result.email || null,
        });
        return;
      }
      sendJson(200, { success: true, token: result.token, user: result.user });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  if (url.pathname === '/auth/verify-email' && req.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const result = webAuth.verifyEmail(token);
    const site = AUTH_BASE_URL || `${url.protocol}//${req.headers.host}`;
    if (!result.ok) {
      res.writeHead(302, {
        Location: `${site.replace(/\/$/, '')}/login?verify=fail&reason=${encodeURIComponent(result.error || 'error')}`,
      });
      res.end();
      return;
    }
    res.writeHead(302, {
      Location: `${site.replace(/\/$/, '')}/login?verify=ok`,
    });
    res.end();
    return;
  }

  if (url.pathname === '/auth/resend-verification' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (!isMailConfigured()) {
        sendJson(503, { success: false, error: 'Почтовый сервер не настроен' });
        return;
      }
      const created = webAuth.createVerificationToken(body.email);
      if (!created.ok) {
        sendJson(400, { success: false, error: created.error });
        return;
      }
      const base = AUTH_BASE_URL || `${url.protocol}//${req.headers.host}`;
      const verifyUrl = `${base.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(created.verifyToken)}`;
      await sendVerificationEmail({
        email: created.email,
        verifyUrl,
        locale: body.locale || 'ru',
      });
      sendJson(200, { success: true, message: 'Письмо отправлено снова' });
    } catch (e) {
      console.error('[Mail] resend failed:', e.message);
      sendJson(502, { success: false, error: 'Не удалось отправить письмо' });
    }
    return;
  }

  if (url.pathname === '/auth/me' && req.method === 'GET') {
    const token = getBearerToken(req, url);
    const payload = webAuth.verifyToken(token, { allowTelegram: true });
    if (!payload) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    if (payload.typ === 'telegram') {
      const sub = await resolveTelegramSubscription(payload.telegramId);
      const pub = publicTgSubscription(sub);
      sendJson(200, {
        success: true,
        user: webAuth.publicTelegramUser(payload.telegramId, pub),
      });
      return;
    }
    const result = webAuth.me(token);
    if (!result.ok) {
      sendJson(401, { success: false, error: result.error || 'Unauthorized' });
      return;
    }
    sendJson(200, { success: true, user: result.user });
    return;
  }

  if (url.pathname === '/billing/plans' && req.method === 'GET') {
    sendJson(200, { success: true, plans: webAuth.listPlans(), trialDays: WEB_TRIAL_DAYS });
    return;
  }

  if (url.pathname === '/billing/checkout' && req.method === 'POST') {
    const token = getBearerToken(req, url);
    const payload = webAuth.verifyToken(token, { allowTelegram: true });
    if (!payload) {
      sendJson(401, { success: false, error: 'Войдите в аккаунт' });
      return;
    }
    if (payload.typ === 'telegram') {
      sendJson(400, {
        success: false,
        error: 'Подписка Tribute управляется в Telegram. Продлите её через Tribute / канал WeaverStory.',
      });
      return;
    }
    const me = webAuth.me(token);
    if (!me.ok) {
      sendJson(401, { success: false, error: 'Войдите в аккаунт' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const fullUser = webAuth.getUserById(me.user.id);
      const created = webAuth.createOrder(fullUser, body.planId, {
        referralCode: body.referralCode || body.ref || null,
      });
      if (!created.ok) {
        sendJson(400, { success: false, error: created.error });
        return;
      }
      let payUrl = null;
      if (PAYMENT_URL) {
        payUrl = PAYMENT_URL
          .replace('{orderId}', created.order.id)
          .replace('{email}', encodeURIComponent(created.order.email))
          .replace('{amount}', String(created.order.amountUsd))
          .replace('{currency}', 'USD')
          .replace('{plan}', created.order.planId);
      }
      sendJson(200, {
        success: true,
        order: created.order,
        plan: created.plan,
        referral: created.referral,
        payUrl,
        message: payUrl
          ? 'Перейдите по ссылке для оплаты'
          : 'Заказ создан. После оплаты доступ активирует администратор (или укажите PAYMENT_URL).',
      });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  // Admin: activate web subscription
  if (url.pathname === '/billing/activate' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');
    const planId = url.searchParams.get('plan') || 'monthly';
    const orderId = url.searchParams.get('orderId');
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(403, { error: 'Only localhost or valid token' });
      return;
    }
    if (orderId) {
      const paid = webAuth.markOrderPaid(orderId);
      sendJson(paid.ok ? 200 : 400, paid.ok ? { success: true, user: paid.user, order: paid.order } : { success: false, error: paid.error });
      return;
    }
    if (!email) {
      sendJson(400, { success: false, error: 'Укажите email или orderId' });
      return;
    }
    const activated = webAuth.activateSubscription(email, planId, {
      days: url.searchParams.get('days') ? Number(url.searchParams.get('days')) : undefined,
    });
    sendJson(activated.ok ? 200 : 400, activated.ok ? { success: true, user: activated.user } : { success: false, error: activated.error });
    return;
  }

  // Admin dashboard stats (website + Telegram)
  if (url.pathname === '/admin/stats' && req.method === 'GET') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    const web = webAuth.getWebStats();
    sendJson(200, {
      success: true,
      generatedAt: new Date().toISOString(),
      website: web,
      telegram: telegramStats(),
      health: {
        tributeKeyConfigured: Boolean(TRIBUTE_API_KEY),
        mailConfigured: isMailConfigured(),
        adminTokenConfigured: Boolean(ADMIN_TOKEN),
      },
    });
    return;
  }

  if (url.pathname === '/admin/users' && req.method === 'GET') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
    sendJson(200, { success: true, users: webAuth.listUsersSafe().slice(0, limit) });
    return;
  }

  if (url.pathname === '/admin/orders' && req.method === 'GET') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
    sendJson(200, { success: true, orders: webAuth.listOrdersSafe().slice(0, limit) });
    return;
  }

  if (url.pathname === '/admin/grant' && req.method === 'POST') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const email = body.email;
      const planId = body.planId || body.plan || 'monthly';
      const days = body.days != null ? Number(body.days) : undefined;
      const extend = body.extend !== false;
      const activated = webAuth.activateSubscription(email, planId, { extend, days });
      if (!activated.ok) {
        sendJson(400, { success: false, error: activated.error });
        return;
      }
      sendJson(200, { success: true, user: activated.user });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  if (url.pathname === '/admin/referrals' && req.method === 'GET') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    sendJson(200, { success: true, referrals: webAuth.listReferrals() });
    return;
  }

  if (url.pathname === '/admin/referrals' && req.method === 'POST') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const created = webAuth.createReferral({
        code: body.code,
        discountPercent: body.discountPercent,
        maxUses: body.maxUses,
        note: body.note,
      });
      if (!created.ok) {
        sendJson(400, { success: false, error: created.error });
        return;
      }
      sendJson(200, { success: true, referral: created.referral });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  if (url.pathname === '/admin/referrals/toggle' && req.method === 'POST') {
    const authz = isAdminAuthorized(req, url);
    if (!authz.ok) {
      sendJson(401, { success: false, error: 'Unauthorized' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const updated = webAuth.setReferralActive(body.code, body.active !== false);
      if (!updated.ok) {
        sendJson(400, { success: false, error: updated.error });
        return;
      }
      sendJson(200, { success: true, referral: updated.referral });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  if (url.pathname === '/billing/referral/validate' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const plan = webAuth.PLANS[body.planId];
      if (!plan) {
        sendJson(400, { success: false, error: 'Неизвестный тариф' });
        return;
      }
      const ref = webAuth.getReferral(body.code);
      if (!ref || ref.active === false) {
        sendJson(400, { success: false, error: 'Код недействителен' });
        return;
      }
      if (ref.maxUses != null && Number(ref.uses) >= Number(ref.maxUses)) {
        sendJson(400, { success: false, error: 'Лимит использований исчерпан' });
        return;
      }
      const pct = Math.max(0, Math.min(100, Number(ref.discountPercent) || 0));
      const amountUsd = Math.round(plan.priceUsd * (1 - pct / 100) * 100) / 100;
      sendJson(200, {
        success: true,
        code: ref.code,
        discountPercent: pct,
        originalUsd: plan.priceUsd,
        amountUsd,
      });
    } catch (e) {
      sendJson(400, { success: false, error: 'Некорректный запрос' });
    }
    return;
  }

  // Список подписчиков Telegram — localhost или ?token=ADMIN_TOKEN
  if (url.pathname === '/auth/subscribers' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
    const remote = forwarded || req.socket?.remoteAddress || '';
    const isLocal = /^(127\.|::1|localhost)/.test(remote) || remote === '';
    const hasToken = ADMIN_TOKEN && token === ADMIN_TOKEN;
    if (!isLocal && !hasToken) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Only localhost or valid token' }));
      return;
    }
    const list = Object.fromEntries(subscriptions);
    res.writeHead(200);
    res.end(JSON.stringify({ count: subscriptions.size, subscribers: list }, null, 2));
    return;
  }

  // Ручное добавление — localhost ИЛИ ?token=ADMIN_TOKEN (для продакшена, когда webhook не сработал)
  if (url.pathname === '/auth/add' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    const telegramId = url.searchParams.get('telegram_id');
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
    const remote = forwarded || req.socket?.remoteAddress || '';
    const isLocal = /^(127\.|::1|localhost)/.test(remote) || remote === '';
    const hasToken = ADMIN_TOKEN && token === ADMIN_TOKEN;
    if (!isLocal && !hasToken) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Only localhost or valid token' }));
      return;
    }
    if (telegramId) {
      const id = String(telegramId).trim();
      upsertSubscription(id, { active: true, expiresAt: null, status: 'active', source: 'admin' });
      console.log('[Auth] Added subscriber:', id, hasToken ? '(via admin token)' : '(localhost)');
    }
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: telegramId ? 'Добавлено' : 'Укажите ?telegram_id=XXX' }));
    return;
  }

  // Ручное удаление подписчика — только localhost (для теста)
  if (url.pathname === '/auth/remove' && req.method === 'GET') {
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
    const remote = forwarded || req.socket?.remoteAddress || '';
    const isLocal = /^(127\.|::1|localhost)/.test(remote) || remote === '';
    if (!isLocal) {
      console.log('[Auth] /auth/remove rejected (not localhost):', remote);
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Only localhost' }));
      return;
    }
    const telegramId = url.searchParams.get('telegram_id');
    if (telegramId) {
      const id = String(telegramId).trim();
      subscriptions.delete(id);
      saveSubscriptions();
      console.log('[Auth] Removed subscriber:', id);
    }
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: telegramId ? 'Удалено' : 'Укажите ?telegram_id=XXX' }));
    return;
  }

  // Polling сессии (приложение + сайт)
  if (url.pathname.startsWith('/auth/session/')) {
    const sessionId = url.pathname.replace('/auth/session/', '');
    const s = sessions.get(sessionId);
    if (s?.done) {
      sessions.delete(sessionId);
      sendJson(200, {
        success: true,
        telegramId: s.telegramId || null,
        subscription: s.subscription || null,
        token: s.token || null,
      });
    } else {
      sendJson(200, { success: false });
    }
    return;
  }

  // Webhook бота Telegram (GET — для проверки, POST — от Telegram)
  if (url.pathname === '/bot/webhook') {
    if (req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ info: 'Telegram webhook, POST only' }));
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const update = JSON.parse(body);
      const msg = update.message;
      const text = (msg?.text || '').trim();
      const chatId = msg?.chat?.id;
      console.log('[Bot] Update:', text?.slice(0, 50), 'chatId:', chatId);
      const match = text.match(/^\/start\s+login_(.+)$/);
      if (match && chatId && AUTH_BASE_URL) {
        const sessionId = match[1].trim();
        sessionChatMap.set(sessionId, chatId);
        const appUrl = `${AUTH_BASE_URL}/auth/telegram/app?session=${encodeURIComponent(sessionId)}`;
        console.log('[Bot] Web App URL:', appUrl);
        const r = await sendTelegramMessage(chatId, 'Нажмите кнопку для входа в StoryWeaver:', {
          inline_keyboard: [[{ text: 'Войти в StoryWeaver', web_app: { url: appUrl } }]],
        });
        if (!r?.ok) console.log('[Bot] sendMessage failed:', r);
      } else if (text.startsWith('/start') && chatId) {
        const fromId = msg?.from?.id;
        const telegramId = fromId ? String(fromId) : (msg?.chat?.type === 'private' ? String(chatId) : null);
        if (telegramId) {
          const sub = subscriptions.get(telegramId);
          await sendTelegramMessage(chatId, formatSubscriptionStatus(sub ?? { active: false }));
        } else {
          await sendTelegramMessage(chatId, 'Для входа откройте приложение StoryWeaver и нажмите «Войти через Telegram».');
        }
      }
    } catch (e) {
      console.error('[Bot] Error:', e.message);
    }
    res.writeHead(200);
    res.end();
    return;
  }

  // Tribute webhook (OpenAPI: new_subscription | renewed_subscription | cancelled_subscription)
  if (url.pathname.startsWith('/webhook/tribute')) {
    if (req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const sig = req.headers['trbt-signature'];
      console.log('[Tribute] webhook received, sig:', !!sig, 'bodyLen:', body.length);

      // При наличии API-ключа подпись обязательна (HMAC-SHA256 тела)
      if (TRIBUTE_API_KEY) {
        if (!sig) {
          console.log('[Tribute] 401 Missing trbt-signature');
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Missing signature' }));
          return;
        }
        const expected = crypto.createHmac('sha256', TRIBUTE_API_KEY).update(body).digest('hex');
        if (sig !== expected) {
          console.log('[Tribute] 401 Invalid signature (check TRIBUTE_API_KEY)');
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
      }

      try {
        const raw = JSON.parse(body);
        if (raw.test_event === 'test_event') {
          console.log('[Tribute] test event OK — webhook настроен');
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        }

        // Конверт: { name, created_at, sent_at, payload }
        const payload = raw.payload || raw;
        const event = String(raw.name || payload.event || '').toLowerCase().trim();
        const tgId = getTelegramId(payload) || getTelegramId(raw);
        const expiresAt = extractExpiresAt(payload, raw);
        const subType = payload.type || null; // regular | gift | trial
        const trbUserId = payload.trb_user_id ?? payload.trbUserId ?? null;
        const subscriptionId = payload.subscription_id ?? payload.subscriptionId ?? null;
        const period = payload.period ?? null;
        const email = payload.email || null;

        console.log('[Tribute] event:', event, 'tgId:', tgId || '(not found)', 'type:', subType || '-');
        if (!tgId) {
          console.log('[Tribute] RAW (для отладки):', JSON.stringify(raw).slice(0, 800));
        }

        if (tgId) {
          if (event === TRIBUTE_EVENTS.NEW || event === TRIBUTE_EVENTS.RENEWED) {
            upsertSubscription(tgId, {
              active: true,
              status: 'active',
              expiresAt: expiresAt || null,
              type: subType,
              period,
              trbUserId,
              subscriptionId,
              email,
              telegramUsername: payload.telegram_username ?? payload.telegramUsername ?? null,
              source: 'webhook',
            });
            console.log('[Tribute] activated:', tgId, event);
          } else if (event === TRIBUTE_EVENTS.CANCELLED) {
            // Доступ сохраняется до expires_at (модель Tribute: pre_cancelled / оплаченный период)
            upsertSubscription(tgId, {
              active: true,
              status: 'cancelled',
              expiresAt: expiresAt || subscriptions.get(tgId)?.expiresAt || null,
              type: subType,
              period,
              trbUserId,
              subscriptionId,
              cancelReason: payload.cancel_reason ?? payload.cancelReason ?? null,
              source: 'webhook',
            });
            console.log('[Tribute] cancelled (access until expiresAt):', tgId, expiresAt || '(none)');
          } else {
            console.log('[Tribute] ignored event:', event);
          }
        }
      } catch (e) {
        console.error('[Tribute] parse error:', e.message);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok' }));
    }
    return;
  }

  // Отладка: каталог подписок Tribute GET /subscriptions
  if (url.pathname === '/auth/tribute/subscriptions' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
    const remote = forwarded || req.socket?.remoteAddress || '';
    const isLocal = /^(127\.|::1|localhost)/.test(remote) || remote === '';
    const hasToken = ADMIN_TOKEN && token === ADMIN_TOKEN;
    if (!isLocal && !hasToken) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Only localhost or valid token' }));
      return;
    }
    const catalog = await fetchTributeSubscriptionsCatalog();
    res.writeHead(catalog ? 200 : 502);
    res.end(JSON.stringify(catalog ? { result: catalog } : { error: 'Tribute API unavailable' }, null, 2));
    return;
  }

  // Статика сайта (SPA)
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (tryServeStatic(req, res, url.pathname)) return;
  }

  sendJson(404, { error: 'Not found' });
});

function shutdown() {
  console.log('[Auth] Shutting down...');
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`StoryWeaver Auth Service on port ${PORT}`);
  console.log('[Config] subscriptions:', SUBS_FILE, '(', subscriptions.size, 'записей)');
  console.log('[Config] AUTH_BASE_URL:', AUTH_BASE_URL || '(not set)');
  console.log('[Config] TRIBUTE_API:', TRIBUTE_API);
  console.log('[Config] TELEGRAM_CHANNEL:', TELEGRAM_CHANNEL, '(fallback проверка подписки)');
  if (BOT_TOKEN && AUTH_BASE_URL) {
    const webhookUrl = AUTH_BASE_URL + '/bot/webhook';
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const d = await r.json();
      if (d.ok) {
        console.log('[Bot] Webhook OK:', webhookUrl);
      } else {
        console.log('[Bot] setWebhook failed:', d.description);
      }
    } catch (e) {
      console.log('[Bot] setWebhook error:', e.message);
    }
  } else if (!BOT_TOKEN) {
    console.log('[Bot] TELEGRAM_BOT_TOKEN not set');
  } else {
    console.log('[Bot] AUTH_BASE_URL not set — укажите ngrok URL в .env');
  }
});
