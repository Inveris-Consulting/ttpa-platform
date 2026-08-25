import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Login } from './pages/Login';
import { DashboardCatalog } from './pages/DashboardCatalog';
import { DashboardViewer } from './pages/DashboardViewer';
import { Settings } from './pages/Settings';
import { DataExplorer } from './pages/DataExplorer';
import { AnalyticsStudioPage } from './pages/AnalyticsStudioPage';
import { AnalyticsDashboardsPage } from './pages/AnalyticsDashboardsPage';
import { Settings as SettingsIcon, LogOut, FolderKanban, Sun, Moon, Database, Sparkles, LayoutDashboard, Gift } from 'lucide-react';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/components.css';

const SESSION_STORAGE_KEY = 'ttpa_user_session';

interface NavigationHeaderProps {
  userSession: any;
  onSignOut: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const getUserInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'US';
};

const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  userSession,
  onSignOut,
  theme,
  toggleTheme,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isCatalog = location.pathname === '/catalog';
  const isDataCatalog = location.pathname === '/data-catalog';
  const isAnalyticsExplore = location.pathname === '/analytics/explore' || location.pathname.startsWith('/analytics-kit');
  const isAnalyticsDash = location.pathname === '/analytics/dashboards';
  const isSettings = location.pathname === '/settings';

  const userName = userSession?.user?.name || userSession?.user?.email?.split('@')[0] || 'User';
  const userRoleLabel = userSession?.user?.role === 'admin' ? 'TTPA ADMIN' : 'REPRESENTATIVE';
  const userInitials = getUserInitials(userSession?.user?.name, userSession?.user?.email);

  return (
    <header className="ttpa-header" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Left Brand + Navigation Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div className="ttpa-brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => navigate('/catalog')}>
          <img src="/assets/rr_logo_white.webp" alt="R&R Logo" className="ttpa-brand-logo" style={{ height: '32px' }} />
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            TTPA Analytics
          </span>
        </div>

        {/* Inveris-style Navigation Menu Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => navigate('/catalog')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: isCatalog ? 700 : 500,
              color: isCatalog ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isCatalog ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <FolderKanban size={15} />
            <span>Catalog</span>
          </button>

          <button
            onClick={() => navigate('/data-catalog')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: isDataCatalog ? 700 : 500,
              color: isDataCatalog ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isDataCatalog ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Database size={15} />
            <span>Data Catalog</span>
          </button>

          <button
            onClick={() => navigate('/analytics/explore')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: isAnalyticsExplore ? 700 : 500,
              color: isAnalyticsExplore ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isAnalyticsExplore ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={15} />
            <span>Analytics Studio</span>
          </button>

          <button
            onClick={() => navigate('/analytics/dashboards')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: isAnalyticsDash ? 700 : 500,
              color: isAnalyticsDash ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isAnalyticsDash ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <LayoutDashboard size={15} />
            <span>Dashboards Studio</span>
          </button>

          {userSession?.user?.role === 'admin' && (
            <button
              onClick={() => navigate('/settings')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isSettings ? 700 : 500,
                color: isSettings ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                backgroundColor: isSettings ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                transition: 'all 0.2s ease',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <SettingsIcon size={15} />
              <span>Settings</span>
            </button>
          )}

          <a
            href="https://ttpa-bonus-program.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.75)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <Gift size={15} />
            <span>Bonus Program</span>
          </a>
        </div>
      </div>

      {/* Right Control Elements: Theme Icon, Vertical Separator, Profile Badge, Logout Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Theme Toggle Icon Button */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            color: 'rgba(255, 255, 255, 0.9)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Vertical Separator */}
        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255, 255, 255, 0.25)', margin: '0 4px' }} />

        {/* Profile Card & Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
              {userName}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rr-gold)', letterSpacing: '0.05em', marginTop: '2px' }}>
              {userRoleLabel}
            </span>
          </div>

          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '12px',
              color: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
            }}
          >
            {userInitials}
          </div>
        </div>

        {/* Sign Out Icon Button */}
        <button
          onClick={onSignOut}
          title="Sign out of platform"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            color: 'rgba(255, 255, 255, 0.9)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginLeft: '4px',
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};

export const AppContent: React.FC = () => {
  // Synchronously restore userSession from localStorage on initial render to preserve F5 state
  const [userSession, setUserSession] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLoginSuccess = (session: any) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    setUserSession(session);
  };

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUserSession(null);
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {userSession && (
        <NavigationHeader
          userSession={userSession}
          onSignOut={handleSignOut}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}

      <main style={{ flex: 1, backgroundColor: 'var(--bg-app)' }}>
        <Routes>
          <Route
            path="/login"
            element={
              userSession ? (
                <Navigate to="/catalog" replace />
              ) : (
                <Login onLoginSuccess={handleLoginSuccess} />
              )
            }
          />
          <Route
            path="/catalog"
            element={userSession ? <DashboardCatalog /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/data-catalog"
            element={userSession ? <DataExplorer /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/analytics/explore"
            element={userSession ? <AnalyticsStudioPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/analytics/dashboards"
            element={userSession ? <AnalyticsDashboardsPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/analytics-kit"
            element={<Navigate to="/analytics/explore" replace />}
          />
          <Route
            path="/analytics-kit/explorar"
            element={<Navigate to="/analytics/explore" replace />}
          />
          <Route
            path="/analytics-kit/dashboards"
            element={<Navigate to="/analytics/dashboards" replace />}
          />
          <Route
            path="/dashboard/:dashboardId"
            element={userSession ? <DashboardViewer /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/settings"
            element={
              userSession ? (
                userSession.user?.role === 'admin' ? (
                  <Settings />
                ) : (
                  <Navigate to="/catalog" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/"
            element={<Navigate to={userSession ? '/catalog' : '/login'} replace />}
          />
          <Route
            path="*"
            element={<Navigate to={userSession ? '/catalog' : '/login'} replace />}
          />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
