import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { LoginScreen } from './components/LoginScreen';
import { ProjectSelect } from './components/ProjectSelect';
import { useStore } from './store';

function App() {
  const { isAuthenticated, currentProject, setCurrentProject } = useStore();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    setAppReady(true);
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
