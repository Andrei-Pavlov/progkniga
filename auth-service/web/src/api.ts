export const GITHUB_RELEASES = 'https://github.com/Andrei-Pavlov/progkniga/releases/latest';
export const STORAGE_TOKEN = 'storyweaver_web_token';
export const TELEGRAM_BOT = 'StoWeaBot';
export const TELEGRAM_CHANNEL = 'WeaverStory';

export type SubscriptionInfo = {
  active: boolean;
  expiresAt?: string | null;
  status?: string | null;
  plan?: string | null;
};

export type WebUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  provider?: 'email' | 'telegram' | string;
  telegramId?: string | null;
  createdAt?: string;
  subscription: SubscriptionInfo;
};

export type AuthResponse = {
  success: boolean;
  token?: string;
  user?: WebUser;
  error?: string;
  needVerification?: boolean;
  email?: string;
  message?: string;
};

export type MeResponse = {
  success: boolean;
  user?: WebUser;
  error?: string;
};

export type SessionPollResponse = {
  success: boolean;
  token?: string | null;
  telegramId?: string | null;
  subscription?: SubscriptionInfo | null;
};

export type Plan = {
  id: string;
  name: string;
  priceUsd: number;
  days: number;
  description: string;
};

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export async function register(
  email: string,
  password: string,
  passwordConfirm: string,
  name?: string,
  locale?: string
): Promise<AuthResponse> {
  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, passwordConfirm, name, locale }),
  });
  return json(res);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return json(res);
}

export async function resendVerification(email: string, locale?: string): Promise<AuthResponse> {
  const res = await fetch('/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, locale }),
  });
  return json(res);
}

export async function fetchMe(token: string): Promise<MeResponse> {
  const res = await fetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res);
}

export async function pollAuthSession(sessionId: string): Promise<SessionPollResponse> {
  const res = await fetch(`/auth/session/${encodeURIComponent(sessionId)}`);
  return json(res);
}

export function telegramLoginUrl(sessionId: string) {
  return `https://t.me/${TELEGRAM_BOT}?start=login_${sessionId}`;
}

export async function fetchPlans(): Promise<{ success: boolean; plans: Plan[]; trialDays?: number }> {
  const res = await fetch('/billing/plans');
  return json(res);
}

export async function checkout(token: string, planId: string) {
  const res = await fetch('/billing/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId }),
  });
  return json<{
    success: boolean;
    order?: { id: string; amountUsd: number; planId: string; status: string };
    plan?: Plan;
    payUrl?: string | null;
    message?: string;
    error?: string;
  }>(res);
}

export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

export type LatestRelease = {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
};

export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/Andrei-Pavlov/progkniga/releases/latest',
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return null;
    return json(res);
  } catch {
    return null;
  }
}

export function detectPlatform(): 'windows' | 'mac' | 'linux' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return 'other';
}

export function pickDownload(assets: ReleaseAsset[], platform: ReturnType<typeof detectPlatform>) {
  const find = (...parts: string[]) =>
    assets.find((a) => {
      const n = a.name.toLowerCase();
      return parts.every((p) => n.includes(p)) && !n.endsWith('.sig');
    });

  if (platform === 'windows') {
    return find('setup', '.exe') || find('.msi') || find('.exe');
  }
  if (platform === 'mac') {
    const isArm = navigator.userAgent.includes('ARM') || navigator.userAgent.includes('Apple');
    if (isArm) return find('aarch64', '.dmg') || find('aarch64') || find('.dmg');
    return find('x64', '.dmg') || find('.dmg');
  }
  if (platform === 'linux') {
    return find('appimage') || find('.deb') || find('.rpm');
  }
  return assets.find((a) => !a.name.endsWith('.sig') && !a.name.includes('latest.json'));
}
