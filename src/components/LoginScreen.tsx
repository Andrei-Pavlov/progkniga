import { useState, useEffect, useRef, FormEvent, CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';
import { useUpdater } from '../hooks/useUpdater';
import QRCode from 'qrcode';

const TELEGRAM_BOT = 'StoWeaBot';
const TELEGRAM_CHANNEL = 'WeaverStory';

type WebAuthResponse = {
  success?: boolean;
  token?: string;
  error?: string;
  user?: {
    subscription?: { active?: boolean; status?: string; expiresAt?: string | null };
  };
};

export function LoginScreen() {
  const setAuthenticated = useStore((s) => s.setAuthenticated);
  const setDemoUser = useStore((s) => s.setDemoUser);
  const setWebToken = useStore((s) => s.setWebToken);
  const { update, checking, downloading, checkForUpdates, installAndRelaunch } = useUpdater();
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [siteUrl, setSiteUrl] = useState('https://progkniga-production.up.railway.app');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    invoke<string>('get_app_version').then(setAppVersion).catch(() => {});
    invoke<string>('get_auth_service_url').then(setSiteUrl).catch(() => {});
    checkForUpdates();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkForUpdates]);

  const finishWebLogin = (token: string, active: boolean) => {
    if (!active) {
      setError('Подписка неактивна. Оформите её на сайте.');
      return;
    }
    setWebToken(token);
    setDemoUser(false);
    setAuthenticated(true);
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailLoading(true);
    try {
      const res = await invoke<WebAuthResponse>('web_auth_login', {
        email: email.trim(),
        password,
      });
      if (!res.success || !res.token) {
        setError(res.error || 'Не удалось войти');
        return;
      }
      finishWebLogin(res.token, Boolean(res.user?.subscription?.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEmailLoading(false);
    }
  };

  const openSite = (path = '/register') => {
    invoke('open_telegram_auth', { url: `${siteUrl.replace(/\/$/, '')}${path}` });
  };

  const startPolling = (sessionId: string) => {
    pollRef.current = setInterval(async () => {
      if (doneRef.current) return;
      try {
        const ok = await invoke<boolean>('poll_auth_session', { sessionId });
        if (ok) {
          doneRef.current = true;
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setLoading(false);
          setShowQr(false);
          setWebToken(null);
          setDemoUser(false);
          setAuthenticated(true);
        }
      } catch (_) {}
    }, 2000);
    setTimeout(() => {
      if (doneRef.current) return;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setLoading(false);
      setShowQr(false);
      setError('Время вышло. Попробуйте снова.');
    }, 120000);
  };

  const handleTelegramLogin = async () => {
    setLoading(true);
    setError('');
    doneRef.current = false;
    const sessionId = crypto.randomUUID?.() || `s${Date.now()}`;
    const url = `https://t.me/${TELEGRAM_BOT}?start=login_${sessionId}`;
    setAuthUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 });
      setQrDataUrl(dataUrl);
      setShowQr(true);
      startPolling(sessionId);
    } catch (e) {
      setLoading(false);
      setError('Не удалось сгенерировать QR-код');
    }
  };

  const openInBrowser = () => {
    if (authUrl) invoke('open_telegram_auth', { url: authUrl });
  };

  const handleDemoLogin = () => {
    setWebToken(null);
    setDemoUser(true);
    setAuthenticated(true);
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 24,
        background: 'var(--bg-primary)',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: 32, margin: 0 }}>StoryWeaver</h1>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        Профессиональное приложение для писателей
      </p>

      <form
        onSubmit={handleEmailLogin}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: 'min(360px, 100%)',
          marginTop: 8,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Вход с аккаунта сайта
        </p>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={emailLoading || loading}
          style={{
            padding: '12px 32px',
            fontSize: 16,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: emailLoading ? 'wait' : 'pointer',
          }}
        >
          {emailLoading ? 'Вход...' : 'Войти'}
        </button>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Нет аккаунта?{' '}
          <button
            type="button"
            onClick={() => openSite('/register')}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 12,
            }}
          >
            Зарегистрироваться на сайте
          </button>
        </p>
      </form>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: 'min(360px, 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: 'var(--text-secondary)',
            fontSize: 12,
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          или
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <button
          onClick={handleTelegramLogin}
          disabled={loading || emailLoading}
          style={{
            padding: '12px 32px',
            fontSize: 16,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Откройте Telegram и нажмите кнопку...' : 'Войти через Telegram'}
        </button>
        <button
          onClick={handleDemoLogin}
          style={{
            padding: '12px 32px',
            fontSize: 14,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Тест для писателей (без авторизации)
        </button>
      </div>

      {error && (
        <p style={{ color: 'var(--error)', margin: 0, fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
          {error}
          {error.includes('Подписка') && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => openSite('/subscribe')}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 13,
                }}
              >
                Открыть подписку
              </button>
            </>
          )}
        </p>
      )}
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
        Telegram: Tribute + канал t.me/{TELEGRAM_CHANNEL}. Сайт: email-аккаунт и подписка на сайте.
      </p>

      <div
        style={{
          position: 'fixed',
          bottom: 12,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        {update ? (
          <button
            onClick={installAndRelaunch}
            disabled={downloading}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: downloading ? 'wait' : 'pointer',
            }}
          >
            {downloading ? 'Загрузка...' : `Обновление ${update.version}`}
          </button>
        ) : (
          <button
            onClick={checkForUpdates}
            disabled={checking}
            style={{
              padding: 0,
              fontSize: 12,
              background: 'none',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: checking ? 'wait' : 'pointer',
              textDecoration: 'underline',
            }}
          >
            {checking ? 'Проверка...' : 'Проверить обновления'}
          </button>
        )}
        {appVersion && <span>v{appVersion}</span>}
      </div>

      {showQr && qrDataUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowQr(false);
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setLoading(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: 24,
              borderRadius: 12,
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text-primary)' }}>
              Отсканируйте QR-код камерой телефона
            </p>
            <img src={qrDataUrl} alt="QR" style={{ display: 'block', margin: '0 auto 16px', borderRadius: 8 }} />
            <button
              onClick={openInBrowser}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Открыть в браузере
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Или нажмите, чтобы открыть ссылку
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
