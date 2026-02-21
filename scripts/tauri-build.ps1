# Сборка StoryWeaver с подписью обновлений
# Запуск: .\scripts\tauri-build.ps1

$projectRoot = Join-Path $PSScriptRoot ".."
$keyPath = Join-Path $projectRoot "storyweaver.key"
if (-not (Test-Path $keyPath)) {
    Write-Error "Ключ не найден: $keyPath"
    exit 1
}

$env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "kuku22kuku"
$env:AUTH_SERVICE_URL = "https://progkniga-production.up.railway.app"

Set-Location $projectRoot
npm run tauri build
