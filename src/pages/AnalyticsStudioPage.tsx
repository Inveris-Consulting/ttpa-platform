import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  AnalyticsStudio,
  createSupabaseRepository,
  createSupabaseRpcAdapter,
} from '../components/analytics-kit';
import { ttpaAnalyticsModel } from '../lib/analyticsModel';
import { Sparkles, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const analyticsAdapter = createSupabaseRpcAdapter({
  client: supabase,
  functionName: 'analytics_query',
  distinctFunctionName: 'analytics_distinct_values',
  model: ttpaAnalyticsModel,
});

const repository = createSupabaseRepository(supabase);

export const AnalyticsStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const [ownerId, setOwnerId] = useState<string>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ttpa_user_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.id) setOwnerId(parsed.user.id);
      }
    } catch (e) {
      console.error(e);
    }
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
          <Sparkles size={16} color="var(--rr-gold)" />
          <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Analytics Studio
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            · Visual Chart & Analysis Builder
          </span>
        </div>

        <button
          onClick={() => navigate('/analytics/dashboards')}
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
          <LayoutDashboard size={14} />
          <span>Go to Dashboard Builder</span>
        </button>
      </div>

      {/* Main Studio View */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AnalyticsStudio
          adapter={analyticsAdapter}
          repository={repository}
          ownerId={ownerId}
          locale="en-US"
          currency="USD"
        />
      </div>
    </div>
  );
};
export default AnalyticsStudioPage;
