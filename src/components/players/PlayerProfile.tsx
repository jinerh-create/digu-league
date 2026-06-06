import { useState, useEffect } from 'react';
import type { Player, Match } from '../../lib/types';

function Avatar({ name, b64, size = 64 }: { name: string; b64?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (b64) return <img src={`data:image/jpeg;base64,${b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#DDD1BF', flexShrink: 0, border: '2px solid var(--border)' }}>
      {initials}
    </div>
  );
}

function nick(name?: string | null, nickname?: string | null) {
  return nickname || (name ?? '').split(' ')[0] || (name ?? '');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Badge = {
  id: string;
  name: string;
  desc: string;
  image: string;
  unlocked: boolean;
  blend?: 'lighten' | 'normal';
  removeWhite?: boolean;
  fullBleed?: boolean;
  darkenWhite?: boolean;
};

const LEVELS = [
  { name: 'OC Grandmaster', icon: '🏆', color: '#FFD700', threshold: 3000000 },
  { name: 'Legend',         icon: '🌟', color: '#FBBF24', threshold: 2000000 },
  { name: 'Mythic II',      icon: '🔥', color: '#EF4444', threshold: 1500000 },
  { name: 'Mythic I',       icon: '🔥', color: '#F87171', threshold: 1250000 },
  { name: 'Titan II',       icon: '⚔️', color: '#F97316', threshold: 1000000 },
  { name: 'Titan I',        icon: '⚔️', color: '#FB923C', threshold:  850000 },
  { name: 'Royal II',       icon: '👑', color: '#E879F9', threshold:  700000 },
  { name: 'Royal I',        icon: '👑', color: '#C026D3', threshold:  580000 },
  { name: 'Ace II',         icon: '🃏', color: '#A78BFA', threshold:  470000 },
  { name: 'Ace I',          icon: '🃏', color: '#8B5CF6', threshold:  380000 },
  { name: 'Diamond II',     icon: '💎', color: '#38BDF8', threshold:  300000 },
  { name: 'Diamond I',      icon: '💎', color: '#67E8F9', threshold:  230000 },
  { name: 'Platinum II',    icon: '💠', color: '#22D3EE', threshold:  180000 },
  { name: 'Platinum I',     icon: '💠', color: '#06B6D4', threshold:  140000 },
  { name: 'Gold II',        icon: '🥇', color: '#D4AF37', threshold:  100000 },
  { name: 'Gold I',         icon: '🥇', color: '#EAB308', threshold:   75000 },
  { name: 'Silver II',      icon: '🥈', color: '#94A3B8', threshold:   50000 },
  { name: 'Silver I',       icon: '🥈', color: '#B0B8C8', threshold:   35000 },
  { name: 'Bronze II',      icon: '🥉', color: '#B87333', threshold:   20000 },
  { name: 'Bronze I',       icon: '🥉', color: '#CD7F32', threshold:   10000 },
  { name: 'Rookie',         icon: '🎴', color: '#6B7280', threshold:       0 },
] as const;

function getLevel(score: number): { name: string; color: string; next: number; current: number; icon: string; nextName: string } {
  for (let i = 0; i < LEVELS.length; i++) {
    if (score >= LEVELS[i].threshold) {
      const next = i > 0 ? LEVELS[i - 1].threshold : 0;
      const nextName = i > 0 ? LEVELS[i - 1].name : '';
      return { name: LEVELS[i].name, icon: LEVELS[i].icon, color: LEVELS[i].color, current: LEVELS[i].threshold, next, nextName };
    }
  }
  const last = LEVELS[LEVELS.length - 1];
  return { name: last.name, icon: last.icon, color: last.color, current: 0, next: LEVELS[LEVELS.length - 2].threshold, nextName: LEVELS[LEVELS.length - 2].name };
}

function buildBadges(totalScore: number, ginCount: number, maxWinStreak: number, perfectMatches: number, centuryHands: number, totalMatches: number): Badge[] {
  return [
    {
      id: 'streak_emperor',
      name: 'Streak Emperor',
      desc: 'Win 5 matches in a row',
      image: '/badges/streak-emperor.jpg',
      unlocked: maxWinStreak >= 5,
      fullBleed: true,
    },
    {
      id: 'three_streak',
      name: '3 Win Streak',
      desc: 'Win 3 matches in a row',
      image: '/badges/three-streak.png',
      unlocked: maxWinStreak >= 3,
      fullBleed: true,
    },
    {
      id: 'streak_10',
      name: '10 Win Streak',
      desc: 'Coming soon',
      image: '/badges/streak-10.png',
      unlocked: false,
      blend: 'lighten',
    },
    {
      id: 'streak_15',
      name: '15 Win Streak',
      desc: 'Coming soon',
      image: '/badges/streak-15.png',
      unlocked: false,
      blend: 'lighten',
    },
    {
      id: 'streak_20',
      name: '20 Win Streak',
      desc: 'Coming soon',
      image: '/badges/streak-20.png',
      unlocked: false,
      blend: 'lighten',
    },
    {
      id: 'digu_25',
      name: '25 Digu',
      desc: 'Achieve 25 Digu hands',
      image: '/badges/digu-25.png',
      unlocked: ginCount >= 25,
      fullBleed: true,
    },
    {
      id: 'games_50',
      name: '50 Games Played',
      desc: 'Coming soon',
      image: '/badges/games-50.png',
      unlocked: false,
      blend: 'lighten',
    },
    {
      id: 'hundred_club',
      name: 'The Hundred Club',
      desc: 'Achieve 100 Digu hands',
      image: '/badges/hundred-club.png',
      unlocked: ginCount >= 100,
    },
    {
      id: 'ace_titan',
      name: 'Ace Titan',
      desc: 'Achieve 200 Digu hands',
      image: '/badges/ace-titan.png',
      unlocked: ginCount >= 200,
    },
    {
      id: 'loyal_fifty',
      name: 'The Loyal Fifty',
      desc: 'Play 50 games all time',
      image: '/badges/loyal-fifty.png',
      unlocked: totalMatches >= 50,
      fullBleed: true,
    },
  ];
}

type Trophy = { id: string; name: string; period: string; image: string; desc: string };

function TrophyCase({ trophiesJson }: { trophiesJson: string | undefined | null }) {
  let trophies: Trophy[] = [];
  try {
    if (trophiesJson && trophiesJson !== '[]' && trophiesJson !== 'null') {
      const parsed = JSON.parse(trophiesJson);
      trophies = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    trophies = [];
  }

  if (trophies.length === 0) return null;

  return (
    <>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem'
      }}>
        <span>🏆 Trophy Cabinet</span>
        <span style={{ color: '#D4AF37', fontWeight: 800 }}>· {trophies.length}</span>
      </div>
      <div className="card" style={{
        padding: '1.5rem', marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, transparent 60%)',
        border: '1px solid rgba(212,175,55,0.2)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', justifyContent: 'center', alignItems: 'flex-end' }}>
          {trophies.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {/* Trophy display — circular for coins, canvas for champion */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {t.image.includes('champion') ? (
                  /* Champion trophy: canvas removes white bg */
                  <>
                    <img src={t.image} alt="" style={{ display: 'none' }} crossOrigin="anonymous"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const canvas = img.nextElementSibling as HTMLCanvasElement;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const d = data.data;
                        for (let i = 0; i < d.length; i += 4) {
                          const bright = (d[i] + d[i+1] + d[i+2]) / 3;
                          const sat = Math.max(d[i],d[i+1],d[i+2]) - Math.min(d[i],d[i+1],d[i+2]);
                          if (bright > 205 && sat < 45) d[i+3] = Math.max(0, 255 - (bright - 205) * 10);
                        }
                        ctx.putImageData(data, 0, 0);
                        canvas.style.display = 'block';
                      }}
                    />
                    <canvas style={{ width: 180, height: 'auto', display: 'none', filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.7))', position: 'relative', zIndex: 1 }} />
                  </>
                ) : (
                  /* Coins: circular frame clips square background */
                  <div style={{
                    width: 160, height: 160, borderRadius: '50%',
                    overflow: 'hidden', position: 'relative', flexShrink: 0,
                    boxShadow: '0 0 0 3px #D4AF37, 0 0 0 6px rgba(212,175,55,0.2), 0 0 40px rgba(212,175,55,0.45), 0 8px 32px rgba(0,0,0,0.6)',
                  }}>
                    <img src={t.image} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
              </div>
              {/* Labels */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '1rem', fontWeight: 900, color: '#D4AF37',
                  marginBottom: '0.375rem', lineHeight: 1.2,
                  textShadow: '0 0 20px rgba(212,175,55,0.5)',
                }}>
                  {t.name}
                </div>
                <div style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: '#D4AF37',
                  background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
                  borderRadius: 20, padding: '4px 14px', display: 'inline-block', marginBottom: '0.375rem',
                }}>
                  {t.period}
                </div>
                {t.desc && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes trophy-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes trophy-glow-shadow {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scaleX(1); }
          50% { opacity: 1; transform: translateX(-50%) scaleX(1.2); }
        }
        @keyframes trophy-glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(212,175,55,0.6)) drop-shadow(0 8px 24px rgba(0,0,0,0.8)); }
          50% { filter: drop-shadow(0 0 35px rgba(212,175,55,0.9)) drop-shadow(0 8px 24px rgba(0,0,0,0.8)); }
        }
      `}</style>
    </>
  );
}

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

const CARD_THRESHOLDS: Record<string, number> = {
  // Wave 1 — starts with 8, mixed high/low across columns
  '8♠':  10000, '2♥':  20000, 'K♦':  30000, '5♣':  40000,
  'J♠':  50000, '3♥':  60000, 'A♦':  70000, '7♣':  80000,
  'Q♠':  90000, '4♥': 100000, '9♦': 110000, '6♣': 120000,
  '10♠':130000,
  // Wave 2
  '8♥': 140000, '2♦': 150000, 'K♣': 160000, '5♠': 170000,
  'J♥': 180000, '3♦': 190000, 'A♣': 200000, '7♠': 210000,
  'Q♥': 220000, '4♦': 230000, '9♣': 240000, '6♠': 250000,
  '10♥':260000,
  // Wave 3
  '8♦': 270000, '2♣': 280000, 'K♠': 290000, '5♥': 300000,
  'J♦': 310000, '3♣': 320000, 'A♠': 330000, '7♥': 340000,
  'Q♦': 350000, '4♣': 360000, '9♠': 370000, '6♥': 380000,
  '10♦':390000,
  // Wave 4
  '8♣': 400000, '2♠': 410000, 'K♥': 420000, '5♦': 430000,
  'J♣': 440000, '3♠': 450000, 'A♥': 460000, '7♦': 470000,
  'Q♣': 480000, '4♠': 490000, '9♥': 500000, '6♦': 510000,
  '10♣':520000,
};

function CardCollection({ totalScore }: { totalScore: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const unlockedCount = Object.values(CARD_THRESHOLDS).filter(t => totalScore >= t).length;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Card Collection · {unlockedCount}/52 Unlocked
      </div>
      <div className="card" style={{ padding: '0.75rem' }}>
        {/* Value header row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 4, marginBottom: '0.5rem' }}>
          {VALUES.map(v => (
            <div key={v} style={{ textAlign: 'center', fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)' }}>{v}</div>
          ))}
        </div>

        {/* Card rows by suit */}
        {SUITS.map(suit => (
          <div key={suit} style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 4, marginBottom: 5 }}>
            {VALUES.map(val => {
              const key = `${val}${suit}`;
              const threshold = CARD_THRESHOLDS[key];
              const unlocked = totalScore >= threshold;
              const isHovered = hovered === key;
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    aspectRatio: '2/3',
                    borderRadius: 5,
                    background: unlocked
                      ? 'linear-gradient(150deg, #f5e070 0%, #d4af37 45%, #8b6210 100%)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${unlocked ? '#c8a020' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    boxShadow: unlocked
                      ? (isHovered ? '0 0 12px rgba(212,175,55,0.7)' : '0 2px 6px rgba(212,175,55,0.3)')
                      : 'none',
                    transform: isHovered && unlocked ? 'translateY(-4px) scale(1.1)' : 'none',
                    transition: 'all 0.15s',
                    cursor: 'default',
                  }}
                  title={unlocked ? `${val}${suit} — Unlocked!` : `${val}${suit} — Reach ${threshold.toLocaleString()} pts to unlock`}
                >
                  <span style={{ fontSize: '0.5rem', fontWeight: 900, color: unlocked ? '#1a1000' : '#2a2a2a', lineHeight: 1 }}>{val}</span>
                  <span style={{ fontSize: '0.6875rem', color: unlocked ? '#3d2c00' : '#1e1e1e', lineHeight: 1 }}>{suit}</span>
                </div>
              );
            })}
          </div>
        ))}

        {/* Progress bar */}
        <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
          <div style={{
            width: `${(unlockedCount / 52) * 100}%`, height: '100%',
            background: 'linear-gradient(90deg, #c8980a, #f5e070)',
            borderRadius: 4, transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ marginTop: '0.375rem', fontSize: '0.5625rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Score pts to unlock cards</span>
          <span>{unlockedCount}/52</span>
        </div>
      </div>
    </div>
  );
}

export default function PlayerProfile({ playerId }: { playerId: string }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [ginCount, setGinCount] = useState(0);
  const [maxWinStreak, setMaxWinStreak] = useState(0);
  const [perfectMatches, setPerfectMatches] = useState(0);
  const [centuryHands, setCenturyHands] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [monthGinCount, setMonthGinCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}/stats`)
      .then(r => r.json())
      .then((data: { player: Player; matches: Match[]; totalScore: number; ginCount: number; maxWinStreak: number; perfectMatches: number; centuryHands: number; error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setPlayer(data.player);
        setMatches(data.matches);
        setTotalScore(data.totalScore ?? 0);
        setGinCount(data.ginCount ?? 0);
        setMaxWinStreak(data.maxWinStreak ?? 0);
        setPerfectMatches(data.perfectMatches ?? 0);
        setCenturyHands(data.centuryHands ?? 0);
        setLoading(false);
        // Fetch monthly gin count
        const now = new Date();
        const doneM = (data.matches || []).filter((m: Match) => m.completed_at);
        let activeM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        if (doneM.length > 0 && !doneM.some((m: Match) => m.completed_at!.startsWith(activeM))) {
          const sorted = doneM.map((m: Match) => m.completed_at!.substring(0,7)).sort().reverse();
          activeM = sorted[0];
        }
        fetch(`/api/stats?month=${activeM}`)
          .then(r => r.json())
          .then((stats: {player_id:string; gin_count:number}[]) => {
            const found = stats.find((s: {player_id:string}) => s.player_id === playerId);
            setMonthGinCount(found?.gin_count ?? 0);
          })
          .catch(() => setMonthGinCount(0));
      })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [playerId]);

  if (loading) return <div className="loading">Loading profile…</div>;
  if (error || !player) return <div className="error-message">{error || 'Player not found'}</div>;

  const won = matches.filter(m => {
    const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;
    return onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
  }).length;
  const drawn = matches.filter(m => m.completed_at && !m.winner_id).length;
  const lost = matches.length - won - drawn;
  const leaguePoints = won * 3 + drawn;
  const winRate = matches.length > 0 ? Math.round((won / matches.length) * 100) : 0;

  // Current streak
  let streak = 0; let streakType = '';
  for (const m of matches) {
    const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;
    const isWin = onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
    const isLoss = m.winner_id && !isWin;
    if (streak === 0) {
      if (isWin) { streak = 1; streakType = 'W'; }
      else if (isLoss) { streak = 1; streakType = 'L'; }
      else break;
    } else if (streakType === 'W' && isWin) streak++;
    else if (streakType === 'L' && isLoss) streak++;
    else break;
  }

  const level = getLevel(totalScore);
  const badges = buildBadges(totalScore, ginCount, maxWinStreak, perfectMatches, centuryHands, matches.length);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const cardsCollected = Object.values(CARD_THRESHOLDS).filter(t => totalScore >= t).length;

  // ── Generate player profile image ──────────────────────────────────────
  async function shareProfile() {
    const W = 680;
    const unlockedBadges = badges.filter(b => b.unlocked);
    const H = 120 + 90 + 80 + 110 + (unlockedBadges.length > 0 ? 110 : 0) + 60;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = Math.max(H, 480);
    const ctx = canvas.getContext('2d')!;

    // BG
    ctx.fillStyle = '#08080F'; ctx.fillRect(0, 0, W, canvas.height);
    const bg = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, 400);
    bg.addColorStop(0, 'rgba(20,16,40,0.9)'); bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, canvas.height);

    // Top bar
    const bar = ctx.createLinearGradient(0,0,W,0);
    bar.addColorStop(0,'transparent'); bar.addColorStop(0.25,level.color);
    bar.addColorStop(0.75,level.color); bar.addColorStop(1,'transparent');
    ctx.fillStyle = bar; ctx.fillRect(0,0,W,3);

    // Avatar
    const ax=60, ay=72, ar=44;
    ctx.save(); ctx.beginPath(); ctx.arc(ax,ay,ar,0,Math.PI*2); ctx.clip();
    const colors2 = ['#2B4F37','#78270D','#1a3a5c','#4a2060','#2c4a1a'];
    ctx.fillStyle = colors2[player.name.charCodeAt(0) % colors2.length];
    ctx.fillRect(ax-ar,ay-ar,ar*2,ar*2);
    if (player.avatar_b64) {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${player.avatar_b64}`;
      await new Promise(r => { img.onload=r; img.onerror=r; });
      ctx.drawImage(img, ax-ar,ay-ar,ar*2,ar*2);
    } else {
      ctx.fillStyle='#DDD1BF'; ctx.font='bold 26px system-ui'; ctx.textAlign='center';
      ctx.fillText(player.name.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase(), ax, ay+9);
    }
    ctx.restore();
    // Level ring
    ctx.beginPath(); ctx.arc(ax,ay,ar+3,0,Math.PI*2);
    ctx.strokeStyle=level.color; ctx.lineWidth=2.5; ctx.stroke();

    // Name + level
    ctx.textAlign='left'; ctx.fillStyle='#fff';
    ctx.font='bold 22px system-ui';
    ctx.fillText(player.nickname || player.name, 120, 58);
    if (player.nickname) { ctx.fillStyle='rgba(221,209,191,0.5)'; ctx.font='500 13px system-ui'; ctx.fillText(player.name, 120, 76); }
    ctx.fillStyle=level.color; ctx.font='700 12px system-ui';
    ctx.fillText(`${level.icon} ${level.name}  ·  Since ${formatDate(player.joined_at)}`, 120, 98);

    // Divider
    ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(20,120); ctx.lineTo(W-20,120); ctx.stroke();

    // Score banner
    let y=130;
    ctx.fillStyle='rgba(212,175,55,0.08)'; ctx.strokeStyle='rgba(212,175,55,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(20,y,W-40,72,10); ctx.fill(); ctx.stroke();
    ctx.textAlign='left'; ctx.fillStyle='rgba(212,175,55,0.55)'; ctx.font='700 9px system-ui';
    ctx.fillText('ALL-TIME TOTAL SCORE', 36, y+20);
    ctx.fillStyle='#D4AF37'; ctx.font='bold 32px system-ui';
    ctx.fillText(totalScore.toLocaleString(), 36, y+54);
    ctx.textAlign='right'; ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='32px serif';
    ctx.fillText('♦', W-36, y+54);

    // Stats grid
    y+=84;
    const statItems=[
      {l:'Matches',v:String(matches.length),c:'#8ABFCC'},{l:'Won',v:String(won),c:'#638D6F'},
      {l:'Lost',v:String(lost),c:'#C8102E'},{l:'Digu',v:String(ginCount),c:'#a78bfa'},
      {l:'Win Rate',v:`${winRate}%`,c:winRate>=50?'#638D6F':'#888'},{l:'League Pts',v:String(leaguePoints),c:'#D4AF37'},
    ];
    const cellW=(W-40)/6, cellH=72;
    statItems.forEach((s,i)=>{
      const cx=20+i*cellW, cy=y;
      ctx.fillStyle='rgba(255,255,255,0.03)'; ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(cx+2,cy,cellW-4,cellH,8); ctx.fill(); ctx.stroke();
      ctx.textAlign='center'; ctx.fillStyle=s.c; ctx.font='bold 18px system-ui';
      ctx.fillText(s.v, cx+cellW/2, cy+36);
      ctx.fillStyle='#666'; ctx.font='700 8px system-ui';
      ctx.fillText(s.l.toUpperCase(), cx+cellW/2, cy+56);
    });

    // Badges row
    if (unlockedBadges.length > 0) {
      y+=82;
      ctx.fillStyle='rgba(212,175,55,0.5)'; ctx.font='700 9px system-ui'; ctx.textAlign='left';
      ctx.fillText(`🏅 BADGES  ·  ${unlockedCount}/${badges.length} UNLOCKED`, 24, y+2);
      y+=14;
      const bSize=56, bGap=8, bPerRow=Math.min(unlockedBadges.length, 10);
      const totalBW = bPerRow*(bSize+bGap)-bGap;
      const bx0 = (W-totalBW)/2;
      unlockedBadges.slice(0,10).forEach((b,i)=>{
        const bx=bx0+i*(bSize+bGap), by=y;
        ctx.save(); ctx.beginPath(); ctx.arc(bx+bSize/2,by+bSize/2,bSize/2,0,Math.PI*2); ctx.clip();
        ctx.fillStyle='rgba(30,30,50,0.8)'; ctx.fillRect(bx,by,bSize,bSize);
        const bImg=new Image(); bImg.src=b.image;
        ctx.restore();
        ctx.beginPath(); ctx.arc(bx+bSize/2,by+bSize/2,bSize/2+1.5,0,Math.PI*2);
        ctx.strokeStyle='#D4AF37'; ctx.lineWidth=2; ctx.stroke();
      });
    }

    // Footer
    ctx.textAlign='center'; ctx.fillStyle='rgba(212,175,55,0.3)'; ctx.font='700 10px Georgia,serif';
    ctx.fillText('♠  DIGU LEAGUE  ·  Play Smart. Win Big. Reign Supreme.  ♠', W/2, canvas.height-14);

    return new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'));
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/leaderboard" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>← Leaderboard</a>
        <button
          onClick={async () => {
            try {
              const blob = await shareProfile();
              const name = (player.nickname || player.name).replace(/\s+/g,'-');
              if (navigator.share && navigator.canShare({ files: [new File([blob], `${name}-stats.png`, { type: 'image/png' })] })) {
                await navigator.share({ files: [new File([blob], `${name}-stats.png`, { type: 'image/png' })], title: `${player.nickname || player.name} — Digu League` });
              } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${name}-digu-stats.png`; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
              }
            } catch {}
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 20, color: '#25D366', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Share Stats
        </button>
      </div>

      {/* Header card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              background: `conic-gradient(${level.color} 0%, ${level.color}88 60%, transparent 100%)`,
              animation: 'spin 4s linear infinite',
            }} />
            <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: `conic-gradient(transparent 60%, ${level.color}88 80%, ${level.color} 100%)` }} />
            <div style={{ position: 'relative', borderRadius: '50%', padding: 3, background: 'var(--card)' }}>
              <Avatar name={player.name} b64={player.avatar_b64} size={72} />
            </div>
            <div style={{
              position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
              background: level.color, color: '#000', fontSize: '0.5rem', fontWeight: 900,
              padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap', letterSpacing: '0.03em',
            }}>{level.icon} {level.name}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {player.nickname || player.name}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                background: `${level.color}22`, border: `1px solid ${level.color}66`,
                borderRadius: 20, padding: '0.15rem 0.6rem',
                fontSize: '0.6875rem', fontWeight: 800, color: level.color,
                letterSpacing: '0.04em',
              }}>
                {level.icon} {level.name}
              </div>
            </div>
            {player.nickname && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{player.name}</div>}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Since {formatDate(player.joined_at)}
            </div>
            {level.next > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ height: 4, background: 'var(--card-raised)', borderRadius: 2, overflow: 'hidden', width: 160 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: level.color, width: `${Math.min(100, ((totalScore - level.current) / (level.next - level.current)) * 100)}%`, transition: 'width 0.6s' }} />
                </div>
                <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {totalScore.toLocaleString()} / {level.next.toLocaleString()} to {level.nextName}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All-time total score banner */}
        <div style={{
          background: 'linear-gradient(135deg, #2a1e00 0%, #3d2e05 50%, #2a1e00 100%)',
          border: '1px solid rgba(212,175,55,0.4)',
          borderRadius: 12, padding: '0.875rem 1rem',
          marginBottom: '0.625rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 0 12px rgba(212,175,55,0.12)',
        }}>
          <div>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(212,175,55,0.6)', marginBottom: '0.2rem' }}>All-Time Total Score</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#D4AF37', lineHeight: 1, letterSpacing: '-0.02em' }}>{totalScore.toLocaleString()}</div>
            <div style={{ fontSize: '0.5625rem', color: 'rgba(212,175,55,0.5)', marginTop: '0.2rem' }}>points scored across all matches</div>
          </div>
          <div style={{ fontSize: '2.25rem', opacity: 0.5 }}>♦</div>
        </div>

        {/* Monthly Stats banner */}
        {(() => {
          const now = new Date();
          const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
          const doneM = matches.filter(m => m.completed_at);
          let activeMonth = thisMonth;
          if (doneM.length > 0 && !doneM.some(m => m.completed_at!.startsWith(thisMonth))) {
            const sorted = doneM.map(m => m.completed_at!.substring(0,7)).sort().reverse();
            activeMonth = sorted[0];
          }
          const activeDate = new Date(activeMonth + '-01');
          const monthName = activeDate.toLocaleString('en', { month: 'long', year: 'numeric' });
          const isCurrentMonth = activeMonth === thisMonth;
          const monthMatches = matches.filter(m => m.completed_at && m.completed_at.startsWith(activeMonth));
          const mWon = monthMatches.filter(m => {
            const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;
            return onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
          }).length;
          const mDrawn = monthMatches.filter(m => !m.winner_id).length;
          const mLost = monthMatches.length - mWon - mDrawn;
          const mWinRate = monthMatches.length > 0 ? Math.round((mWon / monthMatches.length) * 100) : 0;

          return (
            <div style={{
              background: 'linear-gradient(135deg, #001a2a 0%, #002a3d 50%, #001a2a 100%)',
              border: '1px solid rgba(138,191,204,0.35)',
              borderRadius: 12, padding: '0.875rem 1rem',
              marginBottom: '0.625rem',
              boxShadow: '0 0 12px rgba(138,191,204,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(138,191,204,0.6)', marginBottom: '0.2rem' }}>
                    This Month
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#8ABFCC', lineHeight: 1 }}>{monthName}</div>
                </div>
                <div style={{ fontSize: '1.5rem', opacity: 0.4 }}>📅</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '0.375rem' }}>
                {[
                  { label: 'Played', value: monthMatches.length, color: '#8ABFCC' },
                  { label: 'Won', value: mWon, color: 'var(--felt-light)' },
                  { label: 'Lost', value: mLost, color: 'var(--ember)' },
                  { label: 'Digu', value: monthGinCount !== null ? monthGinCount : '—', color: '#a78bfa' },
                  { label: 'Draw', value: mDrawn, color: 'var(--text-secondary)' },
                  { label: 'Win %', value: `${mWinRate}%`, color: mWinRate >= 50 ? 'var(--felt-light)' : '#8ABFCC' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.5rem 0.25rem' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '0.45rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(138,191,204,0.5)', marginTop: '0.2rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem', marginBottom: '1rem' }}>
          {[
            { label: 'League Pts', value: leaguePoints, color: 'var(--gold)' },
            { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'var(--felt-light)' : 'var(--text-secondary)' },
            { label: 'Matches', value: matches.length, color: 'var(--text-primary)' },
            { label: 'Wins', value: won, color: 'var(--felt-light)' },
            { label: 'Losses', value: lost, color: 'var(--ember)' },
            { label: 'Draws', value: drawn, color: 'var(--text-secondary)' },
            { label: 'Digu', value: ginCount, color: '#a78bfa' },
            { label: 'Badges', value: `${unlockedCount}/${badges.length}`, color: '#D4AF37' },
            { label: 'Cards', value: `${cardsCollected}/52`, color: '#c8980a' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--card-raised)', borderRadius: 10, padding: '0.75rem 0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* W/D/L bar */}
        {matches.length > 0 && (
          <div>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8 }}>
              <div style={{ width: `${(won / matches.length) * 100}%`, background: 'var(--felt-light)', transition: 'width 0.4s' }} />
              <div style={{ width: `${(drawn / matches.length) * 100}%`, background: 'var(--text-muted)' }} />
              <div style={{ width: `${(lost / matches.length) * 100}%`, background: 'var(--ember)' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem', fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--felt-light)' }}>■ {won}W</span>
              <span>■ {drawn}D</span>
              <span style={{ color: 'var(--ember)' }}>■ {lost}L</span>
              {streak > 1 && (
                <span style={{ marginLeft: 'auto', color: streakType === 'W' ? 'var(--felt-light)' : 'var(--ember)', fontWeight: 700 }}>
                  {streak} {streakType === 'W' ? 'Win' : 'Loss'} Streak
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Trophy Case */}
      {/* SVG filter: removes white backgrounds by making bright pixels transparent */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 3 0" />
          </filter>
          <filter id="darken-whites" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="luma"/>
            <feComponentTransfer in="luma" result="mask">
              <feFuncA type="linear" slope="8" intercept="-7"/>
            </feComponentTransfer>
            <feFlood floodColor="#000000" result="black"/>
            <feComposite in="black" in2="mask" operator="in" result="overlay"/>
            <feMerge>
              <feMergeNode in="SourceGraphic"/>
              <feMergeNode in="overlay"/>
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>🏅 Badge Collection</span>
        <span style={{ color: unlockedCount > 0 ? '#D4AF37' : 'var(--text-muted)' }}>{unlockedCount}/{badges.length} Unlocked</span>
      </div>
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {badges.map(b => (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              {/* Badge circle */}
              <div style={{
                width: '100%', aspectRatio: '1',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--card-raised)',
                boxShadow: b.unlocked
                  ? '0 0 0 2.5px #D4AF37, 0 0 16px rgba(212,175,55,0.7), 0 0 32px rgba(212,175,55,0.3)'
                  : '0 0 0 1.5px rgba(255,255,255,0.08)',
                transform: b.unlocked ? 'scale(1.06)' : 'scale(1)',
                transition: 'transform 0.3s, box-shadow 0.3s',
              }}>
                <img
                  src={b.image}
                  alt={b.name}
                  style={{
                    width: b.fullBleed ? '100%' : '84%',
                    height: b.fullBleed ? '100%' : '84%',
                    objectFit: b.fullBleed ? 'cover' : 'contain',
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    mixBlendMode: b.removeWhite ? 'normal' : (b.blend === 'lighten' ? 'lighten' : 'normal'),
                    filter: b.darkenWhite
                      ? (b.unlocked ? 'url(#darken-whites)' : 'url(#darken-whites) grayscale(1) brightness(0.4)')
                      : b.removeWhite
                        ? (b.unlocked ? 'url(#remove-white-bg)' : 'url(#remove-white-bg) grayscale(1) brightness(0.4)')
                        : (b.unlocked ? 'none' : 'grayscale(1) brightness(0.4)'),
                    transition: 'filter 0.3s',
                    imageRendering: 'auto',
                  }}
                />
                {/* Lock overlay */}
                {!b.unlocked && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(10,12,20,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}>🔒</div>
                )}
                {/* Unlocked shine sweep */}
                {b.unlocked && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(255,230,100,0.18) 0%, transparent 55%, rgba(255,200,60,0.1) 100%)',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>

              {/* Label */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '0.6rem', fontWeight: 800, lineHeight: 1.2,
                  color: b.unlocked ? '#D4AF37' : 'var(--text-muted)',
                }}>{b.name}</div>
                <div style={{
                  fontSize: '0.5rem', marginTop: '0.1rem', lineHeight: 1.2,
                  color: b.unlocked ? '#00D47E' : 'var(--text-muted)',
                }}>{b.unlocked ? '✓ Unlocked' : 'Locked'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trophy Case */}
      <TrophyCase trophiesJson={player.trophies_json} />

      {/* Card Collection */}
      <CardCollection totalScore={totalScore} />

      {/* Match history */}
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>
        Match History
      </div>

      {matches.length === 0 ? (
        <div className="empty-state"><p>No completed matches yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(showAllMatches ? matches : matches.slice(0, 5)).map(m => {
            const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;
            const oppName = onTeam1
              ? nick(m.player2_name, m.player2_nickname) + (m.team2_player2_name ? ` / ${nick(m.team2_player2_name, m.team2_player2_nickname)}` : '')
              : nick(m.player1_name, m.player1_nickname) + (m.team1_player2_name ? ` / ${nick(m.team1_player2_name, m.team1_player2_nickname)}` : '');
            const isWin = onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
            const isDraw = !m.winner_id;
            const outcome = isDraw ? 'D' : isWin ? 'W' : 'L';
            const outcomeColor = isDraw ? 'var(--text-secondary)' : isWin ? 'var(--felt-light)' : 'var(--ember)';
            const outcomeBg = isDraw ? 'rgba(100,100,100,0.15)' : isWin ? 'rgba(0,212,126,0.12)' : 'rgba(255,74,106,0.12)';

            return (
              <a key={m.id} href={`/scoresheet/${m.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', gap: '0.5rem', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: outcomeBg, border: `1px solid ${outcomeColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8125rem', color: outcomeColor, flexShrink: 0 }}>
                    {outcome}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>vs {oppName}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {m.team1_player2_id ? '2v2' : '1v1'} · {formatDate(m.started_at)}
                      {m.comment && <span style={{ marginLeft: '0.375rem', fontStyle: 'italic' }}>· "{m.comment}"</span>}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--felt-light)', fontWeight: 600 }}>→</span>
              </a>
            );
          })}
          {matches.length > 5 && (
            <button
              onClick={() => setShowAllMatches(s => !s)}
              style={{
                marginTop: '0.25rem', padding: '0.625rem', width: '100%',
                background: 'var(--card-raised)', border: '1px solid var(--border)',
                borderRadius: 10, cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {showAllMatches ? '▲ Show less' : `▼ Show ${matches.length - 5} more matches`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
