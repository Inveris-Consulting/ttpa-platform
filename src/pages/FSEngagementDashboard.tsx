import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { KPICard } from '../components/KPICard';
import { BarChart } from '../components/Charts/BarChart';
import { DonutChart } from '../components/Charts/DonutChart';
import { DrilldownModal } from '../components/DrilldownModal';
import { CallDurationDistribution } from '../types/analytics';
import { Loader2, AlertCircle, Calendar, Filter, FileText, ExternalLink, ChevronLeft, ChevronRight, RotateCw, Clock } from 'lucide-react';

interface FSLeadRow {
  lead_name: string;
  submission_date: string;
  ttpa_representative: string;
  fs_call_count: number;
  crm_url: string;
}

const getPreviousWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const distanceToLastMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7;
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - distanceToLastMonday);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  return {
    startDate: formatDate(lastMonday),
    endDate: formatDate(lastSunday),
  };
};

export const FSEngagementDashboard: React.FC = () => {
  const defaultRange = getPreviousWeekRange();
  
  // Filters State
  const [selectedRep, setSelectedRep] = useState('All Representatives');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [selectedForm, setSelectedForm] = useState('All Forms');
  const [tableFilter, setTableFilter] = useState<'uncalled' | 'one_call'>('uncalled');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Options lists
  const [fsRepresentatives, setFsRepresentatives] = useState<string[]>([]);
  const [formNames, setFormNames] = useState<string[]>([]);

  // Drilldown Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    kpiType: string;
    filterDimension?: string;
    filterValue?: string;
  }>({
    isOpen: false,
    title: '',
    kpiType: 'submissions',
  });

  // Analytics State
  const [kpis, setKpis] = useState({
    calls: 0,
    calls_per_lead: 0,
    leads: 0,
    deals: 0,
    students: 0,
    leads_uncalled: 0,
    leads_one_call: 0,
  });
  const [callDuration, setCallDuration] = useState<CallDurationDistribution[]>([]);
  const [callsByDate, setCallsByDate] = useState<{ date: string; submissions: number }[]>([]);
  const [callsByRep, setCallsByRep] = useState<{ name: string; submissions: number; deals: number; calls: number }[]>([]);
  const [leadsTable, setLeadsTable] = useState<FSLeadRow[]>([]);

  // UI state
  const [ignoreShortCalls, setIgnoreShortCalls] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset pagination on filter change
    fetchFSEngagementAnalytics();
  }, [selectedRep, startDate, endDate, selectedForm, tableFilter, ignoreShortCalls]);

  const fetchFilterOptions = async () => {
    try {
      const { data: repsData } = await supabase
        .from('dRepresentatives')
        .select('Representative')
        .eq('Type', 'FS Team')
        .order('Representative', { ascending: true });
      
      if (repsData) {
        setFsRepresentatives(repsData.map((r) => r.Representative));
      }

      const { data: formsData, error: formsError } = await supabase.rpc('get_unique_form_names');

      if (!formsError && formsData) {
        setFormNames(formsData as string[]);
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchFSEngagementAnalytics = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.rpc('get_fs_engagement_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_representative: selectedRep,
        p_form_name: selectedForm,
        p_table_filter: tableFilter,
        p_min_duration: ignoreShortCalls ? 60 : 0,
      });

      if (error) {
        console.error('FS Analytics RPC Error:', error);
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setKpis(data.kpis || {
          calls: 0,
          calls_per_lead: 0,
          leads: 0,
          deals: 0,
          students: 0,
          leads_uncalled: 0,
          leads_one_call: 0,
        });
        setCallDuration(data.call_duration_distribution || []);
        
        if (data.calls_by_date) {
          setCallsByDate(data.calls_by_date.map((d: any) => ({
            date: d.date,
            submissions: d.value,
          })));
        } else {
          setCallsByDate([]);
        }

        if (data.calls_by_rep) {
          setCallsByRep(data.calls_by_rep.map((r: any) => ({
            name: r.name,
            submissions: r.value,
            deals: 0,
            calls: r.value,
          })));
        } else {
          setCallsByRep([]);
        }

        setLeadsTable(data.leads_table || []);
      }
    } catch (err: any) {
      console.error('Error querying FS analytics:', err);
      setErrorMessage(err.message || 'Error fetching FS Team metrics.');
    } finally {
      setLoading(false);
    }
  };

  const openDrilldown = (
    title: string,
    kpiType: string,
    filterDimension?: string,
    filterValue?: string
  ) => {
    setModalState({
      isOpen: true,
      title,
      kpiType,
      filterDimension,
      filterValue,
    });
  };

  const kpiData = [
    { id: 'calls', label: 'FS Calls', value: kpis.calls.toLocaleString(), subtext: 'FS Team Calls' },
    { id: 'calls_per_lead', label: 'Calls per Lead', value: kpis.calls_per_lead.toString(), subtext: 'Total Calls / Leads' },
    { id: 'leads', label: 'Total Leads', value: kpis.leads.toLocaleString(), subtext: 'Submissions Received' },
    { id: 'deals', label: 'Closed Deals', value: kpis.deals.toLocaleString(), subtext: 'Total Closed Opportunities' },
    { id: 'students', label: 'Students', value: kpis.students.toLocaleString(), subtext: 'Enrolled Students' },
    { id: 'leads_uncalled', label: 'Uncalled Leads', value: kpis.leads_uncalled.toLocaleString(), subtext: 'Leads with 0 calls', trend: { value: 'Critical Alert', isUp: false } },
  ];

  // Pagination Math
  const totalPages = Math.ceil(leadsTable.length / pageSize) || 1;
  const currentLeads = leadsTable.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: '1600px', margin: '0 auto', position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--ttpa-blue-primary)',
            fontWeight: 600,
            zIndex: 10,
          }}
        >
          <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading FS Team metrics...</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: 'var(--space-4)',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Drilldown Modal */}
      <DrilldownModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        startDate={startDate}
        endDate={endDate}
        selectedRep={selectedRep}
        selectedForm={selectedForm}
        kpiType={modalState.kpiType}
        filterDimension={modalState.filterDimension}
        filterValue={modalState.filterValue}
      />

      {/* Filter Bar */}
      <div className="ttpa-filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <div className="ttpa-filter-control">
          <Filter size={14} style={{ color: 'var(--slate-500)' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>FS Representative:</span>
          <select
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="ttpa-select"
          >
            <option value="All Representatives">All FS Representatives</option>
            {fsRepresentatives.map((rep) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
        </div>

        <div className="ttpa-filter-control">
          <FileText size={14} style={{ color: 'var(--slate-500)' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Form:</span>
          <select
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value)}
            className="ttpa-select"
            style={{ maxWidth: '240px' }}
          >
            <option value="All Forms">All Forms</option>
            {formNames.map((form) => (
              <option key={form} value={form}>
                {form}
              </option>
            ))}
          </select>
        </div>

        <div className="ttpa-date-pill">
          <Calendar size={14} style={{ color: 'var(--ttpa-blue-primary)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            <span>–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchFSEngagementAnalytics}
          disabled={loading}
          className="ttpa-btn ttpa-btn-primary ttpa-btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginLeft: 'auto',
          }}
        >
          <RotateCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* KPI Card grid */}
      <div className="ttpa-kpi-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {kpiData.map((kpi) => (
          <KPICard
            key={kpi.id}
            metric={kpi}
            onClick={() => {
              const targetKpi = kpi.id === 'calls' || kpi.id === 'calls_per_lead'
                ? 'calls'
                : kpi.id === 'deals'
                ? 'deals'
                : kpi.id === 'students'
                ? 'students'
                : 'submissions';
              openDrilldown(`Contact Details for ${kpi.label}`, targetKpi);
            }}
          />
        ))}
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <DonutChart data={callDuration} totalLabel="Calls" totalValue={kpis.calls.toLocaleString()} />
        <BarChart data={callsByDate} title="FS Calls by Date" />
      </div>

      {/* Tabela de Leads com Botoes de Filtro de Alto Contraste e Paginacao */}
      <div className="ttpa-card">
        <div 
          className="ttpa-card-header" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ttpa-card-title">FS Team Leads Follow-up</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ({leadsTable.length} leads)
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Flag: Exclude Calls < 1 minute */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: ignoreShortCalls ? 'var(--blue-50)' : 'var(--slate-50)',
                border: `1px solid ${ignoreShortCalls ? 'var(--ttpa-blue-primary)' : 'var(--slate-200)'}`,
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: ignoreShortCalls ? 'var(--ttpa-blue-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.2s ease',
              }}
              title="Consider only calls with duration >= 1 minute"
            >
              <Clock size={14} style={{ color: ignoreShortCalls ? 'var(--ttpa-blue-primary)' : 'var(--slate-500)' }} />
              <input
                type="checkbox"
                checked={ignoreShortCalls}
                onChange={(e) => setIgnoreShortCalls(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--ttpa-blue-primary)' }}
              />
              <span>Ignore Calls &lt; 1 min</span>
            </label>

            {/* Contrast-enhanced Filter Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setTableFilter('uncalled')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: tableFilter === 'uncalled' ? 'var(--ttpa-blue-primary)' : 'var(--bg-surface-elevated)',
                  color: tableFilter === 'uncalled' ? '#FFFFFF' : 'var(--text-primary)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                Leads with 0 Calls ({kpis.leads_uncalled})
              </button>
              
              <button
                onClick={() => setTableFilter('one_call')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: tableFilter === 'one_call' ? 'var(--ttpa-blue-primary)' : 'var(--bg-surface-elevated)',
                  color: tableFilter === 'one_call' ? '#FFFFFF' : 'var(--text-primary)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                Leads with 1 Call (No Deal) ({kpis.leads_one_call})
              </button>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ttpa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Lead Name</th>
                <th style={{ padding: '10px' }}>Submission Date</th>
                <th style={{ padding: '10px' }}>TTPA Representative</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>FS Calls Count</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>CRM Profile</th>
              </tr>
            </thead>
            <tbody>
              {currentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leads found matching current filters.
                  </td>
                </tr>
              ) : (
                currentLeads.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.lead_name}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{row.submission_date}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{row.ttpa_representative}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span className="ttpa-tag" style={{ background: row.fs_call_count === 0 ? 'var(--color-danger-bg)' : 'var(--color-info-bg)', color: row.fs_call_count === 0 ? 'var(--color-danger)' : 'var(--ttpa-blue-primary)', fontWeight: 700 }}>
                        {row.fs_call_count} calls
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {row.crm_url ? (
                        <a
                          href={row.crm_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--ttpa-blue-primary)',
                            fontWeight: 700,
                            textDecoration: 'none'
                          }}
                        >
                          CRM Profile
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (20 items per page) */}
        {leadsTable.length > pageSize && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              marginTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Showing {Math.min((currentPage - 1) * pageSize + 1, leadsTable.length)} to {Math.min(currentPage * pageSize, leadsTable.length)} of {leadsTable.length} leads
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="ttpa-btn ttpa-btn-outline ttpa-btn-sm"
                style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', padding: '0 8px' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ttpa-btn ttpa-btn-outline ttpa-btn-sm"
                style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
