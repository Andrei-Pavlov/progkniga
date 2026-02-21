# Автообновление StoryWeaver

## Настройка (один раз)

### 1. Генерация ключей подписи

```bash
# Windows (PowerShell)
npx tauri signer generate -- -w $HOME/.tauri/storyweaver.key

# macOS / Linux
npx tauri signer generate -- -w ~/.tauri/storyweaver.key
```

При генерации задайте пароль и сохраните его. Появятся два файла:
- `storyweaver.key` — приватный ключ (никогда не коммитить!)
- `storyweaver.key.pub` — публичный ключ

### 2. Публичный ключ в конфиг

Откройте `storyweaver.key.pub` и скопируйте всё содержимое (включая `dW50cnVzdGVk...`). В `src-tauri/tauri.conf.json` замените `REPLACE_WITH_PUBLIC_KEY` на это значение.

### 3. GitHub Secrets

В настройках репозитория (Settings → Secrets and variables → Actions) добавьте:

- `TAURI_SIGNING_PRIVATE_KEY` — содержимое файла `storyweaver.key` или путь к нему
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль, заданный при генерации

## Релиз новой версии

1. Обновите версию в `package.json`, `src-tauri/Cargo.toml` и `src-tauri/tauri.conf.json`
2. Создайте ветку `release` и запушьте, либо запустите workflow вручную (Actions → Release → Run workflow)
3. GitHub Actions соберёт приложение для Windows, macOS и Linux
4. Проверьте черновик релиза и опубликуйте его
5. Пользователи получат уведомление об обновлении при следующем запуске

## Локальная сборка с подписью

```bash
# Windows
$env:TAURI_SIGNING_PRIVATE_KEY = "путь/к/storyweaver.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "ваш_пароль"
npm run tauri build

# macOS / Linux
export TAURI_SIGNING_PRIVATE_KEY="путь/к/storyweaver.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="ваш_пароль"
npm run tauri build
```
