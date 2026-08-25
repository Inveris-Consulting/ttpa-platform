import React, { useEffect, useState } from 'react';
import { Calendar, Filter, Info, FileText, RotateCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RepresentativeOption } from '../types/analytics';

interface FilterBarProps {
  selectedRep: string;
  setSelectedRep: (rep: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  selectedForm?: string;
  setSelectedForm?: (form: string) => void;
  formNames?: string[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedRep,
  setSelectedRep,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedForm,
  setSelectedForm,
  formNames = [],
  onRefresh,
  isRefreshing = false,
}) => {
  const [representatives, setRepresentatives] = useState<RepresentativeOption[]>([]);

  useEffect(() => {
    fetchTTPARepresentativesFromSupabase();
  }, []);

  const fetchTTPARepresentativesFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('dRepresentatives')
        .select('id, Representative, Type')
        .eq('Type', 'TTPA')
        .order('Representative', { ascending: true });

      if (data && !error) {
        setRepresentatives(data);
      }
    } catch (err) {
      console.error('Error fetching TTPA representatives from Supabase:', err);
    }
  };

  return (
    <div className="ttpa-filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Representative Dropdown filtered strictly to TTPA representatives */}
      <div className="ttpa-filter-control">
        <Filter size={14} style={{ color: 'var(--slate-500)' }} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>TTPA Representative:</span>
        <select
          value={selectedRep}
          onChange={(e) => setSelectedRep(e.target.value)}
          className="ttpa-select"
        >
          <option value="All Representatives">All TTPA Representatives</option>
          {representatives.map((rep) => (
            <option key={rep.id} value={rep.Representative}>
              {rep.Representative}
            </option>
          ))}
        </select>
      </div>

      {/* Form Name Dropdown (Optional) */}
      {selectedForm !== undefined && setSelectedForm !== undefined && (
        <div className="ttpa-filter-control">
          <FileText size={14} style={{ color: 'var(--slate-500)' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Form:</span>
          <select
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value)}
            className="ttpa-select"
            style={{ maxWidth: '200px' }}
          >
            <option value="All Forms">All Forms</option>
            {formNames.map((form) => (
              <option key={form} value={form}>
                {form}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Interactive Date Range Control */}
      <div className="ttpa-date-pill" style={{ position: 'relative' }}>
        <Calendar size={14} style={{ color: 'var(--ttpa-blue-primary)' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              const newDate = e.target.value;
              if (newDate > endDate) {
                alert('A data inicial não pode ser posterior à data final.');
                return;
              }
              setStartDate(newDate);
            }}
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
            onChange={(e) => {
              const newDate = e.target.value;
              if (newDate < startDate) {
                alert('A data final não pode ser anterior à data inicial.');
                return;
              }
              setEndDate(newDate);
            }}
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

        <span title="Click date inputs to filter period" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Info size={12} style={{ color: 'var(--slate-400)', cursor: 'pointer' }} />
        </span>
      </div>

      {/* Refresh Data Button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="ttpa-btn ttpa-btn-primary ttpa-btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            opacity: isRefreshing ? 0.7 : 1,
            marginLeft: 'auto',
          }}
        >
          <RotateCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      )}
    </div>
  );
};

interface ChecklistFilterProps {
  filters: { [key: string]: boolean };
  onToggle: (key: string) => void;
}

export const ChecklistFilter: React.FC<ChecklistFilterProps> = ({ filters, onToggle }) => {
  const items = [
    { key: 'students', label: 'Students' },
    { key: 'deals', label: 'Deals' },
    { key: 'submissions', label: 'Submissions' },
    { key: 'calls', label: 'Calls' },
    { key: 'sms', label: 'SMS' },
  ];

  return (
    <div className="ttpa-checklist-card">
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
        Dimensions
      </div>
      {items.map((item) => (
        <label key={item.key} className="ttpa-checkbox-item">
          <input
            type="checkbox"
            checked={filters[item.key] ?? false}
            onChange={() => onToggle(item.key)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
};
