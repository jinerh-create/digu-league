import { useState, useEffect } from 'react';
import type { Match } from '../../lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateValue(iso: string) {
  return iso.slice(0, 10);
}

function DateEditor({ matchId, started_at, editing, saving, onEdit, onSave, onCancel }: {
  matchId: string; started_at: string; editing: boolean; saving: boolean;
  onEdit: () => void; onSave: (id: string, date: string) => void; onCancel: () => void;
}) {
  if (editing) {
    return (
      <input
        type="date"
        defaultValue={toDateValue(started_at)}
        disabled={saving}
        autoFocus
        onClick={e => e.stopPropagation()}
        onChange={e => { if (e.target.value) onSave(matchId, e.target.value); }}
        onBlur={onCancel}
        style={{ fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: 4, padding: '0.1rem 0.25rem', background: 'var(--card)', color: 'var(--text-primary)', cursor: 'pointer' }}
      />
    );
  }
  return (
    <button onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: 0, textDecoration: 'underline dotted' }}>
      {formatDate(started_at)}
    </button>
  );
}

function nick(name: string | null | undefined, nickname: string | null | undefined) {
  return nickname || (name ?? '').split(' ')[0] || (name ?? '');
}
function side1(m: Match) {
  const p1 = nick(m.player1_name, m.player1_nickname);
  const p2 = nick(m.team1_player2_name, m.team1_player2_nickname);
  return m.team1_player2_name ? `${p1} / ${p2}` : p1;
}
function side2(m: Match) {
  const p1 = nick(m.player2_name, m.player2_nickname);
  const p2 = nick(m.team2_player2_name, m.team2_player2_nickname);
  return m.team2_player2_name ? `${p1} / ${p2}` : p1;
}

type Tab = 'all' | 'single' | 'team';

export default function MatchList() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then((data: Match[]) => { setMatches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSaveComment(matchId: string) {
    await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: commentDraft || null }),
    });
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, comment: commentDraft || null } : m));
    setEditingComment(null);
  }

  async function handleDelete(matchId: string) {
    setDeletingId(matchId);
    await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  async function handleDateChange(matchId: string, newDate: string) {
    setSavingDate(true);
    const iso = new Date(newDate).toISOString();
    await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ started_at: iso }),
    });
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, started_at: iso } : m));
    setEditingDate(null);
    setSavingDate(false);
  }

  if (loading) return <div className="loading">Loading matches…</div>;

  const filtered = matches.filter(m => {
    if (tab === 'single') return !m.team1_player2_id;
    if (tab === 'team') return !!m.team1_player2_id;
    return true;
  });

  const active = filtered.filter(m => !m.completed_at);
  const completed = filtered.filter(m => m.completed_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', background: 'var(--card)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
        {(['all', 'single', 'team'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8125rem', textTransform: 'capitalize',
              background: tab === t ? 'var(--felt)' : 'transparent',
              color: tab === t ? 'var(--cream)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'all' ? 'All' : t === 'single' ? 'Single' : 'Team'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <p>No {tab !== 'all' ? tab + ' ' : ''}matches yet.</p>
          <a href="/new-match" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>Start Match</a>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <div className="label" style={{ marginBottom: '0.5rem' }}>In Progress</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {active.map(m => (
              <div key={m.id} className="card match-card" style={{ border: '1.5px solid rgba(212,175,55,0.45)', boxShadow: '0 0 14px rgba(212,175,55,0.12), inset 0 1px 0 rgba(212,175,55,0.08)', position: 'relative', overflow: 'hidden' }}>
                {confirmDeleteId === m.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Delete this match? This cannot be undone.
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-danger"
                        style={{ flex: 1, minHeight: 36, fontSize: '0.8125rem' }}
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m.id)}
                      >
                        {deletingId === m.id ? 'Deleting…' : 'Yes, Delete'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, minHeight: 36, fontSize: '0.8125rem' }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    
              <div className="match-row">
                      <a href={`/match/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, textDecoration: 'none' }}>
                        <div className="match-vs">
                          <span className="player-name">{side1(m)}</span>
                          <span className="vs-text">vs</span>
                          <span className="player-name">{side2(m)}</span>
                        </div>
                      </a>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-gin">Live</span>
                        <button
                          onClick={() => setConfirmDeleteId(m.id)}
                          title="Delete match"
                          style={{
                            background: 'rgba(255,61,90,0.12)', border: '1px solid rgba(255,61,90,0.3)',
                            borderRadius: 6, color: '#FF6B8A', fontSize: '0.75rem',
                            fontWeight: 700, padding: '0.25rem 0.5rem', cursor: 'pointer',
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="match-sub">
                      <span>{m.team1_player2_id ? '2v2 Team' : '1v1 Single'} · To {m.target_score} pts</span>
                      <DateEditor matchId={m.id} started_at={m.started_at} editing={editingDate === m.id} saving={savingDate}
                        onEdit={() => setEditingDate(m.id)} onSave={handleDateChange} onCancel={() => setEditingDate(null)} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <div className="label" style={{ marginBottom: '0.5rem' }}>Completed</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {completed.map(m => {
              const s1 = side1(m);
              const s2 = side2(m);
              const isDraw = m.completed_at && !m.winner_id;
              const winnerSide = m.winner_id === m.player1_id ? s1 : s2;
              return (
                <div key={m.id} className="card match-card" style={{ border: '1.5px solid rgba(212,175,55,0.45)', boxShadow: '0 0 14px rgba(212,175,55,0.12), inset 0 1px 0 rgba(212,175,55,0.08)', position: 'relative', overflow: 'hidden' }}>
                  
              <div className="match-row">
                    <div className="match-vs">
                      <span className={`player-name ${m.winner_id === m.player1_id ? 'winner' : isDraw ? '' : 'loser'}`}>{s1}</span>
                      <span className="vs-text">vs</span>
                      <span className={`player-name ${m.winner_id === m.player2_id ? 'winner' : isDraw ? '' : 'loser'}`}>{s2}</span>
                    </div>
                  </div>
                  {isDraw
                    ? <div style={{ display: 'block', width: '100%', textAlign: 'center', padding: '0.375rem 0.75rem', marginTop: '0.5rem', background: 'rgba(100,100,100,0.3)', color: '#aaa', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 700, boxSizing: 'border-box' }}>Draw</div>
                    : <div style={{ display: 'block', width: '100%', textAlign: 'center', padding: '0.4rem 0.75rem', marginTop: '0.5rem', background: 'linear-gradient(135deg, #b8922a 0%, #d4af37 50%, #e8c84a 100%)', color: '#1a1000', border: '1px solid #d4af37', borderRadius: 20, fontWeight: 800, letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(212,175,55,0.4)', textTransform: 'uppercase', fontSize: '0.8125rem', boxSizing: 'border-box' }}>🏆 {winnerSide}</div>
                  }
                  <div className="match-sub" style={{ marginTop: '0.5rem' }}>
                    <span>{m.team1_player2_id ? '2v2' : '1v1'} · <DateEditor matchId={m.id} started_at={m.started_at} editing={editingDate === m.id} saving={savingDate}
                      onEdit={() => setEditingDate(m.id)} onSave={handleDateChange} onCancel={() => setEditingDate(null)} /></span>
                    <a href={`/scoresheet/${m.id}`} style={{ color: 'var(--felt-light)', fontWeight: 600 }}>Scoresheet →</a>
                  </div>
                  {editingComment === m.id ? (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.375rem' }}>
                      <input
                        autoFocus
                        value={commentDraft}
                        onChange={e => setCommentDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveComment(m.id); if (e.key === 'Escape') setEditingComment(null); }}
                        placeholder="Add a note…"
                        style={{ flex: 1, fontSize: '0.8125rem', padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-raised)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={() => handleSaveComment(m.id)} style={{ padding: '0.25rem 0.5rem', borderRadius: 6, background: 'var(--felt)', color: '#fff', fontWeight: 700, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingComment(null)} style={{ padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setEditingComment(m.id); setCommentDraft(m.comment || ''); }}
                      style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: m.comment ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', fontStyle: m.comment ? 'italic' : 'normal' }}
                    >
                      {m.comment ? `"${m.comment}"` : '+ Add note'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <style>{`
        .match-card {
    padding: 0.875rem 1rem; cursor: default;
    border: 1px solid rgba(212,175,55,0.32) !important;
    box-shadow: 0 0 10px rgba(212,175,55,0.07), inset 0 1px 0 rgba(212,175,55,0.06) !important;
    position: relative; overflow: hidden;
  }
  .match-card::after {
    content: '';
    position: absolute; top: 0; left: -100%; width: 60%; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(212,175,55,0.8), rgba(255,255,255,0.6), rgba(212,175,55,0.8), transparent);
    animation: match-gold-line 4s ease-in-out infinite;
    animation-delay: calc(var(--i, 0) * 0.4s);
  }
        a.match-card { cursor: pointer; }
        a.match-card:hover { border-color: rgba(212,175,55,0.6) !important; box-shadow: 0 0 16px rgba(212,175,55,0.15) !important; }
  @keyframes match-gold-line { 0%{left:-100%} 50%{left:150%} 100%{left:150%} }
        @keyframes goldShimmer { 0%{left:-100%} 60%{left:150%} 100%{left:150%} }
        .match-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
        .match-vs { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; flex-wrap: wrap; }
        .player-name { font-weight: 600; }
        .player-name.winner { color: var(--gold); }
        .player-name.loser { color: var(--text-secondary); }
        .vs-text { color: var(--text-muted); font-size: 0.75rem; flex-shrink: 0; }
        .match-sub { display: flex; justify-content: space-between; margin-top: 0.375rem; font-size: 0.75rem; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
