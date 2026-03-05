# Установка Visual Studio Build Tools для сборки Tauri на Windows
# Запуск: powershell -ExecutionPolicy Bypass -File scripts/install-build-tools.ps1

Write-Host "Установка Visual Studio Build Tools (C++)..." -ForegroundColor Cyan
Write-Host "Это может занять несколько минут." -ForegroundColor Yellow

winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" --accept-package-agreements

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nУстановка завершена. Перезапустите терминал и выполните: npm run tauri build" -ForegroundColor Green
} else {
    Write-Host "`nОшибка. Установите вручную: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Red
}
