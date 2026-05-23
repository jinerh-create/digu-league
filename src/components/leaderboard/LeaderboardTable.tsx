import { useState, useEffect } from 'react';
import type { PlayerStats, TeamStats, Season } from '../../lib/types';

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
  { key: 'gin_count', label: 'Digu', short: 'DIGU' },
  { key: 'league_points', label: 'League Points', short: 'PTS' },
  { key: 'win_rate', label: 'Win Rate', short: 'WIN%' },
];

function getMonthOptions() {
  const opts: { value: string; label: string }[] = [{ value: '', label: 'All Time' }];
  for (let month = 0; month < 12; month++) {
    const d = new Date(2026, month, 1);
    const value = `2026-${String(month + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

function AwardCard({ icon, title, name, subtitle, accentColor }: {
  icon: string; title: string; name: string; subtitle: string; accentColor: string;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: `2px solid ${accentColor}`,
      borderRadius: 16,
      padding: '0.625rem 0.75rem',
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
      boxShadow: `0 4px 20px ${accentColor}33`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
      }} />
      <div style={{ fontSize: '1.25rem', lineHeight: 1, marginBottom: '0.25rem' }}>{icon}</div>
      <div style={{
        fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: accentColor, marginBottom: '0.2rem',
      }}>{title}</div>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '0.875rem', fontWeight: 800,
        color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: '0.15rem',
      }}>{name}</div>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700,
        color: accentColor,
      }}>{subtitle}</div>
    </div>
  );
}

async function generateRankingsImage(rows: PlayerStats[], label: string): Promise<Blob> {
  const W = 680;
  const HEADER_H = 108;
  const COL_H = 30;
  const ROW_H = 58;
  const H = HEADER_H + COL_H + rows.length * ROW_H;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const MEDAL_COLORS = ['#D4AF37', '#A8A9AD', '#CD7F32'];
  const MEDAL_BG     = ['rgba(212,175,55,0.13)', 'rgba(168,169,173,0.08)', 'rgba(205,127,50,0.09)'];
  const COL = { rank: 32, avatar: 64, name: 90, gp: 332, w: 390, l: 446, digu: 504, pts: 562, wr: 638 };

  // ── Background ────────────────────────────────────────────────
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────────
  const hg = ctx.createLinearGradient(0, 0, W, HEADER_H);
  hg.addColorStop(0, '#192b1c');
  hg.addColorStop(0.5, '#0d1510');
  hg.addColorStop(1, '#192b1c');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, HEADER_H);

  // Top gold bar
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0, 'transparent');
  topBar.addColorStop(0.25, '#D4AF37');
  topBar.addColorStop(0.75, '#D4AF37');
  topBar.addColorStop(1, 'transparent');
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, W, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('DIGU LEAGUE', W / 2, 44);

  ctx.fillStyle = '#DDD1BF';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(`Rankings · ${label}`, W / 2, 68);

  ctx.strokeStyle = '#D4AF37';
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 84); ctx.lineTo(W - 60, 84); ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Column header strip ───────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, HEADER_H, W, COL_H);

  ctx.fillStyle = '#666';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PLAYER', COL.name, HEADER_H + 20);
  ctx.textAlign = 'center';
  for (const [label, x] of [['GP', COL.gp], ['W', COL.w], ['L', COL.l], ['DIGU', COL.digu], ['PTS', COL.pts], ['WIN%', COL.wr]] as [string, number][]) {
    ctx.fillText(label, x, HEADER_H + 20);
  }

  // ── Rows ──────────────────────────────────────────────────────
  rows.forEach((s, i) => {
    const y = HEADER_H + COL_H + i * ROW_H;
    const cy = y + ROW_H / 2;
    const isTop3 = i < 3;
    const isRel = rows.length >= 3 && i >= rows.length - 2;
    const isRelStart = rows.length >= 3 && i === rows.length - 2;

    // Row bg
    ctx.fillStyle = isTop3 ? MEDAL_BG[i] : isRel ? 'rgba(200,16,46,0.10)' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
    ctx.fillRect(0, y, W, ROW_H);

    // Left accent bar for top 3
    if (isTop3) {
      ctx.fillStyle = MEDAL_COLORS[i];
      ctx.fillRect(0, y, 3, ROW_H);
    }

    // Relegation divider
    if (isRelStart) {
      ctx.strokeStyle = 'rgba(200,16,46,0.5)';
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Row divider
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 1); ctx.lineTo(W, y + ROW_H - 1); ctx.stroke();

    // ── Rank medal circle ───────────────────────────────────────
    ctx.textAlign = 'center';
    if (isTop3) {
      ctx.beginPath();
      ctx.arc(COL.rank, cy, 15, 0, Math.PI * 2);
      ctx.fillStyle = MEDAL_COLORS[i] + '33';
      ctx.fill();
      ctx.strokeStyle = MEDAL_COLORS[i]; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = MEDAL_COLORS[i];
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(String(i + 1), COL.rank, cy + 5);
    } else {
      ctx.fillStyle = isRel ? '#FF4A6A' : '#555';
      ctx.font = isRel ? 'bold 12px system-ui, sans-serif' : '700 12px system-ui, sans-serif';
      ctx.fillText(isRel ? '▼' : String(i + 1), COL.rank, cy + 4);
    }

    // ── Avatar ──────────────────────────────────────────────────
    const ax = COL.avatar, ay = cy, ar = 17;
    ctx.save();
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
    const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
    ctx.fillStyle = colors[s.name.charCodeAt(0) % colors.length];
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.restore();

    ctx.fillStyle = '#DDD1BF';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const initials = s.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    ctx.fillText(initials, ax, ay + 4);

    // Medal ring around avatar for top 3
    if (isTop3) {
      ctx.beginPath(); ctx.arc(ax, ay, ar + 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = MEDAL_COLORS[i]; ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ── Name ────────────────────────────────────────────────────
    ctx.textAlign = 'left';
    ctx.fillStyle = isTop3 ? '#ffffff' : '#DDD1BF';
    ctx.font = isTop3 ? '700 15px system-ui, sans-serif' : '600 14px system-ui, sans-serif';
    ctx.fillText(s.nickname || s.name, COL.name, cy + 5);

    // ── Stats ────────────────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa'; ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(String(s.matches_played), COL.gp, cy + 5);

    ctx.fillStyle = '#638D6F';
    ctx.fillText(String(s.matches_won), COL.w, cy + 5);

    ctx.fillStyle = '#C8102E';
    ctx.fillText(String(s.matches_lost), COL.l, cy + 5);

    ctx.fillStyle = '#D4AF37';
    ctx.fillText(String(s.gin_count), COL.digu, cy + 5);

    ctx.fillStyle = '#D4AF37';
    ctx.font = isTop3 ? 'bold 16px system-ui, sans-serif' : 'bold 14px system-ui, sans-serif';
    ctx.fillText(String(s.league_points), COL.pts, cy + 5);

    ctx.fillStyle = s.win_rate >= 50 ? '#638D6F' : '#777';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(s.matches_played > 0 ? `${s.win_rate}%` : '—', COL.wr, cy + 5);
  });

  return new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
}

export default function LeaderboardTable() {
  const [tab, setTab] = useState<Tab>('players');
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('matches_won');
  const [sortDesc, setSortDesc] = useState(true);
  const [month, setMonth] = useState('');
  const [season, setSeason] = useState('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [savingSeason, setSavingSeason] = useState(false);
  const [sharing, setSharing] = useState(false);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    fetch('/api/seasons').then(r => r.json()).then((data: Season[]) => setSeasons(data)).catch(() => {});
  }, []);

  function buildUrl(base: string) {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (season) p.set('season', season);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  }

  useEffect(() => {
    setLoading(true);
    if (tab === 'players') {
      fetch(buildUrl('/api/stats'))
        .then(r => r.json())
        .then((data: PlayerStats[]) => { setStats(data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      fetch(buildUrl('/api/stats/teams'))
        .then(r => r.json())
        .then((data: TeamStats[]) => { setTeamStats(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [tab, month, season]);

  const [awardStats, setAwardStats] = useState<PlayerStats[]>([]);
  useEffect(() => {
    fetch(buildUrl('/api/stats'))
      .then(r => r.json())
      .then((data: PlayerStats[]) => setAwardStats(data))
      .catch(() => {});
  }, [month, season]);

  async function handleStartSeason() {
    setSavingSeason(true);
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSeasonName }),
    });
    const data = await res.json() as { ok: boolean; id: string };
    if (data.ok) {
      const updated = await fetch('/api/seasons').then(r => r.json()) as Season[];
      setSeasons(updated);
      setSeason('current');
      setShowSeasonModal(false);
      setNewSeasonName('');
    }
    setSavingSeason(false);
  }

  async function handleShare() {
    if (!sorted.length) return;
    setSharing(true);
    try {
      const label = month
        ? monthOptions.find(o => o.value === month)?.label ?? 'All Time'
        : 'All Time';
      const blob = await generateRankingsImage(sorted, label);
      const file = new File([blob], 'digu-league-rankings.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Digu League Rankings' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'digu-league-rankings.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setSharing(false);
    }
  }

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
    ? hasPlayed.reduce((best, s) => s.league_points > best.league_points ? s : best, hasPlayed[0])
    : null;
  const diguKing = hasPlayed.length > 0
    ? hasPlayed.reduce((best, s) => s.gin_count > best.gin_count ? s : best, hasPlayed[0])
    : null;

  const monthPicker = (
    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <select className="form-input" value={month} onChange={e => setMonth(e.target.value)} style={{ maxWidth: 200, flex: 1 }}>
        {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {seasons.length > 0 && (
        <select className="form-input" value={season} onChange={e => setSeason(e.target.value)} style={{ maxWidth: 200, flex: 1 }}>
          <option value="">All Seasons</option>
          <option value="current">Current Season</option>
          {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', minHeight: 44, whiteSpace: 'nowrap', borderColor: 'var(--gold)', color: 'var(--gold)' }}
        onClick={() => { setNewSeasonName(`Season ${new Date().getFullYear()}`); setShowSeasonModal(true); }}
      >
        New Season
      </button>
      {tab === 'players' && sorted.length > 0 && (
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', minHeight: 44, whiteSpace: 'nowrap', borderColor: 'var(--felt-light)', color: 'var(--felt-light)' }}
          onClick={handleShare}
          disabled={sharing}
        >
          {sharing ? '…' : '📤 Share'}
        </button>
      )}
      <a href="/h2h" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', minHeight: 44, whiteSpace: 'nowrap', textDecoration: 'none' }}>⚔ H2H</a>
      <a href="/records" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', minHeight: 44, whiteSpace: 'nowrap', textDecoration: 'none' }}>🏅 Records</a>
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
          subtitle={playerOfMonth && playerOfMonth.league_points > 0
            ? `${playerOfMonth.league_points} pts`
            : 'No matches yet'}
          accentColor="#D4AF37"
        />
        <AwardCard
          icon="👑"
          title="Digu King of the Month"
          name={diguKing && diguKing.gin_count > 0 ? diguKing.name : '—'}
          subtitle={diguKing && diguKing.gin_count > 0
            ? `${diguKing.gin_count} DIGU`
            : 'No DIGU yet'}
          accentColor="#C8102E"
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
                    <th style={{ textAlign: 'left', paddingRight: '0.25rem' }}>Player</th>
                    <th style={{ textAlign: 'left', paddingRight: '2rem' }}>Nickname</th>
                    {PLAYER_COLS.map((c, ci) => (
                      <th
                        key={c.key}
                        className={`sortable ${sortKey === c.key ? 'active-sort' : ''}`}
                        onClick={() => handleSort(c.key)}
                        title={c.label}
                        style={ci === 0 ? { paddingLeft: '1rem' } : undefined}
                      >
                        {c.short}
                        {sortKey === c.key && <span style={{ marginLeft: 2 }}>{sortDesc ? '↓' : '↑'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const colCount = PLAYER_COLS.length + 3;
                    const isRelegated = sorted.length >= 3 && i >= sorted.length - 2;
                    const isRelegationStart = sorted.length >= 3 && i === sorted.length - 2;
                    return (
                      <>
                        {isRelegationStart && (
                          <tr key="relegation-divider" className="relegation-divider-row">
                            <td colSpan={colCount} style={{ padding: 0 }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.375rem 0.5rem',
                                background: 'rgba(200,16,46,0.12)',
                                borderTop: '1px dashed rgba(200,16,46,0.5)',
                                borderBottom: '1px dashed rgba(200,16,46,0.5)',
                              }}>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#FF6B8A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                  ▼ Relegation Zone
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr key={s.player_id} className={i === 0 ? 'top-row' : isRelegated ? 'relegation-row' : ''}>
                          <td className="rank" style={isRelegated ? { color: '#FF4A6A', fontWeight: 800 } : undefined}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : isRelegated ? '⬇' : i + 1}
                          </td>
                          <td style={{ paddingRight: '0.25rem' }}>
                            <a href={`/players/${s.player_id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
                              <Avatar name={s.name} avatar_b64={s.avatar_b64} size={30} />
                              <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 500, fontSize: '0.9375rem' }}>{s.name}</span>
                            </a>
                          </td>
                          <td style={{ color: 'var(--felt-light)', fontWeight: 600, fontSize: '0.8125rem', fontFamily: "'Quicksand', sans-serif", paddingRight: '2rem' }}>
                            {s.nickname ?? '—'}
                          </td>
                          <td className={sortKey === 'matches_played' ? 'active-col' : ''} style={{ paddingLeft: '1rem' }}>{s.matches_played}</td>
                          <td className={sortKey === 'matches_won' ? 'active-col' : ''} style={{ color: 'var(--felt-light)' }}>{s.matches_won}</td>
                          <td className={sortKey === 'matches_lost' ? 'active-col' : ''} style={{ color: 'var(--ember)' }}>{s.matches_lost}</td>
                          <td className={sortKey === 'gin_count' ? 'active-col' : ''} style={{ color: 'var(--gold)' }}>{s.gin_count}</td>
                          <td className={sortKey === 'league_points' ? 'active-col' : ''} style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.league_points}</td>
                          <td className={sortKey === 'win_rate' ? 'active-col' : ''}>
                            <span style={{ color: s.win_rate >= 50 ? 'var(--felt-light)' : 'var(--text-secondary)' }}>
                              {s.matches_played > 0 ? `${s.win_rate}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      </>
                    );
                  })}
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
        .lb-table .relegation-row td {
          background: rgba(200,16,46,0.14);
          border-bottom: 1px solid rgba(200,16,46,0.2);
        }
        .lb-table .relegation-row td:first-child {
          border-left: 3px solid #C8102E;
        }
        .lb-table .relegation-divider-row td { border-bottom: none; }
        .lb-table tbody tr:last-child td { border-bottom: none; }
      `}</style>

      {/* Season modal */}
      {showSeasonModal && (
        <div className="modal-overlay centered">
          <div className="modal-sheet" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Start New Season</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              All completed matches will be archived into the current season. Rankings reset to zero.
            </p>
            <div className="form-group" style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label className="form-label">Season Name</label>
              <input
                className="form-input"
                value={newSeasonName}
                onChange={e => setNewSeasonName(e.target.value)}
                placeholder="e.g. Season 1"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn btn-ghost btn-block" onClick={() => setShowSeasonModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleStartSeason} disabled={savingSeason || !newSeasonName.trim()}>
                {savingSeason ? 'Starting…' : 'Start Season'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
