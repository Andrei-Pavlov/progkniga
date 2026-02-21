# Вход через Telegram и Tribute

Безопасный вход через **Telegram Mini App**: личность проверяется криптографически, подменять чужой ID нельзя.

---

## Схема

```
1. Пользователь нажимает «Войти через Telegram»
2. Открывается бот t.me/StoWeaBot
3. Бот отправляет кнопку «Войти в StoryWeaver» (Mini App)
4. Пользователь нажимает → открывается Mini App в Telegram
5. Mini App получает подписанные данные (initData) от Telegram
6. Mini App отправляет их на auth-service
7. auth-service проверяет подпись и наличие подписки Tribute
8. Приложение получает подтверждение и открывает доступ
```

---

## Часть 1: Создание бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. Отправьте `/newbot`.
3. Укажите имя и username, например **StoWeaBot**. Если другой — измените константу `TELEGRAM_BOT` в `src/components/LoginScreen.tsx`.
4. Скопируйте токен бота.

---

## Часть 2: Канал и Tribute

1. Создайте канал **t.me/WeaverStory** (или используйте существующий).
2. **Добавьте бота StoWeaBot в канал как администратора** — это нужно для автоматической проверки подписки (если webhook Tribute не сработал).
3. Подключите [@tribute](https://t.me/tribute) к каналу.
4. Настройте подписку.
5. Creator Dashboard → Settings (⋯) → **API Keys**:
   - Сгенерируйте API Key, если нет
   - **Webhook URL**: `https://ваш-ngrok-url.ngrok-free.app/webhook/tribute`  
     (без слэша в конце, HTTPS обязателен)

---

## Часть 3: auth-service

### Переменные окружения (auth-service/.env)

```env
TRIBUTE_API_KEY=ваш_ключ_tribute
TRIBUTE_API_URL=https://tribute.tg/api/v1
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
AUTH_BASE_URL=https://ваш-ngrok-url.ngrok-free.app
TELEGRAM_CHANNEL=WeaverStory
```

**AUTH_BASE_URL** — публичный URL (ngrok или ваш домен). Tribute webhook и Mini App должны быть доступны по HTTPS.

**TELEGRAM_CHANNEL** — username канала для fallback-проверки (бот должен быть админом).

### Запуск

```bash
npm run auth-service
```

При старте auth-service автоматически устанавливает webhook для бота на `AUTH_BASE_URL/bot/webhook`.

---

## Часть 4: Запуск

```bash
# Терминал 1: auth-service
npm run auth-service

# Терминал 2: ngrok (если используете)
ngrok http 3847

# Терминал 3: приложение
npm run tauri:dev
```

Убедитесь, что `AUTH_BASE_URL` в `.env` совпадает с URL ngrok.

---

## Часть 5: Как пользоваться

1. Подпишитесь на канал t.me/WeaverStory через Tribute.
2. В приложении нажмите «Войти через Telegram».
3. Появится QR-код — отсканируйте камерой телефона (Telegram откроет бота) или нажмите «Открыть в браузере».
4. В боте нажмите кнопку «Войти в StoryWeaver».
5. Mini App проверит подписку и завершит вход.
6. Вернитесь в приложение — доступ будет открыт.

**Без Telegram на компьютере:** используйте QR-код — отсканируйте телефоном и войдите через Telegram на телефоне.

---

## Проверка автоматического добавления (webhook Tribute)

Добавление подписчиков **автоматическое**, если webhook настроен:

1. **Creator Dashboard** → Settings → API Keys → Webhook URL = `https://ваш-ngrok-url/webhook/tribute`
2. **ngrok** и **auth-service** должны быть запущены, `AUTH_BASE_URL` в `.env` = URL ngrok
3. **Проверка**: пусть кто-то (другой аккаунт, друг) подпишется на канал через Tribute
4. В терминале auth-service должно появиться: `[Tribute] newSubscription 123456789`
5. В `auth-service/subscriptions.json` появится новый ID

Если логов нет — webhook не доходит (проверьте URL, ngrok, firewall).

---

## Если «Нет активной подписки»

**Автоматическая проверка (продакшен):**
1. **Webhook Tribute** — при подписке Tribute отправляет событие, мы добавляем пользователя.
2. **Fallback через канал** — если webhook не сработал, при входе проверяем членство в канале через Telegram API. **Бот StoWeaBot должен быть администратором канала.**

**Проверьте:**
- Tribute Creator Dashboard → Webhook URL = `https://ваш-url/webhook/tribute`
- Бот StoWeaBot добавлен в канал как администратор
- **Railway:** Volume примонтирован к `/data`, `DATA_DIR=/data` — иначе подписчики сбрасываются при деплое

**Отладка (только localhost):** `http://localhost:3847/auth/add?telegram_id=ВАШ_ID`

---

## Раздача другу (сборка для проверки)

Чтобы друг мог войти через Telegram, auth-service должен быть доступен в интернете.

### 1. Разверните auth-service в облаке

Варианты: [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io) и т.п.

**Пример Railway:**
- Создайте проект, добавьте сервис из GitHub
- Root Directory: `auth-service`
- Переменные: `TRIBUTE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `AUTH_BASE_URL`, `DATA_DIR=/data`
- **Volume** (Settings → Volumes): Mount Path = `/data` — иначе подписчики сбрасываются при каждом деплое
- Tribute Creator Dashboard → Webhook URL: `https://ваш-url/webhook/tribute`

### 2. Соберите приложение с URL вашего auth-service

```powershell
# PowerShell (Windows)
$env:AUTH_SERVICE_URL="https://ваш-auth-url.railway.app"; npm run tauri build
```

```bash
# Bash / Linux / macOS
AUTH_SERVICE_URL=https://ваш-auth-url.railway.app npm run tauri build
```

### 3. Отправьте другу

- **Windows**: `src-tauri/target/release/StoryWeaver.exe` или `.msi` из `src-tauri/target/release/bundle/`
- **macOS**: `.app` или `.dmg` из `src-tauri/target/release/bundle/`
- **Linux**: бинарник или `.AppImage`

Друг должен:
1. Подписаться на канал t.me/WeaverStory через Tribute
2. Запустить приложение → «Войти через Telegram»
3. Нажать кнопку в боте

---

## Демо-режим

Без бота и Tribute используйте «Демо (без авторизации)» для локальной разработки.
