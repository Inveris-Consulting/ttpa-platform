import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Legend,
  Line, LineChart, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { AnalyticsLocale, AnalyticsModel, AnalyticsRow, KitAnalyticsQuery, KitVisualizationConfig } from '../types';

const fallbackColors = ['#FF2600', '#1F438C', '#111827', '#A09FA3', '#FF7257', '#5774AE'];
const compact = (value: number, locale: AnalyticsLocale) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function format(value: number, config: KitVisualizationConfig, locale: AnalyticsLocale, currency: string, percent = false) {
  const decimals = config.decimals ?? 0;
  if (percent || config.valueFormat === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(percent ? value / 100 : Math.abs(value) > 1 ? value / 100 : value);
  let scaled = value, suffix = '';
  if (config.labels === 'millions') { scaled /= 1_000_000; suffix = locale === 'pt-BR' ? ' mi' : 'M'; }
  if (config.labels === 'thousands') { scaled /= 1_000; suffix = locale === 'pt-BR' ? ' mil' : 'K'; }
  const options: Intl.NumberFormatOptions = config.valueFormat === 'currency' ? { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return `${new Intl.NumberFormat(locale, options).format(scaled)}${suffix}`;
}

function labelFor(model: AnalyticsModel, name: string, locale: AnalyticsLocale) {
  const field = model.fields.find((item) => item.name === name);
  return locale === 'en-US' ? field?.labelEn ?? field?.label ?? name : field?.label ?? name;
}

function pivot(rows: AnalyticsRow[], query: KitAnalyticsQuery) {
  const category = query.dimensions[0], measure = query.measures[0];
  if (!query.breakdown) return { rows, series: query.measures };
  const seriesValues = [...new Set(rows.map((row) => String(row[query.breakdown!] ?? '—')))];
  const groups = new Map<string, AnalyticsRow>();
  for (const row of rows) {
    const categoryValue = String(row[category] ?? '—'), segment = String(row[query.breakdown] ?? '—');
    const current = groups.get(categoryValue) ?? { [category]: categoryValue };
    current[`${measure}::${segment}`] = Number(current[`${measure}::${segment}`] ?? 0) + Number(row[measure] ?? 0);
    groups.set(categoryValue, current);
  }
  return { rows: [...groups.values()], series: seriesValues.map((value) => `${measure}::${value}`) };
}

export function ChartRenderer({ rows, query, config, model, locale = 'pt-BR', currency = 'BRL' }: { rows: AnalyticsRow[]; query: KitAnalyticsQuery; config: KitVisualizationConfig; model: AnalyticsModel; locale?: AnalyticsLocale; currency?: string }) {
  if (!rows.length || !query.measures.length) return <div className="ak-empty">{locale === 'pt-BR' ? 'Nenhum resultado' : 'No results'}</div>;
  const colors = config.colors?.length ? config.colors : fallbackColors, category = query.dimensions[0], measure = query.measures[0];
  const labels = config.labels !== 'none', valueLabel = (value: unknown) => format(Number(value), config, locale, currency);
  const legendFormatter = (value: string) => value.includes('::') ? value.split('::')[1] : labelFor(model, value, locale);
  if (config.type === 'table' || config.type === 'matrix') {
    const columns = Object.keys(rows[0]);
    const maxima = Object.fromEntries(query.measures.map((name) => [name, Math.max(...rows.map((row) => Math.abs(Number(row[name] ?? 0))), 1)]));
    return <div className="ak-table-wrap"><table className={`ak-table ${config.type === 'matrix' ? 'matrix' : ''}`}><thead><tr>{columns.map((column) => <th key={column}>{labelFor(model, column, locale)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => { const numeric = typeof row[column] === 'number'; return <td key={column} className={numeric ? 'numeric' : ''} style={config.type === 'matrix' && numeric ? { background: `rgba(255,38,0,${.08 + .38 * Math.abs(Number(row[column])) / (maxima[column] ?? 1)})` } : undefined}>{numeric ? valueLabel(row[column]) : row[column]}</td>; })}</tr>)}</tbody></table></div>;
  }
  if (config.type === 'card') { const total = rows.reduce((sum, row) => sum + Number(row[measure] ?? 0), 0); return <div className="ak-metric-card"><span>{labelFor(model, measure, locale)}</span><strong>{format(total, { ...config, labels: config.labels === 'none' ? 'auto' : config.labels }, locale, currency)}</strong><small>{rows.length} {locale === 'pt-BR' ? 'registros' : 'records'}</small></div>; }
  if (config.type === 'gauge') { const total = rows.reduce((sum, row) => sum + Number(row[measure] ?? 0), 0), progress = config.valueFormat === 'percent' ? Math.min(100, Math.abs(total) <= 1 ? total * 100 : total) : 72; return <div className="ak-gauge"><ResponsiveContainer><RadialBarChart cx="50%" cy="78%" innerRadius="72%" outerRadius="100%" barSize={24} data={[{ value: progress }]} startAngle={180} endAngle={0}><PolarAngleAxis type="number" domain={[0, 100]} tick={false} /><RadialBar dataKey="value" fill={colors[0]} background={{ fill: '#ECEEF2' }} cornerRadius={14} /></RadialBarChart></ResponsiveContainer><strong>{format(total, { ...config, labels: 'auto' }, locale, currency)}</strong></div>; }
  if (config.type === 'pie') return <ResponsiveContainer><PieChart><Tooltip />{config.showLegend && <Legend formatter={legendFormatter} />}<Pie data={rows} dataKey={measure} nameKey={category} outerRadius="76%">{rows.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}{labels && <LabelList dataKey={measure} position="outside" formatter={valueLabel} />}</Pie></PieChart></ResponsiveContainer>;
  if (config.type === 'funnel') return <ResponsiveContainer><FunnelChart><Tooltip /><Funnel data={rows.map((row) => ({ name: row[category], value: row[measure] }))} dataKey="value">{rows.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}<LabelList dataKey="name" position="right" />{labels && <LabelList dataKey="value" position="center" fill="#fff" formatter={valueLabel} />}</Funnel></FunnelChart></ResponsiveContainer>;
  if (config.type === 'scatter') { const second = query.measures[1] ?? measure; return <ResponsiveContainer><ScatterChart margin={{ top: 22, right: 24, bottom: 18, left: 8 }}><CartesianGrid strokeDasharray="4 4" /><XAxis dataKey={measure} type="number" tickFormatter={(value) => compact(Number(value), locale)} /><YAxis dataKey={second} type="number" tickFormatter={(value) => compact(Number(value), locale)} /><Tooltip /><Scatter data={rows} fill={colors[0]} /></ScatterChart></ResponsiveContainer>; }
  const axes = <><CartesianGrid vertical={false} stroke="#E6E8ED" strokeDasharray="4 4" /><XAxis dataKey={category} axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compact(Number(value), locale)} /><Tooltip />{config.showLegend && <Legend formatter={legendFormatter} />}</>;
  if (config.type === 'line') return <ResponsiveContainer><LineChart data={rows} margin={{ top: 28, right: 24, bottom: 8 }}>{axes}{query.measures.map((name, index) => <Line key={name} dataKey={name} stroke={colors[index % colors.length]} strokeWidth={3}>{labels && <LabelList dataKey={name} position="top" formatter={valueLabel} />}</Line>)}</LineChart></ResponsiveContainer>;
  if (config.type === 'area') return <ResponsiveContainer><AreaChart data={rows} margin={{ top: 28, right: 24, bottom: 8 }}>{axes}{query.measures.map((name, index) => <Area key={name} dataKey={name} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={.15}>{labels && <LabelList dataKey={name} position="top" formatter={valueLabel} />}</Area>)}</AreaChart></ResponsiveContainer>;
  const pivoted = pivot(rows, query), normalized = config.type === 'normalizedBar';
  const chartRows = normalized ? pivoted.rows.map((row) => { const total = pivoted.series.reduce((sum, name) => sum + Number(row[name] ?? 0), 0) || 1; return { ...row, ...Object.fromEntries(pivoted.series.map((name) => [name, Number(row[name] ?? 0) / total * 100])) }; }) : pivoted.rows;
  const horizontal = config.orientation === 'horizontal', stacked = normalized || config.stacked || Boolean(query.breakdown);
  const isScrollable = !horizontal && chartRows.length > 15;
  const chartMinWidth = isScrollable ? Math.max(600, chartRows.length * 40) : undefined;
  const barChartElement = (
    <ResponsiveContainer width={chartMinWidth ? chartMinWidth : '100%'} height="100%">
      <BarChart data={chartRows} layout={horizontal ? 'vertical' : 'horizontal'} margin={horizontal ? { top: 18, right: labels ? 70 : 25, left: 25 } : { top: labels ? 34 : 18, right: 20, bottom: chartRows.length > 20 ? 25 : 5 }}>
        <CartesianGrid stroke="#E6E8ED" strokeDasharray="4 4" />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={(value) => normalized ? `${value}%` : compact(Number(value), locale)} />
            <YAxis type="category" dataKey={category} width={92} />
          </>
        ) : (
          <>
            <XAxis dataKey={category} interval={chartRows.length > 30 ? 'preserveStartEnd' : 0} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(value) => normalized ? `${value}%` : compact(Number(value), locale)} domain={normalized ? [0, 100] : undefined} />
          </>
        )}
        <Tooltip />
        {config.showLegend && <Legend formatter={legendFormatter} />}
        {pivoted.series.map((name, index) => (
          <Bar key={name} dataKey={name} stackId={stacked ? 'series' : undefined} fill={colors[index % colors.length]} radius={stacked ? 0 : horizontal ? [0, 7, 7, 0] : [7, 7, 2, 2]}>
            {labels && <LabelList dataKey={name} position={horizontal ? 'right' : 'top'} formatter={(value: unknown) => format(Number(value), config, locale, currency, normalized)} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  if (isScrollable) {
    return <div style={{ overflowX: 'auto', width: '100%', height: '100%' }}>{barChartElement}</div>;
  }
  return barChartElement;
}
