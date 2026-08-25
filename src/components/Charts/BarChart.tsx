import React, { useState } from 'react';
import { SubmissionsByDate } from '../../types/analytics';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface BarChartProps {
  data: SubmissionsByDate[];
  title?: string;
}

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatBarDate = (rawDate: string) => {
  if (!rawDate) return '';

  // Padrão DD/MM/YYYY (ex: "17/06/2026")
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
    const [day, monthStr] = rawDate.split('/');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_NAMES_PT[monthIndex] || monthStr;
    return `${parseInt(day, 10)} ${monthName}`;
  }

  // Padrão YYYY-MM-DD (ex: "2026-06-17")
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [, monthStr, day] = rawDate.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_NAMES_PT[monthIndex] || monthStr;
    return `${parseInt(day, 10)} ${monthName}`;
  }

  // Padrão DD/MM (ex: "17/06")
  if (/^\d{1,2}\/\d{1,2}$/.test(rawDate)) {
    const [day, monthStr] = rawDate.split('/');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_NAMES_PT[monthIndex] || monthStr;
    return `${parseInt(day, 10)} ${monthName}`;
  }

  // Padrão YYYY-MM (ex: "2026-06")
  if (/^\d{4}-\d{2}$/.test(rawDate)) {
    const [year, monthStr] = rawDate.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_NAMES_PT[monthIndex] || monthStr;
    return `${monthName} ${year}`;
  }

  return rawDate;
};

export const BarChart: React.FC<BarChartProps> = ({ data, title = 'Submissions by Date' }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const maxVal = Math.max(...data.map((d) => d.submissions), 1);
  const totalVal = data.reduce((acc, curr) => acc + curr.submissions, 0);

  const baseBarMinWidth = 42;
  const barMinWidth = Math.round(baseBarMinWidth * zoomLevel);
  const isScrollable = data.length > 14 || zoomLevel > 1;
  const minChartWidth = isScrollable ? data.length * barMinWidth : undefined;
  
  // Rotação dos rótulos se a barra for estreita e houver muitas colunas
  const isDense = data.length > 24 && barMinWidth < 45;

  return (
    <div className="ttpa-card" style={{ height: '100%' }}>
      <div className="ttpa-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="ttpa-card-title">{title}</span>
          <span className="ttpa-badge ttpa-badge-blue">{totalVal} Total</span>
        </div>

        {data.length > 5 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Zoom:</span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(0.4, Number((prev - 0.2).toFixed(2))))}
              disabled={zoomLevel <= 0.4}
              title="Diminuir zoom (colunas mais estreitas)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                cursor: zoomLevel <= 0.4 ? 'not-allowed' : 'pointer',
                opacity: zoomLevel <= 0.4 ? 0.5 : 1,
                color: 'var(--text-primary)',
              }}
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '36px', textAlign: 'center', color: 'var(--text-primary)' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(2.5, Number((prev + 0.2).toFixed(2))))}
              disabled={zoomLevel >= 2.5}
              title="Aumentar zoom (colunas mais largas)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                cursor: zoomLevel >= 2.5 ? 'not-allowed' : 'pointer',
                opacity: zoomLevel >= 2.5 ? 0.5 : 1,
                color: 'var(--text-primary)',
              }}
            >
              <ZoomIn size={13} />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Resetar zoom"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="ttpa-bar-chart-scroll-container">
        <div
          className="ttpa-bar-chart"
          style={{
            minWidth: minChartWidth ? `${minChartWidth}px` : '100%',
            paddingBottom: isDense ? '45px' : '35px',
          }}
        >
          {data.map((item, idx) => {
            const heightPct = (item.submissions / maxVal) * 100;
            return (
              <div
                key={idx}
                className="ttpa-bar-group"
                style={{
                  minWidth: `${barMinWidth}px`,
                  flex: isScrollable ? '0 0 auto' : '1 1 0%',
                }}
              >
                <span className="ttpa-bar-val" style={{ fontSize: isDense ? '10px' : '11px' }}>
                  {item.submissions}
                </span>
                <div
                  className="ttpa-bar-fill"
                  style={{ height: `${heightPct}%` }}
                  title={`${item.date}: ${item.submissions}`}
                />
                <span
                  className="ttpa-bar-label"
                  style={{
                    transform: isDense ? 'rotate(-40deg)' : 'none',
                    transformOrigin: 'top center',
                    fontSize: isDense ? '10px' : '11px',
                    bottom: isDense ? '-32px' : '-24px',
                  }}
                >
                  {formatBarDate(item.date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
