import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  DashboardStudio,
  createSupabaseRepository,
  createSupabaseRpcAdapter,
  AnalyticsUser,
} from '../components/analytics-kit';
import { ttpaAnalyticsModel } from '../lib/analyticsModel';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const analyticsAdapter = createSupabaseRpcAdapter({
  client: supabase,
  functionName: 'analytics_query',
  distinctFunctionName: 'analytics_distinct_values',
  model: ttpaAnalyticsModel,
});

const repository = createSupabaseRepository(supabase);

export const AnalyticsDashboardsPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AnalyticsUser>({
    id: 'system',
    name: 'Admin User',
    role: 'admin',
  });
  const [usersList, setUsersList] = useState<AnalyticsUser[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ttpa_user_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user) {
          setCurrentUser({
            id: parsed.user.id || 'system',
            name: parsed.user.name || parsed.user.email?.split('@')[0] || 'User',
            email: parsed.user.email,
            role: parsed.user.role || 'user',
          });
        }
      }
    } catch (e) {
      console.error(e);
    }

    // Load users for permissions manager
    supabase
      .from('users')
      .select('id, name, role')
      .then(({ data }) => {
        if (data) {
          setUsersList(
            data.map((u) => ({
              id: u.id,
              name: u.name || 'User',
              role: u.role || 'user',
            }))
          );
        }
      });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Sub-header navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutDashboard size={16} color="var(--rr-gold)" />
          <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Dashboard Studio
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            · Dashboard & Grid Layout Builder
          </span>
        </div>

        <button
          onClick={() => navigate('/analytics/explore')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={14} />
          <span>Create New Charts / Analyses</span>
        </button>
      </div>

      {/* Main Dashboard Builder View */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DashboardStudio
          adapter={analyticsAdapter}
          repository={repository}
          locale="en-US"
          users={usersList}
          access={{
            currentUser,
            adminRoles: ['admin'],
          }}
        />
      </div>
    </div>
  );
};
export default AnalyticsDashboardsPage;
