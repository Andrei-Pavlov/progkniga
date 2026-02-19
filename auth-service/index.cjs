/**
 * StoryWeaver Auth Service
 * - Канал t.me/WeaverStory, Tribute (@tribute)
 * - Бот для входа через Telegram Mini App (безопасная верификация)
 *
 * Env: TRIBUTE_API_KEY, TELEGRAM_BOT_TOKEN, AUTH_BASE_URL (публичный URL для Mini App)
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const { isValid, parse } = require('@tma.js/init-data-node');

const PORT = Number(process.env.PORT) || 3847;
const TRIBUTE_API = process.env.TRIBUTE_API_URL || 'https://tribute.tg/api/v1';
const TRIBUTE_API_KEY = process.env.TRIBUTE_API_KEY || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const AUTH_BASE_URL = (process.env.AUTH_BASE_URL || '').replace(/\/$/, '');
// Railway: примонтируйте Volume к /data, задайте DATA_DIR=/data — иначе subscriptions сбрасываются при каждом деплое
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

let subscriptions = new Map();
const sessions = new Map(); // sessionId -> { telegramId, done, expiresAt }

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

function getTelegramId(payload) {
  const u = payload.user;
  if (u && typeof u === 'object') {
    const id = u.telegram_id ?? u.telegram_user_id ?? u.id ?? u.user_id;
    if (id != null) return id;
  }
  return (
    payload.telegram_user_id ??
    payload.telegram_id ??
    payload.user_id ??
    payload.subscriber_id ??
    payload.telegram_user
  );
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
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '') {
    res.writeHead(200);
    res.end(JSON.stringify({ service: 'StoryWeaver Auth', status: 'ok' }));
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
        res.writeHead(200);
        res.end(JSON.stringify({ success: false, error: 'Неверные данные' }));
        return;
      }
      const sub = subscriptions.get(telegramId);
      if (!sub?.active) {
        console.log('[Verify] tgId:', telegramId, '→ Нет подписки (subscriptions:', subscriptions.size, 'записей)');
        res.writeHead(200);
        res.end(JSON.stringify({ success: false, error: 'Нет активной подписки на канал' }));
        return;
      }
      console.log('[Verify] tgId:', telegramId, '→ OK, подписка активна');
      if (sessionId) {
        sessions.set(sessionId, { telegramId, done: true, expiresAt: Date.now() + 60000 });
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, error: 'Ошибка сервера' }));
    }
    return;
  }

  // Ручное добавление подписчика (только localhost, для теста)
  if (url.pathname === '/auth/add' && req.method === 'GET') {
    const telegramId = url.searchParams.get('telegram_id');
    if (telegramId) {
      subscriptions.set(String(telegramId).trim(), { active: true, expiresAt: null });
      saveSubscriptions();
      console.log('[Auth] Added subscriber:', telegramId);
    }
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: telegramId ? 'Добавлено' : 'Укажите ?telegram_id=XXX' }));
    return;
  }

  // Ручное удаление подписчика (для теста webhook Tribute)
  if (url.pathname === '/auth/remove' && req.method === 'GET') {
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

  // Polling сессии (приложение)
  if (url.pathname.startsWith('/auth/session/')) {
    const sessionId = url.pathname.replace('/auth/session/', '');
    const s = sessions.get(sessionId);
    if (s?.done) {
      sessions.delete(sessionId);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false }));
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
        const appUrl = `${AUTH_BASE_URL}/auth/telegram/app?session=${encodeURIComponent(sessionId)}`;
        console.log('[Bot] Web App URL:', appUrl);
        const r = await sendTelegramMessage(chatId, 'Нажмите кнопку для входа в StoryWeaver:', {
          inline_keyboard: [[{ text: 'Войти в StoryWeaver', web_app: { url: appUrl } }]],
        });
        if (!r?.ok) console.log('[Bot] sendMessage failed:', r);
      } else if (text.startsWith('/start') && chatId) {
        await sendTelegramMessage(chatId, 'Для входа откройте приложение StoryWeaver и нажмите «Войти через Telegram».');
      }
    } catch (e) {
      console.error('[Bot] Error:', e.message);
    }
    res.writeHead(200);
    res.end();
    return;
  }

  // Tribute webhook
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
      if (TRIBUTE_API_KEY && sig) {
        const expected = crypto.createHmac('sha256', TRIBUTE_API_KEY).update(body).digest('hex');
        if (sig !== expected) {
          console.log('[Tribute] 401 Invalid signature (check TRIBUTE_API_KEY)');
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
      }
      try {
        const payload = JSON.parse(body);
        const event = payload.event || payload.type;
        const tgId = String(getTelegramId(payload) || '');
        console.log('[Tribute] event:', event, 'tgId:', tgId || '(not found)');
        if (!tgId) {
          console.log('[Tribute] payload keys:', Object.keys(payload));
          if (payload.user) console.log('[Tribute] payload.user:', JSON.stringify(payload.user));
        }
        const isNew = ['newSubscription', 'renewedSubscription', 'new_subscription', 'renewed_subscription'].includes(event);
        const isCancel = ['cancelledSubscription', 'cancelled_subscription'].includes(event);
        if (tgId) {
          if (isNew) {
            subscriptions.set(tgId, { active: true, expiresAt: payload.expires_at || payload.expiresAt || null });
            saveSubscriptions();
            console.log('[Tribute] added:', tgId);
          } else if (isCancel) {
            subscriptions.delete(tgId);
            saveSubscriptions();
            console.log('[Tribute] removed:', tgId);
          }
        }
      } catch (e) {
        console.error('[Tribute] parse error:', e.message);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ received: true }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
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
