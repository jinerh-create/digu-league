import { useState, useEffect } from 'react';

interface Scheduled {
  id: string;
  player1_id: string; player2_id: string;
  team1_player2_id: string | null; team2_player2_id: string | null;
  team1_name: string | null; team2_name: string | null;
  scheduled_at: string; note: string | null;
  player1_name?: string; player2_name?: string;
  team1_player2_name?: string; team2_player2_name?: string;
  player1_nickname?: string | null; player2_nickname?: string | null;
  team1_player2_nickname?: string | null; team2_player2_nickname?: string | null;
}

interface Player { id: string; name: string; nickname?: string | null; active: number; }

function nick(name?: string, nickname?: string | null) {
  return nickname || (name ?? '').split(' ')[0] || (name ?? '');
}
function side(s: Scheduled, t: 1 | 2) {
  if (t === 1) {
    const label = s.team1_name || nick(s.player1_name, s.player1_nickname);
    return s.team1_player2_name ? `${label} / ${nick(s.team1_player2_name, s.team1_player2_nickname)}` : label;
  }
  const label = s.team2_name || nick(s.player2_name, s.player2_nickname);
  return s.team2_player2_name ? `${label} / ${nick(s.team2_player2_name, s.team2_player2_nickname)}` : label;
}
function fmtDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ScheduledMatches({ isAdmin = false }: { isAdmin?: boolean }) {
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    player1_id: '', player2_id: '',
    team1_player2_id: '', team2_player2_id: '',
    team1_name: '', team2_name: '',
    scheduled_at: '', note: '',
  });

  useEffect(() => {
    fetch('/api/scheduled').then(r => r.json()).then((d: any) => setScheduled(Array.isArray(d) ? d : []));
    if (isAdmin) {
      fetch('/api/players').then(r => r.json()).then((d: any) => setPlayers((d.players ?? d ?? []).filter((p: Player) => p.active !== 0)));
    }
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/scheduled/${id}`, { method: 'DELETE' });
    setScheduled(prev => prev.filter(s => s.id !== id));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.player1_id || !form.player2_id || !form.scheduled_at) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1_id: form.player1_id,
          player2_id: form.player2_id,
          team1_player2_id: form.team1_player2_id || undefined,
          team2_player2_id: form.team2_player2_id || undefined,
          team1_name: form.team1_name || undefined,
          team2_name: form.team2_name || undefined,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          note: form.note || undefined,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ player1_id: '', player2_id: '', team1_player2_id: '', team2_player2_id: '', team1_name: '', team2_name: '', scheduled_at: '', note: '' });
        const fresh = await fetch('/api/scheduled').then(r => r.json());
        setScheduled(Array.isArray(fresh) ? fresh : []);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin && scheduled.length === 0) return null;

  const sel: React.CSSProperties = {
    width: '100%', background: 'var(--card-raised)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '0.5rem 0.75rem', fontSize: '0.9375rem', outline: 'none',
  };

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
          📅 Upcoming Fixtures
        </h2>
        {isAdmin && (
          <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', minHeight: 'auto' }} onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ Schedule'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreate} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Player 1</label>
              <select value={form.player1_id} onChange={e => setForm(f => ({ ...f, player1_id: e.target.value }))} style={sel} required>
                <option value="">Select…</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Player 2</label>
              <select value={form.player2_id} onChange={e => setForm(f => ({ ...f, player2_id: e.target.value }))} style={sel} required>
                <option value="">Select…</option>
                {players.filter(p => p.id !== form.player1_id).map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Date & Time</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              required
              style={{ ...sel }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Championship final"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{ ...sel }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.25rem' }}>
            {saving ? 'Saving…' : 'Schedule Match'}
          </button>
        </form>
      )}

      {/* List */}
      {scheduled.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.875rem' }}>No upcoming fixtures scheduled.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {scheduled.map(s => (
            <div key={s.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--team-a)' }}>{side(s, 1)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 600, background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>VS</span>
                  <span style={{ color: 'var(--team-b)' }}>{side(s, 2)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{fmtDT(s.scheduled_at)}</div>
                {s.note && <div style={{ fontSize: '0.75rem', color: 'var(--felt-light)', marginTop: '0.125rem', fontStyle: 'italic' }}>"{s.note}"</div>}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.125rem', padding: '0.25rem', flexShrink: 0 }}
                  title="Remove fixture"
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
