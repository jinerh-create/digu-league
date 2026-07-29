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

type Tab = 'all' | 'single' | 'team' | 'classic';

export default function MatchList() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [classicMatches, setClassicMatches] = useState<Match[]>([]);
  const [classicLoaded, setClassicLoaded] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  // Which completed match has its details drawer open (date, type, scoresheet, note).
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then((data: Match[]) => { setMatches(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
    // reveal "New" buttons only for logged-in users (empty POST → 400 authed, 401 not)
    fetch('/api/matches', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
      .then(r => { if (r.status !== 401) setCanCreate(true); })
      .catch(() => {});
  }, []);

  // Classic (Quick) matches load only when that tab is first opened.
  useEffect(() => {
    if (tab !== 'classic' || classicLoaded) return;
    setClassicLoaded(true);
    fetch('/api/classic')
      .then(r => r.json())
      .then((data: Match[]) => setClassicMatches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [tab, classicLoaded]);

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
    const r = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
    if (!r.ok) {
      setDeletingId(null);
      setConfirmDeleteId(null);
      alert(r.status === 403 ? 'Only an admin can delete a match.' : 'Could not delete the match.');
      return;
    }
    // Deleting cascades the match's games server-side, so every derived view —
    // leaderboard, records, form chart, scoresheet — recomputes on next load.
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setClassicMatches(prev => prev.filter(m => m.id !== matchId));
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

  const isClassic = tab === 'classic';
  const newHref = isClassic ? '/new-classic' : '/new-match';
  const base = isClassic ? classicMatches : matches;
  const filtered = base.filter(m => {
    if (tab === 'single') return !m.team1_player2_id;
    if (tab === 'team') return !!m.team1_player2_id;
    return true;
  });

  const active = filtered.filter(m => !m.completed_at);
  const completed = filtered.filter(m => m.completed_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {canCreate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <a href={newHref} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8125rem' }}>
            + New {isClassic ? 'Quick Match' : 'Match'}
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', background: 'var(--card)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
        {(['all', 'single', 'team', 'classic'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8125rem',
              background: tab === t ? (t === 'classic' ? '#7a5cff' : 'var(--felt)') : 'transparent',
              color: tab === t ? 'var(--cream)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'all' ? 'All' : t === 'single' ? 'Single' : t === 'team' ? 'Team' : 'Quick'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <p>No {isClassic ? 'quick ' : tab !== 'all' ? tab + ' ' : ''}matches yet.</p>
          <a href={newHref} className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>Start {isClassic ? 'Quick ' : ''}Match</a>
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
              const open = openId === m.id;
              return (
                <div key={m.id} className="card match-card">
                  {/* Face of the tile: names, King of the Table, winner. Nothing else. */}
                  <div className="match-head" onClick={() => setOpenId(open ? null : m.id)}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(open ? null : m.id); } }}
                    aria-expanded={open} aria-label={`${s1} versus ${s2} — show details`}>
                    <div className="match-vs">
                      <span className={`player-name ${m.winner_id === m.player1_id ? 'winner' : isDraw ? '' : 'loser'}`}>{s1}</span>
                      <span className="vs-text">vs</span>
                      <span className={`player-name ${m.winner_id === m.player2_id ? 'winner' : isDraw ? '' : 'loser'}`}>{s2}</span>
                    </div>
                    {m.king_name && (m.king_digus ?? 0) > 0 && (
                      <span className="king-chip" title={`King of the Table: ${m.king_name} · ${m.king_digus} digu`}>
                        👑 {m.king_name} · {m.king_digus}
                      </span>
                    )}
                    {isDraw
                      ? <span className="result-chip draw">Draw</span>
                      : <span className="result-chip win">🏆 {winnerSide}</span>}
                    <span className={`caret${open ? ' open' : ''}`} aria-hidden="true">⌄</span>
                    {canCreate && (
                      <button className="x-btn" title="Delete match" aria-label="Delete match"
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(m.id); setOpenId(null); }}>
                        ✕
                      </button>
                    )}
                  </div>

                  {canCreate && confirmDeleteId === m.id && (
                    <div className="confirm-strip">
                      <span>Delete this match? Scoresheet, records &amp; standings all adjust.</span>
                      <button className="c-yes" disabled={deletingId === m.id} onClick={() => handleDelete(m.id)}>
                        {deletingId === m.id ? 'Deleting…' : 'Delete'}
                      </button>
                      <button className="c-no" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  )}

                  {open && (
                    <div className="match-details">
                      <div className="detail-row">
                        <span>{m.team1_player2_id ? '2v2' : '1v1'}</span>
                        <span className="dot">·</span>
                        <DateEditor matchId={m.id} started_at={m.started_at} editing={editingDate === m.id} saving={savingDate}
                          onEdit={() => setEditingDate(m.id)} onSave={handleDateChange} onCancel={() => setEditingDate(null)} />
                        <a href={`/scoresheet/${m.id}`} className="sheet-link">Scoresheet →</a>
                      </div>
                      {editingComment === m.id ? (
                        <div className="note-edit">
                          <input
                            autoFocus
                            value={commentDraft}
                            onChange={e => setCommentDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveComment(m.id); if (e.key === 'Escape') setEditingComment(null); }}
                            placeholder="Add a note…"
                          />
                          <button className="n-save" onClick={() => handleSaveComment(m.id)}>Save</button>
                          <button className="n-cancel" onClick={() => setEditingComment(null)}>✕</button>
                        </div>
                      ) : (
                        <div className="note-view" onClick={() => { setEditingComment(m.id); setCommentDraft(m.comment || ''); }}>
                          {m.comment ? `"${m.comment}"` : '+ Add note'}
                        </div>
                      )}
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
    padding: 0.45rem 0.65rem; cursor: default;
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
        .match-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
        .match-vs { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; flex-wrap: wrap; }

        /* ── slim completed tile ── */
        .match-head {
          display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
          cursor: pointer; outline: none;
        }
        .match-head:focus-visible { box-shadow: 0 0 0 2px rgba(212,175,55,0.55); border-radius: 6px; }
        .match-head .match-vs { flex: 1; min-width: 0; font-size: 0.875rem; }
        .king-chip {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.2rem;
          font-size: 0.65rem; font-weight: 700; color: #D4AF37;
          background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.28);
          border-radius: 999px; padding: 0.1rem 0.45rem; white-space: nowrap;
        }
        .result-chip {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.25rem;
          border-radius: 999px; font-weight: 800; font-size: 0.68rem;
          padding: 0.18rem 0.55rem; white-space: nowrap;
        }
        .result-chip.win {
          background: linear-gradient(135deg, #b8922a 0%, #d4af37 50%, #e8c84a 100%);
          color: #1a1000; box-shadow: 0 1px 5px rgba(212,175,55,0.35);
        }
        .result-chip.draw { background: rgba(100,100,100,0.28); color: #aaa; font-weight: 700; }
        .caret {
          flex-shrink: 0; color: var(--text-muted); font-size: 0.8rem; line-height: 1;
          transition: transform 0.18s ease; transform-origin: center;
        }
        .caret.open { transform: rotate(180deg); }
        .x-btn {
          flex-shrink: 0; width: 20px; height: 20px; display: grid; place-items: center;
          border-radius: 5px; border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); font-size: 0.7rem; line-height: 1; cursor: pointer;
          padding: 0; transition: all 0.15s;
        }
        .x-btn:hover { border-color: rgba(255,61,90,0.45); color: #FF6B8A; background: rgba(255,61,90,0.1); }

        .confirm-strip {
          margin-top: 0.45rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
          font-size: 0.7rem; color: var(--ember); font-weight: 700;
        }
        .confirm-strip button { padding: 0.2rem 0.55rem; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer; }
        .confirm-strip .c-yes { background: var(--ember); color: #fff; border: none; }
        .confirm-strip .c-yes:disabled { opacity: 0.6; cursor: default; }
        .confirm-strip .c-no { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }

        .match-details {
          margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 0.4rem;
        }
        .detail-row {
          display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;
          font-size: 0.72rem; color: var(--text-muted);
        }
        .detail-row .dot { opacity: 0.6; }
        .detail-row .sheet-link { margin-left: auto; color: var(--felt-light); font-weight: 600; text-decoration: none; }
        .note-view { font-size: 0.72rem; color: var(--text-muted); cursor: pointer; }
        .note-edit { display: flex; gap: 0.35rem; }
        .note-edit input {
          flex: 1; font-size: 0.78rem; padding: 0.22rem 0.45rem; border-radius: 6px;
          border: 1px solid var(--border); background: var(--card-raised); color: var(--text-primary);
        }
        .note-edit button { padding: 0.22rem 0.5rem; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; }
        .note-edit .n-save { background: var(--felt); color: #fff; border: none; }
        .note-edit .n-cancel { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }
        .player-name { font-weight: 600; }
        .player-name.winner { color: var(--gold); }
        .player-name.loser { color: var(--text-secondary); }
        .vs-text { color: var(--text-muted); font-size: 0.75rem; flex-shrink: 0; }
        .match-sub { display: flex; justify-content: space-between; margin-top: 0.375rem; font-size: 0.75rem; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
