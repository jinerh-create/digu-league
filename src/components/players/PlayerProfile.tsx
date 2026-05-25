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
};

function getLevel(score: number): { name: string; color: string; next: number; icon: string } {
  if (score >= 100000) return { name: 'Legend', color: '#FF6B6B', next: 0, icon: '👑' };
  if (score >= 50000)  return { name: 'Diamond', color: '#67E8F9', next: 100000, icon: '💎' };
  if (score >= 20000)  return { name: 'Gold',    color: '#D4AF37', next: 50000,  icon: '🥇' };
  if (score >= 5000)   return { name: 'Silver',  color: '#B0B8C8', next: 20000,  icon: '🥈' };
  return                        { name: 'Bronze', color: '#CD7F32', next: 5000,   icon: '🥉' };
}

function buildBadges(totalScore: number, ginCount: number, maxWinStreak: number, perfectMatches: number, centuryHands: number): Badge[] {
  return [
    {
      id: 'oc_streak',
      name: 'OC',
      desc: 'Win 5 matches in a row without a single loss',
      image: '/badges/oc-streak.png',
      unlocked: maxWinStreak >= 5,
    },
    {
      id: 'three_streak',
      name: '3 Win Streak',
      desc: 'Win 3 matches in a row without a loss',
      image: '/badges/three-streak.png',
      unlocked: maxWinStreak >= 3,
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
          <Avatar name={player.name} b64={player.avatar_b64} size={72} />
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
                  <div style={{ height: '100%', borderRadius: 2, background: level.color, width: `${Math.min(100, (totalScore / level.next) * 100)}%`, transition: 'width 0.6s' }} />
                </div>
                <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {totalScore.toLocaleString()} / {level.next.toLocaleString()} to {level.name === 'Bronze' ? 'Silver' : level.name === 'Silver' ? 'Gold' : level.name === 'Gold' ? 'Diamond' : 'Legend'}
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
        <span>🏅 Trophy Case</span>
        <span style={{ color: unlockedCount > 0 ? '#D4AF37' : 'var(--text-muted)' }}>{unlockedCount}/{badges.length} Unlocked</span>
      </div>
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '1.25rem' }}>
          {badges.map(b => (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
              {/* Badge image */}
              <div style={{
                width: 100, height: 100, position: 'relative',
                filter: b.unlocked
                  ? 'drop-shadow(0 0 18px rgba(212,175,55,0.8)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))'
                  : 'grayscale(1) brightness(0.18)',
                transform: b.unlocked ? 'perspective(300px) rotateX(8deg) scale(1.05)' : 'none',
                transition: 'filter 0.3s, transform 0.3s',
              }}>
                <img src={b.image} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              {/* Lock overlay when not unlocked */}
              {!b.unlocked && (
                <div style={{
                  position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.85)', border: '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem',
                }}>
                  🔒
                </div>
              )}

              {/* Unlocked glow ring */}
              {b.unlocked && (
                <div style={{
                  position: 'absolute', top: 24,
                  width: 108, height: 108, borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(212,175,55,0.15) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />
              )}

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '0.75rem', fontWeight: 800,
                  color: b.unlocked ? '#D4AF37' : 'var(--text-muted)',
                  letterSpacing: '0.01em',
                }}>{b.name}</div>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                  {b.unlocked ? '✓ Unlocked' : b.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
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
          {matches.map(m => {
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
        </div>
      )}
    </div>
  );
}
