import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMe, STORAGE_TOKEN, TELEGRAM_CHANNEL, type WebUser } from './api';

function formatDate(iso?: string | null) {
  if (!iso) return 'бессрочно / по правилам Tribute';
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
  const isTelegram = user?.provider === 'telegram' || Boolean(user?.telegramId);

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>Кабинет</h2>
        <p>
          {isTelegram
            ? 'Вход через Telegram · подписка Tribute'
            : 'Аккаунт сайта StoryWeaver'}
        </p>
      </div>

      <div className="account-grid">
        {isTelegram ? (
          <div className="panel">
            <div className="stat-label">Telegram ID</div>
            <div className="stat-value">{user?.telegramId || '—'}</div>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="stat-label">Email</div>
              <div className="stat-value">{user?.email || '—'}</div>
            </div>
            <div className="panel">
              <div className="stat-label">Имя</div>
              <div className="stat-value">{user?.name || '—'}</div>
            </div>
          </>
        )}
        <div className="panel">
          <div className="stat-label">Подписка</div>
          <div className={`stat-value ${sub.active ? 'ok' : 'danger'}`}>
            {sub.active ? 'Активна' : 'Не активна'}
          </div>
        </div>
        <div className="panel">
          <div className="stat-label">Тариф / источник</div>
          <div className="stat-value">{sub.plan || (isTelegram ? 'tribute' : '—')}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Действует до</div>
          <div className="stat-value">{formatDate(sub.expiresAt)}</div>
        </div>
        {sub.status && (
          <div className="panel">
            <div className="stat-label">Статус</div>
            <div className="stat-value">{sub.status}</div>
          </div>
        )}
      </div>

      <div className="hero-actions" style={{ marginTop: '1.5rem', flexDirection: 'row', width: 'auto', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/download">
          Скачать приложение
        </Link>
        {isTelegram ? (
          <a
            className="btn btn-secondary"
            href={`https://t.me/${TELEGRAM_CHANNEL.replace(/^@/, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            Канал подписки
          </a>
        ) : (
          <Link className="btn btn-secondary" to="/subscribe">
            {sub.active ? 'Продлить подписку' : 'Оформить подписку'}
          </Link>
        )}
      </div>

      {isTelegram && !sub.active && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Оплатите подписку в Tribute, затем вступите в канал t.me/{TELEGRAM_CHANNEL.replace(/^@/, '')} и обновите
          страницу (или войдите снова).
        </p>
      )}
    </main>
  );
}
