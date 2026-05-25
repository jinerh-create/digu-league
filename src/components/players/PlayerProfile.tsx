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

function buildBadges(totalScore: number, ginCount: number, maxWinStreak: number, perfectMatches: number, centuryHands: number): Badge[] {
  return [
    {
      id: 'streak_emperor',
      name: 'Streak Emperor',
      desc: 'Win 5 matches in a row',
      image: '/badges/streak-emperor.png',
      unlocked: maxWinStreak >= 5,
      blend: 'lighten',
    },
    {
      id: 'three_streak',
      name: '3 Win Streak',
      desc: 'Win 3 matches in a row without a loss',
      image: '/badges/three-streak.png',
      unlocked: maxWinStreak >= 3,
      blend: 'normal',
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
  ];
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
  const badges = buildBadges(totalScore, ginCount, maxWinStreak, perfectMatches, centuryHands);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const cardsCollected = Object.values(CARD_THRESHOLDS).filter(t => totalScore >= t).length;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <a href="/leaderboard" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>← Leaderboard</a>
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
                    width: '100%', height: '100%', objectFit: 'cover',
                    mixBlendMode: b.blend === 'lighten' ? 'lighten' : 'normal',
                    filter: b.unlocked ? 'none' : 'grayscale(1) brightness(0.4)',
                    transition: 'filter 0.3s',
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
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        🏆 Trophy Case
      </div>
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '1rem 0' }}>Trophies coming soon…</div>
      </div>

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
