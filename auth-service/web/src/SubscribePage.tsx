import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  checkout,
  fetchMe,
  fetchPlans,
  STORAGE_TOKEN,
  TELEGRAM_CHANNEL,
  type Plan,
} from './api';

export function SubscribePage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialDays, setTrialDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);

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
      const res = await checkout(token, planId);
      if (!res.success) {
        setError(res.error || 'Не удалось создать заказ');
        return;
      }
      if (res.payUrl) {
        window.location.href = res.payUrl;
        return;
      }
      setMessage(
        `${res.message || 'Заказ создан.'} Номер заказа: ${res.order?.id || '—'}. Сохраните его для активации.`
      );
    } catch {
      setError('Ошибка сети');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <main className="shell section">
        <p className="muted">Загрузка…</p>
      </main>
    );
  }

  if (isTelegram) {
    return (
      <main className="shell section">
        <div className="section-head">
          <h2>Подписка Tribute</h2>
          <p>
            Вы вошли через Telegram. Продление и статус оплаты — в Tribute и канале t.me/
            {TELEGRAM_CHANNEL.replace(/^@/, '')}.
          </p>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            В кабинете можно посмотреть, активна ли подписка, и скачать приложение.
          </p>
          <div className="hero-actions" style={{ width: 'auto', flexDirection: 'row', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/account">
              В кабинет
            </Link>
            <a
              className="btn btn-secondary"
              href={`https://t.me/${TELEGRAM_CHANNEL.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              Открыть канал
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>Подписка на сайте</h2>
        <p>
          Оформите доступ email-аккаунтом. Пробный период при регистрации — {trialDays} дн. Если
          оплатили через Tribute — войдите через Telegram.
        </p>
      </div>

      <div className="download-grid">
        {plans.map((p) => (
          <div key={p.id} className="download-card panel" style={{ background: 'rgba(24,24,31,0.78)' }}>
            <h3>{p.name}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {p.description}
            </p>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {p.priceRub} ₽
            </div>
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => buy(p.id)}>
              {busy === p.id ? 'Оформление…' : 'Оформить'}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="danger">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="hero-actions" style={{ marginTop: 24, flexDirection: 'row', width: 'auto' }}>
        <Link className="btn btn-secondary" to="/account">
          В кабинет
        </Link>
        <Link className="btn btn-ghost" to="/login">
          Вход через Telegram
        </Link>
      </div>
    </main>
  );
}
