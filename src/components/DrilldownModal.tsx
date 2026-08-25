import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, ExternalLink, Loader2, UserCheck, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      fetchDrilldownDetails();
    }
  }, [isOpen, startDate, endDate, selectedRep, selectedForm, kpiType, filterDimension, filterValue]);

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
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No contact records found for this selection.
            </div>
          ) : (
            <table className="ttpa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px' }}>Contact Name</th>
                  <th style={{ padding: '10px' }}>Email</th>
                  <th style={{ padding: '10px' }}>Phone</th>
                  <th style={{ padding: '10px' }}>Representative</th>
                  <th style={{ padding: '10px' }}>Form Name</th>
                  <th style={{ padding: '10px' }}>Source</th>
                  <th style={{ padding: '10px' }}>Date</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>CRM Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
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
      </div>
    </div>
  );
};
