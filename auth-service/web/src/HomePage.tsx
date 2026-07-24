import { Link } from 'react-router-dom';
import { TRIBUTE_CHANNEL_URL } from './api';

const FEATURES = [
  {
    title: 'Редактор глав',
    text: 'Пишите с автосохранением, фокус-режимом и экспортом в Word, TXT и Markdown.',
  },
  {
    title: 'База мира',
    text: 'Персонажи, локации, предметы, фракции и лор — всё связано с текстом книги.',
  },
  {
    title: 'MindMap и таймлайн',
    text: 'Планируйте сюжет визуально и держите хронологию событий под контролем.',
  },
  {
    title: 'Офлайн и ваши данные',
    text: 'Проект хранится локально в SQLite. Работайте без облака и интернета.',
  },
];

export function HomePage() {
  return (
    <main>
      <section className="shell hero">
        <div className="hero-glow" aria-hidden />
        <div className="hero-copy">
          <p className="hero-brand">StoryWeaver</p>
          <h1 className="hero-title">Пространство для вашей книги</h1>
          <p className="hero-lead">
            Десктопное приложение для писателей: главы, мир, связи и структура сюжета — в одном
            спокойном рабочем месте.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/download">
              Скачать приложение
            </Link>
            <a className="btn btn-secondary" href="#subscribe">
              Оформить доступ
            </a>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <h2>Всё, что нужно автору</h2>
          <p>Один инструмент вместо десятка таблиц и заметок — без лишнего шума.</p>
        </div>
        <div className="feature-list">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="feature" style={{ animationDelay: `${0.08 * i}s` }}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell section" id="subscribe">
        <div className="section-head">
          <h2>Доступ по подписке</h2>
          <p>
            Оплатите подписку через Tribute, затем вступите в канал. После этого войдите на сайте или
            в приложении через Telegram.
          </p>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            1. Оплата в Tribute → 2. Подписка на канал WeaverStory → 3. Вход через Telegram
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={TRIBUTE_CHANNEL_URL} target="_blank" rel="noreferrer">
              Открыть канал и Tribute
            </a>
            <Link className="btn btn-secondary" to="/login">
              Уже оплатил — войти
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
