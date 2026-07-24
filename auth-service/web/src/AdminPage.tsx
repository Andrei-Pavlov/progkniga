import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatUsd, useI18n } from './i18n';

const ADMIN_STORAGE = 'storyweaver_admin_token';

type Referral = {
  code: string;
  discountPercent: number;
  active: boolean;
  maxUses: number | null;
  uses: number;
  paidUses: number;
  revenueUsd: number;
  note?: string | null;
  createdAt?: string;
};

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
        referralCode?: string | null;
      }>;
    };
    referrals?: {
      total: number;
      active: number;
      items: Referral[];
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

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    'Content-Type': 'application/json',
  };
}

export function AdminPage() {
  const { t, locale } = useI18n();
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_STORAGE) || '');
  const [draft, setDraft] = useState(() => localStorage.getItem(ADMIN_STORAGE) || '');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState('monthly');
  const [grantDays, setGrantDays] = useState('30');
  const [grantBusy, setGrantBusy] = useState(false);

  const [refCode, setRefCode] = useState('');
  const [refDiscount, setRefDiscount] = useState('10');
  const [refMaxUses, setRefMaxUses] = useState('');
  const [refNote, setRefNote] = useState('');
  const [refBusy, setRefBusy] = useState(false);

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

  const onGrant = async (e: FormEvent) => {
    e.preventDefault();
    setGrantBusy(true);
    setActionMsg('');
    setError('');
    try {
      const body: Record<string, unknown> = {
        email: grantEmail.trim(),
        planId: grantPlan,
        extend: true,
      };
      if (grantPlan === 'custom') {
        body.days = Number(grantDays);
      } else if (grantPlan === 'trial' && grantDays) {
        body.days = Number(grantDays);
      }
      const res = await fetch('/admin/grant', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('admin.grantFail'));
        return;
      }
      setActionMsg(
        `${t('admin.grantOk')}: ${data.user?.email} → ${data.user?.subscription?.plan} / ${data.user?.subscription?.expiresAt || ''}`
      );
      setGrantEmail('');
      await load(token);
    } catch {
      setError(t('admin.network'));
    } finally {
      setGrantBusy(false);
    }
  };

  const onCreateReferral = async (e: FormEvent) => {
    e.preventDefault();
    setRefBusy(true);
    setActionMsg('');
    setError('');
    try {
      const res = await fetch('/admin/referrals', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          code: refCode.trim(),
          discountPercent: Number(refDiscount) || 0,
          maxUses: refMaxUses.trim() ? Number(refMaxUses) : null,
          note: refNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('admin.refFail'));
        return;
      }
      setActionMsg(`${t('admin.refOk')}: ${data.referral?.code}`);
      setRefCode('');
      setRefNote('');
      await load(token);
    } catch {
      setError(t('admin.network'));
    } finally {
      setRefBusy(false);
    }
  };

  const toggleReferral = async (code: string, active: boolean) => {
    setError('');
    try {
      const res = await fetch('/admin/referrals/toggle', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ code, active }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('admin.refFail'));
        return;
      }
      await load(token);
    } catch {
      setError(t('admin.network'));
    }
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
  const refs = w?.referrals?.items || [];

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
      {actionMsg && <p className="ok">{actionMsg}</p>}

      {h && (
        <div className="account-grid" style={{ marginBottom: 24 }}>
          <StatCard label={t('admin.health.mail')} value={h.mailConfigured ? 'OK' : '—'} />
          <StatCard label={t('admin.health.tribute')} value={h.tributeKeyConfigured ? 'OK' : '—'} />
          <StatCard label={t('admin.health.admin')} value={h.adminTokenConfigured ? 'OK' : '—'} />
        </div>
      )}

      <div className="section-head">
        <h2>{t('admin.grantTitle')}</h2>
        <p>{t('admin.grantLead')}</p>
      </div>
      <form className="panel stack" onSubmit={onGrant} style={{ marginBottom: 32, maxWidth: 560 }}>
        <input
          className="field"
          type="email"
          required
          placeholder="email@example.com"
          value={grantEmail}
          onChange={(e) => setGrantEmail(e.target.value)}
        />
        <select className="field" value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)}>
          <option value="monthly">{t('plan.monthly.name')}</option>
          <option value="yearly">{t('plan.yearly.name')}</option>
          <option value="trial">Trial</option>
          <option value="custom">{t('admin.grantCustom')}</option>
        </select>
        <input
          className="field"
          type="number"
          min={1}
          placeholder={t('admin.grantDays')}
          value={grantDays}
          onChange={(e) => setGrantDays(e.target.value)}
          required={grantPlan === 'custom'}
        />
        <button type="submit" className="btn btn-primary" disabled={grantBusy} style={{ width: 'fit-content' }}>
          {grantBusy ? t('admin.working') : t('admin.grantSubmit')}
        </button>
      </form>

      <div className="section-head">
        <h2>{t('admin.refTitle')}</h2>
        <p>{t('admin.refLead')}</p>
      </div>
      <form className="panel stack" onSubmit={onCreateReferral} style={{ marginBottom: 16, maxWidth: 560 }}>
        <input
          className="field"
          required
          minLength={3}
          placeholder={t('admin.refCode')}
          value={refCode}
          onChange={(e) => setRefCode(e.target.value.toUpperCase())}
        />
        <input
          className="field"
          type="number"
          min={0}
          max={100}
          placeholder={t('admin.refDiscount')}
          value={refDiscount}
          onChange={(e) => setRefDiscount(e.target.value)}
        />
        <input
          className="field"
          type="number"
          min={1}
          placeholder={t('admin.refMaxUses')}
          value={refMaxUses}
          onChange={(e) => setRefMaxUses(e.target.value)}
        />
        <input
          className="field"
          placeholder={t('admin.refNote')}
          value={refNote}
          onChange={(e) => setRefNote(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={refBusy} style={{ width: 'fit-content' }}>
          {refBusy ? t('admin.working') : t('admin.refCreate')}
        </button>
      </form>

      <div className="account-grid" style={{ marginBottom: 16 }}>
        <StatCard label={t('admin.refTotal')} value={w?.referrals?.total ?? 0} />
        <StatCard label={t('admin.refActive')} value={w?.referrals?.active ?? 0} />
      </div>

      <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.refCode')}</th>
              <th>%</th>
              <th>{t('admin.refUses')}</th>
              <th>{t('admin.refPaidUses')}</th>
              <th>{t('admin.refRevenue')}</th>
              <th>{t('admin.col.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {refs.map((r) => (
              <tr key={r.code}>
                <td>
                  <strong>{r.code}</strong>
                  {r.note ? <div className="muted" style={{ fontSize: 11 }}>{r.note}</div> : null}
                </td>
                <td>{r.discountPercent}%</td>
                <td>
                  {r.uses}
                  {r.maxUses != null ? ` / ${r.maxUses}` : ''}
                </td>
                <td>{r.paidUses}</td>
                <td>{formatUsd(r.revenueUsd, locale)}</td>
                <td className={r.active ? 'ok' : 'danger'}>{r.active ? 'on' : 'off'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={() => toggleReferral(r.code, !r.active)}
                  >
                    {r.active ? t('admin.refDisable') : t('admin.refEnable')}
                  </button>
                </td>
              </tr>
            ))}
            {!refs.length && (
              <tr>
                <td colSpan={7} className="muted">
                  {t('admin.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
        <StatCard label={t('admin.revenue')} value={w ? formatUsd(w.orders.revenuePaidUsd, locale) : '—'} />
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
              <th>Ref</th>
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
                <td>{o.referralCode || '—'}</td>
                <td>{o.status}</td>
                <td>{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
            {!w?.orders.recent?.length && (
              <tr>
                <td colSpan={6} className="muted">
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
                <td>{row.telegramUsername ? `@${row.telegramUsername}` : row.telegramId}</td>
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
