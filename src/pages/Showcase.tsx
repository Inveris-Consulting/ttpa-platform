import React from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { KPICard } from '../components/KPICard';
import { BarChart } from '../components/Charts/BarChart';
import { DonutChart } from '../components/Charts/DonutChart';
import { SubmissionsByDate, CallDurationDistribution } from '../types/analytics';
import { CheckCircle2, Flame, Sparkles, Phone, FileText, CheckSquare, Award } from 'lucide-react';

const SAMPLE_SUBMISSIONS: SubmissionsByDate[] = [
  { date: '27/07/2026', submissions: 15 },
  { date: '28/07/2026', submissions: 17 },
  { date: '29/07/2026', submissions: 3 },
];

const SAMPLE_CALL_DURATIONS: CallDurationDistribution[] = [
  { label: '+10s Calls', count: 2050, percentage: '55.4%', color: '#2563EB' },
  { label: 'No answer calls', count: 1009, percentage: '27.2%', color: '#1E293B' },
];

export const Showcase: React.FC = () => {
  const colors = [
    { name: 'R&R Navy Deep', varName: '--rr-navy-deep', hex: '#0B1340', desc: 'Dark background gradient' },
    { name: 'R&R Navy Header', varName: '--rr-navy-header', hex: '#15226D', desc: 'Primary header surface' },
    { name: 'TTPA Electric Blue', varName: '--ttpa-blue-primary', hex: '#2563EB', desc: 'TTPA division action color' },
    { name: 'R&R Gold', varName: '--rr-gold', hex: '#F59E0B', desc: 'R&R Gold accent' },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <Badge variant="gold" icon={<Sparkles size={12} />}>
              Vite + React + TypeScript System
            </Badge>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0', color: '#FFFFFF' }}>
              Official Design System — R&R TTPA
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', maxWidth: '700px' }}>
              Style guide, components, and visual tokens created for R&R Rent & Recruit — TTPA Division.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Badge variant="blue">Version 1.0.0</Badge>
            <Badge variant="navy">R&R Group</Badge>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="ttpa-card-title" style={{ fontSize: '20px', marginBottom: 'var(--space-4)' }}>
          1. Color Palette & Visual Tokens
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {colors.map((c) => (
            <div key={c.name} className="ttpa-card" style={{ padding: 'var(--space-3)' }}>
              <div
                style={{
                  height: '80px',
                  backgroundColor: c.hex,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--space-2)',
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</div>
              <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {c.hex} ({c.varName})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="ttpa-card-title" style={{ fontSize: '20px', marginBottom: 'var(--space-4)' }}>
          2. Buttons & Actions
        </h2>
        <div className="ttpa-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
          <Button variant="primary" icon={<Flame size={14} />}>
            TTPA Primary Button
          </Button>
          <Button variant="navy" icon={<Award size={14} />}>
            R&R Navy Button
          </Button>
          <Button variant="gold" icon={<Sparkles size={14} />}>
            Gold Accent Button
          </Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="ghost">Ghost Button</Button>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="ttpa-card-title" style={{ fontSize: '20px', marginBottom: 'var(--space-4)' }}>
          3. Data Visualization Primitives
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <BarChart data={SAMPLE_SUBMISSIONS} />
          <DonutChart data={SAMPLE_CALL_DURATIONS} />
        </div>
      </section>
    </div>
  );
};
