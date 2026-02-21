import { useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function useUpdater() {
  const [update, setUpdate] = useState<Awaited<ReturnType<typeof check>>>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);
    setUpdate(null);
    try {
      const result = await check();
      setUpdate(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка проверки обновлений';
      setError(msg);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const installAndRelaunch = useCallback(async () => {
    if (!update) return;
    setDownloading(true);
    setError(null);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка установки обновления';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  }, [update]);

  return {
    update,
    checking,
    downloading,
    error,
    checkForUpdates,
    installAndRelaunch,
  };
}
