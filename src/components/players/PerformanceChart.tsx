import { useState } from 'react';

type TL = { ym: string; date: string; won: number; digus: number };

const GREEN = '#00D47E', RED = '#FF4A6A', GOLD = '#FFD700', MUTED = '#6B7A96';

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function PerformanceChart({ timeline }: { timeline: TL[] }) {
  const months = [...new Set((timeline || []).map(t => t.ym))].filter(Boolean).sort();
  const [sel, setSel] = useState(months[months.length - 1] || '');
  if (!timeline?.length || !months.length) return null;

  const rows = timeline.filter(t => t.ym === (sel || months[months.length - 1]));
  const wins = rows.filter(r => r.won).length;
  const digus = rows.reduce((s, r) => s + r.digus, 0);
  const maxD = Math.max(1, ...rows.map(r => r.digus));

  const W = 320, H = 118, pad = 8;
  const bw = rows.length ? (W - pad * 2) / rows.length : 0;

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>📈 Performance</div>
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ background: 'var(--card-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          {months.slice().reverse().map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1.1rem', marginBottom: '0.75rem' }}>
        <div><span style={{ color: GREEN, fontWeight: 800, fontSize: '1.15rem' }}>{wins}</span> <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>WINS</span></div>
        <div><span style={{ color: GOLD, fontWeight: 800, fontSize: '1.15rem' }}>{digus}</span> <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>DIGUS</span></div>
        <div><span style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: '1.15rem' }}>{rows.length}</span> <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>MATCHES</span></div>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.25rem 0' }}>No matches this month</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}>
          {rows.map((r, i) => {
            const h = (r.digus / maxD) * (H - 30);
            const w = bw * 0.68;
            const x = pad + i * bw + (bw - w) / 2;
            const y = H - 20 - h;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={Math.max(3, h)} rx={2.5} fill={r.won ? GREEN : RED} />
                {r.digus > 0 && <text x={x + w / 2} y={y - 3} fontSize="7.5" fill={GOLD} textAnchor="middle" fontWeight="700">{r.digus}</text>}
                <text x={x + w / 2} y={H - 6} fontSize="7" fill={MUTED} textAnchor="middle">{i + 1}</text>
              </g>
            );
          })}
        </svg>
      )}

      <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.6rem', fontSize: '0.62rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, background: GREEN, borderRadius: 2, display: 'inline-block' }} />Win</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, background: RED, borderRadius: 2, display: 'inline-block' }} />Loss</span>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Bar = digus per match</span>
      </div>
    </div>
  );
}
