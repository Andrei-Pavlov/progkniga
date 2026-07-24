import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  login,
  pollAuthSession,
  STORAGE_TOKEN,
  TELEGRAM_CHANNEL,
  telegramLoginUrl,
} from './api';
import { useI18n } from './i18n';

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_TOKEN)) navigate('/account', { replace: true });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [navigate]);

  const stopTelegram = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setTgLoading(false);
    setQrDataUrl(null);
    setAuthUrl(null);
  };

  const startTelegram = async () => {
    setError('');
    setTgLoading(true);
    doneRef.current = false;
    const sessionId = crypto.randomUUID?.() || `s${Date.now()}`;
    const url = telegramLoginUrl(sessionId);
    setAuthUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch {
      setTgLoading(false);
      setError(t('login.qrFail'));
      return;
    }

    pollRef.current = setInterval(async () => {
      if (doneRef.current) return;
      try {
        const res = await pollAuthSession(sessionId);
        if (res.success && res.token) {
          doneRef.current = true;
          stopTelegram();
          localStorage.setItem(STORAGE_TOKEN, res.token);
          navigate('/account');
        }
      } catch {
        /* keep polling */
      }
    }, 2000);

    setTimeout(() => {
      if (doneRef.current) return;
      stopTelegram();
      setError(t('login.timeout'));
    }, 120000);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      if (!res.success || !res.token) {
        setError(res.error || t('login.fail'));
        return;
      }
      localStorage.setItem(STORAGE_TOKEN, res.token);
      navigate('/account');
    } catch {
      setError(t('login.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell">
      <div className="login-box panel" style={{ gap: 16 }}>
        <h1>{t('login.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('login.lead')}
        </p>

        <button
          type="button"
          className="btn btn-primary"
          disabled={tgLoading || loading}
          onClick={startTelegram}
          style={{ width: '100%' }}
        >
          {tgLoading ? t('login.tg.loading') : t('login.tg')}
        </button>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {t('login.tg.need')} t.me/{TELEGRAM_CHANNEL}
        </p>

        {qrDataUrl && (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {t('login.qr')}
            </p>
            <img src={qrDataUrl} alt="QR Telegram" width={220} height={220} style={{ borderRadius: 8 }} />
            {authUrl && (
              <a className="btn btn-secondary" href={authUrl} target="_blank" rel="noreferrer">
                {t('login.openBot')}
              </a>
            )}
            <button type="button" className="btn btn-ghost" onClick={stopTelegram}>
              {t('login.cancel')}
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            color: 'var(--text-secondary)',
            fontSize: 12,
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          {t('login.orEmail')}
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={onSubmit} className="stack" style={{ width: '100%' }}>
          <input
            className="field"
            type="email"
            placeholder={t('login.email')}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder={t('login.password')}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-secondary" disabled={loading || tgLoading} style={{ width: '100%' }}>
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>

        {error && (
          <p className="danger" style={{ margin: 0, fontSize: 13 }}>
            {error}
          </p>
        )}
        <p className="muted" style={{ margin: 0 }}>
          {t('login.noAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--accent-hover)', textDecoration: 'underline' }}>
            {t('login.register')}
          </Link>
        </p>
      </div>
    </main>
  );
}
