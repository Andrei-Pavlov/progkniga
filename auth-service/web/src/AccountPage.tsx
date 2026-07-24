import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMe, STORAGE_TOKEN, TELEGRAM_CHANNEL, type WebUser } from './api';
import { useI18n } from './i18n';

export function AccountPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [user, setUser] = useState<WebUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    fetchMe(token)
      .then((data) => {
        if (!data.success || !data.user) {
          localStorage.removeItem(STORAGE_TOKEN);
          navigate('/login', { replace: true });
          return;
        }
        setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return t('account.untilOpen');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <main className="shell section">
        <p className="muted">{t('account.loading')}</p>
      </main>
    );
  }

  const sub = user?.subscription || { active: false };
  const isTelegram = user?.provider === 'telegram' || Boolean(user?.telegramId);

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>{t('account.title')}</h2>
        <p>{isTelegram ? t('account.lead.tg') : t('account.lead.email')}</p>
      </div>

      <div className="account-grid">
        {isTelegram ? (
          <div className="panel">
            <div className="stat-label">{t('account.tgId')}</div>
            <div className="stat-value">{user?.telegramId || '—'}</div>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="stat-label">{t('account.email')}</div>
              <div className="stat-value">{user?.email || '—'}</div>
            </div>
            <div className="panel">
              <div className="stat-label">{t('account.name')}</div>
              <div className="stat-value">{user?.name || '—'}</div>
            </div>
          </>
        )}
        <div className="panel">
          <div className="stat-label">{t('account.sub')}</div>
          <div className={`stat-value ${sub.active ? 'ok' : 'danger'}`}>
            {sub.active ? t('account.active') : t('account.inactive')}
          </div>
        </div>
        <div className="panel">
          <div className="stat-label">{t('account.plan')}</div>
          <div className="stat-value">{sub.plan || (isTelegram ? 'tribute' : '—')}</div>
        </div>
        <div className="panel">
          <div className="stat-label">{t('account.until')}</div>
          <div className="stat-value">{formatDate(sub.expiresAt)}</div>
        </div>
        {sub.status && (
          <div className="panel">
            <div className="stat-label">{t('account.status')}</div>
            <div className="stat-value">{sub.status}</div>
          </div>
        )}
      </div>

      <div className="hero-actions" style={{ marginTop: '1.5rem', flexDirection: 'row', width: 'auto', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/download">
          {t('account.download')}
        </Link>
        {isTelegram ? (
          <a
            className="btn btn-secondary"
            href={`https://t.me/${TELEGRAM_CHANNEL.replace(/^@/, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('account.channel')}
          </a>
        ) : (
          <Link className="btn btn-secondary" to="/subscribe">
            {sub.active ? t('account.extend') : t('account.buy')}
          </Link>
        )}
      </div>

      {isTelegram && !sub.active && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          {t('account.tgHint')} t.me/{TELEGRAM_CHANNEL.replace(/^@/, '')}
        </p>
      )}
    </main>
  );
}
