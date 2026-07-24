import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { STORAGE_TOKEN } from './api';

export function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem(STORAGE_TOKEN);

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    navigate('/');
  };

  return (
    <>
      <header className="shell">
        <nav className="nav">
          <Link to="/" className="brand">
            StoryWeaver
          </Link>
          <div className="nav-links">
            <NavLink to="/download">Скачать</NavLink>
            {!token && <a href="/#subscribe">Подписка</a>}
            {token ? (
              <>
                <NavLink to="/account">Кабинет</NavLink>
                <button type="button" className="linkish" onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <NavLink to="/login">Войти</NavLink>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
      <footer className="shell footer">
        <span>StoryWeaver — офлайн-инструмент для писателей</span>
        <span>
          Канал{' '}
          <a href="https://t.me/WeaverStory" target="_blank" rel="noreferrer">
            t.me/WeaverStory
          </a>
        </span>
      </footer>
    </>
  );
}
