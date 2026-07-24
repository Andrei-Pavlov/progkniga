import { Link } from 'react-router-dom';
import { useI18n } from './i18n';

export function HomePage() {
  const { t } = useI18n();
  const features = [
    { title: t('home.f1.title'), text: t('home.f1.text') },
    { title: t('home.f2.title'), text: t('home.f2.text') },
    { title: t('home.f3.title'), text: t('home.f3.text') },
    { title: t('home.f4.title'), text: t('home.f4.text') },
  ];

  return (
    <main>
      <section className="shell hero">
        <div className="hero-copy">
          <p className="hero-brand">{t('home.brand')}</p>
          <h1 className="hero-title">{t('home.title')}</h1>
          <p className="hero-lead">{t('home.lead')}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/download">
              {t('home.download')}
            </Link>
            <Link className="btn btn-secondary" to="/login">
              {t('home.login')}
            </Link>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <h2>{t('home.features')}</h2>
          <p>{t('home.featuresLead')}</p>
        </div>
        <div className="feature-list">
          {features.map((f) => (
            <article key={f.title} className="feature">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell section" id="subscribe">
        <div className="section-head">
          <h2>{t('home.sub.title')}</h2>
          <p>{t('home.sub.lead')}</p>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            {t('home.sub.steps')}
          </p>
          <div className="hero-actions" style={{ width: 'auto', flexDirection: 'row', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/login">
              {t('home.sub.tg')}
            </Link>
            <Link className="btn btn-secondary" to="/subscribe">
              {t('home.sub.plans')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
