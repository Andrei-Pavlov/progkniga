/**
 * Web users: email/password auth + subscription (independent from Telegram).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = require('crypto');

function createWebAuth({ dataDir, jwtSecret, trialDays = 7 }) {
  const USERS_FILE = path.join(dataDir, 'web-users.json');
  const ORDERS_FILE = path.join(dataDir, 'web-orders.json');
  const secret = jwtSecret || crypto.randomBytes(32).toString('hex');

  /** @type {Map<string, any>} email -> user */
  let users = new Map();
  /** @type {Map<string, any>} orderId -> order */
  let orders = new Map();

  const PLANS = {
    monthly: {
      id: 'monthly',
      name: 'Monthly',
      priceUsd: 4.99,
      days: 30,
      description: 'Full StoryWeaver access for 30 days',
    },
    yearly: {
      id: 'yearly',
      name: 'Yearly',
      priceUsd: 49.99,
      days: 365,
      description: 'Full access for a year — about 17% cheaper',
    },
  };

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      users = new Map(Object.entries(raw));
    } catch (_) {
      users = new Map();
    }
    try {
      const raw = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
      orders = new Map(Object.entries(raw));
    } catch (_) {
      orders = new Map();
    }
  }

  function saveUsers() {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  }

  function saveOrders() {
    const dir = path.dirname(ORDERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(Object.fromEntries(orders), null, 2));
  }

  load();

  function normalizeEmail(email) {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return { salt, hash };
  }

  function verifyPassword(password, salt, hash) {
    const next = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(next, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function publicUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name || null,
      provider: 'email',
      telegramId: null,
      createdAt: user.createdAt,
      subscription: publicSubscription(user.subscription),
    };
  }

  function publicSubscription(sub) {
    if (!sub) return { active: false, plan: null, expiresAt: null, status: 'none' };
    const expiresAt = sub.expiresAt || null;
    let active = !!sub.active;
    if (expiresAt) {
      const t = new Date(expiresAt).getTime();
      if (!Number.isNaN(t) && t <= Date.now()) active = false;
    }
    return {
      active,
      plan: sub.plan || null,
      expiresAt,
      status: active ? sub.status || 'active' : 'expired',
    };
  }

  function signToken(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      typ: 'web',
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  function signTelegramToken(telegramId) {
    const tg = String(telegramId);
    const payload = {
      sub: `tg:${tg}`,
      telegramId: tg,
      typ: 'telegram',
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  function verifyToken(token, { allowTelegram = false } = {}) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!payload?.sub) return null;
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      if (payload.typ === 'web') return payload;
      if (allowTelegram && payload.typ === 'telegram' && payload.telegramId) return payload;
      return null;
    } catch {
      return null;
    }
  }

  function publicTelegramUser(telegramId, subscription) {
    const tg = String(telegramId);
    return {
      id: `tg:${tg}`,
      email: null,
      name: null,
      provider: 'telegram',
      telegramId: tg,
      createdAt: undefined,
      subscription: {
        active: !!subscription?.active,
        plan: subscription?.plan || subscription?.type || 'tribute',
        expiresAt: subscription?.expiresAt ?? null,
        status: subscription?.status || (subscription?.active ? 'active' : 'none'),
      },
    };
  }

  function getUserById(id) {
    for (const u of users.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  function register({ email, password, name }) {
    const em = normalizeEmail(email);
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return { ok: false, error: 'Укажите корректный email' };
    }
    if (!password || String(password).length < 8) {
      return { ok: false, error: 'Пароль должен быть не короче 8 символов' };
    }
    if (users.has(em)) {
      return { ok: false, error: 'Аккаунт с таким email уже есть' };
    }
    const { salt, hash } = hashPassword(password);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 3600 * 1000);
    const user = {
      id: randomUUID(),
      email: em,
      name: (name || '').trim() || null,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: now.toISOString(),
      subscription: trialDays > 0
        ? {
            active: true,
            plan: 'trial',
            status: 'trial',
            expiresAt: trialEnd.toISOString(),
          }
        : { active: false, plan: null, status: 'none', expiresAt: null },
    };
    users.set(em, user);
    saveUsers();
    const token = signToken(user);
    return { ok: true, token, user: publicUser(user) };
  }

  function login({ email, password }) {
    const em = normalizeEmail(email);
    const user = users.get(em);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return { ok: false, error: 'Неверный email или пароль' };
    }
    return { ok: true, token: signToken(user), user: publicUser(user) };
  }

  function me(token) {
    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: 'Unauthorized' };
    const user = getUserById(payload.sub) || users.get(normalizeEmail(payload.email));
    if (!user) return { ok: false, error: 'Unauthorized' };
    // refresh expired flag
    const sub = publicSubscription(user.subscription);
    if (user.subscription && user.subscription.active && !sub.active) {
      user.subscription.active = false;
      user.subscription.status = 'expired';
      saveUsers();
    }
    return { ok: true, user: publicUser(user) };
  }

  function listPlans() {
    return Object.values(PLANS);
  }

  function createOrder(user, planId) {
    const plan = PLANS[planId];
    if (!plan) return { ok: false, error: 'Неизвестный тариф' };
    const order = {
      id: randomUUID(),
      userId: user.id,
      email: user.email,
      planId: plan.id,
      amountUsd: plan.priceUsd,
      days: plan.days,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    orders.set(order.id, order);
    saveOrders();
    return { ok: true, order, plan };
  }

  function activateSubscription(emailOrUserId, planId, { extend = true } = {}) {
    let user = users.get(normalizeEmail(emailOrUserId));
    if (!user) user = getUserById(emailOrUserId);
    if (!user) return { ok: false, error: 'Пользователь не найден' };
    const plan = PLANS[planId] || (planId === 'trial' ? { id: 'trial', days: trialDays } : null);
    if (!plan) return { ok: false, error: 'Неизвестный тариф' };

    const now = Date.now();
    let base = now;
    if (extend && user.subscription?.expiresAt) {
      const prev = new Date(user.subscription.expiresAt).getTime();
      if (!Number.isNaN(prev) && prev > now) base = prev;
    }
    const expiresAt = new Date(base + plan.days * 24 * 3600 * 1000).toISOString();
    user.subscription = {
      active: true,
      plan: plan.id,
      status: 'active',
      expiresAt,
    };
    users.set(user.email, user);
    saveUsers();
    return { ok: true, user: publicUser(user) };
  }

  function markOrderPaid(orderId) {
    const order = orders.get(orderId);
    if (!order) return { ok: false, error: 'Заказ не найден' };
    if (order.status === 'paid') return { ok: true, order, already: true };
    const activated = activateSubscription(order.userId, order.planId);
    if (!activated.ok) return activated;
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    orders.set(order.id, order);
    saveOrders();
    return { ok: true, order, user: activated.user };
  }

  function getOrder(orderId) {
    return orders.get(orderId) || null;
  }

  return {
    secret,
    PLANS,
    register,
    login,
    me,
    listPlans,
    createOrder,
    activateSubscription,
    markOrderPaid,
    getOrder,
    publicUser,
    publicTelegramUser,
    verifyToken,
    signTelegramToken,
    getUserById,
  };
}

module.exports = { createWebAuth };
