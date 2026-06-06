import { useState, useEffect, useMemo } from 'react';
import type { PlayerStats, TeamStats, Season } from '../../lib/types';

type SortKey = keyof Pick<PlayerStats,
  'league_points' | 'win_rate' | 'matches_won' | 'matches_lost' | 'matches_played' |
  'total_points_scored' | 'gin_count' | 'avg_points_per_game' | 'biggest_hand'
>;
type Tab = 'players' | 'teams';

const AVATAR_COLORS = [
  ['#2B4F37', '#638D6F'],
  ['#78270D', '#C8102E'],
  ['#1a3a5c', '#3a7bd5'],
  ['#4a2060', '#9b59b6'],
  ['#2c4a1a', '#5d9e30'],
  ['#5c3a1a', '#d4812a'],
  ['#1a4a4a', '#2eb8b8'],
];

function Avatar({ name, avatar_b64, size = 40, rank }: { name: string; avatar_b64: string | null; size?: number; rank?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const [bg, accent] = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const medalBorder = rank === 1 ? '#D4AF37' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : null;

  if (avatar_b64) {
    return (
      <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
        <img
          src={`data:image/jpeg;base64,${avatar_b64}`}
          alt={name}
          style={{
            width: size, height: size, borderRadius: '50%', objectFit: 'cover',
            border: medalBorder ? `2.5px solid ${medalBorder}` : '2px solid rgba(255,255,255,0.1)',
            boxShadow: medalBorder ? `0 0 12px ${medalBorder}66` : 'none',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${accent}99, ${bg})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 800, color: '#fff', flexShrink: 0,
      border: medalBorder ? `2.5px solid ${medalBorder}` : '2px solid rgba(255,255,255,0.1)',
      boxShadow: medalBorder ? `0 0 16px ${medalBorder}55` : '0 2px 8px rgba(0,0,0,0.4)',
      letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  );
}

const MEDAL_COLOR = ['#D4AF37', '#C0C0C0', '#CD7F32'];
const MEDAL_GLOW = ['rgba(212,175,55,0.25)', 'rgba(192,192,192,0.15)', 'rgba(205,127,50,0.18)'];
const MEDAL_LABEL = ['CHAMPION', '2ND PLACE', '3RD PLACE'];
const MEDAL_GLOW_FILTER = [
  'drop-shadow(0 6px 18px rgba(212,175,55,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
  'drop-shadow(0 6px 18px rgba(192,192,192,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
  'drop-shadow(0 6px 18px rgba(205,127,50,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
];

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
  const now = new Date();
  // Show from Jan 2026 up to current month
  const startYear = 2026, startMonth = 0;
  const endYear = now.getFullYear(), endMonth = now.getMonth();
  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd   = y === endYear   ? endMonth   : 11;
    for (let m = mStart; m <= mEnd; m++) {
      const value = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      opts.push({ value, label });
    }
  }
  return opts;
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function WinBar({ rate, played }: { rate: number; played: number }) {
  if (!played) return <span style={{ color: '#555' }}>—</span>;
  const color = rate >= 60 ? '#638D6F' : rate >= 40 ? '#D4AF37' : '#C8102E';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ color, fontWeight: 700, fontSize: '0.8125rem' }}>{rate}%</span>
      <div style={{ width: 40, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${rate}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function HallOfFameCard({ player, title, icon, color, stats }: {
  player: PlayerStats;
  title: string;
  icon: string;
  color: string;
  stats: { label: string; value: string | number; color?: string }[];
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0, position: 'relative',
      borderRadius: 24, overflow: 'hidden',
      background: `linear-gradient(160deg, ${color}14 0%, rgba(8,8,16,0.95) 60%)`,
      border: `1px solid ${color}44`,
      boxShadow: `0 0 0 1px ${color}18, 0 20px 60px ${color}22, 0 4px 16px rgba(0,0,0,0.6)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 0 1.25rem',
    }}>
      {/* Animated top bar */}

      {/* Rank badge */}
      <img
        src={`/badges/medal-${rank + 1}.svg`}
        alt={MEDAL_LABEL[rank]}
        style={{ width: isChamp ? 88 : 72, height: isChamp ? 88 : 72, filter: MEDAL_GLOW_FILTER[rank] }}
      />

      <Avatar name={s.name} avatar_b64={s.avatar_b64} size={isChamp ? 70 : 56} rank={rank + 1} />

      <div>
        <div style={{
          fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.15em',
          color, textTransform: 'uppercase', marginBottom: 2,
        }}>{MEDAL_LABEL[rank]}</div>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: isChamp ? '1.125rem' : '1rem', fontWeight: 800,
          color: '#fff', lineHeight: 1.2,
        }}>{s.nickname || s.name}</div>
        {s.nickname && <div style={{ fontSize: '0.75rem', color: 'rgba(221,209,191,0.6)', marginTop: 2 }}>{s.name}</div>}
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.25rem 0.5rem', width: '100%',
        background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '0.5rem 0.375rem',
      }}>
        {[
          { label: 'PTS', value: s.league_points, color },
          { label: 'WIN%', value: `${s.win_rate}%`, color: s.win_rate >= 50 ? '#638D6F' : '#DDD1BF' },
          { label: 'DIGU', value: s.gin_count, color: '#D4AF37' },
        ].map(stat => (
          <div key={stat.label}>
            <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stat.label}</div>
            <div style={{ fontSize: isChamp ? '1rem' : '0.875rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function generateHallOfFameImage(
  champion: PlayerStats | null,
  diguKing: PlayerStats | null,
  period: string
): Promise<Blob> {
  const W = 680, H = 440;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#080C14'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
  bg.addColorStop(0, 'rgba(20,25,45,0.9)'); bg.addColorStop(1, 'rgba(8,12,20,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Top gold bar
  const topBar = ctx.createLinearGradient(0,0,W,0);
  topBar.addColorStop(0,'transparent'); topBar.addColorStop(0.25,'#D4AF37');
  topBar.addColorStop(0.75,'#D4AF37'); topBar.addColorStop(1,'transparent');
  ctx.fillStyle = topBar; ctx.fillRect(0,0,W,3);
  ctx.fillStyle = topBar; ctx.fillRect(0,H-3,W,3);

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillStyle = '#D4AF37';
  ctx.shadowBlur = 20; ctx.shadowColor = '#D4AF37';
  ctx.fillText('✦  HALL OF FAME  ✦', W/2, 52);
  ctx.shadowBlur = 0;
  ctx.font = '600 14px system-ui'; ctx.fillStyle = 'rgba(212,175,55,0.6)';
  ctx.fillText(period, W/2, 76);

  // Gold divider
  ctx.strokeStyle = '#D4AF37'; ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 90); ctx.lineTo(W-60, 90); ctx.stroke();
  ctx.globalAlpha = 1;

  // Draw champion card
  async function drawCard(player: PlayerStats | null, x: number, y: number, w: number, title: string, icon: string, color: string, statRows: {l:string,v:string|number,c:string}[]) {
    if (!player) return;
    // Card bg
    ctx.fillStyle = color + '18';
    ctx.strokeStyle = color + '66'; ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, 300, 16);
    ctx.fill(); ctx.stroke();
    // Top accent
    const cg = ctx.createLinearGradient(x,0,x+w,0);
    cg.addColorStop(0,'transparent'); cg.addColorStop(0.5,color); cg.addColorStop(1,'transparent');
    ctx.fillStyle = cg; ctx.fillRect(x+16, y, w-32, 2);
    // Icon
    ctx.font = '40px serif'; ctx.textAlign = 'center';
    ctx.shadowBlur = 16; ctx.shadowColor = color;
    ctx.fillText(icon, x+w/2, y+58);
    ctx.shadowBlur = 0;
    // Title
    ctx.font = 'bold 11px Georgia, serif'; ctx.fillStyle = color;
    ctx.letterSpacing = '0.2em';
    ctx.fillText(title.toUpperCase(), x+w/2, y+78);
    // Avatar circle
    const ax = x+w/2, ay = y+130, ar = 36;
    ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI*2); ctx.clip();
    const colors = ['#2B4F37','#78270D','#1a3a5c','#4a2060','#2c4a1a'];
    ctx.fillStyle = colors[player.name.charCodeAt(0) % colors.length];
    ctx.fillRect(ax-ar, ay-ar, ar*2, ar*2);
    // Avatar if base64
    if (player.avatar_b64) {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${player.avatar_b64}`;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      ctx.drawImage(img, ax-ar, ay-ar, ar*2, ar*2);
    } else {
      ctx.fillStyle = '#DDD1BF'; ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(player.name.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase(), ax, ay+8);
    }
    ctx.restore();
    // Gold ring
    ctx.beginPath(); ctx.arc(ax, ay, ar+3, 0, Math.PI*2);
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
    // Name
    ctx.textAlign = 'center'; ctx.font = 'bold 17px Georgia, serif';
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 8; ctx.shadowColor = color;
    ctx.fillText(player.nickname || player.name.split(' ')[0], ax, ay+ar+22);
    ctx.shadowBlur = 0;
    if (player.nickname) {
      ctx.font = '500 11px system-ui'; ctx.fillStyle = 'rgba(221,209,191,0.5)';
      ctx.fillText(player.name, ax, ay+ar+38);
    }
    // Stats
    const sy = ay + ar + 60;
    statRows.forEach((s, i) => {
      const sx = x + 20 + i * ((w-40) / statRows.length) + (w-40)/(statRows.length*2);
      ctx.textAlign = 'center';
      ctx.font = '700 9px system-ui'; ctx.fillStyle = '#666';
      ctx.fillText(s.l.toUpperCase(), sx, sy);
      ctx.font = 'bold 18px system-ui'; ctx.fillStyle = s.c;
      ctx.fillText(String(s.v), sx, sy+20);
    });
  }

  function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
    c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
    c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
    c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r); c.closePath();
  }

  await drawCard(champion, 30, 100, 290, 'Champion', '🏆', '#D4AF37', [
    { l:'PTS', v: champion?.league_points??0, c:'#D4AF37' },
    { l:'WIN%', v:`${champion?.win_rate??0}%`, c:'#638D6F' },
    { l:'W', v: champion?.matches_won??0, c:'#638D6F' },
  ]);
  await drawCard(diguKing, 360, 100, 290, 'Digu King', '👑', '#C8102E', [
    { l:'DIGU', v: diguKing?.gin_count??0, c:'#D4AF37' },
    { l:'WIN%', v:`${diguKing?.win_rate??0}%`, c:'#638D6F' },
    { l:'W', v: diguKing?.matches_won??0, c:'#638D6F' },
  ]);

  // Footer
  ctx.textAlign = 'center'; ctx.font = '700 11px Georgia,serif';
  ctx.fillStyle = 'rgba(212,175,55,0.35)';
  ctx.fillText('♠  DIGU LEAGUE  ·  One League. One Crown. One Champion.  ♠', W/2, H-16);

  return new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
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
  const MEDAL_BG = ['rgba(212,175,55,0.13)', 'rgba(168,169,173,0.08)', 'rgba(205,127,50,0.09)'];
  const COL = { rank: 32, avatar: 64, name: 90, gp: 332, w: 390, l: 446, digu: 504, pts: 562, wr: 638 };
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, W, H);
  const hg = ctx.createLinearGradient(0, 0, W, HEADER_H);
  hg.addColorStop(0, '#192b1c'); hg.addColorStop(0.5, '#0d1510'); hg.addColorStop(1, '#192b1c');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, HEADER_H);
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0, 'transparent'); topBar.addColorStop(0.25, '#D4AF37');
  topBar.addColorStop(0.75, '#D4AF37'); topBar.addColorStop(1, 'transparent');
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, W, 3);
  ctx.textAlign = 'center'; ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 28px system-ui, sans-serif'; ctx.fillText('DIGU LEAGUE', W / 2, 44);
  ctx.fillStyle = '#DDD1BF'; ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(`Rankings · ${label}`, W / 2, 68);
  ctx.strokeStyle = '#D4AF37'; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 84); ctx.lineTo(W - 60, 84); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, HEADER_H, W, COL_H);
  ctx.fillStyle = '#666'; ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('PLAYER', COL.name, HEADER_H + 20);
  ctx.textAlign = 'center';
  for (const [l, x] of [['GP', COL.gp], ['W', COL.w], ['L', COL.l], ['DIGU', COL.digu], ['PTS', COL.pts], ['WIN%', COL.wr]] as [string, number][]) {
    ctx.fillText(l, x, HEADER_H + 20);
  }
  rows.forEach((s, i) => {
    const y = HEADER_H + COL_H + i * ROW_H;
    const cy = y + ROW_H / 2;
    const isTop3 = i < 3;
    const isRel = rows.length >= 3 && i >= rows.length - 2;
    const isRelStart = rows.length >= 3 && i === rows.length - 2;
    ctx.fillStyle = isTop3 ? MEDAL_BG[i] : isRel ? 'rgba(200,16,46,0.10)' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
    ctx.fillRect(0, y, W, ROW_H);
    if (isTop3) { ctx.fillStyle = MEDAL_COLORS[i]; ctx.fillRect(0, y, 3, ROW_H); }
    if (isRelStart) {
      ctx.strokeStyle = 'rgba(200,16,46,0.5)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 1); ctx.lineTo(W, y + ROW_H - 1); ctx.stroke();
    ctx.textAlign = 'center';
    if (isTop3) {
      ctx.beginPath(); ctx.arc(COL.rank, cy, 15, 0, Math.PI * 2);
      ctx.fillStyle = MEDAL_COLORS[i] + '33'; ctx.fill();
      ctx.strokeStyle = MEDAL_COLORS[i]; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = MEDAL_COLORS[i]; ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(String(i + 1), COL.rank, cy + 5);
    } else {
      ctx.fillStyle = isRel ? '#FF4A6A' : '#555';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(isRel ? '▼' : String(i + 1), COL.rank, cy + 4);
    }
    const ax = COL.avatar, ay = cy, ar = 17;
    ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
    const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
    ctx.fillStyle = colors[s.name.charCodeAt(0) % colors.length];
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2); ctx.restore();
    ctx.fillStyle = '#DDD1BF'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(), ax, ay + 4);
    if (isTop3) {
      ctx.beginPath(); ctx.arc(ax, ay, ar + 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = MEDAL_COLORS[i]; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.textAlign = 'left'; ctx.fillStyle = isTop3 ? '#ffffff' : '#DDD1BF';
    ctx.font = isTop3 ? '700 15px system-ui, sans-serif' : '600 14px system-ui, sans-serif';
    ctx.fillText(s.nickname || s.name, COL.name, cy + 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa'; ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(String(s.matches_played), COL.gp, cy + 5);
    ctx.fillStyle = '#638D6F'; ctx.fillText(String(s.matches_won), COL.w, cy + 5);
    ctx.fillStyle = '#C8102E'; ctx.fillText(String(s.matches_lost), COL.l, cy + 5);
    ctx.fillStyle = '#D4AF37'; ctx.fillText(String(s.gin_count), COL.digu, cy + 5);
    ctx.fillStyle = '#D4AF37'; ctx.font = isTop3 ? 'bold 16px system-ui, sans-serif' : 'bold 14px system-ui, sans-serif';
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
  const [month, setMonth] = useState(currentMonthValue);
  const [season, setSeason] = useState('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [savingSeason, setSavingSeason] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [awardStats, setAwardStats] = useState<PlayerStats[]>([]);
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

  useEffect(() => {
    fetch(buildUrl('/api/stats'))
      .then(r => r.json())
      .then((data: PlayerStats[]) => setAwardStats(data))
      .catch(() => {});
  }, [month, season]);

  async function handleStartSeason() {
    setSavingSeason(true);
    const res = await fetch('/api/seasons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSeasonName }),
    });
    const data = await res.json() as { ok: boolean; id: string };
    if (data.ok) {
      const updated = await fetch('/api/seasons').then(r => r.json()) as Season[];
      setSeasons(updated); setSeason('current'); setShowSeasonModal(false); setNewSeasonName('');
    }
    setSavingSeason(false);
  }

  async function handleShare() {
    if (!sorted.length) return;
    setSharing(true);
    try {
      const label = month ? monthOptions.find(o => o.value === month)?.label ?? 'All Time' : 'All Time';
      const blob = await generateRankingsImage(sorted, label);
      const file = new File([blob], 'digu-league-rankings.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Digu League Rankings' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'digu-league-rankings.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setSharing(false); }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  }

  const sorted = useMemo(
    () => [...stats].sort((a, b) => {
      const av = a[sortKey] as number, bv = b[sortKey] as number;
      return sortDesc ? bv - av : av - bv;
    }),
    [stats, sortKey, sortDesc]
  );

  const hasPlayed = awardStats.filter(s => s.matches_played > 0);
  const playerOfMonth = hasPlayed.length > 0
    ? hasPlayed.reduce((best, s) => s.league_points > best.league_points ? s : best, hasPlayed[0])
    : null;
  const diguKing = hasPlayed.length > 0
    ? hasPlayed.reduce((best, s) => s.gin_count > best.gin_count ? s : best, hasPlayed[0])
    : null;

  const top3 = sorted.slice(0, 3);

  return (
    <div>
      {/* ── Filter bar ───────────────────────────────────────────── */}
      <div className="filter-bar">
        <select className="filter-select" value={month} onChange={e => setMonth(e.target.value)}>
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {seasons.length > 0 && (
          <select className="filter-select" value={season} onChange={e => setSeason(e.target.value)}>
            <option value="">All Seasons</option>
            <option value="current">Current Season</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <div className="filter-actions">
          <button className="pill-btn gold-btn" onClick={() => { setNewSeasonName(`Season ${new Date().getFullYear()}`); setShowSeasonModal(true); }}>
            ✦ New Season
          </button>
          {tab === 'players' && sorted.length > 0 && (
            <button className="pill-btn green-btn" onClick={handleShare} disabled={sharing}>
              {sharing ? '…' : '📤 Share'}
            </button>
          )}
          <a href="/h2h" className="pill-btn ghost-btn">⚔ H2H</a>
          <a href="/records" className="pill-btn ghost-btn">🏅 Records</a>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="tab-bar">
        {(['players', 'teams'] as const).map(key => (
          <button key={key} type="button" onClick={() => { setTab(key); setLoading(true); }}
            className={`tab-btn ${tab === key ? 'tab-active' : ''}`}>
            {key === 'players' ? '👤 Players' : '👥 Teams'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton-list">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.08}s` }} />)}
        </div>
      ) : tab === 'players' ? (
        <>
          {!stats.length ? (
            <div className="empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎴</div>
              <p>No data{month ? ' for this month' : ''}. Play some matches!</p>
            </div>
          ) : (
            <>
              {/* ── Hall of Fame ─────────────────────────────────────── */}
              {hasPlayed.length > 0 && (playerOfMonth || (diguKing && diguKing.gin_count > 0)) && (() => {
                // Sort by league points to get 2nd and 3rd
                const byPts = [...hasPlayed].sort((a,b) => b.league_points - a.league_points);
                const second = byPts[1] ?? null;
                const third  = byPts[2] ?? null;
                const hofPlayers = [
                  playerOfMonth   ? { player: playerOfMonth, title: 'CHAMPION',  icon: '🏆', color: '#D4AF37', stat: `${playerOfMonth.league_points} PTS` } : null,
                  diguKing && diguKing.gin_count > 0 ? { player: diguKing, title: 'DIGU KING', icon: '👑', color: '#C8102E', stat: `${diguKing.gin_count} DIGU` } : null,
                  second ? { player: second, title: '2ND PLACE', icon: '🥈', color: '#A8A9AD', stat: `${second.league_points} PTS` } : null,
                  third  ? { player: third,  title: '3RD PLACE', icon: '🥉', color: '#CD7F32', stat: `${third.league_points} PTS`  } : null,
                ].filter(Boolean) as { player: PlayerStats; title: string; icon: string; color: string; stat: string }[];

                return (
                <div className="podium-section">
                  {/* One single HOF box */}
                  <div style={{
                    border: '2px solid rgba(212,175,55,0.55)',
                    borderRadius: 20, overflow: 'hidden',
                    background: 'linear-gradient(160deg, #0D1020 0%, #080C18 100%)',
                    boxShadow: '0 0 0 1px rgba(212,175,55,0.12), 0 0 32px rgba(212,175,55,0.2), 0 16px 48px rgba(0,0,0,0.7)',
                    position: 'relative',
                  }}>
                    {/* Top shimmer bar */}
                    <div style={{ height: 3, background: 'linear-gradient(90deg,transparent,#D4AF37,#fff,#D4AF37,transparent)', backgroundSize: '200%',  }} />

                    <div style={{ display: 'flex', minHeight: 260 }}>
                      {/* LEFT: Shield panel */}
                      <div style={{
                        width: '34%', flexShrink: 0,
                        background: 'linear-gradient(160deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.04) 100%)',
                        borderRight: '1px solid rgba(212,175,55,0.15)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '1.5rem 1rem', gap: '0.5rem', position: 'relative',
                      }}>
                        {/* DL Logo */}
                        <img
                          src="/dl-logo-v2.png"
                          alt="Digu League"
                          style={{ width: 150, height: 'auto', objectFit: 'contain' }}
                        />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: '0.5rem', fontWeight: 900, letterSpacing: '0.22em', color: 'rgba(212,175,55,0.7)', textTransform: 'uppercase', marginBottom: 2 }}>DIGU LEAGUE</div>
                          <div style={{ fontFamily: "'Cinzel Decorative', Georgia, serif", fontSize: '1.125rem', fontWeight: 900, color: '#D4AF37', lineHeight: 1, textShadow: '0 0 16px rgba(212,175,55,0.6)', letterSpacing: '0.06em' }}>HALL</div>
                          <div style={{ fontFamily: "'Cinzel Decorative', Georgia, serif", fontSize: '0.75rem', fontWeight: 900, color: 'rgba(212,175,55,0.7)', letterSpacing: '0.1em' }}>of</div>
                          <div style={{ fontFamily: "'Cinzel Decorative', Georgia, serif", fontSize: '1.125rem', fontWeight: 900, color: '#D4AF37', lineHeight: 1, textShadow: '0 0 16px rgba(212,175,55,0.6)', letterSpacing: '0.06em' }}>FAME</div>
                        </div>
                        <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent)', margin: '2px 0' }} />
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.4rem', color: 'rgba(212,175,55,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.6 }}>
                          One League<br/>One Crown<br/>One Champion
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.625rem', color: 'rgba(212,175,55,0.35)', fontFamily: "'Cinzel', serif" }}>
                          {month ? new Date(month+'-01').toLocaleString('en',{month:'long',year:'numeric'}) : new Date().toLocaleString('en',{month:'long',year:'numeric'})}
                        </div>
                      </div>

                      {/* RIGHT: Player strips */}
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${hofPlayers.length}, 1fr)`, gap: 0 }}>
                        {hofPlayers.map((h, i) => {
                          const isFirst = i === 0;
                          const initials = h.player.name.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();
                          const bgColors = ['#2B4F37','#78270D','#1a3a5c','#4a2060','#2c4a1a'];
                          const bg = bgColors[h.player.name.charCodeAt(0) % bgColors.length];
                          return (
                            <div key={h.player.player_id} style={{
                              position: 'relative', overflow: 'hidden',
                              borderLeft: i > 0 ? `1px solid ${h.color}18` : 'none',
                              background: `linear-gradient(160deg, ${h.color}14 0%, rgba(6,8,16,0.97) 55%)`,
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              minHeight: 300,
                            }}>
                              {/* Top accent line */}
                              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${h.color},transparent)` }} />

                              {/* Icon */}
                              <div style={{ marginTop: '1.25rem', marginBottom: '0.75rem', fontSize: '1.375rem', filter:`drop-shadow(0 0 8px ${h.color})` }}>{h.icon}</div>

                              {/* Large circular avatar */}
                              <div style={{
                                width: 90, height: 90,
                                borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                                border: `3px solid ${h.color}`,
                                boxShadow: `0 0 0 5px ${h.color}18, 0 0 28px ${h.color}55, 0 8px 24px rgba(0,0,0,0.5)`,
                                marginBottom: '1rem',
                              }}>
                                {h.player.avatar_b64 ? (
                                  <img src={`data:image/jpeg;base64,${h.player.avatar_b64}`}
                                    style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top' }} />
                                ) : (
                                  <div style={{ width:'100%', height:'100%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize: '2rem', fontWeight:800, color:'#DDD1BF' }}>
                                    {initials}
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div style={{ flex:1, width:'100%', padding:'0 0.75rem 1.25rem', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem' }}>
                                {/* Title */}
                                <div style={{
                                  background:`linear-gradient(135deg,${h.color}35,${h.color}15)`,
                                  border:`1.5px solid ${h.color}55`,
                                  borderRadius:20, padding:'3px 12px',
                                  fontFamily:"Quicksand,sans-serif",
                                  fontSize:'0.5625rem', fontWeight:800,
                                  color:h.color, letterSpacing:'0.14em',
                                  textTransform:'uppercase',
                                }}>{h.title}</div>

                                {/* Nickname */}
                                <div style={{
                                  fontFamily:"Quicksand,sans-serif",
                                  fontSize: '1rem',
                                  fontWeight:800, color:'#fff', lineHeight:1.1,
                                  textShadow:`0 0 16px ${h.color}55`,
                                }}>
                                  {h.player.nickname || h.player.name.split(' ')[0]}
                                </div>

                                {/* Full name */}
                                {h.player.nickname && (
                                  <div style={{ fontSize:'0.6875rem', color:'rgba(200,180,140,0.4)', fontFamily:"Quicksand,sans-serif", lineHeight:1 }}>
                                    {h.player.name}
                                  </div>
                                )}

                                {/* Stat */}
                                <div style={{
                                  background:`linear-gradient(135deg,${h.color}30,${h.color}12)`,
                                  border:`2px solid ${h.color}60`,
                                  borderRadius:24, padding:'5px 16px',
                                  fontSize: '0.625rem',
                                  fontWeight:900, color:h.color,
                                  fontFamily:"Quicksand,sans-serif",
                                  letterSpacing:'0.06em',
                                  boxShadow:`0 0 12px ${h.color}25`,
                                  marginTop:'auto',
                                }}>
                                  {h.stat}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(212,175,55,0.2),transparent)' }} />
                  </div>

                  {/* Share Hall of Fame as Image */}
                  {(playerOfMonth || (diguKing && diguKing.gin_count > 0)) && (() => (
                    <button
                      onClick={async () => {
                        const period = month
                          ? new Date(month + '-01').toLocaleString('en', { month: 'long', year: 'numeric' })
                          : new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
                        try {
                          const blob = await generateHallOfFameImage(playerOfMonth ?? null, (diguKing && diguKing.gin_count > 0) ? diguKing : null, period);
                          const url = URL.createObjectURL(blob);
                          if (navigator.share && navigator.canShare({ files: [new File([blob], 'hall-of-fame.png', { type: 'image/png' })] })) {
                            await navigator.share({ files: [new File([blob], 'hall-of-fame.png', { type: 'image/png' })], title: 'Digu League — Hall of Fame' });
                          } else {
                            const a = document.createElement('a'); a.href = url;
                            a.download = `digu-hall-of-fame-${period.replace(' ', '-')}.png`; a.click();
                          }
                          setTimeout(() => URL.revokeObjectURL(url), 5000);
                        } catch {}
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0.875rem auto 0', padding: '0.625rem 1.25rem', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 30, color: '#25D366', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', width: 'fit-content', transition: 'all .2s', fontFamily: 'inherit' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Share Hall of Fame
                    </button>
                  ))()}
                </div>
                );
              })()}

              {/* ── Full leaderboard table ──────────────────────────── */}
              <div className="lb-table-wrap">
                <table className="lb-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>#</th>
                      <th style={{ textAlign: 'left', minWidth: 130 }}>Player</th>
                      {PLAYER_COLS.map(c => (
                        <th key={c.key} className={`sortable ${sortKey === c.key ? 'active-sort' : ''}`}
                          onClick={() => handleSort(c.key)} title={c.label}>
                          {c.short}
                          {sortKey === c.key && <span style={{ marginLeft: 2, opacity: 0.7 }}>{sortDesc ? '↓' : '↑'}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => {
                      const isTop3 = i < 3;
                      const isRel = sorted.length >= 3 && i >= sorted.length - 2;
                      const isRelStart = sorted.length >= 3 && i === sorted.length - 2;
                      return (
                        <>
                          {isRelStart && (
                            <tr key="rel-div" className="rel-divider-row">
                              <td colSpan={9}>
                                <div className="rel-label">▼ Relegation Zone</div>
                              </td>
                            </tr>
                          )}
                          <tr key={s.player_id} className={`lb-row ${isTop3 ? `top-${i+1}` : ''} ${isRel ? 'rel-row' : ''}`}>
                            <td className="rank-cell">
                              {isTop3 ? (
                                <div className="rank-medal" style={{ borderColor: MEDAL_COLOR[i], color: MEDAL_COLOR[i], boxShadow: `0 0 10px ${MEDAL_COLOR[i]}44` }}>
                                  {i + 1}
                                </div>
                              ) : isRel ? (
                                <span style={{ color: '#FF4A6A', fontSize: '1rem' }}>⬇</span>
                              ) : (
                                <span className="rank-num">{i + 1}</span>
                              )}
                            </td>
                            <td>
                              <a href={`/players/${s.player_id}`} className="player-cell">
                                <Avatar name={s.name} avatar_b64={s.avatar_b64} size={34} rank={isTop3 ? i + 1 : undefined} />
                                <div>
                                  <div className="player-name">{s.name}</div>
                                  {s.nickname && <div className="player-nick">{s.nickname}</div>}
                                </div>
                              </a>
                            </td>
                            <td className={sortKey === 'matches_played' ? 'active-col' : ''}><span className="stat-val">{s.matches_played}</span></td>
                            <td className={sortKey === 'matches_won' ? 'active-col' : ''}><span className="stat-val win">{s.matches_won}</span></td>
                            <td className={sortKey === 'matches_lost' ? 'active-col' : ''}><span className="stat-val loss">{s.matches_lost}</span></td>
                            <td className={sortKey === 'gin_count' ? 'active-col' : ''}><span className="stat-val gold">{s.gin_count}</span></td>
                            <td className={sortKey === 'league_points' ? 'active-col' : ''}>
                              <span className="stat-val pts">{s.league_points}</span>
                            </td>
                            <td className={sortKey === 'win_rate' ? 'active-col' : ''}>
                              <WinBar rate={s.win_rate} played={s.matches_played} />
                            </td>
                          </tr>
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {!teamStats.length ? (
            <div className="empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🃏</div>
              <p>No team data{month ? ' for this month' : ''}. Play 2v2 matches!</p>
            </div>
          ) : (
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ textAlign: 'left' }}>Team</th>
                    <th title="League Points">PTS</th>
                    <th title="Matches Played">GP</th>
                    <th title="Wins">W</th>
                    <th title="Draws">D</th>
                    <th title="Losses">L</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((t, i) => (
                    <tr key={t.team_name} className={`lb-row ${i < 3 ? `top-${i+1}` : ''}`}>
                      <td className="rank-cell">
                        {i < 3 ? (
                          <div className="rank-medal" style={{ borderColor: MEDAL_COLOR[i], color: MEDAL_COLOR[i] }}>{i + 1}</div>
                        ) : <span className="rank-num">{i + 1}</span>}
                      </td>
                      <td><span className="player-name">{t.team_name}</span></td>
                      <td><span className="stat-val pts">{t.league_points}</span></td>
                      <td><span className="stat-val">{t.matches_played}</span></td>
                      <td><span className="stat-val win">{t.matches_won}</span></td>
                      <td><span className="stat-val">{t.matches_drawn}</span></td>
                      <td><span className="stat-val loss">{t.matches_lost}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}


      <style>{`
        /* Filter bar */
        .filter-bar {
          display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
          margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 14px;
        }
        .filter-select {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: var(--cream); border-radius: 10px; padding: 0.5rem 0.75rem;
          font-size: 0.8125rem; font-weight: 600; flex: 1; min-width: 140px; max-width: 200px;
          cursor: pointer; outline: none;
        }
        .filter-select:focus { border-color: var(--gold); }
        .filter-actions { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-left: auto; }
        .pill-btn {
          padding: 0.5rem 0.875rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700;
          border: 1.5px solid; cursor: pointer; white-space: nowrap; text-decoration: none;
          display: inline-flex; align-items: center; gap: 0.25rem; transition: all 0.15s;
        }
        .gold-btn { border-color: var(--gold); color: var(--gold); background: rgba(212,175,55,0.07); }
        .gold-btn:hover { background: rgba(212,175,55,0.15); }
        .green-btn { border-color: var(--felt-light); color: var(--felt-light); background: rgba(99,141,111,0.07); }
        .green-btn:hover { background: rgba(99,141,111,0.15); }
        .ghost-btn { border-color: rgba(255,255,255,0.12); color: var(--text-muted); background: transparent; }
        .ghost-btn:hover { border-color: rgba(255,255,255,0.25); color: var(--cream); }

        /* Tab bar */
        .tab-bar { display: flex; gap: 4px; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px; margin-bottom: 1.25rem; }
        .tab-btn {
          flex: 1; padding: 0.625rem; border-radius: 9px; border: none; cursor: pointer;
          font-weight: 700; font-size: 0.875rem; transition: all 0.15s;
          background: transparent; color: var(--text-muted);
        }
        .tab-active { background: var(--felt); color: var(--cream); box-shadow: 0 2px 8px rgba(0,0,0,0.4); }

        /* Skeleton */
        .skeleton-list { display: flex; flex-direction: column; gap: 6px; }
        .skeleton-row { height: 56px; border-radius: 12px; background: rgba(255,255,255,0.04); animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }

        /* Podium + Hall of Fame */
        .podium-section { margin-bottom: 1.5rem; }
        .podium-grid {
          display: flex; gap: 0.75rem; align-items: flex-end;
        }
        .podium-grid .podium-rank-0 { order: 2; }
        .podium-grid .podium-rank-1 { order: 1; }
        .podium-grid .podium-rank-2 { order: 3; }
        .hof-grid {
          display: flex; gap: 0.75rem; align-items: stretch;
        }
        @media (max-width: 480px) {
          .podium-grid { flex-direction: column; }
          .podium-grid .podium-rank-0,
          .podium-grid .podium-rank-1,
          .podium-grid .podium-rank-2 { order: unset; }
          .hof-grid { flex-direction: column; }
        }

        /* Table */
        .lb-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 16px; overflow: hidden; border: 1.5px solid rgba(212,175,55,0.4); box-shadow: 0 0 20px rgba(212,175,55,0.1), inset 0 1px 0 rgba(212,175,55,0.06); }
        .lb-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .lb-table thead { background: rgba(255,255,255,0.04); }
        .lb-table th {
          padding: 0.75rem 0.5rem; text-align: center;
          font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--text-muted);
          border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap;
        }
        .lb-table th.sortable { cursor: pointer; user-select: none; }
        .lb-table th.sortable:hover { color: var(--cream); }
        .lb-table th.active-sort { color: var(--gold); }

        /* Rows */
        .lb-row td { padding: 0.625rem 0.5rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.12s; }
        .lb-row:hover td { background: rgba(255,255,255,0.03); }
        .lb-row:last-child td { border-bottom: none; }
        .top-1 td { background: rgba(212,175,55,0.06); }
        .top-2 td { background: rgba(192,192,192,0.04); }
        .top-3 td { background: rgba(205,127,50,0.04); }
        .top-1:hover td { background: rgba(212,175,55,0.1); }
        .rel-row td { background: rgba(200,16,46,0.08); }
        .rel-row td:first-child { border-left: 2px solid rgba(200,16,46,0.6); }

        /* Rank cells */
        .rank-cell { text-align: center !important; }
        .rank-medal {
          width: 28px; height: 28px; border-radius: 50%; border: 2px solid;
          display: inline-flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.8125rem; margin: 0 auto;
        }
        .rank-num { color: var(--text-muted); font-weight: 700; font-size: 0.8125rem; }

        /* Player cell */
        .player-cell {
          display: flex; align-items: center; gap: 0.5rem;
          text-decoration: none; color: inherit; text-align: left;
        }
        .player-name { font-weight: 700; font-size: 0.9375rem; color: var(--text-primary); white-space: nowrap; }
        .player-nick { font-size: 0.75rem; color: var(--felt-light); font-weight: 600; }

        /* Stat values */
        .stat-val { font-weight: 700; font-size: 0.875rem; color: var(--text-primary); }
        .stat-val.win { color: var(--felt-light); }
        .stat-val.loss { color: var(--ember); }
        .stat-val.gold { color: var(--gold); }
        .stat-val.pts { color: var(--gold); font-size: 1rem; }
        .active-col .stat-val { color: var(--cream) !important; }

        /* Relegation */
        .rel-divider-row td { padding: 0 !important; border: none !important; }
        .rel-label {
          font-size: 0.625rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #FF6B8A;
          padding: 0.375rem 0.75rem;
          background: rgba(200,16,46,0.12);
          border-top: 1px dashed rgba(200,16,46,0.4);
          border-bottom: 1px dashed rgba(200,16,46,0.4);
        }


        /* Empty state */
        .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }
        .empty-state p { font-size: 0.9375rem; }
      `}</style>

      {/* Season modal */}
      {showSeasonModal && (
        <div className="modal-overlay centered">
          <div className="modal-sheet" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Start New Season</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              All completed matches will be archived. Rankings reset to zero.
            </p>
            <div className="form-group" style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label className="form-label">Season Name</label>
              <input className="form-input" value={newSeasonName}
                onChange={e => setNewSeasonName(e.target.value)} placeholder="e.g. Season 1" />
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn btn-ghost btn-block" onClick={() => setShowSeasonModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleStartSeason}
                disabled={savingSeason || !newSeasonName.trim()}>
                {savingSeason ? 'Starting…' : 'Start Season'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
