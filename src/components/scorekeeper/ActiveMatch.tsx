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


export default function ActiveMatch({ matchId, isAdmin = false, isAuthed = false }: { matchId: string; isAdmin?: boolean; isAuthed?: boolean }) {
  const [match, setMatch] = useState<MatchWithGames | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [allowExtraRounds, setAllowExtraRounds] = useState(false);
  const [completionData, setCompletionData] = useState<{ winnerId: string | null; isDraw: boolean; p1Score: number; p2Score: number } | null>(null);
  const [deletingRound, setDeletingRound] = useState<string | null>(null);

  // 1v1 form state
  const [winnerId, setWinnerId] = useState('');
  const [score, setScore] = useState('');
  const [isGin, setIsGin] = useState(false);

  // 2v2 form state
  const [t1Score, setT1Score] = useState('');
  const [t2Score, setT2Score] = useState('');
  const [teamGin, setTeamGin] = useState(false);
  const [ginPlayerId, setGinPlayerId] = useState('');

  // Scoresheet gin edits
  const [ginEdits, setGinEdits] = useState<Record<string, string>>({});
  const [savingGin, setSavingGin] = useState<Record<string, boolean>>({});

  // Inline row editing
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [editT1, setEditT1] = useState('');
  const [editT2, setEditT2] = useState('');
  const [editGin, setEditGin] = useState(false);
  const [editGinPlayer, setEditGinPlayer] = useState('');
  const [editWinner, setEditWinner] = useState('');
  const [editScore, setEditScore] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  if (loading) return <div className="loading" style={{ paddingTop: '3rem' }}>Loading match...</div>;
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
  const p1Nick = match.player1_nickname || p1Name.split(' ')[0];
  const p2Nick = match.player2_nickname || p2Name.split(' ')[0];
  const t1p2Nick = match.team1_player2_nickname || (t1p2Name ? t1p2Name.split(' ')[0] : '');
  const t2p2Nick = match.team2_player2_nickname || (t2p2Name ? t2p2Name.split(' ')[0] : '');
  const team1Label = isTeam ? (match.team1_name || `${p1Nick} / ${t1p2Nick}`) : p1Nick;
  const team2Label = isTeam ? (match.team2_name || `${p2Nick} / ${t2p2Nick}`) : p2Nick;

  const p1Score = match.games.filter(g => g.winner_id === p1Id).reduce((s, g) => s + g.score_awarded, 0);
  const p2Score = match.games.filter(g => g.winner_id === p2Id).reduce((s, g) => s + g.score_awarded, 0);
  const p1InputTotal = isTeam
    ? match.games.reduce((s, g) => s + (g.t1_p1_cards ?? 0) + (g.t1_p2_cards ?? 0), 0)
    : p1Score;
  const p2InputTotal = isTeam
    ? match.games.reduce((s, g) => s + (g.t2_p1_cards ?? 0) + (g.t2_p2_cards ?? 0), 0)
    : p2Score;
  const totalRoundsPlayed = match.games.length;
  const p1RoundsWon = match.games.filter(g => g.winner_id === p1Id).length;
  const p2RoundsWon = match.games.filter(g => g.winner_id === p2Id).length;
  const p1WinPct = totalRoundsPlayed > 0 ? Math.round((p1RoundsWon / totalRoundsPlayed) * 100) : 0;
  const p2WinPct = totalRoundsPlayed > 0 ? Math.round((p2RoundsWon / totalRoundsPlayed) * 100) : 0;
  const maxScore = Math.max(p1InputTotal, p2InputTotal, 1);
  const p1Pct = match.target_score > 0
    ? Math.min(100, (p1InputTotal / match.target_score) * 100)
    : match.max_rounds > 0
      ? p1WinPct
      : Math.round((p1InputTotal / maxScore) * 100);
  const p2Pct = match.target_score > 0
    ? Math.min(100, (p2InputTotal / match.target_score) * 100)
    : match.max_rounds > 0
      ? p2WinPct
      : Math.round((p2InputTotal / maxScore) * 100);
  const scoreDiff = Math.abs(p1InputTotal - p2InputTotal);

  // 2v2 live calc
  const team1Total = parseInt(t1Score as string) || 0;
  const team2Total = parseInt(t2Score as string) || 0;
  const team1Wins2v2 = team1Total >= team2Total;
  const winningTotal2v2 = team1Wins2v2 ? team1Total : team2Total;
  const losingTotal2v2 = team1Wins2v2 ? team2Total : team1Total;
  const teamScore2v2 = teamGin ? winningTotal2v2 + 25 : Math.max(0, winningTotal2v2 - losingTotal2v2);
  const teamWinnerLabel = team1Wins2v2 ? team1Label : team2Label;

  // All 4 players for gin selector (2v2)
  const allPlayers = isTeam ? [
    { id: p1Id, name: p1Nick },
    { id: match.team1_player2_id!, name: t1p2Nick },
    { id: p2Id, name: p2Nick },
    { id: match.team2_player2_id!, name: t2p2Nick },
  ] : [];

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    if (!match) return;
    // Validate score before submitting
    if (!isTeam) {
      const parsedScore = parseInt(score);
      if (!score || isNaN(parsedScore) || parsedScore <= 0) {
        setError('Please enter a valid score (must be greater than 0)');
        return;
      }
    }
    if (isTeam && team1Total === 0 && team2Total === 0) {
      setError('Please enter card counts for both teams');
      return;
    }
    setSubmitting(true);
    setError('');
    const body = isTeam
      ? { t1_p1_cards: team1Total, t1_p2_cards: 0, t2_p1_cards: team2Total, t2_p2_cards: 0, is_gin: false, gin_player_id: null }
      : { winner_id: winnerId, score: parseInt(score), is_gin: isGin, gin_player_id: isGin ? winnerId : null };
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
      setT1Score(''); setT2Score('');
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

  function startEdit(g: Game) {
    setEditingGame(g.id);
    if (isTeam) {
      setEditT1(String((g.t1_p1_cards ?? 0) + (g.t1_p2_cards ?? 0)));
      setEditT2(String((g.t2_p1_cards ?? 0) + (g.t2_p2_cards ?? 0)));
      setEditGin(g.is_gin === 1);
      setEditGinPlayer(g.gin_player_id ?? '');
    } else {
      setEditWinner(g.winner_id);
      setEditScore(String(g.score_awarded));
      setEditGin(g.is_gin === 1);
    }
  }

  async function handleSaveEdit(gameId: string) {
    setSavingEdit(true);
    let body: Record<string, unknown>;
    let updatedProps: Partial<Game>;
    if (isTeam) {
      const t1 = parseInt(editT1) || 0;
      const t2 = parseInt(editT2) || 0;
      const team1Wins = t1 >= t2;
      const newWinnerId = team1Wins ? p1Id : p2Id;
      const newLoserId = team1Wins ? p2Id : p1Id;
      const winningTotal = team1Wins ? t1 : t2;
      const losingTotal = team1Wins ? t2 : t1;
      const scoreAwarded = editGin ? winningTotal + 25 : Math.max(0, winningTotal - losingTotal);
      const ginPId = editGin ? editGinPlayer || null : null;
      body = { winner_id: newWinnerId, loser_id: newLoserId, score_awarded: scoreAwarded,
               is_gin: editGin ? 1 : 0, gin_player_id: ginPId,
               t1_p1_cards: t1, t1_p2_cards: 0, t2_p1_cards: t2, t2_p2_cards: 0 };
      updatedProps = { winner_id: newWinnerId, loser_id: newLoserId, score_awarded: scoreAwarded,
                       is_gin: editGin ? 1 : 0, gin_player_id: ginPId,
                       t1_p1_cards: t1, t1_p2_cards: 0, t2_p1_cards: t2, t2_p2_cards: 0 };
    } else {
      const newLoserId = editWinner === p1Id ? p2Id : p1Id;
      const scoreAwarded = Math.max(0, parseInt(editScore) || 0);
      const ginPId = editGin ? editWinner : null;
      body = { winner_id: editWinner, loser_id: newLoserId, score_awarded: scoreAwarded,
               is_gin: editGin ? 1 : 0, gin_player_id: ginPId };
      updatedProps = { winner_id: editWinner, loser_id: newLoserId, score_awarded: scoreAwarded,
                       is_gin: editGin ? 1 : 0, gin_player_id: ginPId };
    }
    try {
      await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setMatch(prev => prev ? { ...prev, games: prev.games.map(g => g.id === gameId ? { ...g, ...updatedProps } : g) } : prev);
      setGinEdits(prev => ({ ...prev, [gameId]: (updatedProps.gin_player_id as string) ?? '' }));
      setEditingGame(null);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteRound(gameId: string) {
    if (!confirm('Delete this round?')) return;
    setDeletingRound(gameId);
    try {
      const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Failed to delete round');
        return;
      }
      const updated = await fetch(`/api/matches/${matchId}`).then(r => r.json()) as MatchWithGames;
      setMatch(updated);
      const newGin: Record<string, string> = {};
      updated.games.forEach((g: Game) => { newGin[g.id] = g.gin_player_id ?? ''; });
      setGinEdits(newGin);
    } catch { setError('Network error. Try again.'); }
    finally { setDeletingRound(null); }
  }

  const canDelete = isAuthed && (!match?.completed_at || isAdmin);

  const winnerName = completionData?.winnerId === p1Id ? team1Label : completionData?.winnerId === p2Id ? team2Label : '';

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Score Header */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
        {isTeam ? (
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
              {isRoundsMode
                ? roundsDone
                  ? `${match.max_rounds} Rounds Complete!`
                  : `Round ${match.games.length + 1} of ${match.max_rounds}`
                : `Round ${match.games.length + 1}`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--team-a)' }}>Team A</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--team-a)' }}>{p1InputTotal}</div>
                {totalRoundsPlayed > 0 && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--team-a)', opacity: 0.8 }}>
                    {p1RoundsWon}W · {p1WinPct}%
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>vs</div>
                {totalRoundsPlayed > 0 && scoreDiff > 0 && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--gold)', fontWeight: 700, marginTop: '0.25rem' }}>
                    +{scoreDiff}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--team-b)' }}>Team B</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--team-b)' }}>{p2InputTotal}</div>
                {totalRoundsPlayed > 0 && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--team-b)', opacity: 0.8 }}>
                    {p2RoundsWon}W · {p2WinPct}%
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <Avatar name={p1Name} b64={match.player1_avatar} size={40} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p1Nick}</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--team-a)' }}>{p1Score}</div>
                {totalRoundsPlayed > 0 && <div style={{ fontSize: '0.6875rem', color: 'var(--team-a)', opacity: 0.8 }}>{p1RoundsWon}W · {p1WinPct}%</div>}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{roundsDone ? 'Done' : `Round ${match.games.length + 1}`}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>vs</div>
              {isRoundsMode
                ? <div style={{ fontSize: '0.625rem', color: roundsDone ? 'var(--gold)' : 'var(--text-muted)', fontWeight: roundsDone ? 700 : 400 }}>
                    {match.games.length}/{match.max_rounds} rounds
                  </div>
                : <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>to {match.target_score}</div>
              }
              {totalRoundsPlayed > 0 && scoreDiff > 0 && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--gold)', fontWeight: 700, marginTop: '0.2rem' }}>+{scoreDiff}</div>
              )}
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <Avatar name={p2Name} b64={match.player2_avatar} size={40} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p2Nick}</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--team-b)' }}>{p2Score}</div>
                {totalRoundsPlayed > 0 && <div style={{ fontSize: '0.6875rem', color: 'var(--team-b)', opacity: 0.8 }}>{p2RoundsWon}W · {p2WinPct}%</div>}
              </div>
            </div>
          </div>
        )}
        {/* Progress bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[{ label: isTeam ? 'Team A' : p1Nick, pct: p1Pct, color: 'var(--team-a)' }, { label: isTeam ? 'Team B' : p2Nick, pct: p2Pct, color: 'var(--team-b)' }].map(b => (
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
                  <th style={{ ...thStyle, width: 70 }}>DIGU</th>
                  <th style={{ ...thStyle, color: 'var(--team-a)' }}>{p1Nick} / {t1p2Nick}</th>
                  <th style={{ ...thStyle, color: 'var(--team-b)' }}>{p2Nick} / {t2p2Nick}</th>
                  {canDelete && <th style={{ ...thStyle, width: 28 }}></th>}
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => {
                  if (editingGame === g.id) {
                    return (
                      <tr key={g.id} style={{ borderTop: '1px solid var(--border)', background: 'rgba(43,79,55,0.06)' }}>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)', fontWeight: 600 }}>{g.round_number}</td>
                        <td colSpan={canDelete ? 5 : 4}>
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.25rem 0.25rem' }}>
                            <input type="text" inputMode="decimal" value={editT1}
                              onChange={e => { if (/^-?\d*$/.test(e.target.value)) setEditT1(e.target.value); }}
                              style={{ width: 44, textAlign: 'center', padding: '0.25rem 0', borderRadius: 4, border: '1px solid var(--team-a)', color: 'var(--team-a)', fontWeight: 700, fontSize: '0.875rem', background: 'var(--card)' }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>vs</span>
                            <input type="text" inputMode="decimal" value={editT2}
                              onChange={e => { if (/^-?\d*$/.test(e.target.value)) setEditT2(e.target.value); }}
                              style={{ width: 44, textAlign: 'center', padding: '0.25rem 0', borderRadius: 4, border: '1px solid var(--team-b)', color: 'var(--team-b)', fontWeight: 700, fontSize: '0.875rem', background: 'var(--card)' }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: '0.6875rem' }}>
                              <input type="checkbox" checked={editGin} onChange={e => { setEditGin(e.target.checked); if (!e.target.checked) setEditGinPlayer(''); }} />
                              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>DIGU</span>
                            </label>
                            {editGin && (
                              <select value={editGinPlayer} onChange={e => setEditGinPlayer(e.target.value)}
                                style={{ fontSize: '0.6875rem', padding: '0.2rem', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--card)' }}>
                                <option value="">Who?</option>
                                {allPlayers.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                              </select>
                            )}
                            <button onClick={() => handleSaveEdit(g.id)} disabled={savingEdit}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: 'none', background: 'var(--felt)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                              {savingEdit ? '…' : '✓'}
                            </button>
                            <button onClick={() => setEditingGame(null)}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>
                              ✗
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const t1Cards = (g.t1_p1_cards ?? 0) + (g.t1_p2_cards ?? 0);
                  const t2Cards = (g.t2_p1_cards ?? 0) + (g.t2_p2_cards ?? 0);
                  const hasWinner = g.score_awarded > 0;
                  const t1Won = hasWinner && g.winner_id === p1Id;
                  const t2Won = hasWinner && g.winner_id === p2Id;
                  return (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontWeight: 600 }}>
                        <button onClick={() => startEdit(g)} title="Edit round"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px', fontSize: '0.7rem', opacity: 0.5 }}>✎</button>
                        {g.round_number}
                      </td>
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
                      <td style={{ ...tdStyle, padding: '0.25rem', width: 70 }}>
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
                      <td style={{ ...tdStyle, fontWeight: 800, color: 'var(--team-a)' }}>
                        {(g.t1_p1_cards ?? 0) + (g.t1_p2_cards ?? 0)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: 'var(--team-b)' }}>
                        {(g.t2_p1_cards ?? 0) + (g.t2_p2_cards ?? 0)}
                      </td>
                      {canDelete && (
                        <td style={{ ...tdStyle, width: 28 }}>
                          <button
                            onClick={() => handleDeleteRound(g.id)}
                            disabled={deletingRound === g.id}
                            title="Delete round"
                            style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontSize: '0.6875rem', lineHeight: 1, padding: 0 }}
                          >
                            {deletingRound === g.id ? '…' : '✕'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-muted)' }} colSpan={3}>TOTAL</td>
                  <td style={{ ...tdStyle, fontWeight: 800, fontSize: '1rem', color: 'var(--gold)' }}>{p1InputTotal}</td>
                  <td style={{ ...tdStyle, fontWeight: 800, fontSize: '1rem', color: 'var(--gold)' }}>{p2InputTotal}</td>
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
                  {canDelete && <th style={{ ...thStyle, width: 28 }}></th>}
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => {
                  if (editingGame === g.id) {
                    return (
                      <tr key={g.id} style={{ borderTop: '1px solid var(--border)', background: 'rgba(43,79,55,0.06)' }}>
                        <td style={tdStyle}>{g.round_number}</td>
                        <td colSpan={canDelete ? 4 : 3}>
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.25rem 0.25rem' }}>
                            {[{ id: p1Id, name: p1Nick, color: 'var(--team-a)' }, { id: p2Id, name: p2Nick, color: 'var(--team-b)' }].map(p => (
                              <button key={p.id} type="button" onClick={() => setEditWinner(p.id)}
                                style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 600, fontSize: '0.6875rem', cursor: 'pointer',
                                  border: `2px solid ${editWinner === p.id ? p.color : 'var(--border)'}`,
                                  background: 'transparent', color: editWinner === p.id ? p.color : 'var(--text-muted)' }}>
                                {p.name}
                              </button>
                            ))}
                            <input type="text" inputMode="decimal" value={editScore}
                              onChange={e => { if (/^-?\d*$/.test(e.target.value)) setEditScore(e.target.value); }}
                              style={{ width: 52, textAlign: 'center', padding: '0.2rem', borderRadius: 4, border: '1px solid var(--border)', fontWeight: 700, fontSize: '0.875rem', background: 'var(--card)' }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: '0.6875rem' }}>
                              <input type="checkbox" checked={editGin} onChange={e => setEditGin(e.target.checked)} />
                              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>DIGU</span>
                            </label>
                            <button onClick={() => handleSaveEdit(g.id)} disabled={savingEdit}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: 'none', background: 'var(--felt)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                              {savingEdit ? '…' : '✓'}
                            </button>
                            <button onClick={() => setEditingGame(null)}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>
                              ✗
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const hasWinner = g.score_awarded > 0;
                  const p1Won = hasWinner && g.winner_id === p1Id;
                  const p2Won = hasWinner && g.winner_id === p2Id;
                  return (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                        <button onClick={() => startEdit(g)} title="Edit round"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px', fontSize: '0.7rem', opacity: 0.5 }}>✎</button>
                        {g.round_number}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--team-a)' }}>
                        {p1Won ? g.score_awarded : ''}
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
                          {[{ id: p1Id, name: p1Nick }, { id: p2Id, name: p2Nick }].map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--team-b)' }}>
                        {p2Won ? g.score_awarded : ''}
                      </td>
                      {canDelete && (
                        <td style={{ ...tdStyle, width: 28 }}>
                          <button
                            onClick={() => handleDeleteRound(g.id)}
                            disabled={deletingRound === g.id}
                            title="Delete round"
                            style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontSize: '0.6875rem', lineHeight: 1, padding: 0 }}
                          >
                            {deletingRound === g.id ? '…' : '✕'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-muted)' }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--gold)' }}>{p1Score}</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--gold)' }}>{p2Score}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rounds complete banner */}
      {!match.completed_at && roundsDone && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem', textAlign: 'center', border: '1px solid var(--gold)', background: 'rgba(212,175,55,0.08)' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
            {match.games.length} Rounds Complete!
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {(() => {
              const t1 = isTeam ? p1InputTotal : p1Score;
              const t2 = isTeam ? p2InputTotal : p2Score;
              if (t1 === t2) return 'Scores are tied — this will be a Draw.';
              return `${t1 > t2 ? team1Label : team2Label} wins with ${Math.max(t1, t2)} — ${Math.min(t1, t2)}`;
            })()}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!allowExtraRounds && (
              <button
                className="btn btn-secondary btn-block"
                style={{ flex: 1, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onClick={() => setAllowExtraRounds(true)}
              >
                + Add More Rounds
              </button>
            )}
            <button
              className="btn btn-primary btn-block"
              style={{ flex: 1 }}
              onClick={() => setShowFinishConfirm(true)}
              disabled={finishing}
            >
              {finishing ? 'Finishing...' : 'Finish Match'}
            </button>
          </div>
        </div>
      )}
      {/* Round Entry Form */}
      {!match.completed_at && (!roundsDone || allowExtraRounds) && (
        <form onSubmit={handleAddRound} noValidate className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
            Add Round {match.games.length + 1}
          </div>

          {isTeam ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Team 1 score */}
              <div style={{ background: 'var(--team-a-dim)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: 8, padding: '0.875rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--team-a)', marginBottom: '0.125rem' }}>{team1Label}</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--team-a)', marginBottom: '0.625rem' }}>{p1Name} / {t1p2Name}</div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={t1Score}
                  onChange={e => { if (/^-?\d*$/.test(e.target.value)) setT1Score(e.target.value); }}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: '1.75rem', fontWeight: 800,
                    background: 'var(--card-raised)', border: '1px solid rgba(230,57,70,0.3)',
                    borderRadius: 8, padding: '0.5rem', color: 'var(--team-a)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setT1Score(s => s.startsWith('-') ? s.slice(1) : s ? '-' + s : s)}
                  style={{
                    marginTop: '0.5rem', width: '100%', padding: '0.35rem', borderRadius: 6,
                    border: `1px solid ${t1Score.startsWith('-') ? 'var(--team-a)' : 'var(--border)'}`,
                    background: t1Score.startsWith('-') ? 'rgba(230,57,70,0.15)' : 'var(--card-raised)',
                    color: t1Score.startsWith('-') ? 'var(--team-a)' : 'var(--text-muted)',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
                  }}
                >
                  {t1Score.startsWith('-') ? '− Negative ON' : '± Toggle Negative'}
                </button>
              </div>

              {/* Team 2 score */}
              <div style={{ background: 'var(--team-b-dim)', border: '1px solid rgba(74,85,104,0.2)', borderRadius: 8, padding: '0.875rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--team-b)', marginBottom: '0.125rem' }}>{team2Label}</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--team-b)', marginBottom: '0.625rem' }}>{p2Name} / {t2p2Name}</div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={t2Score}
                  onChange={e => { if (/^-?\d*$/.test(e.target.value)) setT2Score(e.target.value); }}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: '1.75rem', fontWeight: 800,
                    background: 'var(--card-raised)', border: '1px solid rgba(74,85,104,0.3)',
                    borderRadius: 8, padding: '0.5rem', color: 'var(--team-b)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setT2Score(s => s.startsWith('-') ? s.slice(1) : s ? '-' + s : s)}
                  style={{
                    marginTop: '0.5rem', width: '100%', padding: '0.35rem', borderRadius: 6,
                    border: `1px solid ${t2Score.startsWith('-') ? 'var(--team-b)' : 'var(--border)'}`,
                    background: t2Score.startsWith('-') ? 'rgba(74,85,104,0.25)' : 'var(--card-raised)',
                    color: t2Score.startsWith('-') ? 'var(--team-b)' : 'var(--text-muted)',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
                  }}
                >
                  {t2Score.startsWith('-') ? '− Negative ON' : '± Toggle Negative'}
                </button>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Winner select */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Who won this round?</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[{ id: p1Id, name: p1Nick, color: 'var(--team-a)' }, { id: p2Id, name: p2Nick, color: 'var(--team-b)' }].map(p => (
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
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 15"
                    value={score}
                    onChange={e => { if (/^-?\d*$/.test(e.target.value)) setScore(e.target.value); }}
                    required
                    className="form-input"
                    style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', padding: '0.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setScore(s => s.startsWith('-') ? s.slice(1) : s ? '-' + s : s)}
                    style={{
                      marginTop: '0.375rem', width: '100%', padding: '0.3rem', borderRadius: 6,
                      border: `1px solid ${score.startsWith('-') ? 'var(--cream)' : 'var(--border)'}`,
                      background: score.startsWith('-') ? 'rgba(212,175,55,0.15)' : 'var(--card-raised)',
                      color: score.startsWith('-') ? 'var(--gold)' : 'var(--text-muted)',
                      fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
                    }}
                  >
                    {score.startsWith('-') ? '− Negative ON' : '± Toggle Negative'}
                  </button>
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
            {(match.games.length >= 5 || allowExtraRounds) && (
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
              {p1InputTotal === p2InputTotal
                ? 'Scores are tied — this will be a Draw (1 league point each).'
                : `${p1InputTotal > p2InputTotal ? team1Label : team2Label} leads ${Math.max(p1InputTotal, p2InputTotal)} — ${Math.min(p1InputTotal, p2InputTotal)}. Winner gets 3 league points.`}
            </p>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn btn-ghost btn-block" onClick={() => setShowFinishConfirm(false)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleFinish} disabled={finishing}>
                {finishing ? 'Finishing...' : 'Finish Match'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletion && completionData && (
        <div className="modal-overlay centered" style={{ zIndex: 300 }}>
          <div className="modal-sheet" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.25rem' }}>{completionData.isDraw ? 'Draw!' : 'Match Complete!'}</h2>
            {completionData.isDraw
              ? <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Both teams get 1 league point</p>
              : <p style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--gold)' }}>{winnerName}</strong> wins — 3 league points</p>
            }
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '1rem 0', padding: '0.875rem', background: 'var(--card-raised)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{team1Label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--team-a)' }}>{p1InputTotal}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{team2Label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--team-b)' }}>{p2InputTotal}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{match.games.length} rounds played</p>
            <div style={{ display: 'flex', gap: '0.625rem', flexDirection: 'column' }}>
              <a href="/new-match" className="btn btn-primary btn-block">New Match</a>
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

