import { useState, useEffect } from 'react';
import type { Match, Game } from '../../lib/types';

interface MatchWithGames extends Match {
  games: Game[];
}

function Avatar({ name, b64, size = 36 }: { name: string; b64?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (b64) return <img src={`data:image/jpeg;base64,${b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#DDD1BF', flexShrink: 0 }}>
      {initials}
    </div>
  );
}


export default function ActiveMatch({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchWithGames | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionData, setCompletionData] = useState<{ winnerId: string | null; isDraw: boolean; p1Score: number; p2Score: number } | null>(null);

  // 1v1 form state
  const [winnerId, setWinnerId] = useState('');
  const [score, setScore] = useState('');
  const [isGin, setIsGin] = useState(false);

  // 2v2 form state
  const [t1Score, setT1Score] = useState(0);
  const [t2Score, setT2Score] = useState(0);
  const [teamGin, setTeamGin] = useState(false);
  const [ginPlayerId, setGinPlayerId] = useState('');

  // Scoresheet gin edits
  const [ginEdits, setGinEdits] = useState<Record<string, string>>({});
  const [savingGin, setSavingGin] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then((data: MatchWithGames & { error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setMatch(data);
        setWinnerId(data.player1_id);
        const initGin: Record<string, string> = {};
        data.games.forEach(g => { initGin[g.id] = g.gin_player_id ?? ''; });
        setGinEdits(initGin);
        if (data.completed_at) {
          const p1S = data.games.filter(g => g.winner_id === data.player1_id).reduce((s, g) => s + g.score_awarded, 0);
          const p2S = data.games.filter(g => g.winner_id === data.player2_id).reduce((s, g) => s + g.score_awarded, 0);
          setCompletionData({ winnerId: data.winner_id, isDraw: !data.winner_id, p1Score: p1S, p2Score: p2S });
          setShowCompletion(true);
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load match'); setLoading(false); });
  }, [matchId]);

  if (loading) return <div className="loading" style={{ paddingTop: '3rem' }}>Loading matchâ€¦</div>;
  if (error || !match) return <div className="error-message">{error || 'Match not found'}</div>;

  const isTeam = !!match.team1_player2_id;
  const isRoundsMode = match.max_rounds > 0;
  const roundsLeft = isRoundsMode ? match.max_rounds - match.games.length : null;
  const roundsDone = isRoundsMode && match.games.length >= match.max_rounds;
  const p1Id = match.player1_id;
  const p2Id = match.player2_id;
  const p1Name = match.player1_name ?? 'Team 1';
  const p2Name = match.player2_name ?? 'Team 2';
  const t1p2Name = match.team1_player2_name ?? '';
  const t2p2Name = match.team2_player2_name ?? '';
  const team1Label = isTeam ? (match.team1_name || `${p1Name} / ${t1p2Name}`) : p1Name;
  const team2Label = isTeam ? (match.team2_name || `${p2Name} / ${t2p2Name}`) : p2Name;

  const p1Score = match.games.filter(g => g.winner_id === p1Id).reduce((s, g) => s + g.score_awarded, 0);
  const p2Score = match.games.filter(g => g.winner_id === p2Id).reduce((s, g) => s + g.score_awarded, 0);
  const p1Pct = match.target_score > 0 ? Math.min(100, (p1Score / match.target_score) * 100) : 0;
  const p2Pct = match.target_score > 0 ? Math.min(100, (p2Score / match.target_score) * 100) : 0;

  // 2v2 live calc
  const team1Total = t1Score;
  const team2Total = t2Score;
  const team1Wins2v2 = team1Total <= team2Total;
  const losingTotal2v2 = team1Wins2v2 ? team2Total : team1Total;
  const winningTotal2v2 = team1Wins2v2 ? team1Total : team2Total;
  const teamScore2v2 = teamGin ? losingTotal2v2 + 25 : Math.max(0, losingTotal2v2 - winningTotal2v2);
  const teamWinnerLabel = team1Wins2v2 ? team1Label : team2Label;

  // All 4 players for gin selector (2v2)
  const allPlayers = isTeam ? [
    { id: p1Id, name: p1Name },
    { id: match.team1_player2_id!, name: t1p2Name },
    { id: p2Id, name: p2Name },
    { id: match.team2_player2_id!, name: t2p2Name },
  ] : [];

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    if (!match) return;
    setSubmitting(true);
    setError('');
    const body = isTeam
      ? { t1_p1_cards: t1Score, t1_p2_cards: 0, t2_p1_cards: t2Score, t2_p2_cards: 0, is_gin: teamGin, gin_player_id: teamGin ? ginPlayerId || null : null }
      : { winner_id: winnerId, score: parseInt(score) || 0, is_gin: isGin, gin_player_id: isGin ? winnerId : null };
    try {
      const res = await fetch(`/api/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { game: Game; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed'); setSubmitting(false); return; }
      setMatch(prev => prev ? { ...prev, games: [...prev.games, data.game] } : prev);
      setGinEdits(prev => ({ ...prev, [data.game.id]: data.game.gin_player_id ?? '' }));
      setScore(''); setIsGin(false);
      setT1Score(0); setT2Score(0);
      setTeamGin(false); setGinPlayerId('');
    } catch { setError('Network error. Try again.'); }
    finally { setSubmitting(false); }
  }

  async function handleFinish() {
    if (!match) return;
    setFinishing(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/finish`, { method: 'POST' });
      const data = await res.json() as { ok: boolean; winnerId: string | null; isDraw: boolean; p1Score: number; p2Score: number; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to finish'); setFinishing(false); return; }
      setMatch(prev => prev ? { ...prev, winner_id: data.winnerId, completed_at: new Date().toISOString() } : prev);
      setCompletionData(data);
      setShowFinishConfirm(false);
      setShowCompletion(true);
    } catch { setError('Network error'); }
    finally { setFinishing(false); }
  }

  async function handleGinEdit(gameId: string, playerId: string) {
    setGinEdits(prev => ({ ...prev, [gameId]: playerId }));
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

  const winnerName = completionData?.winnerId === p1Id ? team1Label : completionData?.winnerId === p2Id ? team2Label : '';

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Score Header */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
        {isTeam ? (
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
              {isRoundsMode ? `Round ${match.games.length + 1} of ${match.max_rounds}` : `Round ${match.games.length + 1}`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--team-a)' }}>{team1Label}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--team-a)' }}>{p1Score}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>vs</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--team-b)' }}>{team2Label}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--team-b)' }}>{p2Score}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <Avatar name={p1Name} b64={match.player1_avatar} size={40} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p1Name}</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--team-a)' }}>{p1Score}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Round {match.games.length + 1}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>vs</div>
              {isRoundsMode
                ? <div style={{ fontSize: '0.625rem', color: roundsDone ? 'var(--gold)' : 'var(--text-muted)', fontWeight: roundsDone ? 700 : 400 }}>
                    {match.games.length}/{match.max_rounds} rounds
                  </div>
                : <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>to {match.target_score}</div>
              }
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <Avatar name={p2Name} b64={match.player2_avatar} size={40} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p2Name}</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--team-b)' }}>{p2Score}</div>
              </div>
            </div>
          </div>
        )}
        {/* Progress bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[{ label: p1Name.split(' ')[0], pct: p1Pct, color: 'var(--team-a)' }, { label: p2Name.split(' ')[0], pct: p2Pct, color: 'var(--team-b)' }].map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 36, fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <div style={{ width: 28, fontSize: '0.625rem', color: 'var(--text-muted)' }}>{Math.round(b.pct)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scoresheet Table */}
      {match.games.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem', overflowX: 'auto' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>Scoresheet</div>
          {isTeam ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>WINNER</th>
                  <th style={thStyle}>DIGU</th>
                  <th style={{ ...thStyle, color: 'var(--team-a)' }}>{p1Name.split(' ')[0]} / {t1p2Name.split(' ')[0]}</th>
                  <th style={{ ...thStyle, color: 'var(--team-b)' }}>{p2Name.split(' ')[0]} / {t2p2Name.split(' ')[0]}</th>
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => {
                  const t1Cards = (g.t1_p1_cards ?? 0) + (g.t1_p2_cards ?? 0);
                  const t2Cards = (g.t2_p1_cards ?? 0) + (g.t2_p2_cards ?? 0);
                  // winner = team with higher score_awarded; 0-point rounds show no winner
                  const hasWinner = g.score_awarded > 0;
                  const t1Won = hasWinner && g.winner_id === p1Id;
                  const t2Won = hasWinner && g.winner_id === p2Id;
                  return (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontWeight: 600 }}>{g.round_number}</td>
                      <td style={tdStyle}>
                        {hasWinner ? (
                          <span style={{
                            display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: 4,
                            fontSize: '0.625rem', fontWeight: 700,
                            background: t1Won ? 'rgba(230,57,70,0.15)' : 'rgba(74,85,104,0.15)',
                            color: t1Won ? 'var(--team-a)' : 'var(--team-b)',
                          }}>
                            {t1Won ? (match.team1_name || 'A') : (match.team2_name || 'B')}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, padding: '0.25rem' }}>
                        <select
                          value={ginEdits[g.id] ?? ''}
                          onChange={e => handleGinEdit(g.id, e.target.value)}
                          disabled={savingGin[g.id]}
                          style={{
                            width: '100%', background: 'var(--card-raised)', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--gold)', fontSize: '0.6875rem', fontWeight: 600,
                            padding: '0.2rem 0.125rem', cursor: 'pointer', textAlign: 'center',
                          }}
                        >
                          <option value="">—</option>
                          {allPlayers.map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: t1Won ? 'var(--team-a)' : 'var(--text-muted)' }}>
                        {t1Cards > 0 ? t1Cards : '0'}{t1Won ? ` (+${g.score_awarded})` : ''}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: t2Won ? 'var(--team-b)' : 'var(--text-muted)' }}>
                        {t2Cards > 0 ? t2Cards : '0'}{t2Won ? ` (+${g.score_awarded})` : ''}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-muted)' }} colSpan={3}>TOTAL</td>
                  <td style={{ ...tdStyle, fontWeight: 800, fontSize: '1rem', color: 'var(--team-a)' }}>{p1Score}</td>
                  <td style={{ ...tdStyle, fontWeight: 800, fontSize: '1rem', color: 'var(--team-b)' }}>{p2Score}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, color: 'var(--team-a)', textAlign: 'center' }}>{p1Name}</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>DIGU</th>
                  <th style={{ ...thStyle, color: 'var(--team-b)', textAlign: 'center' }}>{p2Name}</th>
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => {
                  const hasWinner = g.score_awarded > 0;
                  const p1Won = hasWinner && g.winner_id === p1Id;
                  const p2Won = hasWinner && g.winner_id === p2Id;
                  return (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{g.round_number}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 500, color: p1Won ? 'var(--team-a)' : 'var(--text-muted)' }}>
                        {p1Won ? `+${g.score_awarded}` : ''}
                      </td>
                      <td style={{ ...tdStyle, padding: '0.25rem' }}>
                        <select
                          value={ginEdits[g.id] ?? ''}
                          onChange={e => handleGinEdit(g.id, e.target.value)}
                          disabled={savingGin[g.id]}
                          style={{
                            width: '100%', background: 'var(--card-raised)', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--gold)', fontSize: '0.6875rem', fontWeight: 600,
                            padding: '0.2rem 0.125rem', cursor: 'pointer', textAlign: 'center',
                          }}
                        >
                          <option value="">—</option>
                          {[{ id: p1Id, name: p1Name }, { id: p2Id, name: p2Name }].map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 500, color: p2Won ? 'var(--team-b)' : 'var(--text-muted)' }}>
                        {p2Won ? `+${g.score_awarded}` : ''}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--team-a)' }}>{p1Score}</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--team-b)' }}>{p2Score}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rounds complete banner */}
      {!match.completed_at && roundsDone && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem', textAlign: 'center', border: '1px solid var(--gold)', background: 'rgba(212,175,55,0.08)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>ðŸ</div>
          <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: '0.25rem' }}>All {match.max_rounds} rounds complete!</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {p1Score === p2Score ? 'Scores are tied â€” this will be a Draw.' : `${p1Score > p2Score ? team1Label : team2Label} leads ${Math.max(p1Score, p2Score)}â€“${Math.min(p1Score, p2Score)}`}
          </div>
          <button className="btn btn-primary btn-block" onClick={handleFinish} disabled={finishing}>
            {finishing ? 'Finishingâ€¦' : 'ðŸ† Finish Match'}
          </button>
        </div>
      )}

      {/* Round Entry Form */}
      {!match.completed_at && !roundsDone && (
        <form onSubmit={handleAddRound} className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
            Add Round {match.games.length + 1}
          </div>

          {isTeam ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Team 1 score */}
              <div style={{ background: 'var(--team-a-dim)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: 8, padding: '0.875rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--team-a)', marginBottom: '0.125rem' }}>{team1Label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>{p1Name} / {t1p2Name}</div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={t1Score}
                  onChange={e => { const n = parseInt(e.target.value, 10); setT1Score(isNaN(n) ? 0 : Math.max(0, Math.min(99, n))); }}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: '1.75rem', fontWeight: 800,
                    background: 'var(--card-raised)', border: '1px solid rgba(230,57,70,0.3)',
                    borderRadius: 8, padding: '0.5rem', color: 'var(--team-a)',
                  }}
                />
              </div>

              {/* Team 2 score */}
              <div style={{ background: 'var(--team-b-dim)', border: '1px solid rgba(74,85,104,0.2)', borderRadius: 8, padding: '0.875rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--team-b)', marginBottom: '0.125rem' }}>{team2Label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>{p2Name} / {t2p2Name}</div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={t2Score}
                  onChange={e => { const n = parseInt(e.target.value, 10); setT2Score(isNaN(n) ? 0 : Math.max(0, Math.min(99, n))); }}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: '1.75rem', fontWeight: 800,
                    background: 'var(--card-raised)', border: '1px solid rgba(74,85,104,0.3)',
                    borderRadius: 8, padding: '0.5rem', color: 'var(--team-b)',
                  }}
                />
              </div>

              {/* Gin toggle + gin player */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={teamGin} onChange={e => { setTeamGin(e.target.checked); if (!e.target.checked) setGinPlayerId(''); }} />
                  <span style={{ fontWeight: 600, color: 'var(--gold)' }}>â˜… DIGU</span>
                </label>
                {teamGin && (
                  <select
                    className="form-input"
                    value={ginPlayerId}
                    onChange={e => setGinPlayerId(e.target.value)}
                    style={{ flex: 1, fontSize: '0.8125rem', padding: '0.25rem 0.5rem', minHeight: 'auto' }}
                  >
                    <option value="">Who ginned?</option>
                    {allPlayers.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                  </select>
                )}
              </div>

              {/* Preview */}
              <div style={{ background: 'rgba(43,79,55,0.2)', border: '1px solid rgba(99,141,111,0.3)', borderRadius: 8, padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {team1Total === team2Total ? 'Tied â€” score 0' : `${teamWinnerLabel} wins`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {teamGin && <span className="badge badge-gin">DIGU +25</span>}
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold)' }}>+{teamScore2v2}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Winner select */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Who won this round?</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[{ id: p1Id, name: p1Name, color: 'var(--team-a)' }, { id: p2Id, name: p2Name, color: 'var(--team-b)' }].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setWinnerId(p.id)}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem',
                        border: `2px solid ${winnerId === p.id ? p.color : 'var(--border)'}`,
                        background: winnerId === p.id ? 'rgba(255,255,255,0.05)' : 'var(--card)',
                        color: winnerId === p.id ? p.color : 'var(--text-secondary)',
                        transition: 'all 0.15s', cursor: 'pointer',
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score + gin row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Score (points)</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="e.g. 15"
                    value={score}
                    onChange={e => setScore(e.target.value)}
                    required
                    className="form-input"
                    style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', padding: '0.5rem' }}
                  />
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', paddingBottom: '0.5rem', userSelect: 'none' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>DIGU?</span>
                  <input type="checkbox" checked={isGin} onChange={e => setIsGin(e.target.checked)} style={{ width: 20, height: 20 }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--gold)' }}>â˜…</span>
                </label>
              </div>
            </div>
          )}

          {error && <div className="error-message" style={{ marginTop: '0.5rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
            <button type="submit" className="btn btn-felt btn-block" disabled={submitting} style={{ flex: 2 }}>
              {submitting ? 'Savingâ€¦' : isRoundsMode
                ? `+ Add Round ${match.games.length + 1} of ${match.max_rounds}`
                : `+ Add Round ${match.games.length + 1}`}
            </button>
            {match.games.length > 0 && !isRoundsMode && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowFinishConfirm(true)}
                style={{ flex: 1, background: 'rgba(212,175,55,0.15)', borderColor: 'var(--gold)', color: 'var(--gold)' }}
              >
                Finish
              </button>
            )}
          </div>
        </form>
      )}

      {/* Finish Confirm Modal */}
      {showFinishConfirm && (
        <div className="modal-overlay centered" style={{ zIndex: 200 }}>
          <div className="modal-sheet" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Finish Match?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {p1Score === p2Score
                ? 'Scores are tied â€” this will be recorded as a Draw (1 league point each).'
                : `${p1Score > p2Score ? team1Label : team2Label} leads ${Math.max(p1Score, p2Score)}â€“${Math.min(p1Score, p2Score)}. Winner gets 3 league points.`}
            </p>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn btn-ghost btn-block" onClick={() => setShowFinishConfirm(false)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleFinish} disabled={finishing}>
                {finishing ? 'Finishingâ€¦' : 'Finish Match'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletion && completionData && (
        <div className="modal-overlay centered" style={{ zIndex: 300 }}>
          <div className="modal-sheet" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{completionData.isDraw ? 'ðŸ¤' : 'ðŸ†'}</div>
            <h2 style={{ marginBottom: '0.25rem' }}>{completionData.isDraw ? 'Draw!' : 'Match Complete!'}</h2>
            {completionData.isDraw
              ? <p>Both teams get 1 league point</p>
              : <p><strong style={{ color: 'var(--gold)' }}>{winnerName}</strong> wins Â· 3 league points</p>
            }
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '1rem 0', padding: '0.875rem', background: 'var(--card-raised)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{team1Label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--team-a)' }}>{completionData.p1Score}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{team2Label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--team-b)' }}>{completionData.p2Score}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{match.games.length} rounds played</p>
            <div style={{ display: 'flex', gap: '0.625rem', flexDirection: 'column' }}>
              <a href="/new-match" className="btn btn-primary btn-block">â–¶ New Match</a>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setShowCompletion(false)}>View Scoresheet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.375rem 0.25rem',
  fontSize: '0.5625rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.375rem 0.25rem',
  textAlign: 'center',
  fontSize: '0.8125rem',
};

