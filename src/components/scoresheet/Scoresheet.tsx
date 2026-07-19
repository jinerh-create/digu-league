import { useState, useEffect, useRef } from 'react';
import type { Match, Game } from '../../lib/types';

const REACTION_EMOJIS = ['🔥', '💯', '👑', '😮', '😂', '🎯', '⚡'];

function ReactionBar({ matchId }: { matchId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`rxn_${matchId}`) || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    fetch(`/api/matches/${matchId}/reactions`).then(r => r.json()).then((d: any) => {
      if (d.counts) setCounts(d.counts);
    });
  }, [matchId]);

  async function toggle(emoji: string) {
    const myId = myReactions[emoji];
    if (myId) {
      // Remove
      await fetch(`/api/matches/${matchId}/reactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionId: myId }),
      });
      const next = { ...myReactions };
      delete next[emoji];
      setMyReactions(next);
      localStorage.setItem(`rxn_${matchId}`, JSON.stringify(next));
      setCounts(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] || 1) - 1) }));
    } else {
      // Add
      const res = await fetch(`/api/matches/${matchId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      const d: any = await res.json();
      if (d.id) {
        const next = { ...myReactions, [emoji]: d.id };
        setMyReactions(next);
        localStorage.setItem(`rxn_${matchId}`, JSON.stringify(next));
        setCounts(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', padding: '0.75rem 0 0.25rem' }}>
      {REACTION_EMOJIS.map(emoji => {
        const count = counts[emoji] || 0;
        const mine = !!myReactions[emoji];
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.6rem',
              borderRadius: 20,
              border: mine ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              background: mine ? 'rgba(212,175,55,0.12)' : 'var(--card-raised)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 700,
              color: mine ? 'var(--gold)' : 'var(--text-muted)',
              transition: 'all 0.15s',
              lineHeight: 1,
            }}
          >
            <span>{emoji}</span>
            {count > 0 && <span style={{ fontSize: '0.75rem' }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface MatchWithGames extends Match {
  games: Game[];
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function Scoresheet({ matchId, isAdmin = false, isAuthed = false }: { matchId: string; isAdmin?: boolean; isAuthed?: boolean }) {
  const [match, setMatch] = useState<MatchWithGames | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ginSelections, setGinSelections] = useState<Record<string, string>>({});
  const [savingGin, setSavingGin] = useState<Record<string, boolean>>({});
  const [editingScore, setEditingScore] = useState<{ gameId: string; side: 'p1' | 'p2' } | null>(null);
  const [scoreDraft, setScoreDraft] = useState('');
  const [deletingRound, setDeletingRound] = useState<string | null>(null);
  const scoreSaving = useRef(false);

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

  function displayName(name: string | undefined, nickname: string | null | undefined) {
    return nickname || (name ?? '').split(' ')[0] || (name ?? '');
  }

  // Use nicknames in the sub-header player list
  const team1Players = [
    displayName(match.player1_name, match.player1_nickname),
    match.team1_player2_name ? displayName(match.team1_player2_name, match.team1_player2_nickname) : null,
  ].filter(Boolean).join(' / ');
  const team2Players = [
    displayName(match.player2_name, match.player2_nickname),
    match.team2_player2_name ? displayName(match.team2_player2_name, match.team2_player2_nickname) : null,
  ].filter(Boolean).join(' / ');
  const allPlayers = [
    { id: p1Id, name: displayName(match.player1_name, match.player1_nickname) },
    match.team1_player2_id ? { id: match.team1_player2_id, name: displayName(match.team1_player2_name, match.team1_player2_nickname) } : null,
    { id: p2Id, name: displayName(match.player2_name, match.player2_nickname) },
    match.team2_player2_id ? { id: match.team2_player2_id, name: displayName(match.team2_player2_name, match.team2_player2_nickname) } : null,
  ].filter(Boolean) as { id: string; name: string }[];

  async function handleSaveScore(gameId: string, side: 'p1' | 'p2') {
    if (scoreSaving.current) return;
    scoreSaving.current = true;
    setEditingScore(null);
    const val = parseInt(scoreDraft, 10);
    if (!isNaN(val) && val > 0) {
      const row = match!.games.find(g => g.id === gameId)!;
      const isTeamMatch = !!match!.team1_player2_id;
      const body = isTeamMatch
        ? side === 'p1'
          ? { winner_id: row.winner_id, loser_id: row.loser_id, score_awarded: row.score_awarded, t1_p1_cards: val, t1_p2_cards: (row.t1_p2_cards ?? 0), t2_p1_cards: (row.t2_p1_cards ?? 0), t2_p2_cards: (row.t2_p2_cards ?? 0) }
          : { winner_id: row.winner_id, loser_id: row.loser_id, score_awarded: row.score_awarded, t1_p1_cards: (row.t1_p1_cards ?? 0), t1_p2_cards: (row.t1_p2_cards ?? 0), t2_p1_cards: val, t2_p2_cards: (row.t2_p2_cards ?? 0) }
        : { winner_id: row.winner_id, loser_id: row.loser_id, score_awarded: val, is_gin: row.is_gin, gin_player_id: row.gin_player_id ?? null };
      await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await fetch(`/api/matches/${matchId}`).then(r => r.json()) as MatchWithGames;
      setMatch(data);
    }
    scoreSaving.current = false;
  }

  async function handleDeleteRound(gameId: string) {
    if (!confirm('Delete this round? This cannot be undone.')) return;
    setDeletingRound(gameId);
    try {
      const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Failed to delete round');
        return;
      }
      const data = await fetch(`/api/matches/${matchId}`).then(r => r.json()) as MatchWithGames;
      setMatch(data);
      const init: Record<string, string> = {};
      data.games.forEach((g: any) => { init[g.id] = g.gin_player_id ?? ''; });
      setGinSelections(init);
    } finally {
      setDeletingRound(null);
    }
  }

  const matchCompleted = !!match.completed_at;
  const canDeleteRound = isAuthed && (!matchCompleted || isAdmin);

  let p1Running = 0;
  let p2Running = 0;
  const isTeam = !!match.team1_player2_id;
  // Per-round duration = time from the previous round's record to this one; round 1
  // is measured from the match start. Uses the timestamp each game already carries,
  // so it works retroactively on old matches with no schema change. Guarded against
  // missing/backwards clocks (returns null → shown as "—").
  const roundMins = (() => {
    const out: (number | null)[] = [];
    let prev = match.started_at ? new Date(match.started_at).getTime() : NaN;
    for (const g of match.games) {
      const t = g.timestamp ? new Date(g.timestamp).getTime() : NaN;
      if (!isFinite(prev) || !isFinite(t) || t < prev) { out.push(null); prev = isFinite(t) ? t : prev; continue; }
      out.push((t - prev) / 60000);
      prev = t;
    }
    return out;
  })();
  const fmtMins = (m: number | null) => m == null ? '—' : m < 1 ? '<1m' : m < 60 ? `${Math.round(m)}m` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  const matchMins = (match.started_at && match.completed_at)
    ? (new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) / 60000
    : null;

  const rows = match.games.map((g, i) => {
    const p1Won = g.winner_id === p1Id;
    if (p1Won) p1Running += g.score_awarded;
    else p2Running += g.score_awarded;
    return {
      id: g.id,
      round: g.round_number,
      mins: roundMins[i],
      p1Pts: p1Won ? g.score_awarded : null,
      p2Pts: p1Won ? null : g.score_awarded,
      t1Score: (g.t1_p1_cards ?? 0) + (g.t1_p2_cards ?? 0),
      t2Score: (g.t2_p1_cards ?? 0) + (g.t2_p2_cards ?? 0),
      hasUndercut: g.is_undercut === 1,
      winnerId: g.winner_id,
    };
  });

  const p1DisplayTotal = isTeam ? rows.reduce((s, r) => s + r.t1Score, 0) : p1Running;
  const p2DisplayTotal = isTeam ? rows.reduce((s, r) => s + r.t2Score, 0) : p2Running;
  const winnerLabel = match.winner_id === p1Id ? team1Label : match.winner_id === p2Id ? team2Label : null;
  const totalRounds = match.max_rounds > 0 ? match.max_rounds : Math.max(12, rows.length + 2);

  async function generateShareImage(): Promise<Blob> {
    const dpr = 2;
    const W = 580;
    const PAD = 16;
    const COL_ROUND = 46;
    const COL_GIN = 82;
    const COL_TEAM = (W - PAD * 2 - COL_ROUND - COL_GIN) / 2;
    const ROW_H = 42;
    const HEADER_H = 80;
    const BANNER_H = winnerLabel ? 48 : 0;
    const TABLE_TH1 = 36;
    const TABLE_TH2 = 28;
    const FOOTER_H = 28;
    const TOTAL_H = PAD + HEADER_H + 8 + BANNER_H + (BANNER_H ? 8 : 0) + TABLE_TH1 + TABLE_TH2 + rows.length * ROW_H + ROW_H + FOOTER_H + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = TOTAL_H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, TOTAL_H);
    bg.addColorStop(0, '#0e1525');
    bg.addColorStop(1, '#080e1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, TOTAL_H);

    // Card
    ctx.fillStyle = '#141e30';
    rrect(ctx, PAD / 2, PAD / 2, W - PAD, TOTAL_H - PAD, 14);
    ctx.fill();
    ctx.strokeStyle = '#263048';
    ctx.lineWidth = 1;
    rrect(ctx, PAD / 2, PAD / 2, W - PAD, TOTAL_H - PAD, 14);
    ctx.stroke();

    let y = PAD + 16;

    // Logo badge
    const logoR = 20;
    const logoX = PAD + logoR + 12;
    const logoY = y + logoR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
    ctx.fillStyle = '#1E2A44';
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#D4AF37';
    ctx.font = `bold ${logoR}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♠', logoX, logoY + 1);
    ctx.restore();

    // Title
    ctx.fillStyle = '#DDD1BF';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Digu League', logoX + logoR + 12, y + 2);
    ctx.fillStyle = '#6b7a96';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(monthLabel(match!.started_at).toUpperCase(), logoX + logoR + 12, y + 26);

    y += HEADER_H - 10;

    // Divider
    ctx.strokeStyle = '#263048';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD + 8, y);
    ctx.lineTo(W - PAD - 8, y);
    ctx.stroke();
    y += 10;

    // Winner banner
    if (winnerLabel) {
      const bx = PAD + 8, bw = W - (PAD + 8) * 2;
      ctx.fillStyle = 'rgba(212,175,55,0.1)';
      rrect(ctx, bx, y, bw, 36, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,175,55,0.3)';
      ctx.lineWidth = 1;
      rrect(ctx, bx, y, bw, 36, 6);
      ctx.stroke();
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🏆 ${winnerLabel} wins  ·  +${Math.abs(p1Running - p2Running)}`, W / 2, y + 18);
      y += BANNER_H;
    }

    // Column x positions
    const x0 = PAD + 8;
    const x1 = x0 + COL_ROUND;
    const x2 = x1 + COL_GIN;
    const x3 = x2 + COL_TEAM;
    const tableW = W - PAD - 8 - x0;

    // Table header row 1 — team names
    ctx.fillStyle = 'rgba(200,16,46,0.18)';
    ctx.fillRect(x2, y, COL_TEAM, TABLE_TH1);
    ctx.fillStyle = 'rgba(59,130,246,0.18)';
    ctx.fillRect(x3, y, COL_TEAM, TABLE_TH1);

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7a96';
    ctx.fillText('Round', x0 + COL_ROUND / 2, y + TABLE_TH1 / 2);
    ctx.fillStyle = '#D4AF37';
    ctx.fillText('DIGU', x1 + COL_GIN / 2, y + TABLE_TH1 / 2);
    ctx.fillStyle = '#C8102E';
    ctx.fillText(team1Label.toUpperCase(), x2 + COL_TEAM / 2, y + TABLE_TH1 / 2);
    ctx.fillStyle = '#3B82F6';
    ctx.fillText(team2Label.toUpperCase(), x3 + COL_TEAM / 2, y + TABLE_TH1 / 2);

    y += TABLE_TH1;

    // Table header row 2 — player names
    ctx.fillStyle = 'rgba(200,16,46,0.08)';
    ctx.fillRect(x2, y, COL_TEAM, TABLE_TH2);
    ctx.fillStyle = 'rgba(59,130,246,0.08)';
    ctx.fillRect(x3, y, COL_TEAM, TABLE_TH2);
    ctx.fillStyle = '#D4AF37';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText(team1Players, x2 + COL_TEAM / 2, y + TABLE_TH2 / 2);
    ctx.fillText(team2Players, x3 + COL_TEAM / 2, y + TABLE_TH2 / 2);

    y += TABLE_TH2;

    // Header bottom border
    ctx.strokeStyle = '#263048';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + tableW, y);
    ctx.stroke();

    // Data rows
    rows.forEach((r, i) => {
      const ry = y + i * ROW_H;
      const isWinA = r.winnerId === p1Id;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.018)';
        ctx.fillRect(x0, ry, tableW, ROW_H);
      }
      const mid = ry + ROW_H / 2;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      // Round
      ctx.fillStyle = '#6b7a96';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText(String(r.round), x0 + COL_ROUND / 2, mid);

      // Gin player
      const ginId = ginSelections[r.id];
      if (ginId) {
        const gp = allPlayers.find(p => p.id === ginId);
        if (gp) {
          ctx.fillStyle = '#D4AF37';
          ctx.font = '700 13px system-ui, sans-serif';
          ctx.fillText(gp.name, x1 + COL_GIN / 2, mid);
        }
      }

      // Scores — team A always red, team B always blue
      const p1Text = isTeam ? String(r.t1Score) : (r.p1Pts ? String(r.p1Pts) : '');
      const p2Text = isTeam ? String(r.t2Score) : (r.p2Pts ? String(r.p2Pts) : '');
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillStyle = '#E8304A';
      if (p1Text) ctx.fillText(p1Text, x2 + COL_TEAM / 2, mid);
      ctx.fillStyle = '#5B9CF6';
      if (p2Text) ctx.fillText(p2Text, x3 + COL_TEAM / 2, mid);

      // Row line
      ctx.strokeStyle = '#1c2535';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, ry + ROW_H);
      ctx.lineTo(x0 + tableW, ry + ROW_H);
      ctx.stroke();
    });

    y += rows.length * ROW_H;

    // Total separator
    ctx.strokeStyle = '#3a4a60';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + tableW, y);
    ctx.stroke();

    // Total row
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x0, y, tableW, ROW_H);
    const tmid = y + ROW_H / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7a96';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText('Total', x0 + COL_ROUND / 2, tmid);
    ctx.fillStyle = '#D4AF37';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(String(p1DisplayTotal), x2 + COL_TEAM / 2, tmid);
    ctx.fillText(String(p2DisplayTotal), x3 + COL_TEAM / 2, tmid);

    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
  }

  async function handleShare() {
    try {
      const blob = await generateShareImage();
      const file = new File([blob], 'digu-scoresheet.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Digu League Match' });
        return;
      }
      // Fallback: download the image
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'digu-scoresheet.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Last resort: copy text
      const text = `Digu League\n${team1Label} vs ${team2Label}\n${winnerLabel ? `${winnerLabel} wins · ${p1Running} – ${p2Running}` : `${p1DisplayTotal} – ${p2DisplayTotal}`}`;
      navigator.clipboard?.writeText(text);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <a href={`/match/${matchId}`} style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'inline-block', marginBottom: '0.625rem' }}>← Back</a>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleShare}
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.875rem', padding: '0.625rem 0.75rem' }}
          >
            🔗 Share
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.875rem', padding: '0.625rem 0.75rem' }}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      <div className="scoresheet" id="printable">
        {/* Title */}
        <div className="ss-title">
          <img src="/dl-logo-v2.png" alt="Digu League" className="ss-logo" />
          <div>
            <h1 className="ss-heading">Digu League</h1>
            <div className="ss-month">{monthLabel(match.started_at)}</div>
          </div>
        </div>

        {winnerLabel && (() => {
          const margin = Math.abs(isTeam ? p1DisplayTotal - p2DisplayTotal : p1Running - p2Running);
          // MVP = player with most digus
          const diguCounts: Record<string, number> = {};
          for (const g of match.games) {
            if (g.gin_player_id) diguCounts[g.gin_player_id] = (diguCounts[g.gin_player_id] || 0) + 1;
          }
          const mvpEntry = Object.entries(diguCounts).sort((a, b) => b[1] - a[1])[0];
          const mvpPlayer = mvpEntry ? allPlayers.find(p => p.id === mvpEntry[0]) : null;
          const mvpDigus = mvpEntry?.[1] ?? 0;
          // Best hand
          const topHand = [...rows].sort((a, b) => Math.max(b.p1Pts??0, b.p2Pts??0) - Math.max(a.p1Pts??0, a.p2Pts??0))[0];
          const topScore = topHand ? Math.max(topHand.p1Pts??0, topHand.p2Pts??0) : 0;
          return (
            <div>
              <div className="ss-winner-banner">🏆 {winnerLabel} wins · +{margin}{matchMins != null ? ` · ⏱ ${fmtMins(matchMins)}` : ''}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {mvpPlayer && mvpDigus > 0 && (
                  <div style={{ flex: 1, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>👑 King of the Table</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--gold)', marginTop: '0.2rem' }}>{mvpPlayer.name}</div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{mvpDigus} digu</div>
                  </div>
                )}
                {topScore > 0 && (
                  <div style={{ flex: 1, background: 'rgba(120,39,13,0.12)', border: '1px solid rgba(120,39,13,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>⚡ Best Hand</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--ember)', marginTop: '0.2rem' }}>{topScore} pts · Rd {topHand!.round}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {!match.completed_at && (
          <div className="ss-in-progress">Match in progress · {match.games.length} rounds played</div>
        )}
        {match.comment && (
          <div style={{
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: 8, padding: '0.5rem 0.875rem', marginBottom: '0.75rem',
            fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic',
          }}>
            "{match.comment}"
          </div>
        )}

        {/* Score Table */}
        <div className="ss-table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th className="ss-round-col" rowSpan={2}>R</th>
                <th className="ss-time-col" rowSpan={2}>T</th>
                <th className="ss-gin-header" rowSpan={2}>DIGU</th>
                <th className="ss-team-header team-a">{team1Label}</th>
                <th className="ss-team-header team-b">{team2Label}</th>
                {canDeleteRound && <th className="ss-del-col" rowSpan={2}></th>}
              </tr>
              <tr>
                <th className="ss-sub-col" style={{ color: '#ffffff' }}>{team1Players}</th>
                <th className="ss-sub-col" style={{ color: '#ffffff' }}>{team2Players}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={r.winnerId === p1Id ? 'row-win-a' : 'row-win-b'}>
                  <td className="ss-round-num">{r.round}</td>
                  <td className="ss-time-cell">{fmtMins(r.mins)}</td>
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
                  <td className="ss-score-cell" style={{ color: 'var(--team-a)', cursor: (matchCompleted && !isAdmin) ? 'default' : 'pointer' }}
                    onClick={() => { if (matchCompleted && !isAdmin) return; setEditingScore({ gameId: r.id, side: 'p1' }); setScoreDraft(String(isTeam ? r.t1Score : (r.p1Pts ?? 0))); }}>
                    {editingScore?.gameId === r.id && editingScore.side === 'p1' ? (
                      <input
                        autoFocus type="number" inputMode="numeric"
                        value={scoreDraft}
                        onChange={e => setScoreDraft(e.target.value)}
                        onBlur={() => handleSaveScore(r.id, 'p1')}
                        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { scoreSaving.current = true; setEditingScore(null); setTimeout(() => { scoreSaving.current = false; }, 100); } }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 60, textAlign: 'center', fontSize: '1rem', fontWeight: 800, background: 'var(--card-raised)', border: '1px solid var(--team-a)', borderRadius: 4, color: 'var(--team-a)', padding: '0.1rem' }}
                      />
                    ) : (isTeam ? (r.t1Score || '') : (r.p1Pts || ''))}
                  </td>
                  <td className="ss-score-cell" style={{ color: 'var(--team-b)', cursor: (matchCompleted && !isAdmin) ? 'default' : 'pointer' }}
                    onClick={() => { if (matchCompleted && !isAdmin) return; setEditingScore({ gameId: r.id, side: 'p2' }); setScoreDraft(String(isTeam ? r.t2Score : (r.p2Pts ?? 0))); }}>
                    {editingScore?.gameId === r.id && editingScore.side === 'p2' ? (
                      <input
                        autoFocus type="number" inputMode="numeric"
                        value={scoreDraft}
                        onChange={e => setScoreDraft(e.target.value)}
                        onBlur={() => handleSaveScore(r.id, 'p2')}
                        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { scoreSaving.current = true; setEditingScore(null); setTimeout(() => { scoreSaving.current = false; }, 100); } }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 60, textAlign: 'center', fontSize: '1rem', fontWeight: 800, background: 'var(--card-raised)', border: '1px solid var(--team-b)', borderRadius: 4, color: 'var(--team-b)', padding: '0.1rem' }}
                      />
                    ) : (isTeam ? (r.t2Score || '') : (r.p2Pts || ''))}
                  </td>
                  {canDeleteRound && (
                    <td className="ss-del-cell">
                      <button
                        className="del-round-btn"
                        onClick={() => handleDeleteRound(r.id)}
                        disabled={deletingRound === r.id}
                        title="Delete round"
                      >
                        {deletingRound === r.id ? '…' : '✕'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* Empty rows */}
              {Array.from({ length: Math.max(0, totalRounds - rows.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="empty-row">
                  <td className="ss-round-num">{rows.length + i + 1}</td>
                  <td className="ss-time-cell"></td>
                  <td className="ss-gin-cell"></td>
                  <td className="ss-score-cell"></td>
                  <td className="ss-score-cell"></td>
                  {canDeleteRound && <td className="ss-del-cell"></td>}
                </tr>
              ))}

              {/* Total row */}
              <tr className="totals-row">
                <td className="ss-round-num" style={{ fontWeight: 700 }}>Total</td>
                <td className="ss-time-cell"></td>
                <td className="ss-gin-cell"></td>
                <td className="ss-score-cell" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--gold)' }}>
                  {p1DisplayTotal}
                </td>
                <td className="ss-score-cell" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--gold)' }}>
                  {p2DisplayTotal}
                </td>
                {canDeleteRound && <td className="ss-del-cell"></td>}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Reactions */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.25rem' }}>
          <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reactions</div>
          <ReactionBar matchId={matchId} />
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
        .ss-table th, .ss-table td { border: 1px solid var(--border); text-align: center; font-size: 1rem; font-weight: 700; }
        .ss-round-col { width: 48px; }
        .ss-time-col { width: 54px; font-size: 0.72rem; }
        .ss-time-cell { padding: 0.5rem 0.25rem; text-align: center; color: var(--text-muted); font-size: 0.76rem; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ss-gin-header {
          width: 100px;
          padding: 0.375rem 0.25rem;
          font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em;
          text-transform: uppercase; color: var(--gold);
        }
        .ss-team-header {
          padding: 0.625rem 0.375rem; font-size: 0.9375rem; font-weight: 800;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .ss-team-header.team-a { background: var(--team-a-dim); color: var(--team-a); border-bottom: 2px solid var(--team-a); }
        .ss-team-header.team-b { background: var(--team-b-dim); color: var(--team-b); border-bottom: 2px solid var(--team-b); }
        .ss-table thead tr:nth-child(2) th {
          padding: 0.5rem 0.25rem; font-size: 0.9375rem; font-weight: 700;
          color: var(--text-primary); letter-spacing: 0.01em;
          max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ss-round-num { padding: 0.5rem 0.375rem; color: var(--text-muted); font-size: 0.9375rem; font-weight: 700; }
        .ss-gin-cell { padding: 0.25rem 0.25rem; min-width: 100px; }
        .ss-score-cell { padding: 0.625rem 0.375rem; font-weight: 800; font-size: 1.125rem; min-width: 60px; }
        .empty-row td { height: 36px; opacity: 0.25; }
        .totals-row { background: rgba(255,255,255,0.03); border-top: 2px solid var(--border); }
        .totals-row td { padding: 0.625rem 0.375rem; }
        .undercut-mark { color: var(--team-b); font-size: 0.875rem; }
        .ss-legend {
          display: flex; flex-wrap: wrap; gap: 1rem;
          margin-top: 0.875rem; padding-top: 0.75rem;
          border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted);
        }

        /* Delete round button */
        .ss-del-col { width: 32px; padding: 0; border-color: transparent !important; background: transparent !important; }
        .ss-del-cell { padding: 0.25rem 0.25rem; text-align: center; border-color: var(--border); }
        .del-round-btn {
          width: 26px; height: 26px;
          border-radius: 6px;
          border: 1px solid rgba(239,68,68,0.3);
          background: rgba(239,68,68,0.08);
          color: #EF4444;
          font-size: 0.7rem;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.15s;
          line-height: 1;
        }
        .del-round-btn:hover:not(:disabled) { background: rgba(239,68,68,0.2); border-color: #EF4444; }
        .del-round-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Gin select dropdown */
        .gin-select {
          width: 100%;
          background: var(--card-raised);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--gold);
          font-size: 0.875rem;
          font-weight: 700;
          padding: 0.25rem 0.125rem;
          cursor: pointer;
          text-align: center;
        }
        .gin-select:focus { outline: none; border-color: var(--gold); }
        .gin-select option { color: var(--cream); background: var(--card); }

        /* Compact mobile: fit the whole sheet on a phone screen (no horizontal scroll) */
        @media (max-width: 480px) {
          .scoresheet { padding: 0.45rem; }
          .ss-table-wrap { margin: 0 -0.45rem; overflow-x: hidden; }
          .ss-table { min-width: 0; width: 100%; table-layout: fixed; }
          .ss-table th, .ss-table td { font-size: 0.72rem; border-width: 1px; }
          .ss-round-col { width: 30px; }
          .ss-time-col { width: 30px; }
          .ss-time-cell { padding: 0.3rem 0.02rem; font-size: 0.6rem; }
          .ss-gin-header { width: 64px; padding: 0.28rem 0.05rem; font-size: 0.56rem; letter-spacing: 0; }
          .ss-gin-cell { padding: 0.18rem 0.06rem; min-width: 0; }
          .ss-team-header { padding: 0.35rem 0.06rem; font-size: 0.6rem; letter-spacing: 0; white-space: normal; word-break: break-word; line-height: 1.15; }
          .ss-table thead tr:nth-child(2) th { padding: 0.3rem 0.04rem; font-size: 0.56rem; max-width: none; white-space: normal; word-break: break-word; line-height: 1.15; }
          .ss-round-num { padding: 0.35rem 0.05rem; font-size: 0.66rem; }
          .ss-score-cell { padding: 0.4rem 0.05rem; font-size: 0.85rem; min-width: 0; }
          .ss-score-cell input { width: 100% !important; max-width: 100%; box-sizing: border-box; padding: 0.1rem 0 !important; }
          .totals-row td { padding: 0.4rem 0.05rem; }
          .ss-score-cell[style*="1.25rem"] { font-size: 0.95rem !important; }
          .gin-select { font-size: 0.6rem; padding: 0.18rem 0; }
          .ss-del-col { width: 20px; }
          .ss-del-cell { padding: 0.12rem 0.03rem; }
          .del-round-btn { width: 18px; height: 18px; font-size: 0.55rem; }
        }

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
