# StoryWeaver (Desktop)

Профессиональное офлайн-приложение для писателей с редактором глав, базой мира, связыванием сущностей, валидацией таймлайна и MindMap планировщиком сюжета.

## Требования

- Node.js 18+
- Rust (для Tauri)
- npm или pnpm

## Установка

```bash
npm install
```

## Запуск

```bash
npm run tauri:dev
```

## Сборка

```bash
npm run tauri:build
```

## Структура проекта

```
├── src/                 # React UI
│   ├── components/      # Компоненты
│   ├── database/       # SQLite схема
│   ├── services/       # Сервисы (валидация и т.д.)
│   └── store.ts        # Zustand store
├── src-tauri/          # Tauri (Rust) backend
│   └── src/
│       ├── db.rs       # SQLite через rusqlite
│       ├── db_commands.rs
│       └── commands.rs
├── auth-service/       # Node.js сервис: канал t.me/WeaverStory, Tribute (@tribute) API/webhook
└── docs/               # Документация
```

## Функции

- **Редактор глав** — написание и редактирование текста с автосохранением
- **MindMap** — визуальный планировщик сюжета (узлы: сюжет, персонаж, арка, секрет)
- **База мира** — персонажи, локации, предметы, фракции
- **Валидация** — проверка консистентности (смерть персонажей, владение предметами)
- **Авторизация** — канал [t.me/WeaverStory](https://t.me/WeaverStory), подписка через Tribute (@tribute) API/webhook (опционально демо-режим). См. [docs/TELEGRAM_AUTH_GUIDE.md](docs/TELEGRAM_AUTH_GUIDE.md)

## Данные

Все данные хранятся локально в SQLite. Каждый проект — папка с файлом `storyweaver.db`.
