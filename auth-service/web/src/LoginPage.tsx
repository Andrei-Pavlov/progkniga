import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  pollAuthSession,
  STORAGE_TOKEN,
  TELEGRAM_BOT,
  TELEGRAM_CHANNEL,
  TRIBUTE_CHANNEL_URL,
} from './api';

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_TOKEN)) {
      navigate('/account', { replace: true });
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [navigate]);

  const startPolling = (sessionId: string) => {
    pollRef.current = setInterval(async () => {
      if (doneRef.current) return;
      try {
        const data = await pollAuthSession(sessionId);
        if (data.success && data.token) {
          doneRef.current = true;
          if (pollRef.current) clearInterval(pollRef.current);
          localStorage.setItem(STORAGE_TOKEN, data.token);
          navigate('/account');
        }
      } catch {
        /* keep polling */
      }
    }, 2000);

    setTimeout(() => {
      if (doneRef.current) return;
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      setQr(null);
      setError('Время вышло. Попробуйте снова.');
    }, 120000);
  };

  const startLogin = async () => {
    setLoading(true);
    setError('');
    doneRef.current = false;
    const sessionId = crypto.randomUUID();
    const url = `https://t.me/${TELEGRAM_BOT}?start=login_${sessionId}`;
    setAuthUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 });
      setQr(dataUrl);
      startPolling(sessionId);
    } catch {
      setLoading(false);
      setError('Не удалось сгенерировать QR-код');
    }
  };

  return (
    <main className="shell">
      <div className="panel login-box stack">
        <h1>Вход</h1>
        <p className="muted" style={{ margin: 0 }}>
          Через Telegram-бота {TELEGRAM_BOT}. Нужна активная подписка Tribute и канал{' '}
          {TELEGRAM_CHANNEL}.
        </p>

        {!qr ? (
          <button type="button" className="btn btn-primary" onClick={startLogin} disabled={loading}>
            Войти через Telegram
          </button>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Отсканируйте QR или откройте ссылку в Telegram, затем нажмите кнопку в боте.
            </p>
            <div className="qr-wrap">
              <img src={qr} alt="QR для входа через Telegram" />
            </div>
            {authUrl && (
              <a className="btn btn-secondary" href={authUrl} target="_blank" rel="noreferrer">
                Открыть в Telegram
              </a>
            )}
          </>
        )}

        {error && <p className="danger">{error}</p>}

        <a className="btn btn-ghost" href={TRIBUTE_CHANNEL_URL} target="_blank" rel="noreferrer">
          Оформить подписку
        </a>
        <Link className="muted" to="/">
          На главную
        </Link>
      </div>
    </main>
  );
}
