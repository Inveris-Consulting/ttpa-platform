import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { KpiMetric } from '../types/analytics';

interface KPICardProps {
  metric: KpiMetric;
  isSelected?: boolean;
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({ metric, isSelected, onClick }) => {
  return (
    <div 
      className={`ttpa-kpi-card ${isSelected ? 'active' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="ttpa-kpi-label">{metric.label}</span>
      <span className="ttpa-kpi-value">{metric.value}</span>
      
      {metric.subtext && (
        <span className="ttpa-kpi-subtext">{metric.subtext}</span>
      )}

      {metric.trend && (
        <div style={{ marginTop: '4px' }}>
          <span className={`ttpa-kpi-trend ${metric.trend.isUp ? 'ttpa-kpi-trend-up' : 'ttpa-kpi-trend-down'}`}>
            {metric.trend.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {metric.trend.value}
          </span>
        </div>
      )}
    </div>
  );
};
