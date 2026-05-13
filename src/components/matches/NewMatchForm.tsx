import { useState, useEffect } from 'react';
import type { Player } from '../../lib/types';

export default function NewMatchForm() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
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
    if (!p1 || !p2) { setError('Select both players'); return; }
    if (p1 === p2) { setError('Players must be different'); return; }
    if (isNaN(finalTarget) || finalTarget < 10) { setError('Invalid target score'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player1_id: p1, player2_id: p2, target_score: finalTarget }),
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

  const p2Options = players.filter(p => p.id !== p1);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Player 1</label>
            <select className="form-input" value={p1} onChange={e => { setP1(e.target.value); if (p2 === e.target.value) setP2(''); }} required>
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Player 2</label>
            <select className="form-input" value={p2} onChange={e => setP2(e.target.value)} required disabled={!p1}>
              <option value="">Select player…</option>
              {p2Options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="form-label" style={{ marginBottom: '0.75rem' }}>Target Score</div>
        <div className="toggle-group" style={{ marginBottom: useCustom ? '0.75rem' : 0 }}>
          {[100, 500].map(t => (
            <button
              key={t}
              type="button"
              className={`toggle-option ${!useCustom && target === t ? 'active' : ''}`}
              onClick={() => { setTarget(t); setUseCustom(false); }}
            >
              {t} pts
            </button>
          ))}
          <button
            type="button"
            className={`toggle-option ${useCustom ? 'active' : ''}`}
            onClick={() => setUseCustom(true)}
          >
            Custom
          </button>
        </div>
        {useCustom && (
          <input
            type="number"
            className="form-input"
            inputMode="numeric"
            placeholder="e.g. 250"
            value={customTarget}
            onChange={e => setCustomTarget(e.target.value)}
            min={10}
            max={10000}
            required
          />
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
        {submitting ? 'Starting…' : '▶ Start Match'}
      </button>
    </form>
  );
}
