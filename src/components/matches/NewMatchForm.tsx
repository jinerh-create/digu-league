import { useState, useEffect } from 'react';
import type { Player } from '../../lib/types';

export default function NewMatchForm() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [team1Name, setTeam1Name] = useState('Team A');
  const [team2Name, setTeam2Name] = useState('Team B');
  const [p1a, setP1a] = useState('');
  const [p1b, setP1b] = useState('');
  const [p2a, setP2a] = useState('');
  const [p2b, setP2b] = useState('');
  const [target, setTarget] = useState<number>(100);
  const [customTarget, setCustomTarget] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/players')
      .then(r => r.json())
      .then((data: Player[]) => { setPlayers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const finalTarget = useCustom ? parseInt(customTarget, 10) : target;
    if (!p1a || !p2a) { setError('Select at least one player per team'); return; }
    const allSelected = [p1a, p1b, p2a, p2b].filter(Boolean);
    const unique = new Set(allSelected);
    if (unique.size !== allSelected.length) { setError('Each player can only appear once'); return; }
    if (isNaN(finalTarget) || finalTarget < 10) { setError('Invalid target score'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1_id: p1a,
          player2_id: p2a,
          target_score: finalTarget,
          team1_name: team1Name.trim() || null,
          team2_name: team2Name.trim() || null,
          team1_player2_id: p1b || null,
          team2_player2_id: p2b || null,
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

  if (loading) return <div className="loading">Loading players…</div>;
  if (!players.length) return (
    <div className="empty-state">
      <p>No players found. <a href="/players" style={{ color: 'var(--felt-light)' }}>Add players first.</a></p>
    </div>
  );

  const taken = new Set([p1a, p1b, p2a, p2b].filter(Boolean));
  function opts(exclude: string[]) {
    return players.filter(p => !exclude.includes(p.id) || exclude[0] === p.id);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Team A */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4a9eff', flexShrink: 0 }} />
          <input
            className="form-input"
            style={{ fontWeight: 700, fontSize: '1rem', padding: '0.375rem 0.625rem', height: 'auto', minHeight: 'auto' }}
            value={team1Name}
            onChange={e => setTeam1Name(e.target.value)}
            placeholder="Team A name"
            maxLength={30}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div className="form-group">
            <label className="form-label">Player 1</label>
            <select className="form-input" value={p1a} onChange={e => setP1a(e.target.value)} required>
              <option value="">Select player…</option>
              {players.filter(p => !taken.has(p.id) || p.id === p1a).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Player 2 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <select className="form-input" value={p1b} onChange={e => setP1b(e.target.value)}>
              <option value="">None (1v1)</option>
              {players.filter(p => (!taken.has(p.id) || p.id === p1b) && p.id !== p1a).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.9375rem' }}>vs</div>

      {/* Team B */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--heart)', flexShrink: 0 }} />
          <input
            className="form-input"
            style={{ fontWeight: 700, fontSize: '1rem', padding: '0.375rem 0.625rem', height: 'auto', minHeight: 'auto' }}
            value={team2Name}
            onChange={e => setTeam2Name(e.target.value)}
            placeholder="Team B name"
            maxLength={30}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div className="form-group">
            <label className="form-label">Player 1</label>
            <select className="form-input" value={p2a} onChange={e => setP2a(e.target.value)} required>
              <option value="">Select player…</option>
              {players.filter(p => (!taken.has(p.id) || p.id === p2a) && p.id !== p1a && p.id !== p1b).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Player 2 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <select className="form-input" value={p2b} onChange={e => setP2b(e.target.value)}>
              <option value="">None (1v1)</option>
              {players.filter(p => (!taken.has(p.id) || p.id === p2b) && p.id !== p1a && p.id !== p1b && p.id !== p2a).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Target Score */}
      <div className="card">
        <div className="form-label" style={{ marginBottom: '0.75rem' }}>Target Score</div>
        <div className="toggle-group" style={{ marginBottom: useCustom ? '0.75rem' : 0 }}>
          {[100, 500].map(t => (
            <button key={t} type="button" className={`toggle-option ${!useCustom && target === t ? 'active' : ''}`}
              onClick={() => { setTarget(t); setUseCustom(false); }}>
              {t} pts
            </button>
          ))}
          <button type="button" className={`toggle-option ${useCustom ? 'active' : ''}`} onClick={() => setUseCustom(true)}>
            Custom
          </button>
        </div>
        {useCustom && (
          <input type="number" className="form-input" inputMode="numeric" placeholder="e.g. 250"
            value={customTarget} onChange={e => setCustomTarget(e.target.value)} min={10} max={10000} required />
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
        {submitting ? 'Starting…' : '▶ Start Match'}
      </button>
    </form>
  );
}
