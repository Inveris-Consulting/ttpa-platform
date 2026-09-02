import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, ExternalLink, Loader2, UserCheck, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DrilldownRow {
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  rep_name: string;
  form_name: string;
  source: string;
  date: string;
  kpi: string;
  crm_url: string | null;
}

type SortField = keyof DrilldownRow;
type SortDirection = 'asc' | 'desc';

const parseDateValue = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  }
  const t = new Date(trimmed).getTime();
  return isNaN(t) ? 0 : t;
};

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  startDate: string;
  endDate: string;
  selectedRep: string;
  selectedForm: string;
  kpiType: string;
  filterDimension?: string;
  filterValue?: string;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({
  isOpen,
  onClose,
  title,
  startDate,
  endDate,
  selectedRep,
  selectedForm,
  kpiType,
  filterDimension,
  filterValue,
}) => {
  const [rows, setRows] = useState<DrilldownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  useEffect(() => {
    if (isOpen) {
      fetchDrilldownDetails();
    }
  }, [isOpen, startDate, endDate, selectedRep, selectedForm, kpiType, filterDimension, filterValue]);

  // Reset pagination to first page when search, sort, or records change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection, rows.length]);

  const fetchDrilldownDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_kpi_drilldown_details', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_representative: selectedRep,
        p_form_name: selectedForm,
        p_kpi_type: kpiType,
        p_filter_dimension: filterDimension || null,
        p_filter_value: filterValue || null,
      });

      if (rpcError) {
        console.error('Drilldown RPC error:', rpcError);
        setError(rpcError.message);
      } else {
        setRows(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching drilldown details:', err);
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (!isOpen) return null;

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.toLowerCase();
    return (
      (row.contact_name && row.contact_name.toLowerCase().includes(q)) ||
      (row.contact_email && row.contact_email.toLowerCase().includes(q)) ||
      (row.contact_phone && row.contact_phone.toLowerCase().includes(q)) ||
      (row.rep_name && row.rep_name.toLowerCase().includes(q)) ||
      (row.form_name && row.form_name.toLowerCase().includes(q)) ||
      (row.source && row.source.toLowerCase().includes(q))
    );
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'date') {
      const timeA = parseDateValue(a.date);
      const timeB = parseDateValue(b.date);
      comparison = timeA - timeB;
    } else {
      const valA = (a[sortField] ?? '').toString().trim();
      const valB = (b[sortField] ?? '').toString().trim();
      comparison = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.max(Math.ceil(sortedRows.length / pageSize), 1);
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderSortableHeader = (field: SortField, label: string, align: 'left' | 'center' = 'left') => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: align,
          color: isActive ? 'var(--ttpa-blue-primary)' : 'var(--text-secondary)',
          fontWeight: isActive ? 700 : 600,
          whiteSpace: 'nowrap',
          transition: 'color 0.15s ease',
        }}
        title={`Ordenar por ${label} (${isActive && sortDirection === 'asc' ? 'Z-A ou Maior' : 'A-Z ou Menor'})`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp size={14} style={{ color: 'var(--ttpa-blue-primary)' }} />
            ) : (
              <ArrowDown size={14} style={{ color: 'var(--ttpa-blue-primary)' }} />
            )
          ) : (
            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
          )}
        </div>
      </th>
    );
  };

  const handleExportCSV = () => {
    if (sortedRows.length === 0) return;

    const headers = [
      'Contact Name',
      'Email',
      'Phone',
      'Representative',
      'Form Name',
      'Source',
      'Date',
      'CRM Link',
    ];

    const escapeCSV = (val: string | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = sortedRows.map((row) => [
      escapeCSV(row.contact_name),
      escapeCSV(row.contact_email),
      escapeCSV(row.contact_phone),
      escapeCSV(row.rep_name),
      escapeCSV(row.form_name),
      escapeCSV(row.source),
      escapeCSV(row.date),
      escapeCSV(row.crm_url || ''),
    ]);

    const csvContent = '\uFEFF' + [
      headers.map((h) => `"${h}"`).join(','),
      ...csvRows.map((r) => r.join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    link.href = url;
    link.setAttribute('download', `${safeTitle}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--rr-navy-deep)',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCheck size={18} style={{ color: 'var(--rr-gold)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {title}
              </h3>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                {rows.length} contacts found • {startDate} to {endDate}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'rgba(255,255,255,0.5)' }} />
              <input
                type="text"
                placeholder="Search contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 30px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={sortedRows.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: sortedRows.length === 0 ? 'rgba(255,255,255,0.1)' : 'var(--ttpa-blue-primary)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: sortedRows.length === 0 ? 'not-allowed' : 'pointer',
                opacity: sortedRows.length === 0 ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
              title="Exportar dados visíveis para planilha CSV"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ttpa-blue-primary)' }}>
              <Loader2 size={24} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '13px', fontWeight: 600 }}>Loading row-level contact details...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '24px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : sortedRows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No contact records found for this selection.
            </div>
          ) : (
            <table className="ttpa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  {renderSortableHeader('contact_name', 'Contact Name')}
                  {renderSortableHeader('contact_email', 'Email')}
                  {renderSortableHeader('contact_phone', 'Phone')}
                  {renderSortableHeader('rep_name', 'Representative')}
                  {renderSortableHeader('form_name', 'Form Name')}
                  {renderSortableHeader('source', 'Source')}
                  {renderSortableHeader('date', 'Date')}
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>CRM Link</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {row.contact_name}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {row.contact_email || '—'}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {row.contact_phone || '—'}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {row.rep_name}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {row.form_name}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      <span className="ttpa-tag">{row.source}</span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
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
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer Bar */}
        {!loading && !error && sortedRows.length > 0 && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} contacts
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="ttpa-select"
                  style={{
                    padding: '3px 8px',
                    fontSize: '12px',
                    height: '28px',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="ttpa-btn ttpa-btn-outline ttpa-btn-sm"
                style={{
                  opacity: currentPage === 1 ? 0.4 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', padding: '0 8px' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="ttpa-btn ttpa-btn-outline ttpa-btn-sm"
                style={{
                  opacity: currentPage >= totalPages ? 0.4 : 1,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                }}
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
