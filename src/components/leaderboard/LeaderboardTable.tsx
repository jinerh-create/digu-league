import { useState, useEffect } from 'react';
import type { PlayerStats, TeamStats } from '../../lib/types';

type SortKey = keyof Pick<PlayerStats,
  'league_points' | 'win_rate' | 'matches_won' | 'matches_lost' | 'matches_played' |
  'total_points_scored' | 'gin_count' | 'avg_points_per_game' | 'biggest_hand'
>;

type Tab = 'players' | 'teams';

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
      fontSize: size * 0.35, fontWeight: 700, color: '#DDD1BF', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

const PLAYER_COLS: { key: SortKey; label: string; short: string }[] = [
  { key: 'matches_played', label: 'Games Played', short: 'GP' },
  { key: 'matches_won', label: 'Wins', short: 'W' },
  { key: 'matches_lost', label: 'Losses', short: 'L' },
  { key: 'league_points', label: 'League Points (W=3 D=1 L=0)', short: 'LP' },
  { key: 'gin_count', label: 'Digu', short: 'DIGU' },
  { key: 'total_points_scored', label: 'Points Scored', short: 'PTS' },
  { key: 'win_rate', label: 'Win Rate', short: 'WIN%' },
];

function getMonthOptions() {
  const opts: { value: string; label: string }[] = [{ value: '', label: 'All Time' }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

function AwardCard({ icon, title, name, subtitle, gradient }: {
  icon: string; title: string; name: string; subtitle: string; gradient: string;
}) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 14,
      padding: '1.125rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '2rem', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.65)',
          marginBottom: '0.2rem',
        }}>{title}</div>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '1.0625rem',
          fontWeight: 700,
          color: '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{name}</div>
        <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.1rem' }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default function LeaderboardTable() {
  const [tab, setTab] = useState<Tab>('players');
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('league_points');
  const [sortDesc, setSortDesc] = useState(true);
  const [month, setMonth] = useState('');
  const monthOptions = getMonthOptions();

  useEffect(() => {
    setLoading(true);
    if (tab === 'players') {
      const url = month ? `/api/stats?month=${month}` : '/api/stats';
      fetch(url)
        .then(r => r.json())
        .then((data: PlayerStats[]) => { setStats(data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      const url = month ? `/api/stats/teams?month=${month}` : '/api/stats/teams';
      fetch(url)
        .then(r => r.json())
        .then((data: TeamStats[]) => { setTeamStats(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [tab, month]);

  // Always fetch player stats for awards (all types, current month)
  const [awardStats, setAwardStats] = useState<PlayerStats[]>([]);
  useEffect(() => {
    const url = month ? `/api/stats?month=${month}` : '/api/stats';
    fetch(url)
      .then(r => r.json())
      .then((data: PlayerStats[]) => setAwardStats(data))
      .catch(() => {});
  }, [month]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  }

  const sorted = [...stats].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDesc ? bv - av : av - bv;
  });

  // Awards — pick best player regardless of whether they have data yet
  const hasPlayed = awardStats.filter(s => s.matches_played > 0);
  const playerOfMonth = hasPlayed.length > 0
    ? hasPlayed.reduce((best, s) => s.total_points_scored > best.total_points_scored ? s : best, hasPlayed[0])
    : null;
  const diguKing = hasPlayed.length > 0
    ? hasPlayed.reduce((best, s) => s.gin_count > best.gin_count ? s : best, hasPlayed[0])
    : null;

  const monthPicker = (
    <div style={{ marginBottom: '1rem' }}>
      <select
        className="form-input"
        value={month}
        onChange={e => setMonth(e.target.value)}
        style={{ maxWidth: 220 }}
      >
        {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const tabBar = (
    <div style={{ display: 'flex', gap: 4, background: 'var(--card-raised)', borderRadius: 8, padding: 4, marginBottom: '1rem' }}>
      {([['players', 'Players'], ['teams', 'Teams']] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => { setTab(key); setLoading(true); }}
          style={{
            flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700, fontSize: '0.875rem',
            background: tab === key ? 'var(--felt)' : 'transparent',
            color: tab === key ? 'var(--cream)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const awardsSection = (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem',
      }}>
        {month ? monthOptions.find(o => o.value === month)?.label : 'All Time'} Awards
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <AwardCard
          icon="🏆"
          title="Player of the Month"
          name={playerOfMonth ? playerOfMonth.name : '—'}
          subtitle={playerOfMonth && playerOfMonth.total_points_scored > 0
            ? `${playerOfMonth.total_points_scored} pts scored`
            : 'No matches yet'}
          gradient="linear-gradient(135deg, #1a3a24 0%, #2B4F37 100%)"
        />
        <AwardCard
          icon="👑"
          title="Digu King of the Month"
          name={diguKing && diguKing.gin_count > 0 ? diguKing.name : '—'}
          subtitle={diguKing && diguKing.gin_count > 0
            ? `${diguKing.gin_count} digu${diguKing.gin_count !== 1 ? 's' : ''}`
            : 'No digus yet'}
          gradient="linear-gradient(135deg, #4a1508 0%, #78270D 100%)"
        />
      </div>
    </div>
  );

  if (loading) return (
    <>{monthPicker}{tabBar}<div className="loading">Loading rankings…</div></>
  );

  return (
    <div>
      {monthPicker}
      {tabBar}

      {tab === 'players' ? (
        <>
          {!stats.length ? (
            <div className="empty-state">
              <p>No single-match data{month ? ' for this month' : ''}. Play some 1v1 matches!</p>
            </div>
          ) : (
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th style={{ textAlign: 'left' }}>Player</th>
                    {PLAYER_COLS.map(c => (
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
                          <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 500, fontSize: '0.9375rem' }}>{s.name}</span>
                        </div>
                      </td>
                      <td className={sortKey === 'matches_played' ? 'active-col' : ''}>{s.matches_played}</td>
                      <td className={sortKey === 'matches_won' ? 'active-col' : ''} style={{ color: 'var(--felt-light)' }}>{s.matches_won}</td>
                      <td className={sortKey === 'matches_lost' ? 'active-col' : ''} style={{ color: 'var(--ember)' }}>{s.matches_lost}</td>
                      <td className={sortKey === 'league_points' ? 'active-col' : ''} style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.league_points}</td>
                      <td className={sortKey === 'gin_count' ? 'active-col' : ''} style={{ color: 'var(--gold)' }}>{s.gin_count}</td>
                      <td className={sortKey === 'total_points_scored' ? 'active-col' : ''}>{s.total_points_scored}</td>
                      <td className={sortKey === 'win_rate' ? 'active-col' : ''}>
                        <span style={{ color: s.win_rate >= 50 ? 'var(--felt-light)' : 'var(--text-secondary)' }}>
                          {s.matches_played > 0 ? `${s.win_rate}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {!teamStats.length ? (
            <div className="empty-state">
              <p>No team match data{month ? ' for this month' : ''}. Play some 2v2 matches!</p>
            </div>
          ) : (
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th style={{ textAlign: 'left' }}>Team</th>
                    <th title="League Points">LP</th>
                    <th title="Matches Played">MP</th>
                    <th title="Wins">W</th>
                    <th title="Draws">D</th>
                    <th title="Losses">L</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((t, i) => (
                    <tr key={t.team_name} className={i === 0 ? 'top-row' : ''}>
                      <td className="rank">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td>
                        <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 500, fontSize: '0.9375rem' }}>{t.team_name}</span>
                      </td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{t.league_points}</td>
                      <td>{t.matches_played}</td>
                      <td style={{ color: 'var(--felt-light)' }}>{t.matches_won}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.matches_drawn}</td>
                      <td style={{ color: 'var(--ember)' }}>{t.matches_lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {awardsSection}

      <style>{`
        .lb-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .lb-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .lb-table th {
          padding: 0.5rem 0.375rem;
          text-align: center;
          font-size: 0.6875rem;
          font-family: 'Quicksand', sans-serif;
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
          font-family: 'Quicksand', sans-serif;
        }
        .lb-table td.active-col { font-weight: 700; }
        .lb-table .rank { font-weight: 700; color: var(--text-muted); font-size: 0.9375rem; }
        .lb-table .top-row td { background: rgba(212,175,55,0.05); }
        .lb-table tbody tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}
