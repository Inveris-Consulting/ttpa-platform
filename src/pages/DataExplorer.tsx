import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import {
  PhoneCall,
  FileText,
  Briefcase,
  GraduationCap,
  Calendar,
  Search,
  Filter,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCw,
  Clock,
  TrendingUp,
  User,
  Phone,
  Mail,
} from 'lucide-react';

type EntityType = 'calls' | 'submissions' | 'deals' | 'students';

interface SummaryMetrics {
  total_period: number;
  current_week: number;
  last_week: number;
  current_month: number;
  total_records: number;
}

export const DataExplorer: React.FC = () => {
  const [activeEntity, setActiveEntity] = useState<EntityType>('submissions');

  // Date Range State
  const [startDate, setStartDate] = useState<string>('2026-08-10');
  const [endDate, setEndDate] = useState<string>('2026-08-16');

  // Dropdown Filter State
  const [selectedRep, setSelectedRep] = useState<string>('All Representatives');
  const [selectedFormSource, setSelectedFormSource] = useState<string>('All Forms/Sources');

  // Text Input Filter State (Draft state - only applied when Search is clicked)
  const [inputName, setInputName] = useState<string>('');
  const [inputPhone, setInputPhone] = useState<string>('');
  const [inputEmail, setInputEmail] = useState<string>('');

  // Applied Filter State (Passed to RPC)
  const [appliedName, setAppliedName] = useState<string>('');
  const [appliedPhone, setAppliedPhone] = useState<string>('');
  const [appliedEmail, setAppliedEmail] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Dropdown Options
  const [representatives, setRepresentatives] = useState<{ id: string; Representative: string }[]>([]);
  const [formSourceOptions, setFormSourceOptions] = useState<string[]>([]);

  // Data & KPI State
  const [summary, setSummary] = useState<SummaryMetrics>({
    total_period: 0,
    current_week: 0,
    last_week: 0,
    current_month: 0,
    total_records: 0,
  });
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    setPage(1); // Reset page on entity change
    fetchDataExplorer();
  }, [activeEntity, page, pageSize, startDate, endDate, selectedRep, selectedFormSource, appliedName, appliedPhone, appliedEmail]);

  const fetchDropdownOptions = async () => {
    try {
      const { data: repData } = await supabase
        .from('dRepresentatives')
        .select('id, Representative')
        .order('Representative');
      if (repData) setRepresentatives(repData);

      const { data: formsData } = await supabase.rpc('get_unique_form_names');
      if (formsData) setFormSourceOptions(formsData as string[]);
    } catch (err) {
      console.error('Error loading dropdown options:', err);
    }
  };

  const fetchDataExplorer = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_data_catalog_explorer', {
        p_entity: activeEntity,
        p_start_date: startDate,
        p_end_date: endDate,
        p_representative: selectedRep,
        p_form_source: selectedFormSource,
        p_search_name: appliedName,
        p_search_phone: appliedPhone,
        p_search_email: appliedEmail,
        p_page: page,
        p_page_size: pageSize,
      });

      if (error) {
        console.error('Data Catalog RPC error:', error);
        return;
      }

      if (data) {
        setSummary(data.summary || {
          total_period: 0,
          current_week: 0,
          last_week: 0,
          current_month: 0,
          total_records: 0,
        });
        setTableRows(data.rows || []);
      }
    } catch (err) {
      console.error('Data Catalog fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedName(inputName.trim());
    setAppliedPhone(inputPhone.trim());
    setAppliedEmail(inputEmail.trim());
  };

  const totalPages = Math.max(Math.ceil((summary.total_records || 0) / pageSize), 1);

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Badge variant="gold" icon={<DatabaseIcon size={12} />}>
              Data Explorer & Catalog
            </Badge>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '8px 0 4px 0', color: '#FFFFFF' }}>
              Operational Data Catalog
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
              Access raw records for Calls, Submissions, Deals, and Enrolled Students with custom text search and comparative period analytics.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchDataExplorer}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <RotateCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Entity Selector Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveEntity('submissions')}
          className="ttpa-btn"
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '14px',
            backgroundColor: activeEntity === 'submissions' ? 'var(--ttpa-blue-primary)' : 'var(--bg-surface)',
            color: activeEntity === 'submissions' ? '#FFFFFF' : 'var(--text-primary)',
            border: `1px solid ${activeEntity === 'submissions' ? 'var(--ttpa-blue-primary)' : 'var(--border-medium)'}`,
            boxShadow: activeEntity === 'submissions' ? '0 4px 12px var(--ttpa-blue-glow)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <FileText size={16} />
          Submissions
        </button>

        <button
          onClick={() => setActiveEntity('calls')}
          className="ttpa-btn"
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '14px',
            backgroundColor: activeEntity === 'calls' ? 'var(--ttpa-blue-primary)' : 'var(--bg-surface)',
            color: activeEntity === 'calls' ? '#FFFFFF' : 'var(--text-primary)',
            border: `1px solid ${activeEntity === 'calls' ? 'var(--ttpa-blue-primary)' : 'var(--border-medium)'}`,
            boxShadow: activeEntity === 'calls' ? '0 4px 12px var(--ttpa-blue-glow)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <PhoneCall size={16} />
          Calls
        </button>

        <button
          onClick={() => setActiveEntity('deals')}
          className="ttpa-btn"
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '14px',
            backgroundColor: activeEntity === 'deals' ? 'var(--ttpa-blue-primary)' : 'var(--bg-surface)',
            color: activeEntity === 'deals' ? '#FFFFFF' : 'var(--text-primary)',
            border: `1px solid ${activeEntity === 'deals' ? 'var(--ttpa-blue-primary)' : 'var(--border-medium)'}`,
            boxShadow: activeEntity === 'deals' ? '0 4px 12px var(--ttpa-blue-glow)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Briefcase size={16} />
          Deals
        </button>

        <button
          onClick={() => setActiveEntity('students')}
          className="ttpa-btn"
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '14px',
            backgroundColor: activeEntity === 'students' ? 'var(--ttpa-blue-primary)' : 'var(--bg-surface)',
            color: activeEntity === 'students' ? '#FFFFFF' : 'var(--text-primary)',
            border: `1px solid ${activeEntity === 'students' ? 'var(--ttpa-blue-primary)' : 'var(--border-medium)'}`,
            boxShadow: activeEntity === 'students' ? '0 4px 12px var(--ttpa-blue-glow)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <GraduationCap size={16} />
          Students / Alunos
        </button>
      </div>

      {/* Filter Bar with Text Inputs and Manual Search Button (PLACED BEFORE THE SUMMARY CARDS) */}
      <form onSubmit={handleApplySearch} className="ttpa-card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
            Filter & Search Criteria
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Text input filters require clicking <strong>Search</strong> to execute.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          {/* Representative Filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Representative:
            </label>
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="ttpa-select"
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
            >
              <option value="All Representatives">All Representatives</option>
              {representatives.map((r) => (
                <option key={r.id} value={r.Representative}>
                  {r.Representative}
                </option>
              ))}
            </select>
          </div>

          {/* Form / Source Filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Form / Source:
            </label>
            <select
              value={selectedFormSource}
              onChange={(e) => setSelectedFormSource(e.target.value)}
              className="ttpa-select"
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
            >
              <option value="All Forms/Sources">All Forms / Sources</option>
              {formSourceOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Start Date:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Date Range End */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              End Date:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Text Inputs for Name, Phone, Email + Search Button */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Filter by Name:
            </label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--slate-400)' }} />
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="e.g. John Doe"
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Filter by Phone:
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--slate-400)' }} />
              <input
                type="text"
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                placeholder="e.g. 555-0199"
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Filter by Email:
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--slate-400)' }} />
              <input
                type="text"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="e.g. user@gmail.com"
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <Button type="submit" variant="primary" size="md" icon={<Search size={14} />} style={{ width: '100%', height: '36px' }}>
              Search
            </Button>
          </div>
        </div>
      </form>

      {/* 4 Summary Comparative Cards (PLACED AFTER THE FILTERS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="ttpa-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--ttpa-blue-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <span>Total in Period</span>
            <Calendar size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            {summary.total_period.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Selected Date Range
          </div>
        </div>

        <div className="ttpa-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <span>Current Week</span>
            <TrendingUp size={16} style={{ color: '#10B981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            {summary.current_week.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            This Week (Mon-Today)
          </div>
        </div>

        <div className="ttpa-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <span>Last Week</span>
            <Clock size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            {summary.last_week.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Previous Calendar Week
          </div>
        </div>

        <div className="ttpa-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <span>Current Month</span>
            <Calendar size={16} style={{ color: '#8B5CF6' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            {summary.current_month.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            This Calendar Month
          </div>
        </div>
      </div>

      {/* Main Paginated Data Table */}
      <div className="ttpa-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {activeEntity === 'calls' && 'Calls Log'}
            {activeEntity === 'submissions' && 'Submissions Log'}
            {activeEntity === 'deals' && 'Deals Log'}
            {activeEntity === 'students' && 'Students / Alunos Enrolled Log'}{' '}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
              ({summary.total_records.toLocaleString()} records found)
            </span>
          </h3>

          {/* Page Size Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="ttpa-select"
              style={{ padding: '4px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ttpa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Date / Time</th>
                <th style={{ padding: '10px' }}>Name / Lead</th>
                <th style={{ padding: '10px' }}>Contact Phone</th>
                <th style={{ padding: '10px' }}>Email</th>
                <th style={{ padding: '10px' }}>Representative</th>

                {activeEntity === 'calls' && <th style={{ padding: '10px', textAlign: 'center' }}>Duration</th>}
                {activeEntity === 'calls' && <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>}

                {activeEntity === 'submissions' && <th style={{ padding: '10px' }}>Form Name</th>}
                {activeEntity === 'submissions' && <th style={{ padding: '10px' }}>Source</th>}

                {(activeEntity === 'deals' || activeEntity === 'students') && <th style={{ padding: '10px' }}>Stage</th>}
                {(activeEntity === 'deals' || activeEntity === 'students') && <th style={{ padding: '10px' }}>Source</th>}

                <th style={{ padding: '10px', textAlign: 'center' }}>CRM Profile</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading data catalog records...
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No records found matching current search criteria.
                  </td>
                </tr>
              ) : (
                tableRows.map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.date}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.time}</div>
                    </td>

                    <td style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {row.name || '—'}
                    </td>

                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {row.phone || '—'}
                    </td>

                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {row.email || '—'}
                    </td>

                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {row.representative || 'Unassigned'}
                    </td>

                    {/* Entity Specific Columns */}
                    {activeEntity === 'calls' && (
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600 }}>
                        {row.duration}s
                      </td>
                    )}

                    {activeEntity === 'calls' && (
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <Badge variant={row.answered ? 'success' : 'navy'}>
                          {row.answered ? 'Answered' : 'No Answer'}
                        </Badge>
                      </td>
                    )}

                    {activeEntity === 'submissions' && (
                      <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                        {row.form_name || '—'}
                      </td>
                    )}

                    {activeEntity === 'submissions' && (
                      <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                        {row.source || '—'}
                      </td>
                    )}

                    {(activeEntity === 'deals' || activeEntity === 'students') && (
                      <td style={{ padding: '12px 10px' }}>
                        <Badge variant={activeEntity === 'students' ? 'gold' : 'blue'}>
                          {row.stage || 'Active'}
                        </Badge>
                      </td>
                    )}

                    {(activeEntity === 'deals' || activeEntity === 'students') && (
                      <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                        {row.source || '—'}
                      </td>
                    )}

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
                            textDecoration: 'none',
                            fontSize: '12px',
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

        {/* Pagination Footer Bar */}
        {summary.total_records > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              marginTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Showing {Math.min((page - 1) * pageSize + 1, summary.total_records)} to {Math.min(page * pageSize, summary.total_records)} of {summary.total_records.toLocaleString()} records
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="ttpa-btn ttpa-btn-outline ttpa-btn-sm"
                style={{ opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', padding: '0 8px' }}>
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="ttpa-btn ttpa-btn-outline ttpa-btn-sm"
                style={{ opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
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

const DatabaseIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

export default DataExplorer;
