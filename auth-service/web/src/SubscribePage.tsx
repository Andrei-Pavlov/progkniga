import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  checkout,
  fetchMe,
  fetchPlans,
  STORAGE_TOKEN,
  TELEGRAM_CHANNEL,
  type Plan,
} from './api';
import { formatUsd, useI18n } from './i18n';

export function SubscribePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialDays, setTrialDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);
  const [referralCode, setReferralCode] = useState(() => (searchParams.get('ref') || '').toUpperCase());

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    Promise.all([fetchMe(token), fetchPlans()])
      .then(([me, plansRes]) => {
        if (!me.success || !me.user) {
          localStorage.removeItem(STORAGE_TOKEN);
          navigate('/login', { replace: true });
          return;
        }
        setIsTelegram(me.user.provider === 'telegram' || Boolean(me.user.telegramId));
        setPlans(plansRes.plans || []);
        if (plansRes.trialDays != null) setTrialDays(plansRes.trialDays);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const buy = async (planId: string) => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      navigate('/login');
      return;
    }
    setBusy(planId);
    setError('');
    setMessage('');
    try {
      const res = await checkout(token, planId, referralCode.trim() || undefined);
      if (!res.success) {
        setError(res.error || t('subscribe.orderFail'));
        return;
      }
      if (res.payUrl) {
        window.location.href = res.payUrl;
        return;
      }
      const discount =
        res.order?.discountPercent && res.order.discountPercent > 0
          ? ` (−${res.order.discountPercent}%${res.order.referralCode ? ` · ${res.order.referralCode}` : ''})`
          : '';
      setMessage(
        `${res.message || ''} Order: ${res.order?.id || '—'} · ${formatUsd(res.order?.amountUsd || 0, locale)}${discount}`
      );
    } catch {
      setError(t('subscribe.network'));
    } finally {
      setBusy(null);
    }
  };

  const planName = (id: string) => t(`plan.${id}.name`);
  const planDesc = (id: string) => t(`plan.${id}.desc`);

  if (loading) {
    return (
      <main className="shell section">
        <p className="muted">{t('subscribe.loading')}</p>
      </main>
    );
  }

  if (isTelegram) {
    return (
      <main className="shell section">
        <div className="section-head">
          <h2>{t('subscribe.tg.title')}</h2>
          <p>
            {t('subscribe.tg.lead')} t.me/{TELEGRAM_CHANNEL.replace(/^@/, '')}
          </p>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            {t('subscribe.tg.body')}
          </p>
          <div className="hero-actions" style={{ width: 'auto', flexDirection: 'row', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/account">
              {t('subscribe.account')}
            </Link>
            <a
              className="btn btn-secondary"
              href={`https://t.me/${TELEGRAM_CHANNEL.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('subscribe.tg.channel')}
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>{t('subscribe.title')}</h2>
        <p>{t('subscribe.lead', { days: trialDays })}</p>
      </div>

      <div className="panel stack" style={{ marginBottom: 20, maxWidth: 420 }}>
        <label className="stat-label" htmlFor="ref-code">
          {t('subscribe.referral')}
        </label>
        <input
          id="ref-code"
          className="field"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder={t('subscribe.referralPh')}
          autoComplete="off"
        />
      </div>

      <div className="download-grid">
        {plans.map((p) => (
          <div key={p.id} className="download-card panel" style={{ background: 'rgba(24,24,31,0.78)' }}>
            <h3>{planName(p.id)}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {planDesc(p.id)}
            </p>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {formatUsd(p.priceUsd, locale)}
            </div>
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => buy(p.id)}>
              {busy === p.id ? t('subscribe.buying') : t('subscribe.buy')}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="danger">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="hero-actions" style={{ marginTop: 24, flexDirection: 'row', width: 'auto' }}>
        <Link className="btn btn-secondary" to="/account">
          {t('subscribe.account')}
        </Link>
        <Link className="btn btn-ghost" to="/login">
          {t('subscribe.tgLogin')}
        </Link>
      </div>
    </main>
  );
}
