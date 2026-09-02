import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchDashboardsFromSupabase, DashboardItem, DEFAULT_DASHBOARDS } from '../lib/powerbiStore';
import { Dashboard as NativeDashboard } from './Dashboard';
import { FSEngagementDashboard } from './FSEngagementDashboard';
import { TTPABonusDashboard } from './TTPABonusDashboard';
import {
  ChartRenderer,
  createSupabaseRepository,
  createSupabaseRpcAdapter,
  KitDashboard,
  SavedKitChart,
  AnalyticsRow,
} from '../components/analytics-kit';
import { ttpaAnalyticsModel } from '../lib/analyticsModel';
import { Button } from '../components/Button';
import { ArrowLeft, ExternalLink, Loader2, Edit3 } from 'lucide-react';

const analyticsAdapter = createSupabaseRpcAdapter({
  client: supabase,
  functionName: 'analytics_query',
  distinctFunctionName: 'analytics_distinct_values',
  model: ttpaAnalyticsModel,
});

const repository = createSupabaseRepository(supabase);

function KitChartWidget({ chart }: { chart: SavedKitChart }) {
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    analyticsAdapter
      .execute(chart.query, controller.signal)
      .then((data) => {
        setRows(data);
        setError('');
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [chart]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="ak-empty">{error}</div>;
  }

  return (
    <ChartRenderer
      rows={rows}
      query={chart.query}
      config={chart.visualization}
      model={ttpaAnalyticsModel}
      locale="pt-BR"
    />
  );
}

function KitDashboardContent({ dashboardId }: { dashboardId: string }) {
  const [kitDashboard, setKitDashboard] = useState<KitDashboard | null>(null);
  const [charts, setCharts] = useState<SavedKitChart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([repository.listDashboards(), repository.listCharts()])
      .then(([allDashboards, allCharts]) => {
        const found = allDashboards.find((d) => d.id === dashboardId);
        setKitDashboard(found || null);
        setCharts(allCharts);
      })
      .finally(() => setLoading(false));
  }, [dashboardId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '8px', color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="animate-spin" />
        <span>Carregando widgets do dashboard...</span>
      </div>
    );
  }

  if (!kitDashboard) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Dashboard do Analytics Kit não encontrado ou sem permissão de acesso.
      </div>
    );
  }

  if (!kitDashboard.items.length) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Este dashboard ainda não possui widgets configurados.
      </div>
    );
  }

  return (
    <div className="analytics-kit" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      <section className="ak-grid" style={{ minHeight: '600px' }}>
        {kitDashboard.items.map((item) => {
          const chart = item.type === 'chart' ? charts.find((c) => c.id === item.chartId) : null;
          return (
            <article
              key={item.id}
              className="ak-widget"
              style={{
                gridColumn: `${item.position.x + 1} / span ${item.position.w}`,
                gridRow: `${item.position.y + 1} / span ${item.position.h}`,
              }}
            >
              <header>
                <b>{item.type === 'chart' ? chart?.name ?? 'Gráfico' : item.title}</b>
              </header>
              <div>
                {item.type === 'chart' && chart && <KitChartWidget chart={chart} />}
                {item.type === 'text' && <p style={{ padding: '12px', fontSize: '14px', lineHeight: 1.5 }}>{item.content}</p>}
                {item.type === 'image' && <img src={item.url} alt={item.alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
                {item.type === 'iframe' && <iframe src={item.url} title={item.title} style={{ width: '100%', height: '100%', border: 'none' }} />}
                {item.type === 'ai' && <p style={{ padding: '12px', fontStyle: 'italic' }}>{item.prompt}</p>}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

export const DashboardViewer: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();

  const [dashboards, setDashboards] = useState<DashboardItem[]>(DEFAULT_DASHBOARDS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboards();
  }, [dashboardId]);

  const loadDashboards = async () => {
    setLoading(true);
    try {
      const savedSession = localStorage.getItem('ttpa_user_session');
      let userId: string | undefined;
      let userRole: string | undefined;

      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        userId = parsed?.user?.id;
        userRole = parsed?.user?.role;
      }

      const list = await fetchDashboardsFromSupabase(userId, userRole);
      setDashboards(list);
    } catch (err) {
      console.error('Error fetching dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  const dashboard = dashboards.find((d) => d.id === dashboardId) || dashboards[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Top Sub-Bar with Back Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/catalog')}>
            Back to Catalog
          </Button>
          <span style={{ color: 'var(--border-medium)' }}>|</span>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {dashboard ? dashboard.title : 'Loading...'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {dashboard?.type === 'analytics_kit' && (
            <Button
              variant="outline"
              size="sm"
              icon={<Edit3 size={14} />}
              onClick={() => navigate('/analytics/dashboards')}
            >
              Editar no Studio
            </Button>
          )}

          {dashboard && dashboard.type === 'powerbi' && dashboard.iframeUrl && (
            <a
              href={dashboard.iframeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ttpa-blue-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Open in Power BI Service
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        ) : dashboardId === 'ttpa-bonus' ? (
          <TTPABonusDashboard />
        ) : dashboardId === 'fs-engagement' ? (
          <FSEngagementDashboard />
        ) : dashboardId === 'ttpa-team-performance' || dashboard?.type === 'native' ? (
          <NativeDashboard />
        ) : dashboard?.type === 'analytics_kit' ? (
          <KitDashboardContent dashboardId={dashboardId!} />
        ) : (
          <iframe
            src={dashboard?.iframeUrl}
            title={dashboard?.title || 'Power BI Report'}
            style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 120px)', border: 'none', display: 'block' }}
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
};
export default DashboardViewer;
