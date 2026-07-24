import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { STORAGE_TOKEN } from './api';
import { AnimatedBackground } from './AnimatedBackground';

export function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem(STORAGE_TOKEN);

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    navigate('/');
  };

  return (
    <>
      <AnimatedBackground />
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand">
            StoryWeaver
          </Link>
          <div className="nav-links">
            <NavLink to="/download">Скачать</NavLink>
            <NavLink to="/subscribe">Подписка</NavLink>
            {token ? (
              <>
                <NavLink to="/account">Кабинет</NavLink>
                <button type="button" className="linkish" onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Войти</NavLink>
                <NavLink to="/register">Регистрация</NavLink>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="page">
        <Outlet />
      </div>
      <footer className="footer">
        <div className="shell" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', width: '100%' }}>
          <span>StoryWeaver</span>
          <span>Сайт и Telegram-вход в приложении — независимы</span>
        </div>
      </footer>
    </>
  );
}
