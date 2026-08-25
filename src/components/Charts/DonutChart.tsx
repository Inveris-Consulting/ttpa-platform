import React from 'react';
import { CallDurationDistribution } from '../../types/analytics';

interface DonutChartProps {
  data: CallDurationDistribution[];
  totalLabel?: string;
  totalValue?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  totalLabel = 'Calls',
  totalValue = '0',
}) => {
  const radius = 60;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const totalCount = data.reduce((sum, item) => sum + item.count, 0);

  let accumulatedPercent = 0;

  return (
    <div className="ttpa-card" style={{ height: '100%' }}>
      <div className="ttpa-card-header">
        <span className="ttpa-card-title">Calls time distribution</span>
      </div>

      <div className="ttpa-donut-wrapper" style={{ paddingTop: '8px' }}>
        <div className="ttpa-donut-chart">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <g transform="rotate(-90 80 80)">
              {data.map((item, idx) => {
                const percent = totalCount > 0 ? item.count / totalCount : 0;
                const strokeDasharray = `${percent * circumference} ${circumference}`;
                const strokeDashoffset = -accumulatedPercent * circumference;
                accumulatedPercent += percent;

                return (
                  <circle
                    key={idx}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  >
                    <title>{`${item.label}: ${item.count} (${item.percentage})`}</title>
                  </circle>
                );
              })}
            </g>
          </svg>

          <div className="ttpa-donut-center">
            <div className="ttpa-donut-center-val">{totalValue}</div>
            <div className="ttpa-donut-center-lbl">{totalLabel}</div>
          </div>
        </div>

        <div className="ttpa-donut-legend">
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Call Duration Class
          </div>
          {data.map((item, idx) => (
            <div key={idx} className="ttpa-legend-item">
              <span className="ttpa-legend-label">
                <span className="ttpa-legend-dot" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
              <span className="ttpa-legend-val">{item.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
