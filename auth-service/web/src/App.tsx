import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage } from './HomePage';
import { DownloadPage } from './DownloadPage';
import { LoginPage } from './LoginPage';
import { AccountPage } from './AccountPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="download" element={<DownloadPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
