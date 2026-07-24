import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, resendVerification, STORAGE_TOKEN } from './api';
import { useI18n } from './i18n';

export function RegisterPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_TOKEN)) navigate('/account', { replace: true });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    if (password !== passwordConfirm) {
      setError(t('register.mismatch'));
      setLoading(false);
      return;
    }
    try {
      const res = await register(email, password, passwordConfirm, name, locale);
      if (!res.success) {
        setError(res.error || t('register.fail'));
        return;
      }
      if (res.needVerification) {
        setPendingEmail(res.email || email);
        return;
      }
      if (res.token) {
        localStorage.setItem(STORAGE_TOKEN, res.token);
        navigate('/account');
      }
    } catch {
      setError(t('register.network'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const res = await resendVerification(pendingEmail, locale);
      if (!res.success) {
        setError(res.error || t('register.resendFail'));
        return;
      }
      setInfo(t('register.resendOk'));
    } catch {
      setError(t('register.resendFail'));
    } finally {
      setResending(false);
    }
  };

  if (pendingEmail) {
    return (
      <main className="shell">
        <div className="login-box panel">
          <h1>{t('register.checkEmail')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('register.checkEmailBody', { email: pendingEmail })}
          </p>
          {info && <p className="ok" style={{ margin: 0, fontSize: 13 }}>{info}</p>}
          {error && <p className="danger" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
          <button type="button" className="btn btn-secondary" disabled={resending} onClick={onResend} style={{ width: '100%' }}>
            {resending ? t('register.submitting') : t('register.resend')}
          </button>
          <p className="muted" style={{ margin: 0 }}>
            <Link to="/login" style={{ color: 'var(--accent-hover)', textDecoration: 'underline' }}>
              {t('register.login')}
            </Link>
          </p>
        </div>
      </main>
    );
  }

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
        <input
          className="field"
          type="password"
          placeholder={t('register.passwordConfirm')}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
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
