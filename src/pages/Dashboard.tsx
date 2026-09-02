import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { KPICard } from '../components/KPICard';
import { FilterBar } from '../components/FilterBar';
import { BarChart } from '../components/Charts/BarChart';
import { DonutChart } from '../components/Charts/DonutChart';
import { HorizontalBarChart } from '../components/Charts/HorizontalBarChart';
import { HeatmapTable } from '../components/Charts/HeatmapTable';
import { DrilldownModal } from '../components/DrilldownModal';
import {
  SubmissionsByDate,
  SubmissionsByRep,
  CallDurationDistribution,
  HeatmapRow,
} from '../types/analytics';
import { Loader2, AlertCircle, PhoneCall, Award, Users, FileText } from 'lucide-react';

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

export const Dashboard: React.FC = () => {
  const defaultRange = getPreviousWeekRange();

  // Filters State
  const [selectedRep, setSelectedRep] = useState('All Representatives');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [selectedForm, setSelectedForm] = useState('All Forms');
  const [formNames, setFormNames] = useState<string[]>([]);

  // Selected KPI & Granularity
  const [selectedKpi, setSelectedKpi] = useState<string>('submissions');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

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

  // KPIs State
  const [kpiMetrics, setKpiMetrics] = useState({
    calls: 0,
    submissions: 0,
    deals: 0,
    students: 0,
    submission_rate: 0,
    deals_rate: 0,
    students_rate: 0,
    avg_talk_time: 0,
    calls_per_rep: 0,
    avg_daily_calls: 0,
    avg_daily_calls_per_rep: 0,
    submissions_per_rep: 0,
    avg_daily_submissions: 0,
    avg_daily_submissions_per_rep: 0,
    students_rate_vs_deals: 0,
  });

  // Charts State
  const [kpiByDate, setKpiByDate] = useState<SubmissionsByDate[]>([]);
  const [kpiByRep, setKpiByRep] = useState<SubmissionsByRep[]>([]);
  const [kpiByForm, setKpiByForm] = useState<{ name: string; submissions: number; deals: number; calls: number }[]>([]);
  const [kpiByWeekday, setKpiByWeekday] = useState<{ name: string; submissions: number; deals: number; calls: number }[]>([]);
  const [kpiByHour, setKpiByHour] = useState<HeatmapRow[]>([]);

  // Calls Extra State
  const [callDuration, setCallDuration] = useState<CallDurationDistribution[]>([]);
  const [avgTalkTimeByRep, setAvgTalkTimeByRep] = useState<{ name: string; value: number }[]>([]);
  const [callsFunnel, setCallsFunnel] = useState({ total_calls: 0, answered_calls: 0, productive_calls: 0 });
  const [studentsByRep, setStudentsByRep] = useState<{ label: string; value: number }[]>([]);

  // Sources State
  const [sourcesData, setSourcesData] = useState<{
    submissions: { label: string; value: number }[];
    deals: { label: string; value: number }[];
    calls: { label: string; value: number }[];
    students: { label: string; value: number }[];
  }>({ submissions: [], deals: [], calls: [], students: [] });

  const [loading, setLoading] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRequestIdRef = React.useRef(0);

  useEffect(() => {
    fetchFormNames();
  }, []);

  // Fetch KPIs only when core filters change (NOT on selectedKpi or granularity changes)
  useEffect(() => {
    const reqId = ++activeRequestIdRef.current;
    fetchDashboardKpis(reqId);
  }, [selectedRep, startDate, endDate, selectedForm]);

  // Fetch Charts when core filters OR chart-specific controls change
  useEffect(() => {
    const reqId = activeRequestIdRef.current;
    fetchDashboardCharts(reqId);
  }, [selectedRep, startDate, endDate, selectedForm, selectedKpi, granularity]);

  const fetchFormNames = async () => {
    try {
      const { data, error } = await supabase.rpc('get_unique_form_names');
      if (!error && data) {
        setFormNames(data as string[]);
      }
    } catch (err) {
      console.error('Error fetching form names:', err);
    }
  };

  const fetchDashboardKpis = async (requestId: number) => {
    setLoadingKpis(true);
    try {
      const { data, error } = await supabase.rpc('get_ttpa_performance_kpis', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_representative: selectedRep,
        p_form_name: selectedForm,
      });

      // Discard stale responses from older filter changes
      if (requestId !== activeRequestIdRef.current) return;

      if (error) {
        console.error('Error fetching KPIs:', error);
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setKpiMetrics(data);
        setErrorMessage(null);
      }
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        console.error('KPIs fetch error:', err);
        setErrorMessage(err.message || 'Error fetching KPIs.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoadingKpis(false);
      }
    }
  };

  const fetchDashboardCharts = async (requestId: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_ttpa_performance_charts', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_representative: selectedRep,
        p_form_name: selectedForm,
        p_kpi_type: selectedKpi,
        p_granularity: granularity,
      });

      // Discard stale responses from older filter changes
      if (requestId !== activeRequestIdRef.current) return;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setKpiByDate(
          (data.kpi_by_date || []).map((d: any) => ({
            date: d.date,
            submissions: d.value,
          }))
        );

        setKpiByRep(
          (data.kpi_by_rep || []).map((r: any) => ({
            name: r.name,
            submissions: r.value,
            deals: 0,
            calls: r.value,
          }))
        );

        setKpiByForm(
          (data.kpi_by_form || []).map((f: any) => ({
            name: f.label,
            submissions: f.value,
            deals: 0,
            calls: f.value,
          }))
        );

        setKpiByWeekday(
          (data.kpi_by_weekday || []).map((w: any) => ({
            name: w.label,
            submissions: w.value,
            deals: 0,
            calls: w.value,
          }))
        );

        setKpiByHour(data.kpi_by_hour || []);
        setCallDuration(data.call_duration_distribution || []);
        setAvgTalkTimeByRep(data.avg_talk_time_by_rep || []);
        setCallsFunnel(data.calls_funnel || { total_calls: 0, answered_calls: 0, productive_calls: 0 });
        setStudentsByRep(data.students_by_rep || []);

        if (data.sources) {
          setSourcesData(data.sources);
        }
      }
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        setErrorMessage(err.message || 'Error fetching chart metrics.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
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

  // Linha 1 general KPI data
  const mainKpis = [
    { id: 'calls', label: 'Calls', value: (kpiMetrics.calls || 0).toLocaleString() },
    { id: 'submissions', label: 'Submissions', value: (kpiMetrics.submissions || 0).toLocaleString() },
    { id: 'deals', label: 'Deals', value: (kpiMetrics.deals || 0).toLocaleString() },
    { id: 'students', label: 'Students', value: (kpiMetrics.students || 0).toLocaleString() },
    { id: 'submission_rate', label: 'Submission Rate', value: `${kpiMetrics.submission_rate || 0}%` },
    { id: 'deals_rate', label: 'Deals Rate', value: `${kpiMetrics.deals_rate || 0}%` },
    { id: 'students_rate', label: 'Students Rate', value: `${kpiMetrics.students_rate || 0}%` },
  ];

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 80, right: 20, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ttpa-blue-primary)', fontWeight: 600, zIndex: 100 }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Refreshing TTPA Dashboard...</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* Filters bar */}
      <FilterBar
        selectedRep={selectedRep}
        setSelectedRep={setSelectedRep}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedForm={selectedForm}
        setSelectedForm={setSelectedForm}
        formNames={formNames}
        onRefresh={() => {
          const reqId = ++activeRequestIdRef.current;
          fetchDashboardKpis(reqId);
          fetchDashboardCharts(reqId);
        }}
        isRefreshing={loading || loadingKpis}
      />

      {/* LINHA 1: Cards */}
      <div
        className="ttpa-kpi-grid"
        style={{
          opacity: loadingKpis ? 0.6 : 1,
          pointerEvents: loadingKpis ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
        {mainKpis.map((kpi) => (
          <KPICard
            key={kpi.id}
            metric={kpi}
            onClick={() => {
              const targetKpi = ['calls', 'submissions', 'deals', 'students'].includes(kpi.id)
                ? kpi.id
                : 'submissions';
              openDrilldown(`Contact Details for ${kpi.label}`, targetKpi);
            }}
          />
        ))}
      </div>

      {/* LINHA 2: Gráficos Seletor de KPI + Granularidade (Dia, Semana, Mês) */}
      <div className="ttpa-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="ttpa-card-title">KPI Historical Over Time</span>
            <select
              value={selectedKpi}
              onChange={(e) => setSelectedKpi(e.target.value)}
              className="ttpa-select"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              <option value="submissions">Submissions</option>
              <option value="calls">Calls</option>
              <option value="deals">Deals</option>
              <option value="students">Students</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Granularity:</span>
            <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              {(['day', 'week', 'month'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: granularity === g ? 'var(--ttpa-blue-primary)' : 'transparent',
                    color: granularity === g ? '#FFFFFF' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <BarChart data={kpiByDate} title={`${selectedKpi.toUpperCase()} Over Time (${granularity})`} />
      </div>

      {/* LINHA 3: 3 Bar Charts lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <HorizontalBarChart
          data={kpiByRep}
          title={`${selectedKpi.toUpperCase()} by Representative`}
          onBarClick={(item) => openDrilldown(`${selectedKpi.toUpperCase()} for ${item.name || item.label}`, selectedKpi, 'representative', item.name || item.label)}
        />
        <HorizontalBarChart
          data={kpiByForm}
          title={`${selectedKpi.toUpperCase()} by Form Name`}
          onBarClick={(item) => openDrilldown(`${selectedKpi.toUpperCase()} for ${item.name || item.label}`, selectedKpi, 'form_name', item.name || item.label)}
        />
        <HorizontalBarChart
          data={kpiByWeekday}
          title={`AVG Daily ${selectedKpi.toUpperCase()} by Weekday`}
          onBarClick={(item) => openDrilldown(`${selectedKpi.toUpperCase()} on ${item.name || item.label}`, selectedKpi)}
        />
      </div>

      {/* LINHA 3.5: Heatmap Table Ocupando 100% da Largura da Tela */}
      <div className="ttpa-card" style={{ width: '100%' }}>
        <HeatmapTable data={kpiByHour} />
      </div>

      {/* LINHA 4: Calls Cards */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PhoneCall size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
          Calls Analytical Section
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Calls Details (Avg Talk Time)', 'calls')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Avg Talk Time (Attended)</span>
            <span className="ttpa-kpi-value">{kpiMetrics.avg_talk_time}s</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Calls Details per Rep', 'calls')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Calls per Active Rep</span>
            <span className="ttpa-kpi-value">{kpiMetrics.calls_per_rep}</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Calls Details (Daily AVG)', 'calls')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">AVG Daily Calls</span>
            <span className="ttpa-kpi-value">{kpiMetrics.avg_daily_calls}</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Calls Details (Daily AVG per Rep)', 'calls')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">AVG Daily Calls per Rep</span>
            <span className="ttpa-kpi-value">{kpiMetrics.avg_daily_calls_per_rep}</span>
          </div>
        </div>
      </div>

      {/* LINHA 5: Gráficos de Chamadas (Convertidos para HorizontalBarChart) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <DonutChart data={callDuration} totalLabel="Calls" totalValue={(kpiMetrics.calls || 0).toLocaleString()} />
        
        <HorizontalBarChart
          data={avgTalkTimeByRep}
          title="AVG Talk Time by Representative"
          valueFormatter={(v) => `${v}s`}
          onBarClick={(item) => openDrilldown(`Calls for ${item.name || item.label}`, 'calls', 'representative', item.name || item.label)}
        />

        <div className="ttpa-card">
          <span className="ttpa-card-title" style={{ display: 'block', marginBottom: '12px' }}>Calls Funnel Conversion</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }} onClick={() => openDrilldown('All Calls', 'calls')}>
              <span>Total Calls:</span>
              <span style={{ fontWeight: 700 }}>{(callsFunnel.total_calls || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }} onClick={() => openDrilldown('Answered Calls', 'calls')}>
              <span>Answered Calls:</span>
              <span style={{ fontWeight: 700, color: 'var(--ttpa-blue-primary)' }}>
                {(callsFunnel.answered_calls || 0).toLocaleString()} ({callsFunnel.total_calls > 0 ? ROUND((callsFunnel.answered_calls / callsFunnel.total_calls) * 100, 1) : 0}%)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }} onClick={() => openDrilldown('Productive Calls (>=30s)', 'calls')}>
              <span>Productive Calls (&gt;=30s):</span>
              <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                {(callsFunnel.productive_calls || 0).toLocaleString()} ({callsFunnel.total_calls > 0 ? ROUND((callsFunnel.productive_calls / callsFunnel.total_calls) * 100, 1) : 0}%)
              </span>
            </div>
          </div>
        </div>

        <HorizontalBarChart
          data={studentsByRep}
          title="Students by Representative"
          barColor="var(--rr-gold)"
          onBarClick={(item) => openDrilldown(`Students for ${item.name || item.label}`, 'students', 'representative', item.name || item.label)}
        />
      </div>

      {/* LINHA 6: Submissions Cards */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
          Submissions Analytical Section
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Submissions Details', 'submissions')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Submissions per Active Rep</span>
            <span className="ttpa-kpi-value">{kpiMetrics.submissions_per_rep}</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Submissions Details (Daily AVG)', 'submissions')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">AVG Daily Submissions</span>
            <span className="ttpa-kpi-value">{kpiMetrics.avg_daily_submissions}</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Submissions Details (Daily AVG per Rep)', 'submissions')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">AVG Daily Submissions per Rep</span>
            <span className="ttpa-kpi-value">{kpiMetrics.avg_daily_submissions_per_rep}</span>
          </div>
        </div>
      </div>

      {/* LINHA 7: Sources (Todos convertidos para HorizontalBarChart) */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
          Performance by Canal/Source
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <HorizontalBarChart
            data={sourcesData.submissions}
            title="Submissions by Source"
            onBarClick={(item) => openDrilldown(`Submissions from ${item.name || item.label}`, 'submissions', 'source', item.name || item.label)}
          />

          <HorizontalBarChart
            data={sourcesData.deals}
            title="Deals by Source"
            barColor="var(--color-success)"
            onBarClick={(item) => openDrilldown(`Deals from ${item.name || item.label}`, 'deals', 'source', item.name || item.label)}
          />

          <HorizontalBarChart
            data={sourcesData.students}
            title="Students by Source"
            barColor="var(--rr-gold)"
            onBarClick={(item) => openDrilldown(`Students from ${item.name || item.label}`, 'students', 'source', item.name || item.label)}
          />
        </div>
      </div>

      {/* LINHA 8: Deals Cards */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Award size={16} style={{ color: 'var(--rr-gold)' }} />
          Deals & Student Conversion Section
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Closed Deals Details', 'deals')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Closed Deals</span>
            <span className="ttpa-kpi-value">{kpiMetrics.deals}</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Enrolled Students Details', 'students')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Enrolled Students</span>
            <span className="ttpa-kpi-value">{kpiMetrics.students}</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Deals Rate Breakdown', 'deals')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Deals Rate (Deals / Submissions)</span>
            <span className="ttpa-kpi-value">{kpiMetrics.deals_rate}%</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Students Rate Breakdown', 'students')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Students Rate (Students / Submissions)</span>
            <span className="ttpa-kpi-value">{kpiMetrics.students_rate}%</span>
          </div>
          <div className="ttpa-kpi-card" onClick={() => openDrilldown('Students vs Deals Breakdown', 'students')} style={{ cursor: 'pointer' }}>
            <span className="ttpa-kpi-label">Students Rate (Students / Deals)</span>
            <span className="ttpa-kpi-value">{kpiMetrics.students_rate_vs_deals}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function ROUND(val: number, precision: number) {
  const p = Math.pow(10, precision);
  return Math.round(val * p) / p;
}
