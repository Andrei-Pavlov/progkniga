import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchMe,
  STORAGE_TOKEN,
  TRIBUTE_CHANNEL_URL,
  type MeResponse,
  type SubscriptionInfo,
} from './api';

function formatDate(iso?: string | null) {
  if (!iso) return 'бессрочно';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function AccountPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    fetchMe(token)
      .then((data) => {
        if (!data.success) {
          localStorage.removeItem(STORAGE_TOKEN);
          navigate('/login', { replace: true });
          return;
        }
        setMe(data);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <main className="shell section">
        <p className="muted">Загрузка кабинета…</p>
      </main>
    );
  }

  const sub: SubscriptionInfo = me?.subscription || { active: false };

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>Кабинет</h2>
        <p>Статус доступа к StoryWeaver и быстрые действия.</p>
      </div>

      <div className="account-grid">
        <div className="panel">
          <div className="stat-label">Telegram ID</div>
          <div className="stat-value">{me?.telegramId || '—'}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Подписка</div>
          <div className={`stat-value ${sub.active ? 'ok' : 'danger'}`}>
            {sub.active ? 'Активна' : 'Не активна'}
          </div>
        </div>
        <div className="panel">
          <div className="stat-label">Действует до</div>
          <div className="stat-value">{formatDate(sub.expiresAt)}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Тип</div>
          <div className="stat-value">{sub.type || sub.status || '—'}</div>
        </div>
      </div>

      <div className="hero-actions" style={{ marginTop: '1.5rem' }}>
        <Link className="btn btn-primary" to="/download">
          Скачать приложение
        </Link>
        {!sub.active && (
          <a className="btn btn-secondary" href={TRIBUTE_CHANNEL_URL} target="_blank" rel="noreferrer">
            Оформить подписку
          </a>
        )}
      </div>
    </main>
  );
}
