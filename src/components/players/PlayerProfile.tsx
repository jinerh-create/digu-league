import { useState, useEffect, useRef } from 'react';
import type { Player, Match, PlayerStats } from '../../lib/types';

function Avatar({ name, avatar_b64, size = 80 }: { name: string; avatar_b64: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (avatar_b64) {
    return <img src={`data:image/jpeg;base64,${avatar_b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#DDD1BF', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function resizeImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8).replace('data:image/jpeg;base64,', ''));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function PlayerProfile({ playerId }: { playerId: string }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/players/${playerId}`).then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/matches').then(r => r.json()),
    ]).then(([playerData, allStats, allMatches]: [Player & { error?: string }, PlayerStats[], Match[]]) => {
      if (playerData.error) { setError(playerData.error); setLoading(false); return; }
      setPlayer(playerData);
      const s = (allStats as PlayerStats[]).find(s => s.player_id === playerId);
      setStats(s ?? null);
      const myMatches = (allMatches as Match[]).filter(m =>
        m.player1_id === playerId || m.player2_id === playerId ||
        m.team1_player2_id === playerId || m.team2_player2_id === playerId
      );
      setMatches(myMatches);
      setLoading(false);
    }).catch(() => { setError('Failed to load profile'); setLoading(false); });
  }, [playerId]);

  async function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !player) return;
    setUploading(true);
    try {
      const b64 = await resizeImage(file);
      const res = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_b64: b64 }),
      });
      const updated = await res.json() as Player;
      setPlayer(updated);
    } catch { /* silent */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error || !player) return <div className="error-message">{error || 'Player not found'}</div>;

  function matchLabel(m: Match) {
    const isTeam = !!m.team1_player2_id;
    if (isTeam) {
      const t1 = m.team1_name || 'Team A';
      const t2 = m.team2_name || 'Team B';
      return `${t1} vs ${t2}`;
    }
    return `${m.player1_name || '?'} vs ${m.player2_name || '?'}`;
  }

  function matchResult(m: Match) {
    if (!m.completed_at) return { label: 'In Progress', color: 'var(--felt-light)' };
    if (!m.winner_id) return { label: 'Draw', color: 'var(--text-muted)' };
    const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;
    const team1Won = m.winner_id === m.player1_id;
    const won = onTeam1 ? team1Won : !team1Won;
    return won
      ? { label: 'Won', color: 'var(--team-a)' }
      : { label: 'Lost', color: 'var(--text-muted)' };
  }

  const statItems = [
    { label: 'GP', value: stats?.matches_played ?? 0 },
    { label: 'W', value: stats?.matches_won ?? 0 },
    { label: 'L', value: stats?.matches_lost ?? 0 },
    { label: 'DIGU', value: stats?.gin_count ?? 0 },
    { label: 'PTS', value: stats?.total_points_scored ?? 0 },
    { label: 'WIN%', value: stats ? `${stats.win_rate}%` : '0%' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Profile Header */}
      <div className="card" style={{ padding: '1.5rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            type="button"
            onClick={handleAvatarClick}
            style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
            title="Upload photo"
          >
            {uploading
              ? <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>...</div>
              : <Avatar name={player.name} avatar_b64={player.avatar_b64} size={80} />
            }
            <span style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem' }}>
              📷
            </span>
          </button>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {player.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Joined {new Date(player.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {/* Stats Grid */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
          Career Stats
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {statItems.map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Match History */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
          Match History
        </div>
        {matches.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
            No matches yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {matches.map(m => {
              const result = matchResult(m);
              const date = new Date(m.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <a
                  key={m.id}
                  href={`/match/${m.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}
                >
                  <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: result.color }}>
                      {result.label}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {matchLabel(m)}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {date}
                      {m.target_score > 0 && ` · ${m.target_score} pts`}
                      {m.max_rounds > 0 && ` · ${m.max_rounds} rounds`}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>›</div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
