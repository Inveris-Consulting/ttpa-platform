import React from 'react';
import { HeatmapRow } from '../../types/analytics';

interface HeatmapTableProps {
  data: HeatmapRow[];
}

export const HeatmapTable: React.FC<HeatmapTableProps> = ({ data }) => {
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  const hourTotals: { [key: number]: number } = {};
  hours.forEach((h) => {
    hourTotals[h] = data.reduce((sum, row) => sum + (row.hours[h] || 0), 0);
  });

  const grandTotal = data.reduce((sum, row) => sum + row.total, 0);

  const getHeatClass = (val: number) => {
    if (val === 0) return 'heat-0';
    if (val <= 1) return 'heat-1';
    if (val <= 2) return 'heat-2';
    if (val <= 3) return 'heat-3';
    if (val <= 4) return 'heat-4';
    if (val <= 6) return 'heat-5';
    if (val <= 7) return 'heat-6';
    return 'heat-7';
  };

  return (
    <div className="ttpa-card" style={{ height: '100%' }}>
      <div className="ttpa-card-header">
        <span className="ttpa-card-title">Submissions by Hour</span>
      </div>

      <div style={{ overflowX: 'auto', paddingTop: '4px' }}>
        <table className="ttpa-heatmap-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Day / Hour</th>
              {hours.map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {row.day}
                </td>
                {hours.map((h) => {
                  const val = row.hours[h] || 0;
                  return (
                    <td key={h} className={getHeatClass(val)}>
                      {val > 0 ? val : ''}
                    </td>
                  );
                })}
                <td style={{ fontWeight: 800, color: 'var(--text-primary)', background: 'var(--slate-100)' }}>
                  {row.total}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--border-medium)' }}>
              <td style={{ textAlign: 'left', fontWeight: 800, color: 'var(--text-primary)' }}>
                Total
              </td>
              {hours.map((h) => (
                <td key={h} style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                  {hourTotals[h]}
                </td>
              ))}
              <td style={{ fontWeight: 900, color: 'var(--ttpa-blue-primary)', background: 'var(--ttpa-blue-light)' }}>
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
