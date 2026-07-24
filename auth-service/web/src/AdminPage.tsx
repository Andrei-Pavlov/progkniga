import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatUsd, useI18n } from './i18n';

const ADMIN_STORAGE = 'storyweaver_admin_token';

type AdminStats = {
  success: boolean;
  generatedAt?: string;
  error?: string;
  website?: {
    users: {
      total: number;
      verified: number;
      unverified: number;
      subscriptions: Record<string, number>;
      recent: Array<{
        id: string;
        email?: string | null;
        createdAt?: string;
        emailVerified?: boolean;
        subscription?: { active?: boolean; plan?: string | null; status?: string | null; expiresAt?: string | null };
      }>;
    };
    orders: {
      total: number;
      pending: number;
      paid: number;
      revenuePaidUsd: number;
      recent: Array<{
        id: string;
        email: string;
        planId: string;
        amountUsd: number;
        status: string;
        createdAt: string;
        paidAt?: string;
      }>;
    };
  };
  telegram?: {
    total: number;
    active: number;
    expired: number;
    cancelled: number;
    bySource: Record<string, number>;
    channel?: string;
    recent: Array<{
      telegramId: string;
      active: boolean;
      status?: string | null;
      expiresAt?: string | null;
      type?: string | null;
      source?: string;
      telegramUsername?: string | null;
      email?: string | null;
      updatedAt?: string | null;
    }>;
  };
  health?: {
    tributeKeyConfigured: boolean;
    mailConfigured: boolean;
    adminTokenConfigured: boolean;
  };
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function AdminPage() {
  const { t, locale } = useI18n();
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_STORAGE) || '');
  const [draft, setDraft] = useState(() => localStorage.getItem(ADMIN_STORAGE) || '');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (adminToken: string) => {
      if (!adminToken.trim()) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/admin/stats', {
          headers: { Authorization: `Bearer ${adminToken.trim()}` },
        });
        const data = (await res.json()) as AdminStats;
        if (!res.ok || !data.success) {
          setStats(null);
          setError(data.error || t('admin.unauthorized'));
          return;
        }
        setStats(data);
      } catch {
        setError(t('admin.network'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  const onUnlock = (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    localStorage.setItem(ADMIN_STORAGE, next);
    setToken(next);
  };

  const onLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE);
    setToken('');
    setDraft('');
    setStats(null);
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!token) {
    return (
      <main className="shell">
        <form className="login-box panel" onSubmit={onUnlock}>
          <h1>{t('admin.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('admin.lead')}
          </p>
          <input
            className="field"
            type="password"
            placeholder={t('admin.token')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            required
            autoComplete="off"
          />
          {error && (
            <p className="danger" style={{ margin: 0, fontSize: 13 }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {t('admin.unlock')}
          </button>
        </form>
      </main>
    );
  }

  const w = stats?.website;
  const tg = stats?.telegram;
  const h = stats?.health;

  return (
    <main className="shell section">
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2>{t('admin.title')}</h2>
          <p>
            {t('admin.updated')}: {fmtDate(stats?.generatedAt)}
          </p>
        </div>
        <div className="hero-actions" style={{ width: 'auto', flexDirection: 'row', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => load(token)}>
            {loading ? t('admin.refreshing') : t('admin.refresh')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            {t('admin.logout')}
          </button>
        </div>
      </div>

      {error && <p className="danger">{error}</p>}

      {h && (
        <div className="account-grid" style={{ marginBottom: 24 }}>
          <StatCard label={t('admin.health.mail')} value={h.mailConfigured ? 'OK' : '—'} />
          <StatCard label={t('admin.health.tribute')} value={h.tributeKeyConfigured ? 'OK' : '—'} />
          <StatCard label={t('admin.health.admin')} value={h.adminTokenConfigured ? 'OK' : '—'} />
        </div>
      )}

      <div className="section-head">
        <h2>{t('admin.website')}</h2>
        <p>{t('admin.websiteLead')}</p>
      </div>
      <div className="account-grid">
        <StatCard label={t('admin.users')} value={w?.users.total ?? '—'} />
        <StatCard label={t('admin.verified')} value={w?.users.verified ?? '—'} />
        <StatCard label={t('admin.unverified')} value={w?.users.unverified ?? '—'} />
        <StatCard label={t('admin.subActive')} value={w?.users.subscriptions.active ?? '—'} />
        <StatCard label={t('admin.subTrial')} value={w?.users.subscriptions.trial ?? '—'} />
        <StatCard label={t('admin.subPending')} value={w?.users.subscriptions.pending_verification ?? '—'} />
        <StatCard label={t('admin.ordersPaid')} value={w?.orders.paid ?? '—'} />
        <StatCard
          label={t('admin.revenue')}
          value={w ? formatUsd(w.orders.revenuePaidUsd, locale) : '—'}
        />
        <StatCard label={t('admin.ordersPending')} value={w?.orders.pending ?? '—'} />
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>{t('admin.telegram')}</h2>
        <p>
          {t('admin.telegramLead')}
          {tg?.channel ? ` · ${tg.channel}` : ''}
        </p>
      </div>
      <div className="account-grid">
        <StatCard label={t('admin.tgTotal')} value={tg?.total ?? '—'} />
        <StatCard label={t('admin.tgActive')} value={tg?.active ?? '—'} />
        <StatCard label={t('admin.tgExpired')} value={tg?.expired ?? '—'} />
        <StatCard label={t('admin.tgCancelled')} value={tg?.cancelled ?? '—'} />
      </div>
      {tg?.bySource && Object.keys(tg.bySource).length > 0 && (
        <div className="panel stack" style={{ marginTop: 16 }}>
          <div className="stat-label">{t('admin.tgSources')}</div>
          <div className="muted" style={{ margin: 0 }}>
            {Object.entries(tg.bySource)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')}
          </div>
        </div>
      )}

      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>{t('admin.recentUsers')}</h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>{t('admin.col.verified')}</th>
              <th>{t('admin.col.plan')}</th>
              <th>{t('admin.col.status')}</th>
              <th>{t('admin.col.created')}</th>
            </tr>
          </thead>
          <tbody>
            {(w?.users.recent || []).map((u) => (
              <tr key={u.id}>
                <td>{u.email || '—'}</td>
                <td>{u.emailVerified === false ? '✗' : '✓'}</td>
                <td>{u.subscription?.plan || '—'}</td>
                <td>{u.subscription?.status || '—'}</td>
                <td>{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
            {!w?.users.recent?.length && (
              <tr>
                <td colSpan={5} className="muted">
                  {t('admin.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>{t('admin.recentOrders')}</h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>{t('admin.col.plan')}</th>
              <th>{t('admin.col.amount')}</th>
              <th>{t('admin.col.status')}</th>
              <th>{t('admin.col.created')}</th>
            </tr>
          </thead>
          <tbody>
            {(w?.orders.recent || []).map((o) => (
              <tr key={o.id}>
                <td>{o.email}</td>
                <td>{o.planId}</td>
                <td>{formatUsd(o.amountUsd, locale)}</td>
                <td>{o.status}</td>
                <td>{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
            {!w?.orders.recent?.length && (
              <tr>
                <td colSpan={5} className="muted">
                  {t('admin.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>{t('admin.recentTg')}</h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Telegram</th>
              <th>{t('admin.col.status')}</th>
              <th>{t('admin.col.source')}</th>
              <th>{t('admin.col.until')}</th>
              <th>{t('admin.col.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {(tg?.recent || []).map((row) => (
              <tr key={row.telegramId}>
                <td>
                  {row.telegramUsername ? `@${row.telegramUsername}` : row.telegramId}
                </td>
                <td className={row.active ? 'ok' : 'danger'}>{row.active ? 'active' : row.status || 'off'}</td>
                <td>{row.source || '—'}</td>
                <td>{fmtDate(row.expiresAt)}</td>
                <td>{fmtDate(row.updatedAt)}</td>
              </tr>
            ))}
            {!tg?.recent?.length && (
              <tr>
                <td colSpan={5} className="muted">
                  {t('admin.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
