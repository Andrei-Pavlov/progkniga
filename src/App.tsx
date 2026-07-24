import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Layout } from './components/Layout';
import { LoginScreen } from './components/LoginScreen';
import { ProjectSelect } from './components/ProjectSelect';
import { useStore } from './store';

type WebMeResponse = {
  success?: boolean;
  user?: { subscription?: { active?: boolean } };
};

function App() {
  const { isAuthenticated, isDemoUser, webToken, currentProject, setCurrentProject, clearSession, setAuthenticated } =
    useStore();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        if (webToken) {
          const me = await invoke<WebMeResponse>('web_auth_me', { token: webToken });
          if (cancelled) return;
          if (!me.success || !me.user?.subscription?.active) {
            clearSession();
          } else {
            setAuthenticated(true);
          }
        }
      } catch {
        if (!cancelled && webToken) clearSession();
      } finally {
        if (!cancelled) setAppReady(true);
      }
    };

    if (isDemoUser || !webToken) {
      setAppReady(true);
      return;
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!appReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span>Загрузка...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!currentProject) {
    return <ProjectSelect onSelect={setCurrentProject} />;
  }

  return <Layout />;
}

export default App;
