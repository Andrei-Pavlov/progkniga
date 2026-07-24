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
  const REFERRALS_FILE = path.join(dataDir, 'web-referrals.json');
  const secret = jwtSecret || crypto.randomBytes(32).toString('hex');

  /** @type {Map<string, any>} email -> user */
  let users = new Map();
  /** @type {Map<string, any>} orderId -> order */
  let orders = new Map();
  /** @type {Map<string, any>} code -> referral */
  let referrals = new Map();

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
    try {
      const raw = JSON.parse(fs.readFileSync(REFERRALS_FILE, 'utf8'));
      referrals = new Map(Object.entries(raw));
    } catch (_) {
      referrals = new Map();
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

  function saveReferrals() {
    const dir = path.dirname(REFERRALS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REFERRALS_FILE, JSON.stringify(Object.fromEntries(referrals), null, 2));
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
      emailVerified: user.emailVerified !== false,
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

  function register({ email, password, passwordConfirm, name }) {
    const em = normalizeEmail(email);
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return { ok: false, error: 'Укажите корректный email' };
    }
    if (!password || String(password).length < 8) {
      return { ok: false, error: 'Пароль должен быть не короче 8 символов' };
    }
    if (passwordConfirm == null || String(password) !== String(passwordConfirm)) {
      return { ok: false, error: 'Пароли не совпадают' };
    }
    if (users.has(em)) {
      return { ok: false, error: 'Аккаунт с таким email уже есть' };
    }
    const { salt, hash } = hashPassword(password);
    const now = new Date();
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const user = {
      id: randomUUID(),
      email: em,
      name: (name || '').trim() || null,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: now.toISOString(),
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
      // Trial starts after email confirmation
      subscription: { active: false, plan: null, status: 'pending_verification', expiresAt: null },
    };
    users.set(em, user);
    saveUsers();
    return {
      ok: true,
      needVerification: true,
      email: em,
      verifyToken,
      user: publicUser(user),
    };
  }

  function login({ email, password }) {
    const em = normalizeEmail(email);
    const user = users.get(em);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return { ok: false, error: 'Неверный email или пароль' };
    }
    if (user.emailVerified === false) {
      return {
        ok: false,
        error: 'Подтвердите email — мы отправили письмо со ссылкой',
        needVerification: true,
        email: em,
      };
    }
    return { ok: true, token: signToken(user), user: publicUser(user) };
  }

  function verifyEmail(token) {
    const raw = String(token || '').trim();
    if (!raw) return { ok: false, error: 'Нет токена' };
    let found = null;
    for (const u of users.values()) {
      if (u.emailVerifyToken && u.emailVerifyToken === raw) {
        found = u;
        break;
      }
    }
    if (!found) return { ok: false, error: 'Ссылка недействительна или уже использована' };
    if (found.emailVerified) {
      return { ok: true, already: true, user: publicUser(found) };
    }
    if (found.emailVerifyExpires) {
      const exp = new Date(found.emailVerifyExpires).getTime();
      if (!Number.isNaN(exp) && exp < Date.now()) {
        return { ok: false, error: 'Срок ссылки истёк. Запросите письмо снова.' };
      }
    }
    const now = new Date();
    found.emailVerified = true;
    found.emailVerifyToken = null;
    found.emailVerifyExpires = null;
    if (trialDays > 0) {
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 3600 * 1000);
      found.subscription = {
        active: true,
        plan: 'trial',
        status: 'trial',
        expiresAt: trialEnd.toISOString(),
      };
    } else {
      found.subscription = { active: false, plan: null, status: 'none', expiresAt: null };
    }
    users.set(found.email, found);
    saveUsers();
    return { ok: true, token: signToken(found), user: publicUser(found) };
  }

  function createVerificationToken(email) {
    const em = normalizeEmail(email);
    const user = users.get(em);
    if (!user) return { ok: false, error: 'Пользователь не найден' };
    if (user.emailVerified !== false) {
      return { ok: false, error: 'Email уже подтверждён' };
    }
    const verifyToken = crypto.randomBytes(32).toString('hex');
    user.emailVerifyToken = verifyToken;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    users.set(em, user);
    saveUsers();
    return { ok: true, email: em, verifyToken };
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

  function normalizeReferralCode(code) {
    return String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function publicReferral(ref) {
    if (!ref) return null;
    return {
      code: ref.code,
      discountPercent: Number(ref.discountPercent) || 0,
      active: ref.active !== false,
      maxUses: ref.maxUses ?? null,
      uses: Number(ref.uses) || 0,
      paidUses: Number(ref.paidUses) || 0,
      revenueUsd: Math.round((Number(ref.revenueUsd) || 0) * 100) / 100,
      note: ref.note || null,
      createdAt: ref.createdAt,
    };
  }

  function getReferral(code) {
    const c = normalizeReferralCode(code);
    if (!c) return null;
    return referrals.get(c) || null;
  }

  function listReferrals() {
    return [...referrals.values()]
      .map(publicReferral)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function createReferral({ code, discountPercent = 0, maxUses = null, note = '' }) {
    const c = normalizeReferralCode(code);
    if (!c || c.length < 3) return { ok: false, error: 'Код слишком короткий (мин. 3 символа)' };
    if (referrals.has(c)) return { ok: false, error: 'Такой код уже есть' };
    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const max = maxUses == null || maxUses === '' ? null : Math.max(1, Number(maxUses));
    if (maxUses != null && maxUses !== '' && (!Number.isFinite(max) || max < 1)) {
      return { ok: false, error: 'Некорректный maxUses' };
    }
    const ref = {
      code: c,
      discountPercent: pct,
      active: true,
      maxUses: max,
      uses: 0,
      paidUses: 0,
      revenueUsd: 0,
      note: String(note || '').trim() || null,
      createdAt: new Date().toISOString(),
    };
    referrals.set(c, ref);
    saveReferrals();
    return { ok: true, referral: publicReferral(ref) };
  }

  function setReferralActive(code, active) {
    const ref = getReferral(code);
    if (!ref) return { ok: false, error: 'Код не найден' };
    ref.active = !!active;
    referrals.set(ref.code, ref);
    saveReferrals();
    return { ok: true, referral: publicReferral(ref) };
  }

  function applyReferralToPrice(priceUsd, referralCode) {
    const ref = getReferral(referralCode);
    if (!ref) return { ok: false, error: 'Реферальный код не найден' };
    if (ref.active === false) return { ok: false, error: 'Код отключён' };
    if (ref.maxUses != null && Number(ref.uses) >= Number(ref.maxUses)) {
      return { ok: false, error: 'Лимит использований кода исчерпан' };
    }
    const pct = Math.max(0, Math.min(100, Number(ref.discountPercent) || 0));
    const amount = Math.round(Number(priceUsd) * (1 - pct / 100) * 100) / 100;
    return {
      ok: true,
      referral: ref,
      amountUsd: Math.max(0, amount),
      discountPercent: pct,
      originalUsd: Number(priceUsd),
    };
  }

  function createOrder(user, planId, { referralCode } = {}) {
    const plan = PLANS[planId];
    if (!plan) return { ok: false, error: 'Неизвестный тариф' };
    if (!user) return { ok: false, error: 'Пользователь не найден' };

    let amountUsd = plan.priceUsd;
    let appliedCode = null;
    let discountPercent = 0;
    let originalUsd = plan.priceUsd;

    if (referralCode) {
      const applied = applyReferralToPrice(plan.priceUsd, referralCode);
      if (!applied.ok) return applied;
      amountUsd = applied.amountUsd;
      discountPercent = applied.discountPercent;
      originalUsd = applied.originalUsd;
      appliedCode = applied.referral.code;
      applied.referral.uses = (Number(applied.referral.uses) || 0) + 1;
      referrals.set(appliedCode, applied.referral);
      saveReferrals();
    }

    const order = {
      id: randomUUID(),
      userId: user.id,
      email: user.email,
      planId: plan.id,
      amountUsd,
      originalUsd,
      discountPercent,
      referralCode: appliedCode,
      days: plan.days,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    orders.set(order.id, order);
    saveOrders();
    return { ok: true, order, plan, referral: appliedCode ? publicReferral(getReferral(appliedCode)) : null };
  }

  function activateSubscription(emailOrUserId, planId, { extend = true, days } = {}) {
    let user = users.get(normalizeEmail(emailOrUserId));
    if (!user) user = getUserById(emailOrUserId);
    if (!user) return { ok: false, error: 'Пользователь не найден' };

    let plan = PLANS[planId] || null;
    if (!plan && planId === 'trial') plan = { id: 'trial', days: trialDays, priceUsd: 0 };
    if (!plan && planId === 'custom') {
      const d = Number(days);
      if (!Number.isFinite(d) || d < 1) return { ok: false, error: 'Укажите days для custom' };
      plan = { id: 'custom', days: d, priceUsd: 0 };
    }
    if (!plan) return { ok: false, error: 'Неизвестный тариф' };

    const planDays = days != null && Number(days) > 0 ? Number(days) : plan.days;
    const now = Date.now();
    let base = now;
    if (extend && user.subscription?.expiresAt) {
      const prev = new Date(user.subscription.expiresAt).getTime();
      if (!Number.isNaN(prev) && prev > now) base = prev;
    }
    const expiresAt = new Date(base + planDays * 24 * 3600 * 1000).toISOString();
    user.subscription = {
      active: true,
      plan: plan.id,
      status: plan.id === 'trial' ? 'trial' : 'active',
      expiresAt,
      grantedByAdmin: plan.id === 'custom' || planId === 'custom' ? true : undefined,
    };
    if (user.emailVerified === false) {
      user.emailVerified = true;
      user.emailVerifyToken = null;
      user.emailVerifyExpires = null;
    }
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

    if (order.referralCode) {
      const ref = getReferral(order.referralCode);
      if (ref) {
        ref.paidUses = (Number(ref.paidUses) || 0) + 1;
        ref.revenueUsd = Math.round(((Number(ref.revenueUsd) || 0) + (Number(order.amountUsd) || 0)) * 100) / 100;
        referrals.set(ref.code, ref);
        saveReferrals();
      }
    }

    return { ok: true, order, user: activated.user };
  }

  function getOrder(orderId) {
    return orders.get(orderId) || null;
  }

  function listUsersSafe() {
    return [...users.values()]
      .map((u) => publicUser(u))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function listOrdersSafe() {
    return [...orders.values()].sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
  }

  function getWebStats() {
    const all = [...users.values()];
    const subs = { active: 0, expired: 0, trial: 0, pending_verification: 0, none: 0, other: 0 };
    let verified = 0;
    let unverified = 0;
    for (const u of all) {
      if (u.emailVerified === false) unverified += 1;
      else verified += 1;
      const pub = publicSubscription(u.subscription);
      const status = u.subscription?.status || pub.status || 'none';
      if (status === 'pending_verification') subs.pending_verification += 1;
      else if (pub.active && (pub.plan === 'trial' || status === 'trial')) subs.trial += 1;
      else if (pub.active) subs.active += 1;
      else if (pub.status === 'expired' || status === 'expired') subs.expired += 1;
      else if (status === 'none' || !u.subscription) subs.none += 1;
      else subs.other += 1;
    }
    const orderList = listOrdersSafe();
    let pending = 0;
    let paid = 0;
    let revenuePaidUsd = 0;
    for (const o of orderList) {
      if (o.status === 'paid') {
        paid += 1;
        revenuePaidUsd += Number(o.amountUsd) || 0;
      } else {
        pending += 1;
      }
    }
    return {
      users: {
        total: all.length,
        verified,
        unverified,
        subscriptions: subs,
        recent: listUsersSafe().slice(0, 25),
      },
      orders: {
        total: orderList.length,
        pending,
        paid,
        revenuePaidUsd: Math.round(revenuePaidUsd * 100) / 100,
        recent: orderList.slice(0, 25),
      },
      referrals: {
        total: referrals.size,
        active: [...referrals.values()].filter((r) => r.active !== false).length,
        items: listReferrals(),
      },
    };
  }

  return {
    secret,
    PLANS,
    register,
    login,
    me,
    verifyEmail,
    createVerificationToken,
    listPlans,
    createOrder,
    activateSubscription,
    markOrderPaid,
    getOrder,
    listUsersSafe,
    listOrdersSafe,
    getWebStats,
    createReferral,
    listReferrals,
    getReferral,
    setReferralActive,
    publicReferral,
    publicUser,
    publicTelegramUser,
    verifyToken,
    signTelegramToken,
    getUserById,
  };
}

module.exports = { createWebAuth };
