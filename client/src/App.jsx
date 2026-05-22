import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import UsersPage from './pages/Users/UsersPage';
import ReportPage from './pages/Report/ReportPage';
import SettingsPage from './pages/Settings/SettingsPage';
import AccountPage from './pages/Account/AccountPage';
import InfoPage from './pages/Info/InfoPage';
import ProfilePage from './pages/Profile/ProfilePage';

function ProtectedRoute({ children, page }) {
  const { user, hasAccess } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (page && !hasAccess(page)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace  /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="info" element={<InfoPage />} />
        <Route path="users" element={<ProtectedRoute page="users"><UsersPage /></ProtectedRoute>} />
        <Route path="report" element={<ProtectedRoute page="report"><ReportPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute page="settings"><SettingsPage /></ProtectedRoute>} />
        <Route path="account" element={<ProtectedRoute page="account"><AccountPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
