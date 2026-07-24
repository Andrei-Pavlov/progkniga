import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { STORAGE_TOKEN } from './api';
import { AnimatedBackground } from './AnimatedBackground';
import { useI18n, type Locale } from './i18n';

export function Layout() {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const token = localStorage.getItem(STORAGE_TOKEN);

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    navigate('/');
  };

  const switchLocale = (next: Locale) => {
    if (next !== locale) setLocale(next);
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
            <NavLink to="/download">{t('nav.download')}</NavLink>
            <NavLink to="/subscribe">{t('nav.subscribe')}</NavLink>
            {token ? (
              <>
                <NavLink to="/account">{t('nav.account')}</NavLink>
                <button type="button" className="linkish" onClick={logout}>
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">{t('nav.login')}</NavLink>
                <NavLink to="/register">{t('nav.register')}</NavLink>
              </>
            )}
            <div className="lang-switch" role="group" aria-label="Language">
              <button
                type="button"
                className={locale === 'ru' ? 'lang-btn active' : 'lang-btn'}
                onClick={() => switchLocale('ru')}
              >
                RU
              </button>
              <button
                type="button"
                className={locale === 'en' ? 'lang-btn active' : 'lang-btn'}
                onClick={() => switchLocale('en')}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="page">
        <Outlet />
      </div>
      <footer className="footer">
        <div
          className="shell"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', width: '100%' }}
        >
          <span>StoryWeaver</span>
          <span>{t('footer.auth')}</span>
        </div>
      </footer>
    </>
  );
}
