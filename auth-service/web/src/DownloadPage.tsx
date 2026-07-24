import { useEffect, useMemo, useState } from 'react';
import {
  detectPlatform,
  fetchLatestRelease,
  GITHUB_RELEASES,
  pickDownload,
  type LatestRelease,
} from './api';

export function DownloadPage() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const platform = useMemo(() => detectPlatform(), []);

  useEffect(() => {
    fetchLatestRelease()
      .then(setRelease)
      .finally(() => setLoading(false));
  }, []);

  const suggested = release ? pickDownload(release.assets, platform) : null;
  const platformLabel =
    platform === 'windows' ? 'Windows' : platform === 'mac' ? 'macOS' : platform === 'linux' ? 'Linux' : 'ваша ОС';

  return (
    <main className="shell section">
      <div className="section-head">
        <h2>Скачать</h2>
        <p>Десктопное приложение StoryWeaver. Обновления приходят автоматически.</p>
      </div>

      <div className="stack">
        <div className="panel stack">
          {loading && <p className="muted" style={{ margin: 0 }}>Загрузка…</p>}
          {!loading && release && (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Версия <strong style={{ color: 'var(--text-primary)' }}>{release.tag_name}</strong>
              </p>
              {suggested ? (
                <a className="btn btn-primary" href={suggested.browser_download_url} style={{ width: 'fit-content' }}>
                  Скачать для {platformLabel}
                </a>
              ) : (
                <a className="btn btn-primary" href={GITHUB_RELEASES} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>
                  Открыть релизы
                </a>
              )}
              <a className="btn btn-ghost" href={release.html_url} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>
                Все файлы
              </a>
            </>
          )}
          {!loading && !release && (
            <a className="btn btn-primary" href={GITHUB_RELEASES} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>
              Открыть релизы на GitHub
            </a>
          )}
        </div>

        {release && (
          <div className="download-grid">
            {release.assets
              .filter((a) => !a.name.endsWith('.sig') && a.name !== 'latest.json')
              .map((a) => (
                <a key={a.name} className="download-card" href={a.browser_download_url}>
                  <h3>{a.name}</h3>
                  <span className="muted">{(a.size / (1024 * 1024)).toFixed(1)} MB</span>
                </a>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
