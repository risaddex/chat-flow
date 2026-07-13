import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import NavigateListener from './components/NavigateListener';
import NotificationListener from './components/NotificationListener';
import LoginPage from './pages/LoginPage';
import InboxPage from './pages/InboxPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ContactsPage from './pages/ContactsPage';
import CasesPage from './pages/CasesPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BusinessProvider>
              <NavigateListener />
              <NotificationListener />
              <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AuthGuard />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Navigate to="/dashboard/conversations" replace />} />
                  <Route path="/dashboard/conversations" element={<InboxPage />} />
                  <Route path="/dashboard/conversations/:id" element={<InboxPage />} />
                  <Route path="/dashboard/contacts" element={<ContactsPage />} />
                  <Route path="/dashboard/cases" element={<CasesPage />} />
                  <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/dashboard/conversations" replace />} />
            </Routes>
            </BusinessProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
