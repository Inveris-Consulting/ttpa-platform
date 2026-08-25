import React from 'react';

export interface GenericBarItem {
  name?: string;
  label?: string;
  submissions?: number;
  value?: number;
}

interface HorizontalBarChartProps {
  data: GenericBarItem[];
  title?: string;
  onBarClick?: (item: GenericBarItem) => void;
  valueFormatter?: (val: number) => string;
  barColor?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  title = 'Horizontal Bar Chart',
  onBarClick,
  valueFormatter = (val) => val.toLocaleString(),
  barColor = 'var(--ttpa-blue-primary)',
}) => {
  const getItemName = (item: GenericBarItem) => item.name || item.label || 'Unassigned';
  const getItemValue = (item: GenericBarItem) => item.value ?? item.submissions ?? 0;

  // Garantir a ordenação automática do maior para o menor (decrescente)
  const sortedData = [...data].sort((a, b) => getItemValue(b) - getItemValue(a));

  const maxVal = Math.max(...sortedData.map(getItemValue), 1);

  return (
    <div className="ttpa-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {title && (
        <div className="ttpa-card-header" style={{ marginBottom: '12px' }}>
          <span className="ttpa-card-title">{title}</span>
        </div>
      )}

      {sortedData.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No data available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
          {sortedData.map((item, idx) => {
            const name = getItemName(item);
            const val = getItemValue(item);
            const widthPct = (val / maxVal) * 100;

            return (
              <div
                key={idx}
                onClick={() => onBarClick && onBarClick(item)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  cursor: onBarClick ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span
                    style={{
                      color: onBarClick ? 'var(--ttpa-blue-primary)' : 'var(--text-primary)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '80%',
                    }}
                    title={name}
                  >
                    {name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {valueFormatter(val)}
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: 'var(--slate-100)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(widthPct, 2)}%`,
                      height: '100%',
                      backgroundColor: barColor,
                      borderRadius: '4px',
                      transition: 'width 0.5s ease',
                    }}
                    title={`${name}: ${valueFormatter(val)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
