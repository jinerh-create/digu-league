import { useState, useEffect } from 'react';
import type { Match, Game } from '../../lib/types';

interface MatchWithGames extends Match {
  games: Game[];
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function Scoresheet({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchWithGames | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ginSelections, setGinSelections] = useState<Record<string, string>>({});
  const [savingGin, setSavingGin] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then((data: MatchWithGames & { error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setMatch(data);
        // Init gin selections from stored data
        const init: Record<string, string> = {};
        data.games.forEach(g => { init[g.id] = g.gin_player_id ?? ''; });
        setGinSelections(init);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load match'); setLoading(false); });
  }, [matchId]);

  async function handleGinChange(gameId: string, playerId: string) {
    setGinSelections(prev => ({ ...prev, [gameId]: playerId }));
    setSavingGin(prev => ({ ...prev, [gameId]: true }));
    try {
      await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_gin: playerId ? 1 : 0, gin_player_id: playerId || null }),
      });
    } finally {
      setSavingGin(prev => ({ ...prev, [gameId]: false }));
    }
  }

  if (loading) return <div className="loading">Loading scoresheet…</div>;
  if (error || !match) return <div className="error-message">{error || 'Match not found'}</div>;

  const p1Id = match.player1_id;
  const p2Id = match.player2_id;
  const team1Label = match.team1_name || match.player1_name || 'Team A';
  const team2Label = match.team2_name || match.player2_name || 'Team B';
  const team1Players = [match.player1_name, match.team1_player2_name].filter(Boolean).join(' / ');
  const team2Players = [match.player2_name, match.team2_player2_name].filter(Boolean).join(' / ');

  // All players for gin dropdown
  const allPlayers = [
    { id: p1Id, name: match.player1_name ?? 'Player 1' },
    match.team1_player2_id ? { id: match.team1_player2_id, name: match.team1_player2_name ?? '' } : null,
    { id: p2Id, name: match.player2_name ?? 'Player 2' },
    match.team2_player2_id ? { id: match.team2_player2_id, name: match.team2_player2_name ?? '' } : null,
  ].filter(Boolean) as { id: string; name: string }[];

  let p1Running = 0;
  let p2Running = 0;
  const rows = match.games.map(g => {
    const p1Won = g.winner_id === p1Id;
    if (p1Won) p1Running += g.score_awarded;
    else p2Running += g.score_awarded;
    return {
      id: g.id,
      round: g.round_number,
      p1Pts: p1Won ? g.score_awarded : null,
      p2Pts: p1Won ? null : g.score_awarded,
      hasUndercut: g.is_undercut === 1,
      winnerId: g.winner_id,
    };
  });

  const winnerLabel = match.winner_id === p1Id ? team1Label : match.winner_id === p2Id ? team2Label : null;
  const totalRounds = match.max_rounds > 0 ? match.max_rounds : Math.max(12, rows.length + 2);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <a href={`/match/${matchId}`} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>← Back</a>
        <button
          onClick={() => window.print()}
          className="btn btn-secondary"
          style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', minHeight: 'auto' }}
        >
          🖨 Print
        </button>
      </div>

      <div className="scoresheet" id="printable">
        {/* Title */}
        <div className="ss-title">
          <img src="/logo.png" alt="Digu League" className="ss-logo" />
          <div>
            <h1 className="ss-heading">Digu League</h1>
            <div className="ss-month">{monthLabel(match.started_at)}</div>
          </div>
        </div>

        {winnerLabel && (
          <div className="ss-winner-banner">🏆 {winnerLabel} wins · {p1Running} – {p2Running}</div>
        )}
        {!match.completed_at && (
          <div className="ss-in-progress">Match in progress · {match.games.length} rounds played</div>
        )}

        {/* Score Table */}
        <div className="ss-table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th className="ss-round-col" rowSpan={2}>Round</th>
                <th className="ss-gin-header" rowSpan={2}>DIGU</th>
                <th className="ss-team-header team-a">{team1Label}</th>
                <th className="ss-team-header team-b">{team2Label}</th>
              </tr>
              <tr>
                <th className="ss-sub-col">{team1Players}</th>
                <th className="ss-sub-col">{team2Players}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={r.winnerId === p1Id ? 'row-win-a' : 'row-win-b'}>
                  <td className="ss-round-num">{r.round}</td>
                  <td className="ss-gin-cell">
                    <select
                      className="gin-select"
                      value={ginSelections[r.id] ?? ''}
                      onChange={e => handleGinChange(r.id, e.target.value)}
                      disabled={savingGin[r.id]}
                      title="Select gin player"
                    >
                      <option value="">—</option>
                      {allPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {r.hasUndercut && <span className="undercut-mark" title="Undercut">⟲</span>}
                  </td>
                  <td className="ss-score-cell" style={{ color: r.p1Pts ? 'var(--team-a)' : undefined }}>
                    {r.p1Pts ?? ''}
                  </td>
                  <td className="ss-score-cell" style={{ color: r.p2Pts ? 'var(--team-b)' : undefined }}>
                    {r.p2Pts ?? ''}
                  </td>
                </tr>
              ))}

              {/* Empty rows */}
              {Array.from({ length: Math.max(0, totalRounds - rows.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="empty-row">
                  <td className="ss-round-num">{rows.length + i + 1}</td>
                  <td className="ss-gin-cell"></td>
                  <td className="ss-score-cell"></td>
                  <td className="ss-score-cell"></td>
                </tr>
              ))}

              {/* Total row */}
              <tr className="totals-row">
                <td className="ss-round-num" style={{ fontWeight: 700 }}>Total</td>
                <td className="ss-gin-cell"></td>
                <td className="ss-score-cell" style={{ fontWeight: 800, fontSize: '1rem', color: p1Running > p2Running ? 'var(--gold)' : 'var(--team-a)' }}>
                  {p1Running}
                </td>
                <td className="ss-score-cell" style={{ fontWeight: 800, fontSize: '1rem', color: p2Running > p1Running ? 'var(--gold)' : 'var(--team-b)' }}>
                  {p2Running}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="ss-legend">
          <span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>★ DIGU</span> (+25 bonus)</span>
          <span><span className="undercut-mark">⟲</span> Undercut (+25 bonus)</span>
          {match.target_score > 0 && <span>Target: {match.target_score} pts</span>}
          {match.max_rounds > 0 && <span>Rounds: {match.max_rounds}</span>}
        </div>
      </div>

      <style>{`
        .scoresheet {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          margin-bottom: 1rem;
        }
        .ss-title {
          display: flex; align-items: center; gap: 0.875rem;
          margin-bottom: 1rem; padding-bottom: 0.875rem;
          border-bottom: 2px solid var(--border);
        }
        .ss-logo { width: 48px; height: 48px; border-radius: 8px; object-fit: contain; }
        .ss-heading { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 0.125rem; }
        .ss-month { font-size: 0.8125rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .ss-winner-banner {
          background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.3);
          border-radius: var(--radius-sm); padding: 0.5rem 0.875rem;
          font-size: 0.875rem; font-weight: 700; color: var(--gold);
          margin-bottom: 1rem; text-align: center;
        }
        .ss-in-progress {
          background: rgba(43,79,55,0.2); border: 1px solid rgba(99,141,111,0.3);
          border-radius: var(--radius-sm); padding: 0.5rem 0.875rem;
          font-size: 0.8125rem; color: var(--felt-light); margin-bottom: 1rem; text-align: center;
        }
        .ss-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -0.25rem; }
        .ss-table { width: 100%; border-collapse: collapse; min-width: 300px; }
        .ss-table th, .ss-table td { border: 1px solid var(--border); text-align: center; font-size: 0.875rem; }
        .ss-round-col { width: 44px; }
        .ss-gin-header {
          width: 100px;
          padding: 0.375rem 0.25rem;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--gold);
        }
        .ss-team-header {
          padding: 0.5rem 0.375rem; font-size: 0.75rem; font-weight: 800;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .ss-team-header.team-a { background: var(--team-a-dim); color: var(--team-a); border-bottom: 2px solid var(--team-a); }
        .ss-team-header.team-b { background: var(--team-b-dim); color: var(--team-b); border-bottom: 2px solid var(--team-b); }
        .ss-table thead tr:nth-child(2) th {
          padding: 0.375rem 0.25rem; font-size: 0.6rem; font-weight: 600;
          color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;
          max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ss-round-num { padding: 0.5rem 0.375rem; color: var(--text-muted); font-size: 0.75rem; font-weight: 600; }
        .ss-gin-cell { padding: 0.25rem 0.25rem; min-width: 100px; }
        .ss-score-cell { padding: 0.5rem 0.375rem; font-weight: 700; min-width: 52px; }
        .empty-row td { height: 36px; opacity: 0.25; }
        .totals-row { background: rgba(255,255,255,0.03); border-top: 2px solid var(--border); }
        .totals-row td { padding: 0.625rem 0.375rem; }
        .undercut-mark { color: var(--team-b); font-size: 0.875rem; }
        .ss-legend {
          display: flex; flex-wrap: wrap; gap: 1rem;
          margin-top: 0.875rem; padding-top: 0.75rem;
          border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted);
        }

        /* Gin select dropdown */
        .gin-select {
          width: 100%;
          background: var(--card-raised);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--gold);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.125rem;
          cursor: pointer;
          text-align: center;
        }
        .gin-select:focus { outline: none; border-color: var(--gold); }
        .gin-select option { color: var(--cream); background: var(--card); }

        /* Print */
        @media print {
          body { background: white; color: black; }
          .bottom-nav, a[href], button { display: none !important; }
          .scoresheet { background: white; border: none; padding: 0; border-radius: 0; }
          .ss-table th, .ss-table td { border-color: #ccc; }
          .ss-team-header.team-a { background: #fde8ea; color: #c0242f; }
          .ss-team-header.team-b { background: #e8eaed; color: #2d3748; }
          .ss-heading, .ss-score-cell { color: black; }
          .ss-month, .ss-round-num { color: #666; }
          .totals-row { background: #f5f5f5; }
          .gin-select { border-color: #ccc; color: #333; background: white; }
        }
      `}</style>
    </div>
  );
}
