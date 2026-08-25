import React from 'react';
import { Sun, Moon, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentView: 'catalog' | 'viewer' | 'settings';
  setCurrentView: (view: 'catalog' | 'viewer' | 'settings') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  theme,
  toggleTheme,
}) => {
  return (
    <header className="ttpa-header">
      <div className="ttpa-brand" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('catalog')}>
        <img 
          src="/assets/rr_logo_white.webp" 
          alt="R&R Rent & Recruit Logo" 
          className="ttpa-brand-logo"
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="ttpa-brand-title">
            TTPA Dashboard
            <span className="ttpa-brand-badge">R&R Division</span>
          </div>
        </div>
      </div>

      <div className="ttpa-header-controls">
        <button
          onClick={toggleTheme}
          className="ttpa-btn ttpa-btn-outline-navy ttpa-btn-sm"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
};
