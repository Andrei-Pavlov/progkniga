import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';
import QRCode from 'qrcode';

const TELEGRAM_BOT = 'StoWeaBot';
const TELEGRAM_CHANNEL = 'WeaverStory';

export function LoginScreen() {
  const setAuthenticated = useStore((s) => s.setAuthenticated);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
      try {
        await invoke('open_telegram_auth', { url });
      } catch (_) {}
    } catch (e) {
      setLoading(false);
      setError('Не удалось сгенерировать QR-код');
    }
  };

  const openInBrowser = () => {
    if (authUrl) invoke('open_telegram_auth', { url: authUrl });
  };

  const handleDemoLogin = () => {
    setAuthenticated(true);
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
      }}
    >
      <h1 style={{ fontSize: 32, margin: 0 }}>StoryWeaver</h1>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        Профессиональное приложение для писателей
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <button
          onClick={handleTelegramLogin}
          disabled={loading}
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
          Демо (без авторизации)
        </button>
      </div>
      {error && <p style={{ color: 'var(--error)', margin: 0, fontSize: 13 }}>{error}</p>}
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
        Подпишитесь на t.me/{TELEGRAM_CHANNEL} через Tribute. Вход проверяет подписку автоматически.
      </p>

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
