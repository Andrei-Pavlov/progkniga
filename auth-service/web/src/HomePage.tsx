import { Link } from 'react-router-dom';
import { TRIBUTE_CHANNEL_URL } from './api';

const FEATURES = [
  {
    title: 'Редактор глав',
    text: 'Написание и редактирование текста с автосохранением, фокус-режимом и экспортом.',
  },
  {
    title: 'База мира',
    text: 'Персонажи, локации, предметы, фракции и лор — рядом с текстом книги.',
  },
  {
    title: 'MindMap и таймлайн',
    text: 'Планировщик сюжета и хронология событий в одном приложении.',
  },
  {
    title: 'Офлайн',
    text: 'Данные локально в SQLite. Проект — папка на вашем диске.',
  },
];

export function HomePage() {
  return (
    <main>
      <section className="shell hero">
        <div className="hero-copy">
          <p className="hero-brand">StoryWeaver</p>
          <h1 className="hero-title">Профессиональное приложение для писателей</h1>
          <p className="hero-lead">
            Редактор глав, база мира, MindMap и таймлайн — офлайн, на вашем компьютере.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/download">
              Скачать приложение
            </Link>
            <Link className="btn btn-secondary" to="/login">
              Войти через Telegram
            </Link>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <h2>Возможности</h2>
          <p>Тот же инструмент, что в десктопном приложении.</p>
        </div>
        <div className="feature-list">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell section" id="subscribe">
        <div className="section-head">
          <h2>Подписка</h2>
          <p>
            Оплатите через Tribute, затем подпишитесь на канал WeaverStory. Вход проверяет оба шага.
          </p>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            1. Оплата в Tribute → 2. Канал WeaverStory → 3. Вход через Telegram
          </p>
          <div className="hero-actions" style={{ width: 'auto', flexDirection: 'row', flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href={TRIBUTE_CHANNEL_URL} target="_blank" rel="noreferrer">
              Открыть канал
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
