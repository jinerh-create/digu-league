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
  // Admin may fill in the remaining rounds of a rounds-based match that was finished early.
  const adminFillRounds = !!match?.completed_at && isAdmin && (match?.max_rounds ?? 0) > 0 && (match?.games.length ?? 0) < (match?.max_rounds ?? 0);

  const winnerName = completionData?.winnerId === p1Id ? team1Label : completionData?.winnerId === p2Id ? team2Label : '';

  // Generate & share a "match starting" VS card (photos of both sides) to WhatsApp etc.
  async function handleShareStart() {
    if (!match) return;
    const W = 1080, H = 1350;
    const RED = '#FF4A6A', BLUE = '#4D9FFF';
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const done = !!match.completed_at;

    // helpers
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#101a2e'); bg.addColorStop(0.5, '#0a1120'); bg.addColorStop(1, '#070c17');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = (cx: number, cy: number, col: string) => { const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, 560); g.addColorStop(0, col); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
    glow(230, 520, 'rgba(255,74,106,0.18)');
    glow(850, 520, 'rgba(77,159,255,0.18)');
    ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 5; rr(26, 26, W - 52, H - 52, 34); ctx.stroke();

    // header
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#D4AF37'; ctx.font = '700 56px Georgia, serif';
    ctx.fillText('D I G U   L E A G U E', W / 2, 118);
    ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 150, 148); ctx.lineTo(W / 2 + 150, 148); ctx.stroke();
    // status pill
    {
      const label = done ? 'FULL TIME' : 'MATCH STARTING';
      const col = done ? '#D4AF37' : '#ff5a5f';
      ctx.font = '800 30px Arial, sans-serif';
      const tw = ctx.measureText(label).width;
      const dot = 16, gap = 14, padX = 30, w = tw + padX * 2 + dot + gap, h = 58, x = W / 2 - w / 2, y = 178;
      rr(x, y, w, h, h / 2); ctx.fillStyle = done ? 'rgba(212,175,55,0.14)' : 'rgba(255,90,95,0.14)'; ctx.fill();
      ctx.strokeStyle = col + '88'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + padX + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col;
      ctx.fillText(label, x + padX + dot + gap, y + h / 2 + 1);
    }

    // load photos
    const loadImg = (b64: string | null | undefined): Promise<HTMLImageElement | null> =>
      new Promise((res) => { if (!b64) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `data:image/jpeg;base64,${b64}`; });
    const [imgA, imgB, imgA2, imgB2] = await Promise.all([
      loadImg((match as any).player1_avatar), loadImg((match as any).player2_avatar),
      loadImg((match as any).team1_player2_avatar), loadImg((match as any).team2_player2_avatar),
    ]);

    const initials = (s: string) => (s || '?').split(/[\s/]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    function avatar(img: HTMLImageElement | null, cx: number, cy: number, r: number, ini: string, ring: string) {
      ctx!.save();
      ctx!.beginPath(); ctx!.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx!.fillStyle = ring; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx!.lineWidth = 4; ctx!.strokeStyle = 'rgba(255,255,255,0.15)'; ctx!.stroke();
      ctx!.beginPath(); ctx!.arc(cx, cy, r, 0, Math.PI * 2); ctx!.closePath(); ctx!.clip();
      if (img) { const s = Math.min(img.width, img.height); ctx!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2); }
      else { ctx!.fillStyle = '#161d2e'; ctx!.fillRect(cx - r, cy - r, r * 2, r * 2); ctx!.fillStyle = '#c7d1e0'; ctx!.font = `700 ${Math.round(r * 0.85)}px Arial, sans-serif`; ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'; ctx!.fillText(ini, cx, cy + 4); }
      ctx!.restore();
    }

    // team labels
    const cyAv = 540;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 30px Arial, sans-serif'; ctx.fillStyle = RED; ctx.fillText('TEAM A', 300, 320);
    ctx.fillStyle = BLUE; ctx.fillText('TEAM B', 780, 320);

    if (isTeam) {
      const r = 96;
      avatar(imgA, 214, cyAv, r, initials(p1Nick), RED);
      avatar(imgA2, 406, cyAv, r, initials(t1p2Nick), RED);
      avatar(imgB, 674, cyAv, r, initials(p2Nick), BLUE);
      avatar(imgB2, 866, cyAv, r, initials(t2p2Nick), BLUE);
    } else {
      avatar(imgA, 300, cyAv, 150, initials(team1Label), RED);
      avatar(imgB, 780, cyAv, 150, initials(team2Label), BLUE);
    }

    // team names + accent underline
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#f2f5fa';
    const fit = (t: string, max: number) => { let f = 44; ctx.font = `800 ${f}px Arial, sans-serif`; while (ctx.measureText(t).width > max && f > 20) { f -= 2; ctx.font = `800 ${f}px Arial, sans-serif`; } };
    fit(team1Label, 440); ctx.fillText(team1Label.toUpperCase(), 300, cyAv + 240);
    fit(team2Label, 440); ctx.fillText(team2Label.toUpperCase(), 780, cyAv + 240);
    ctx.strokeStyle = RED; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(300 - 46, cyAv + 262); ctx.lineTo(300 + 46, cyAv + 262); ctx.stroke();
    ctx.strokeStyle = BLUE; ctx.beginPath(); ctx.moveTo(780 - 46, cyAv + 262); ctx.lineTo(780 + 46, cyAv + 262); ctx.stroke();

    // VS badge
    {
      const cx = W / 2, cy = cyAv, r = 76;
      const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); ring.addColorStop(0, '#FDECA8'); ring.addColorStop(1, '#B8860B');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, Math.PI * 2); ctx.fillStyle = '#0b1120'; ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 58px Georgia, serif';
      ctx.fillStyle = '#FDECA8'; ctx.fillText('VS', cx, cy + 2);
    }

    // info panel
    const startTime = new Date(match.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dateStr = new Date(match.started_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const mode = match.max_rounds > 0 ? `${match.max_rounds} Rounds` : `To ${match.target_score}`;
    rr(80, 1000, W - 160, 168, 24); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    const cols: [string, string][] = [['START', startTime], ['FORMAT', mode], ['DATE', dateStr]];
    const cxs = [260, 540, 820];
    cols.forEach(([lbl, val], i) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f2f5fa'; ctx.textBaseline = 'alphabetic';
      let f = 40; ctx.font = `800 ${f}px Arial, sans-serif`; while (ctx.measureText(val).width > 260 && f > 22) { f -= 2; ctx.font = `800 ${f}px Arial, sans-serif`; }
      ctx.fillText(val, cxs[i], 1078);
      ctx.fillStyle = '#D4AF37'; ctx.font = '700 22px Arial, sans-serif'; ctx.fillText(lbl, cxs[i], 1122);
      if (i < 2) { ctx.strokeStyle = 'rgba(212,175,55,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cxs[i] + 140, 1030); ctx.lineTo(cxs[i] + 140, 1138); ctx.stroke(); }
    });

    // footer
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#D4AF37'; ctx.font = '700 30px Arial, sans-serif'; ctx.fillText('digu-league.pages.dev', W / 2, 1250);
    ctx.fillStyle = 'rgba(200,180,140,0.4)'; ctx.font = '600 22px Arial, sans-serif';
    ctx.fillText('PLAY SMART  ·  WIN THE CROWN', W / 2, 1290);

    const caption = `🎴 Digu League — ${done ? 'full time!' : 'match starting!'}\n${team1Label} 🆚 ${team2Label}`;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'digu-match.png', { type: 'image/png' });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: caption }); return; } } catch { /* download */ }
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'digu-match.png'; a.click(); URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {isAuthed && (
        <button onClick={handleShareStart} className="btn btn-secondary" style={{ width: '100%', marginBottom: '1rem', fontSize: '0.875rem', padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          🆚 Share Match {match.completed_at ? 'Result' : 'Start'} to WhatsApp
        </button>
      )}
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
      {((!match.completed_at && (!roundsDone || allowExtraRounds)) || adminFillRounds) && (
        <form onSubmit={handleAddRound} noValidate className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
          {adminFillRounds && (
            <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: '0.625rem' }}>
              ✎ Admin · adding missing rounds ({match.games.length}/{match.max_rounds})
            </div>
          )}
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
                  <span style={{ fontSize: '0.875rem', color: 'var(--gold)' }}>★</span>
                </label>
              </div>
            </div>
          )}

          {error && <div className="error-message" style={{ marginTop: '0.5rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
            <button type="submit" className="btn btn-felt btn-block" disabled={submitting} style={{ flex: 2 }}>
              {submitting ? 'Saving…' : isRoundsMode
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

