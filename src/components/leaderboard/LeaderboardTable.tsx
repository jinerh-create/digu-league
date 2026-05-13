import { useState, useEffect } from 'react';
import type { PlayerStats } from '../../lib/types';

type SortKey = keyof Pick<PlayerStats,
  'win_rate' | 'matches_won' | 'matches_lost' | 'games_played' |
  'total_points_scored' | 'gin_count' | 'avg_points_per_game' | 'biggest_hand'
>;

function Avatar({ name, avatar_b64, size = 32 }: { name: string; avatar_b64: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (avatar_b64) {
    return (
      <img
        src={`data:image/jpeg;base64,${avatar_b64}`}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#DDD1BF', flexShrink: 0
    }}>
      {initials}
    </div>
  );
}

const COLS: { key: SortKey; label: string; short: string }[] = [
  { key: 'win_rate', label: 'Win%', short: 'Win%' },
  { key: 'matches_won', label: 'W', short: 'W' },
  { key: 'matches_lost', label: 'L', short: 'L' },
  { key: 'total_points_scored', label: 'Pts', short: 'Pts' },
  { key: 'gin_count', label: 'Gins', short: 'Gins' },
  { key: 'avg_points_per_game', label: 'Avg', short: 'Avg' },
];

export default function LeaderboardTable() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('win_rate');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then((data: PlayerStats[]) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  }

  const sorted = [...stats].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDesc ? bv - av : av - bv;
  });

  if (loading) return <div className="loading">Loading rankings…</div>;
  if (!stats.length) return (
    <div className="empty-state">
      <p>No players yet. <a href="/players" style={{ color: 'var(--felt-light)' }}>Add players</a> to see rankings.</p>
    </div>
  );

  return (
    <div>
      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th style={{ textAlign: 'left' }}>Player</th>
              {COLS.map(c => (
                <th
                  key={c.key}
                  className={`sortable ${sortKey === c.key ? 'active-sort' : ''}`}
                  onClick={() => handleSort(c.key)}
                  title={c.label}
                >
                  {c.short}
                  {sortKey === c.key && <span style={{ marginLeft: 2 }}>{sortDesc ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.player_id} className={i === 0 ? 'top-row' : ''}>
                <td className="rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Avatar name={s.name} avatar_b64={s.avatar_b64} size={30} />
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{s.name}</span>
                  </div>
                </td>
                <td className={sortKey === 'win_rate' ? 'active-col' : ''}>
                  <span style={{ color: s.win_rate >= 50 ? 'var(--felt-light)' : 'var(--text-secondary)' }}>
                    {s.matches_played > 0 ? `${s.win_rate}%` : '—'}
                  </span>
                </td>
                <td className={sortKey === 'matches_won' ? 'active-col' : ''} style={{ color: 'var(--felt-light)' }}>
                  {s.matches_won}
                </td>
                <td className={sortKey === 'matches_lost' ? 'active-col' : ''} style={{ color: 'var(--ember)' }}>
                  {s.matches_lost}
                </td>
                <td className={sortKey === 'total_points_scored' ? 'active-col' : ''}>
                  {s.total_points_scored}
                </td>
                <td className={sortKey === 'gin_count' ? 'active-col' : ''} style={{ color: 'var(--gold)' }}>
                  {s.gin_count}
                </td>
                <td className={sortKey === 'avg_points_per_game' ? 'active-col' : ''}>
                  {s.avg_points_per_game}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .lb-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .lb-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .lb-table th {
          padding: 0.5rem 0.375rem;
          text-align: center;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .lb-table th.sortable { cursor: pointer; user-select: none; }
        .lb-table th.sortable:hover { color: var(--cream); }
        .lb-table th.active-sort { color: var(--cream); }
        .lb-table td {
          padding: 0.625rem 0.375rem;
          text-align: center;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        .lb-table td.active-col { font-weight: 700; }
        .lb-table .rank { font-weight: 700; color: var(--text-muted); font-size: 0.9375rem; }
        .lb-table .top-row td { background: rgba(212,175,55,0.05); }
        .lb-table tbody tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}
