import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMe, STORAGE_TOKEN, type WebUser } from './api';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function AccountPage() {
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

  if (loading) {
    return (
      <main className="shell section">
        <p className="muted">Загрузка кабинета…</p>
      </main>
    );
  }

  const sub = user?.subscription || { active: false };

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>Кабинет</h2>
        <p>Ваш аккаунт на сайте StoryWeaver.</p>
      </div>

      <div className="account-grid">
        <div className="panel">
          <div className="stat-label">Email</div>
          <div className="stat-value">{user?.email || '—'}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Имя</div>
          <div className="stat-value">{user?.name || '—'}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Подписка</div>
          <div className={`stat-value ${sub.active ? 'ok' : 'danger'}`}>
            {sub.active ? 'Активна' : 'Не активна'}
          </div>
        </div>
        <div className="panel">
          <div className="stat-label">Тариф</div>
          <div className="stat-value">{sub.plan || '—'}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Действует до</div>
          <div className="stat-value">{formatDate(sub.expiresAt)}</div>
        </div>
      </div>

      <div className="hero-actions" style={{ marginTop: '1.5rem', flexDirection: 'row', width: 'auto', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/subscribe">
          {sub.active ? 'Продлить подписку' : 'Оформить подписку'}
        </Link>
        <Link className="btn btn-secondary" to="/download">
          Скачать приложение
        </Link>
      </div>
    </main>
  );
}
