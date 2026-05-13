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

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then((data: MatchWithGames & { error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setMatch(data);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load match'); setLoading(false); });
  }, [matchId]);

  if (loading) return <div className="loading">Loading scoresheet…</div>;
  if (error || !match) return <div className="error-message">{error || 'Match not found'}</div>;

  const p1Id = match.player1_id;
  const p2Id = match.player2_id;

  // Team display names
  const team1Label = match.team1_name || match.player1_name || 'Team A';
  const team2Label = match.team2_name || match.player2_name || 'Team B';

  // Team player names
  const team1Players = [match.player1_name, match.team1_player2_name].filter(Boolean).join(' / ');
  const team2Players = [match.player2_name, match.team2_player2_name].filter(Boolean).join(' / ');

  // Build running score per round
  let p1Running = 0;
  let p2Running = 0;
  const rows = match.games.map(g => {
    const p1Won = g.winner_id === p1Id;
    if (p1Won) p1Running += g.score_awarded;
    else p2Running += g.score_awarded;
    return {
      round: g.round_number,
      p1Pts: p1Won ? g.score_awarded : 0,
      p2Pts: p1Won ? 0 : g.score_awarded,
      p1Total: p1Running,
      p2Total: p2Running,
      p1Gin: p1Won && g.is_gin === 1,
      p2Gin: !p1Won && g.is_gin === 1,
      p1Undercut: p1Won && g.is_undercut === 1,
      p2Undercut: !p1Won && g.is_undercut === 1,
      winnerId: g.winner_id,
    };
  });

  const winnerLabel = match.winner_id === p1Id ? team1Label : match.winner_id === p2Id ? team2Label : null;

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

        {/* Status */}
        {winnerLabel && (
          <div className="ss-winner-banner">
            🏆 {winnerLabel} wins · {p1Running} – {p2Running}
          </div>
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
                <th className="ss-team-header team-a" colSpan={3}>{team1Label}</th>
                <th className="ss-team-header team-b" colSpan={3}>{team2Label}</th>
              </tr>
              <tr>
                <th className="ss-sub-col">Gin</th>
                <th className="ss-sub-col">{team1Players}</th>
                <th className="ss-sub-col total-col">Total</th>
                <th className="ss-sub-col">Gin</th>
                <th className="ss-sub-col">{team2Players}</th>
                <th className="ss-sub-col total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.round} className={r.winnerId === p1Id ? 'row-win-a' : 'row-win-b'}>
                  <td className="ss-round-num">{r.round}</td>
                  <td className="ss-gin-cell">
                    {r.p1Gin && <span className="gin-mark">★</span>}
                    {r.p1Undercut && <span className="undercut-mark">⟲</span>}
                  </td>
                  <td className="ss-score-cell">{r.p1Pts > 0 ? r.p1Pts : ''}</td>
                  <td className="ss-total-cell">{r.p1Total}</td>
                  <td className="ss-gin-cell">
                    {r.p2Gin && <span className="gin-mark">★</span>}
                    {r.p2Undercut && <span className="undercut-mark">⟲</span>}
                  </td>
                  <td className="ss-score-cell">{r.p2Pts > 0 ? r.p2Pts : ''}</td>
                  <td className="ss-total-cell">{r.p2Total}</td>
                </tr>
              ))}

              {/* Empty rows (up to at least 12 total for a blank sheet feel) */}
              {Array.from({ length: Math.max(0, 12 - rows.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="empty-row">
                  <td className="ss-round-num">{rows.length + i + 1}</td>
                  <td className="ss-gin-cell"></td>
                  <td className="ss-score-cell"></td>
                  <td className="ss-total-cell"></td>
                  <td className="ss-gin-cell"></td>
                  <td className="ss-score-cell"></td>
                  <td className="ss-total-cell"></td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="totals-row">
                <td className="ss-round-num" style={{ fontWeight: 700 }}>Total</td>
                <td className="ss-gin-cell"></td>
                <td className="ss-score-cell"></td>
                <td className="ss-total-cell" style={{ fontWeight: 800, fontSize: '1rem', color: p1Running > p2Running ? 'var(--gold)' : 'inherit' }}>
                  {p1Running}
                </td>
                <td className="ss-gin-cell"></td>
                <td className="ss-score-cell"></td>
                <td className="ss-total-cell" style={{ fontWeight: 800, fontSize: '1rem', color: p2Running > p1Running ? 'var(--gold)' : 'inherit' }}>
                  {p2Running}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="ss-legend">
          <span><span className="gin-mark">★</span> Gin (+25 bonus)</span>
          <span><span className="undercut-mark">⟲</span> Undercut (+25 bonus)</span>
          <span>Target: {match.target_score} pts</span>
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
          display: flex;
          align-items: center;
          gap: 0.875rem;
          margin-bottom: 1rem;
          padding-bottom: 0.875rem;
          border-bottom: 2px solid var(--border);
        }

        .ss-logo {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: contain;
        }

        .ss-heading {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-bottom: 0.125rem;
        }

        .ss-month {
          font-size: 0.8125rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .ss-winner-banner {
          background: rgba(212,175,55,0.12);
          border: 1px solid rgba(212,175,55,0.3);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.875rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--gold);
          margin-bottom: 1rem;
          text-align: center;
        }

        .ss-in-progress {
          background: rgba(43,79,55,0.2);
          border: 1px solid rgba(99,141,111,0.3);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.875rem;
          font-size: 0.8125rem;
          color: var(--felt-light);
          margin-bottom: 1rem;
          text-align: center;
        }

        .ss-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 0 -0.25rem;
        }

        .ss-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 340px;
        }

        .ss-table th, .ss-table td {
          border: 1px solid var(--border);
          text-align: center;
          font-size: 0.875rem;
        }

        .ss-round-col { width: 44px; }
        .ss-sub-col { width: auto; }
        .total-col { background: rgba(255,255,255,0.02); }

        .ss-team-header {
          padding: 0.5rem 0.375rem;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .ss-team-header.team-a {
          background: rgba(74,158,255,0.12);
          color: #4a9eff;
          border-bottom: 2px solid #4a9eff;
        }

        .ss-team-header.team-b {
          background: rgba(200,16,46,0.12);
          color: var(--heart);
          border-bottom: 2px solid var(--heart);
        }

        .ss-table thead tr:nth-child(2) th {
          padding: 0.375rem 0.25rem;
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ss-round-num {
          padding: 0.5rem 0.375rem;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .ss-gin-cell {
          padding: 0.375rem 0.25rem;
          font-size: 1rem;
          min-width: 32px;
        }

        .ss-score-cell {
          padding: 0.5rem 0.375rem;
          font-weight: 600;
          color: var(--cream);
          min-width: 44px;
        }

        .ss-total-cell {
          padding: 0.5rem 0.375rem;
          font-weight: 700;
          color: var(--text-primary);
          background: rgba(255,255,255,0.02);
          min-width: 44px;
        }

        .row-win-a .ss-score-cell:nth-child(3),
        .row-win-a .ss-total-cell:nth-child(4) {
          color: #4a9eff;
        }

        .row-win-b .ss-score-cell:nth-child(6),
        .row-win-b .ss-total-cell:nth-child(7) {
          color: var(--heart);
        }

        .empty-row td {
          height: 36px;
          opacity: 0.3;
        }

        .totals-row {
          background: rgba(255,255,255,0.03);
          border-top: 2px solid var(--border);
        }

        .totals-row td {
          padding: 0.625rem 0.375rem;
        }

        .gin-mark {
          color: var(--gold);
          font-size: 0.875rem;
        }

        .undercut-mark {
          color: var(--heart);
          font-size: 0.875rem;
        }

        .ss-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 0.875rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Print styles */
        @media print {
          body { background: white; color: black; }
          .bottom-nav, a[href] { display: none !important; }
          .scoresheet {
            background: white;
            border: none;
            padding: 0;
            border-radius: 0;
          }
          .ss-table th, .ss-table td { border-color: #ccc; }
          .ss-team-header.team-a { background: #e8f0ff; color: #1a56db; }
          .ss-team-header.team-b { background: #fde8ea; color: #c81028; }
          .ss-heading { color: black; }
          .ss-month { color: #666; }
          .ss-round-num { color: #666; }
          .ss-score-cell, .ss-total-cell { color: black; }
          .totals-row { background: #f5f5f5; }
          .gin-mark { color: #b8860b; }
          .undercut-mark { color: #c81028; }
          .ss-in-progress, .ss-winner-banner { background: #f0f0f0; color: #333; border-color: #ccc; }
        }
      `}</style>
    </div>
  );
}
