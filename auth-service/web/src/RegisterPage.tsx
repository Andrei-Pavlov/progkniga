import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, STORAGE_TOKEN } from './api';

export function RegisterPage() {
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
        setError(res.error || 'Не удалось зарегистрироваться');
        return;
      }
      localStorage.setItem(STORAGE_TOKEN, res.token);
      navigate('/account');
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell">
      <form className="login-box panel" onSubmit={onSubmit}>
        <h1>Регистрация</h1>
        <p className="muted" style={{ margin: 0 }}>
          Создайте аккаунт на сайте. После регистрации — пробный период.
        </p>
        <input
          className="field"
          type="text"
          placeholder="Имя (необязательно)"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          placeholder="Пароль (мин. 8 символов)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p className="danger" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Создание…' : 'Создать аккаунт'}
        </button>
        <p className="muted" style={{ margin: 0 }}>
          Уже есть аккаунт? <Link to="/login" style={{ color: 'var(--accent-hover)', textDecoration: 'underline' }}>Войти</Link>
        </p>
      </form>
    </main>
  );
}
