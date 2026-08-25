import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardsFromSupabase, DashboardItem, DEFAULT_DASHBOARDS } from '../lib/powerbiStore';
import { Badge } from '../components/Badge';
import { ExternalLink, Search, Sparkles, Loader2 } from 'lucide-react';

export const DashboardCatalog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboards, setDashboards] = useState<DashboardItem[]>(DEFAULT_DASHBOARDS);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
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
      console.error('Error loading catalog dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDashboards = dashboards.filter(
    (d) =>
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Banner */}
      <div
        className="ttpa-card"
        style={{
          background: 'linear-gradient(135deg, var(--rr-navy-deep) 0%, var(--rr-navy-header) 100%)',
          color: '#FFFFFF',
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <Badge variant="gold" icon={<Sparkles size={12} />}>
              R&R Report Catalog
            </Badge>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '8px 0 4px 0', color: '#FFFFFF' }}>
              Analytical Dashboard Catalog
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
              Access native dashboards, embedded Power BI reports, and custom Analytics Kit dashboards.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/analytics/explore')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Sparkles size={14} />
              <span>Explore Analytics</span>
            </button>
            <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'rgba(255,255,255,0.6)' }} />
              <input
                type="text"
                placeholder="Search dashboards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  outline: 'none',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px', gap: '8px', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="animate-spin" />
          <span>Loading authorized dashboards...</span>
        </div>
      ) : (
        /* Grid of Clickable Dashboard Cards */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-5)' }}>
          {filteredDashboards.map((dash) => (
            <div
              key={dash.id}
              className="ttpa-card ttpa-card-interactive"
              onClick={() => navigate(`/dashboard/${dash.id}`)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '240px',
                padding: 'var(--space-5)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <Badge variant={dash.type === 'native' ? 'blue' : dash.type === 'powerbi' ? 'gold' : 'success'}>
                    {dash.type === 'native' ? 'Native Dashboard' : dash.type === 'powerbi' ? 'Power BI' : 'Analytics Kit'}
                  </Badge>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dash.category}</span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {dash.title}
                </h3>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {dash.description}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Added on: {dash.createdAt}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ttpa-blue-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Open Dashboard
                  <ExternalLink size={14} />
                </span>
              </div>
            </div>
          ))}

          {filteredDashboards.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No dashboards available or matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
