import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkout, fetchPlans, STORAGE_TOKEN, type Plan } from './api';

export function SubscribePage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialDays, setTrialDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    fetchPlans()
      .then((d) => {
        setPlans(d.plans || []);
        if (d.trialDays != null) setTrialDays(d.trialDays);
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

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>Подписка</h2>
        <p>
          Оформите доступ к StoryWeaver на сайте. При регистрации даётся пробный период{' '}
          {trialDays} дн. Десктоп по-прежнему входит через Telegram отдельно.
        </p>
      </div>

      {loading && <p className="muted">Загрузка тарифов…</p>}

      <div className="download-grid">
        {plans.map((p) => (
          <div key={p.id} className="download-card panel" style={{ background: 'rgba(24,24,31,0.78)' }}>
            <h3>{p.name}</h3>
            <p className="muted" style={{ margin: 0 }}>{p.description}</p>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {p.priceRub} ₽
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => buy(p.id)}
            >
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
      </div>
    </main>
  );
}
