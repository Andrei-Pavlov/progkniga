export const TELEGRAM_BOT = 'StoWeaBot';
export const TELEGRAM_CHANNEL = 'WeaverStory';
export const TRIBUTE_CHANNEL_URL = `https://t.me/${TELEGRAM_CHANNEL}`;
export const GITHUB_RELEASES = 'https://github.com/Andrei-Pavlov/progkniga/releases/latest';
export const STORAGE_TOKEN = 'storyweaver_web_token';

export type SubscriptionInfo = {
  active: boolean;
  expiresAt?: string | null;
  status?: string | null;
  type?: string | null;
};

export type MeResponse = {
  success: boolean;
  telegramId?: string;
  subscription?: SubscriptionInfo;
  error?: string;
};

export type SessionResponse = {
  success: boolean;
  token?: string;
  telegramId?: string;
  subscription?: SubscriptionInfo;
};

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export async function pollAuthSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`/auth/session/${encodeURIComponent(sessionId)}`);
  return json(res);
}

export async function fetchMe(token: string): Promise<MeResponse> {
  const res = await fetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res);
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
  const names = assets.map((a) => a.name.toLowerCase());
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
  void names;
  return assets.find((a) => !a.name.endsWith('.sig') && !a.name.includes('latest.json'));
}
