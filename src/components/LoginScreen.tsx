import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';

const TELEGRAM_BOT = 'StoWeaBot';
const TELEGRAM_CHANNEL = 'WeaverStory';

export function LoginScreen() {
  const setAuthenticated = useStore((s) => s.setAuthenticated);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleTelegramLogin = async () => {
    setLoading(true);
    setError('');
    doneRef.current = false;
    const sessionId = crypto.randomUUID?.() || `s${Date.now()}`;
    try {
      await invoke('open_telegram_auth', {
        url: `https://t.me/${TELEGRAM_BOT}?start=login_${sessionId}`,
      });
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
        setError('Время вышло. Попробуйте снова.');
      }, 120000);
    } catch (e) {
      setLoading(false);
      setError('Не удалось открыть Telegram');
    }
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
    </div>
  );
}
