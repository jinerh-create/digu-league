import { useState, useEffect } from 'react';
import type { Match, Game } from '../../lib/types';
import { DEFAULT_SETTINGS } from '../../lib/types';
import { calculateHand } from '../../lib/scoring';

interface MatchWithGames extends Match {
  games: Game[];
}

interface DraftState {
  knockerId: string;
  resultType: 'normal' | 'gin' | 'undercut';
  knockerDeadwood: number;
  defenderDeadwood: number;
}

function Avatar({ name, b64, size = 40 }: { name: string; b64: string | null | undefined; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (b64) return <img src={`data:image/jpeg;base64,${b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#DDD1BF' }}>
      {initials}
    </div>
  );
}

function Stepper({ value, onChange, min = 0, max = 99, disabled }: { value: number; onChange: (n: number) => void; min?: number; max?: number; disabled?: boolean }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min}>−</button>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n))); }}
        disabled={disabled}
        min={min}
        max={max}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max}>+</button>
    </div>
  );
}

export default function ActiveMatch({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchWithGames | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionWinnerId, setCompletionWinnerId] = useState('');
  const [draft, setDraft] = useState<DraftState>({
    knockerId: '',
    resultType: 'normal',
    knockerDeadwood: 0,
    defenderDeadwood: 10,
  });

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then((data: MatchWithGames & { error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setMatch(data);
        setDraft(d => ({ ...d, knockerId: data.player1_id }));
        if (data.completed_at && data.winner_id) {
          setCompletionWinnerId(data.winner_id);
          setShowCompletion(true);
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load match'); setLoading(false); });
  }, [matchId]);

  if (loading) return <div className="loading" style={{ paddingTop: '3rem' }}>Loading match…</div>;
  if (error || !match) return <div className="error-message">{error || 'Match not found'}</div>;

  const p1Id = match.player1_id;
  const p2Id = match.player2_id;
  const p1Name = match.player1_name ?? 'Player 1';
  const p2Name = match.player2_name ?? 'Player 2';

  const p1Score = match.games.filter(g => g.winner_id === p1Id).reduce((s, g) => s + g.score_awarded, 0);
  const p2Score = match.games.filter(g => g.winner_id === p2Id).reduce((s, g) => s + g.score_awarded, 0);

  const p1Pct = Math.min(100, (p1Score / match.target_score) * 100);
  const p2Pct = Math.min(100, (p2Score / match.target_score) * 100);

  const defenderId = draft.knockerId === p1Id ? p2Id : p1Id;
  const defenderName = draft.knockerId === p1Id ? p2Name : p1Name;
  const knockerName = draft.knockerId === p1Id ? p1Name : p2Name;

  const isGin = draft.resultType === 'gin';
  const knockerDW = isGin ? 0 : draft.knockerDeadwood;

  let preview: { score: number; winner: 'knocker' | 'defender'; isUndercut: boolean } | null = null;
  try {
    preview = calculateHand(knockerDW, draft.defenderDeadwood, isGin, DEFAULT_SETTINGS);
  } catch {}

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!match) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knocker_id: draft.knockerId,
          knocker_deadwood: knockerDW,
          defender_deadwood: draft.defenderDeadwood,
          is_gin: isGin,
        }),
      });
      const data = await res.json() as {
        game: Game;
        p1Score: number;
        p2Score: number;
        matchComplete: boolean;
        matchWinnerId: string;
        error?: string;
      };
      if (!res.ok) { setError(data.error ?? 'Failed'); setSubmitting(false); return; }

      setMatch(prev => prev ? { ...prev, games: [...prev.games, data.game] } : prev);
      setDraft(d => ({ ...d, knockerDeadwood: 0, defenderDeadwood: 10 }));

      if (data.matchComplete) {
        setCompletionWinnerId(data.matchWinnerId);
        setShowCompletion(true);
        setMatch(prev => prev ? { ...prev, winner_id: data.matchWinnerId, completed_at: new Date().toISOString() } : prev);
      }
    } catch { setError('Network error. Try again.'); }
    finally { setSubmitting(false); }
  }

  const completionWinnerName = completionWinnerId === p1Id ? p1Name : p2Name;

  return (
    <div style={{ paddingBottom: '1rem' }}>
      {/* Score Header */}
      <div className="score-header card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ marginBottom: '0.375rem' }}>
              <Avatar name={p1Name} b64={match.player1_avatar} size={44} />
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cream)', marginBottom: '0.25rem' }}>{p1Name}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#4a9eff' }}>{p1Score}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Hand {match.games.length + 1}
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>vs</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>to {match.target_score}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ marginBottom: '0.375rem' }}>
              <Avatar name={p2Name} b64={match.player2_avatar} size={44} />
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cream)', marginBottom: '0.25rem' }}>{p2Name}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--heart)' }}>{p2Score}</div>
          </div>
        </div>

        {/* Progress Bars */}
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '2rem', fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right' }}>{p1Name.split(' ')[0]}</div>
            <div className="progress-bar-track" style={{ flex: 1 }}>
              <div className="progress-bar-fill" style={{ width: `${p1Pct}%`, background: '#4a9eff' }} />
            </div>
            <div style={{ width: '2.5rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{Math.round(p1Pct)}%</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '2rem', fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right' }}>{p2Name.split(' ')[0]}</div>
            <div className="progress-bar-track" style={{ flex: 1 }}>
              <div className="progress-bar-fill" style={{ width: `${p2Pct}%`, background: 'var(--heart)' }} />
            </div>
            <div style={{ width: '2.5rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{Math.round(p2Pct)}%</div>
          </div>
        </div>
      </div>

      {/* Entry Form */}
      {!match.completed_at && (
        <form onSubmit={handleRecord} className="card" style={{ marginBottom: '1rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-label">Who knocked?</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[{ id: p1Id, name: p1Name }, { id: p2Id, name: p2Name }].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDraft(d => ({ ...d, knockerId: p.id }))}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${draft.knockerId === p.id ? (p.id === p1Id ? '#4a9eff' : 'var(--heart)') : 'var(--border)'}`,
                  background: draft.knockerId === p.id ? 'rgba(255,255,255,0.05)' : 'var(--card)',
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  color: draft.knockerId === p.id ? (p.id === p1Id ? '#4a9eff' : 'var(--heart)') : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  minHeight: 52,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="form-label">Result type</div>
          <div className="toggle-group">
            {(['normal', 'gin', 'undercut'] as const).map(t => (
              <button
                key={t}
                type="button"
                className={`toggle-option ${draft.resultType === t ? `active ${t === 'normal' ? '' : t}` : ''}`}
                onClick={() => setDraft(d => ({ ...d, resultType: t }))}
              >
                {t === 'normal' ? 'Knock' : t === 'gin' ? '★ Gin' : '⟲ Undercut'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{knockerName} deadwood</label>
              <Stepper
                value={isGin ? 0 : draft.knockerDeadwood}
                onChange={v => setDraft(d => ({ ...d, knockerDeadwood: v }))}
                disabled={isGin}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{defenderName} deadwood</label>
              <Stepper
                value={draft.defenderDeadwood}
                onChange={v => setDraft(d => ({ ...d, defenderDeadwood: v }))}
              />
            </div>
          </div>

          {/* Score preview */}
          {preview && (
            <div style={{
              background: 'rgba(43,79,55,0.2)',
              border: '1px solid rgba(99,141,111,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {preview.winner === 'knocker' ? knockerName : defenderName} wins hand
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isGin && <span className="badge badge-gin">GIN +{DEFAULT_SETTINGS.ginBonus}</span>}
                {preview.isUndercut && <span className="badge badge-undercut">UNDERCUT +{DEFAULT_SETTINGS.undercutBonus}</span>}
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold)' }}>+{preview.score}</span>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-felt btn-lg btn-block" disabled={submitting}>
            {submitting ? 'Recording…' : '✓ Record Hand'}
          </button>
        </form>
      )}

      {/* Game History */}
      {match.games.length > 0 && (
        <div className="card" style={{ padding: '1rem' }}>
          <div className="form-label" style={{ marginBottom: '0.625rem' }}>Hand History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {[...match.games].reverse().map(g => {
              const winnerName = g.winner_id === p1Id ? p1Name : p2Name;
              return (
                <div key={g.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card-raised)',
                  fontSize: '0.875rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', minWidth: 40 }}>#{g.round_number}</span>
                    <span style={{ fontWeight: 600 }}>{winnerName}</span>
                    {g.is_gin === 1 && <span className="badge badge-gin">GIN</span>}
                    {g.is_undercut === 1 && <span className="badge badge-undercut">UNDER</span>}
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>+{g.score_awarded}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletion && (
        <div className="modal-overlay centered" style={{ zIndex: 300 }}>
          <div className="modal-sheet" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
            <h2 style={{ marginBottom: '0.25rem' }}>Match Complete!</h2>
            <p style={{ marginBottom: '0.25rem' }}>{completionWinnerName} wins the match</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', margin: '1rem 0', padding: '0.875rem', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p1Name}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4a9eff' }}>{p1Score}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p2Name}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--heart)' }}>{p2Score}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>{match.games.length} hands played</p>
            <div style={{ display: 'flex', gap: '0.625rem', flexDirection: 'column' }}>
              <a href="/new-match" className="btn btn-primary btn-block">▶ New Match</a>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setShowCompletion(false)}>View History</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
