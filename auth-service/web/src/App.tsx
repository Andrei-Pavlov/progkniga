import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage } from './HomePage';
import { DownloadPage } from './DownloadPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { AccountPage } from './AccountPage';
import { SubscribePage } from './SubscribePage';
import { AdminPage } from './AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="download" element={<DownloadPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="subscribe" element={<SubscribePage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
