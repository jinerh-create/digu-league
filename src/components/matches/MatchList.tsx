import { useState, useEffect } from 'react';
import type { Match } from '../../lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function side1(m: Match) {
  return m.team1_player2_name ? `${m.player1_name} / ${m.team1_player2_name}` : (m.player1_name ?? '');
}
function side2(m: Match) {
  return m.team2_player2_name ? `${m.player2_name} / ${m.team2_player2_name}` : (m.player2_name ?? '');
}

type Tab = 'all' | 'single' | 'team';

export default function MatchList() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then((data: Match[]) => { setMatches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
              <a href={`/match/${m.id}`} key={m.id} className="card match-card">
                <div className="match-row">
                  <div className="match-vs">
                    <span className="player-name">{side1(m)}</span>
                    <span className="vs-text">vs</span>
                    <span className="player-name">{side2(m)}</span>
                  </div>
                  <span className="badge badge-gin">Live</span>
                </div>
                <div className="match-sub">
                  <span>{m.team1_player2_id ? '2v2 Team' : '1v1 Single'} · To {m.target_score} pts</span>
                  <span>{formatDate(m.started_at)}</span>
                </div>
              </a>
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
                <div key={m.id} className="card match-card">
                  <div className="match-row">
                    <div className="match-vs">
                      <span className={`player-name ${m.winner_id === m.player1_id ? 'winner' : isDraw ? '' : 'loser'}`}>{s1}</span>
                      <span className="vs-text">vs</span>
                      <span className={`player-name ${m.winner_id === m.player2_id ? 'winner' : isDraw ? '' : 'loser'}`}>{s2}</span>
                    </div>
                    {isDraw
                      ? <span className="badge" style={{ background: 'rgba(100,100,100,0.3)', color: '#aaa' }}>Draw</span>
                      : <span className="badge badge-win">{winnerSide} wins</span>
                    }
                  </div>
                  <div className="match-sub">
                    <span>{m.team1_player2_id ? '2v2' : '1v1'} · {formatDate(m.started_at)}</span>
                    <a href={`/scoresheet/${m.id}`} style={{ color: 'var(--felt-light)', fontWeight: 600 }}>Scoresheet →</a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <style>{`
        .match-card { padding: 0.875rem 1rem; cursor: default; }
        a.match-card { cursor: pointer; }
        a.match-card:hover { border-color: #444; }
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
