import { useState, useEffect } from 'react';
import type { Player } from '../../lib/types';

// A Classic (casual) match — never counts toward any league. Players can be
// picked from the existing league OR typed in as one-off guests.
export default function ClassicMatchForm() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [team1Name, setTeam1Name] = useState('Team A');
  const [team2Name, setTeam2Name] = useState('Team B');
  const [p1a, setP1a] = useState('');
  const [p1b, setP1b] = useState('');
  const [p2a, setP2a] = useState('');
  const [p2b, setP2b] = useState('');
  const [matchType, setMatchType] = useState<'single' | 'team'>('single');
  const [targetMode, setTargetMode] = useState<'pts' | 'rounds'>('pts');
  const [target, setTarget] = useState<number>(100);
  const [customTarget, setCustomTarget] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [roundCount, setRoundCount] = useState('10');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/players')
      .then(r => r.json())
      .then((data: Player[]) => { setPlayers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Turn a typed value into a slot: exact (case-insensitive) name match → existing id, else guest name.
  function slot(value: string) {
    const v = value.trim();
    if (!v) return null;
    const found = players.find(p => p.name.toLowerCase() === v.toLowerCase());
    return found ? { id: found.id } : { name: v };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!p1a.trim() || !p2a.trim()) { setError('Enter or pick both players'); return; }

    // Guard: same existing player twice
    const chosen = [p1a, matchType === 'team' ? p1b : '', p2a, matchType === 'team' ? p2b : '']
      .map(slot).filter(Boolean) as ({ id?: string; name?: string })[];
    const ids = chosen.filter(s => s.id).map(s => s.id);
    if (new Set(ids).size !== ids.length) { setError('Each player can only be picked once'); return; }

    const isRounds = targetMode === 'rounds';
    const maxRounds = isRounds ? parseInt(roundCount, 10) : 0;
    const finalTarget = isRounds ? 0 : (useCustom ? parseInt(customTarget, 10) : target);
    if (isRounds && (isNaN(maxRounds) || maxRounds < 5)) { setError('Minimum 5 rounds required'); return; }
    if (!isRounds && (isNaN(finalTarget) || finalTarget < 10)) { setError('Invalid target score'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/classic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p1a: slot(p1a),
          p2a: slot(p2a),
          p1b: matchType === 'team' ? slot(p1b) : null,
          p2b: matchType === 'team' ? slot(p2b) : null,
          target_score: finalTarget,
          max_rounds: maxRounds,
          team1_name: matchType === 'team' ? team1Name : null,
          team2_name: matchType === 'team' ? team2Name : null,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok || !data.id) { setError(data.error ?? 'Failed to create match'); setSubmitting(false); return; }
      window.location.href = `/match/${data.id}`;
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading">Loading…</div>;

  const nameInput = (val: string, set: (v: string) => void, ph: string, listId: string) => (
    <>
      <input
        className="form-input"
        value={val}
        onChange={e => set(e.target.value)}
        placeholder={ph}
        list={listId}
        maxLength={40}
        autoComplete="off"
      />
      <datalist id={listId}>
        {players.map(p => <option key={p.id} value={p.name} />)}
      </datalist>
    </>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        🎴 <strong>Classic match</strong> — a casual game with anyone. Type a new name for a guest, or pick an existing player. Kept in history but <strong>never counts toward any league</strong>.
      </div>

      {/* Match type toggle */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--card)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
        {(['single', 'team'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setMatchType(t); if (t === 'single') { setP1b(''); setP2b(''); } }} style={{
            flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.875rem',
            background: matchType === t ? 'var(--felt)' : 'transparent',
            color: matchType === t ? 'var(--cream)' : 'var(--text-muted)', transition: 'all 0.15s',
          }}>
            {t === 'single' ? '👤 Single (1v1)' : '👥 Team (2v2)'}
          </button>
        ))}
      </div>

      {/* Side A */}
      <div className="card">
        {matchType === 'team' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--team-a)', flexShrink: 0 }} />
            <input className="form-input" style={{ fontWeight: 700, fontSize: '1rem', padding: '0.375rem 0.625rem', height: 'auto', minHeight: 'auto' }}
              value={team1Name} onChange={e => setTeam1Name(e.target.value)} placeholder="Team A name" maxLength={30} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div className="form-group">
            <label className="form-label">{matchType === 'team' ? 'Player 1' : 'Player A'}</label>
            {nameInput(p1a, setP1a, 'Type a name or pick…', 'dl-p1a')}
          </div>
          {matchType === 'team' && (
            <div className="form-group">
              <label className="form-label">Player 2 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              {nameInput(p1b, setP1b, 'Type a name or pick…', 'dl-p1b')}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.9375rem' }}>vs</div>

      {/* Side B */}
      <div className="card">
        {matchType === 'team' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--team-b)', flexShrink: 0 }} />
            <input className="form-input" style={{ fontWeight: 700, fontSize: '1rem', padding: '0.375rem 0.625rem', height: 'auto', minHeight: 'auto' }}
              value={team2Name} onChange={e => setTeam2Name(e.target.value)} placeholder="Team B name" maxLength={30} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div className="form-group">
            <label className="form-label">{matchType === 'team' ? 'Player 1' : 'Player B'}</label>
            {nameInput(p2a, setP2a, 'Type a name or pick…', 'dl-p2a')}
          </div>
          {matchType === 'team' && (
            <div className="form-group">
              <label className="form-label">Player 2 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              {nameInput(p2b, setP2b, 'Type a name or pick…', 'dl-p2b')}
            </div>
          )}
        </div>
      </div>

      {/* Match Format */}
      <div className="card">
        <div className="form-label" style={{ marginBottom: '0.75rem' }}>Match Format</div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--card-raised)', borderRadius: 8, padding: 4, marginBottom: '0.875rem' }}>
          {(['pts', 'rounds'] as const).map(m => (
            <button key={m} type="button" onClick={() => setTargetMode(m)} style={{
              flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.875rem',
              background: targetMode === m ? 'var(--felt)' : 'transparent',
              color: targetMode === m ? 'var(--cream)' : 'var(--text-muted)', transition: 'all 0.15s',
            }}>
              {m === 'pts' ? '🏆 Points' : '🔄 Rounds'}
            </button>
          ))}
        </div>
        {targetMode === 'pts' ? (
          <>
            <div className="form-label" style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>Target Score</div>
            <div className="toggle-group" style={{ marginBottom: useCustom ? '0.75rem' : 0, flexWrap: 'wrap' }}>
              {[100, 500, 1000].map(t => (
                <button key={t} type="button" className={`toggle-option ${!useCustom && target === t ? 'active' : ''}`}
                  onClick={() => { setTarget(t); setUseCustom(false); }}>{t} pts</button>
              ))}
              <button type="button" className={`toggle-option ${useCustom ? 'active' : ''}`} onClick={() => setUseCustom(true)}>Custom</button>
            </div>
            {useCustom && (
              <input type="number" className="form-input" inputMode="numeric" placeholder="e.g. 250"
                value={customTarget} onChange={e => setCustomTarget(e.target.value)} min={10} max={10000} />
            )}
          </>
        ) : (
          <>
            <div className="form-label" style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>Number of Rounds <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min 5)</span></div>
            <input type="number" className="form-input" inputMode="numeric" placeholder="e.g. 10"
              value={roundCount} onChange={e => setRoundCount(e.target.value)} min={5}
              style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }} />
          </>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
        {submitting ? 'Starting…' : '▶ Start Classic Match'}
      </button>
    </form>
  );
}
