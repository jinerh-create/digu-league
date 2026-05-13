import { useState, useEffect } from 'react';
import type { Match } from '../../lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MatchList() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then((data: Match[]) => { setMatches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading matches…</div>;
  if (!matches.length) return (
    <div className="empty-state">
      <p>No matches yet.</p>
      <a href="/new-match" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>Start First Match</a>
    </div>
  );

  const active = matches.filter(m => !m.completed_at);
  const completed = matches.filter(m => m.completed_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {active.length > 0 && (
        <section>
          <div className="label" style={{ marginBottom: '0.5rem' }}>In Progress</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {active.map(m => (
              <a href={`/match/${m.id}`} key={m.id} className="card match-card">
                <div className="match-row">
                  <div className="match-vs">
                    <span className="player-name">{m.player1_name}</span>
                    <span className="vs-text">vs</span>
                    <span className="player-name">{m.player2_name}</span>
                  </div>
                  <span className="badge badge-gin">Live</span>
                </div>
                <div className="match-sub">
                  <span>To {m.target_score} pts</span>
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
              const team1 = m.team1_name || m.player1_name;
              const team2 = m.team2_name || m.player2_name;
              const winnerTeam = m.winner_id === m.player1_id ? team1 : team2;
              return (
              <div key={m.id} className="card match-card">
                <div className="match-row">
                  <div className="match-vs">
                    <span className={`player-name ${m.winner_id === m.player1_id ? 'winner' : 'loser'}`}>{team1}</span>
                    <span className="vs-text">vs</span>
                    <span className={`player-name ${m.winner_id === m.player2_id ? 'winner' : 'loser'}`}>{team2}</span>
                  </div>
                  <span className="badge badge-win">{winnerTeam} wins</span>
                </div>
                <div className="match-sub">
                  <span>To {m.target_score} pts · {formatDate(m.started_at)}</span>
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
        .match-vs { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; }
        .player-name { font-weight: 600; }
        .player-name.winner { color: var(--gold); }
        .player-name.loser { color: var(--text-secondary); }
        .vs-text { color: var(--text-muted); font-size: 0.75rem; }
        .match-sub { display: flex; justify-content: space-between; margin-top: 0.375rem; font-size: 0.75rem; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
