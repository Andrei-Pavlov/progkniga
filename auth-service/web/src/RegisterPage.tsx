import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, STORAGE_TOKEN } from './api';
import { useI18n } from './i18n';

export function RegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_TOKEN)) navigate('/account', { replace: true });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await register(email, password, name);
      if (!res.success || !res.token) {
        setError(res.error || t('register.fail'));
        return;
      }
      localStorage.setItem(STORAGE_TOKEN, res.token);
      navigate('/account');
    } catch {
      setError(t('register.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell">
      <form className="login-box panel" onSubmit={onSubmit}>
        <h1>{t('register.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('register.lead')}
        </p>
        <input
          className="field"
          type="text"
          placeholder={t('register.name')}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field"
          type="email"
          placeholder={t('register.email')}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          placeholder={t('register.password')}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && (
          <p className="danger" style={{ margin: 0, fontSize: 13 }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? t('register.submitting') : t('register.submit')}
        </button>
        <p className="muted" style={{ margin: 0 }}>
          {t('register.haveAccount')}{' '}
          <Link to="/login" style={{ color: 'var(--accent-hover)', textDecoration: 'underline' }}>
            {t('register.login')}
          </Link>
        </p>
      </form>
    </main>
  );
}
