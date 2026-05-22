import { useState, useEffect } from 'react';

function nick(name: string, nickname?: string) { return nickname || name.split(' ')[0]; }
function fmt(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

const AVATAR_COLORS = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];

function Avatar({ name, b64, size = 56 }: { name: string; b64?: string; size?: number }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  if (b64) return <img src={`data:image/jpeg;base64,${b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#DDD1BF', border: '2px solid var(--border)' }}>
      {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
    </div>
  );
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawAvatarCircle(ctx: CanvasRenderingContext2D, name: string, b64: string | undefined, cx: number, cy: number, r: number, img: HTMLImageElement | null) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#DDD1BF';
    ctx.font = `bold ${r * 0.75}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#263048'; ctx.lineWidth = 2; ctx.stroke();
}

export default function HeadToHead() {
  const [players, setPlayers] = useState<any[]>([]);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then((d: any) => {
      const list = d.players ?? d ?? [];
      setPlayers(list);
      const params = new URLSearchParams(window.location.search);
      const qp1 = params.get('p1') ?? '';
      const qp2 = params.get('p2') ?? '';
      if (qp1 && qp2 && qp1 !== qp2) {
        setP1(qp1); setP2(qp2);
        setLoading(true);
        fetch(`/api/h2h?p1=${qp1}&p2=${qp2}`).then(r => r.json()).then((d2: any) => { setData(d2); setLoading(false); });
      }
    });
  }, []);

  function search() {
    if (!p1 || !p2 || p1 === p2) return;
    setLoading(true); setData(null);
    history.pushState({}, '', `/h2h?p1=${p1}&p2=${p2}`);
    fetch(`/api/h2h?p1=${p1}&p2=${p2}`).then(r => r.json()).then((d: any) => { setData(d); setLoading(false); });
  }

  async function generateShareImage(): Promise<Blob> {
    const dpr = 2;
    const W = 560, PAD = 20;
    const HEADER_H = 72;
    const AVATAR_R = 44;
    const VS_SECTION_H = AVATAR_R * 2 + 24;
    const BAR_SECTION_H = 52;
    const STATS_H = 72;
    const HISTORY_H = Math.min(data.matches.length, 5) * 44 + (data.matches.length > 0 ? 32 : 0);
    const FOOTER_H = 28;
    const TOTAL_H = PAD + HEADER_H + 12 + VS_SECTION_H + 12 + BAR_SECTION_H + 12 + STATS_H + (HISTORY_H > 0 ? 16 + HISTORY_H : 0) + 16 + FOOTER_H + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = W * dpr; canvas.height = TOTAL_H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, TOTAL_H);
    bg.addColorStop(0, '#0e1525'); bg.addColorStop(1, '#080e1a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, TOTAL_H);

    // Card
    ctx.fillStyle = '#141e30';
    rrect(ctx, PAD / 2, PAD / 2, W - PAD, TOTAL_H - PAD, 16); ctx.fill();
    ctx.strokeStyle = '#263048'; ctx.lineWidth = 1;
    rrect(ctx, PAD / 2, PAD / 2, W - PAD, TOTAL_H - PAD, 16); ctx.stroke();

    let y = PAD + 16;

    // Logo badge
    const logoR = 18, logoX = PAD + logoR + 14, logoY = y + logoR;
    ctx.save();
    ctx.beginPath(); ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
    ctx.fillStyle = '#1E2A44'; ctx.fill();
    ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#D4AF37'; ctx.font = `bold ${logoR}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♠', logoX, logoY + 1);
    ctx.restore();

    ctx.fillStyle = '#DDD1BF'; ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Digu League', logoX + logoR + 12, y + 2);
    ctx.fillStyle = '#6b7a96'; ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText('HEAD TO HEAD', logoX + logoR + 12, y + 24);

    y += HEADER_H - 8;
    ctx.strokeStyle = '#263048'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD + 8, y); ctx.lineTo(W - PAD - 8, y); ctx.stroke();
    y += 14;

    // Load avatars
    let img1: HTMLImageElement | null = null, img2: HTMLImageElement | null = null;
    try { if (data.p1.avatar_b64) img1 = await loadImg(`data:image/jpeg;base64,${data.p1.avatar_b64}`); } catch { /**/ }
    try { if (data.p2.avatar_b64) img2 = await loadImg(`data:image/jpeg;base64,${data.p2.avatar_b64}`); } catch { /**/ }

    // Avatars
    const cx1 = PAD + 14 + AVATAR_R, cx2 = W - PAD - 14 - AVATAR_R, midX = W / 2;
    const avatarCY = y + AVATAR_R;
    drawAvatarCircle(ctx, data.p1.name, data.p1.avatar_b64, cx1, avatarCY, AVATAR_R, img1);
    drawAvatarCircle(ctx, data.p2.name, data.p2.avatar_b64, cx2, avatarCY, AVATAR_R, img2);

    // VS
    ctx.fillStyle = '#3a4a60'; ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚔', midX, avatarCY);

    // Names
    const nameY = y + AVATAR_R * 2 + 10;
    ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#C8102E'; ctx.textAlign = 'center';
    ctx.fillText(nick(data.p1.name, data.p1.nickname), cx1, nameY);
    ctx.fillStyle = '#3B82F6';
    ctx.fillText(nick(data.p2.name, data.p2.nickname), cx2, nameY);

    y += VS_SECTION_H + 14;

    // W/L bar section
    const barX = PAD + 14, barW = W - (PAD + 14) * 2, barH = 12, barY = y + 18;
    const total = data.matches.length;
    const p1pct = total > 0 ? data.p1Wins / total : 0.5;
    const p2pct = total > 0 ? data.p2Wins / total : 0.5;

    ctx.fillStyle = '#6b7a96'; ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${data.p1Wins}W`, barX, y);
    ctx.fillStyle = '#6b7a96'; ctx.textAlign = 'right';
    ctx.fillText(`${data.p2Wins}W`, barX + barW, y);
    ctx.fillStyle = '#6b7a96'; ctx.textAlign = 'center';
    ctx.fillText(`${total} Matches`, midX, y);

    // Bar track
    ctx.fillStyle = '#1c2535';
    rrect(ctx, barX, barY, barW, barH, barH / 2); ctx.fill();
    if (p1pct > 0) {
      ctx.fillStyle = '#C8102E';
      rrect(ctx, barX, barY, barW * p1pct, barH, barH / 2); ctx.fill();
    }
    if (p2pct > 0) {
      ctx.fillStyle = '#3B82F6';
      rrect(ctx, barX + barW * (1 - p2pct), barY, barW * p2pct, barH, barH / 2); ctx.fill();
    }

    y += BAR_SECTION_H + 10;

    // Stats row
    const statsData = [
      { label: 'Wins', v1: String(data.p1Wins), v2: String(data.p2Wins) },
      { label: 'Win %', v1: total ? `${Math.round((data.p1Wins / total) * 100)}%` : '—', v2: total ? `${Math.round((data.p2Wins / total) * 100)}%` : '—' },
      { label: 'Avg Score', v1: String(data.p1AvgScore), v2: String(data.p2AvgScore) },
    ];
    const colW = (W - (PAD + 14) * 2) / statsData.length;
    statsData.forEach((s, i) => {
      const sx = PAD + 14 + i * colW + colW / 2;
      ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#6b7a96'; ctx.textBaseline = 'top';
      ctx.fillText(s.label.toUpperCase(), sx, y);
      ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#C8102E'; ctx.fillText(s.v1, sx - colW * 0.22, y + 14);
      ctx.fillStyle = '#3a4a60'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText('vs', sx, y + 18);
      ctx.fillStyle = '#3B82F6'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.fillText(s.v2, sx + colW * 0.22, y + 14);
    });

    y += STATS_H + 12;

    // Match history (up to 5)
    if (data.matches.length > 0) {
      ctx.fillStyle = '#6b7a96'; ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('RECENT MATCHES', PAD + 14, y);
      y += 18;
      const shown = data.matches.slice(0, 5);
      shown.forEach((m: any) => {
        const rowH = 36, rx = PAD + 10, rw = W - (PAD + 10) * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        rrect(ctx, rx, y, rw, rowH, 6); ctx.fill();
        ctx.strokeStyle = '#1c2535'; ctx.lineWidth = 1;
        rrect(ctx, rx, y, rw, rowH, 6); ctx.stroke();

        const p1OnLeft = m.player1_id === p1 || m.team1_player2_id === p1;
        const myScore = p1OnLeft ? m.t1_score : m.t2_score;
        const theirScore = p1OnLeft ? m.t2_score : m.t1_score;
        const won = m.winner_id && ((p1OnLeft && m.winner_id === m.player1_id) || (!p1OnLeft && m.winner_id === m.player2_id));
        const resultColor = won ? '#638D6F' : m.winner_id ? '#78270D' : '#6b7a96';
        const rowMid = y + rowH / 2;

        ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textBaseline = 'middle';
        ctx.fillStyle = resultColor; ctx.textAlign = 'left';
        ctx.fillText(won ? 'WIN' : m.winner_id ? 'LOSS' : 'DRAW', rx + 10, rowMid);
        ctx.fillStyle = '#3a4a60'; ctx.font = '600 9px system-ui, sans-serif';
        ctx.fillText(fmt(m.started_at), rx + 10, rowMid + 11);

        ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'right';
        ctx.fillStyle = '#C8102E'; ctx.fillText(String(myScore ?? ''), rx + rw - 10, rowMid - 4);

        ctx.fillStyle = '#3a4a60'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('–', rx + rw / 2, rowMid - 4);

        ctx.fillStyle = '#3B82F6'; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(String(theirScore ?? ''), rx + rw / 2 + 14, rowMid - 4);

        const total = (myScore ?? 0) + (theirScore ?? 0);
        ctx.fillStyle = '#3a4a60'; ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(`${total} total`, rx + rw - 10, rowMid + 10);

        y += rowH + 6;
      });
    }

    // Footer
    y += 4;
    ctx.fillStyle = 'rgba(107,122,150,0.4)'; ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('digu-league.pages.dev', W / 2, y);

    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
  }

  async function share() {
    try {
      const blob = await generateShareImage();
      const file = new File([blob], 'digu-h2h.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Digu League H2H' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'digu-h2h.png'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      const shareUrl = `${window.location.origin}/h2h?p1=${p1}&p2=${p2}`;
      navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  }

  const activePlayers = players.filter(p => p.active !== 0);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Selector */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Player 1</label>
            <select value={p1} onChange={e => setP1(e.target.value)} style={{ width: '100%', background: 'var(--card-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.625rem 0.75rem', fontSize: '0.9375rem', outline: 'none' }}>
              <option value="">Select player…</option>
              {activePlayers.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </select>
          </div>
          <div style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-muted)', paddingBottom: '0.5rem' }}>VS</div>
          <div>
            <label style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Player 2</label>
            <select value={p2} onChange={e => setP2(e.target.value)} style={{ width: '100%', background: 'var(--card-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.625rem 0.75rem', fontSize: '0.9375rem', outline: 'none' }}>
              <option value="">Select player…</option>
              {activePlayers.filter(p => p.id !== p1).map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={search} disabled={!p1 || !p2 || p1 === p2 || loading}>
            {loading ? 'Loading…' : '⚔ Compare'}
          </button>
          {data && !data.error && (
            <button onClick={share} title="Share this matchup" style={{ padding: '0 1rem', background: copied ? 'var(--felt-light)' : 'var(--card-raised)', color: copied ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', transition: 'background 0.2s, color 0.2s', whiteSpace: 'nowrap' }}>
              {copied ? '✓ Copied!' : '🔗 Share'}
            </button>
          )}
        </div>
      </div>

      {data && !data.error && (
        <>
          {/* Summary banner */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <Avatar name={data.p1.name} b64={data.p1.avatar_b64} size={64} />
                <div style={{ marginTop: '0.5rem', fontWeight: 800, fontSize: '1rem' }}>{nick(data.p1.name, data.p1.nickname)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-muted)' }}>⚔</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Avatar name={data.p2.name} b64={data.p2.avatar_b64} size={64} />
                <div style={{ marginTop: '0.5rem', fontWeight: 800, fontSize: '1rem' }}>{nick(data.p2.name, data.p2.nickname)}</div>
              </div>
            </div>

            {/* W/L bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                <span style={{ color: 'var(--team-a)', fontWeight: 700 }}>{data.p1Wins}W</span>
                <span>{data.matches.length} Matches · {data.draws} Draw{data.draws !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--team-b)', fontWeight: 700 }}>{data.p2Wins}W</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--card-raised)', overflow: 'hidden', display: 'flex' }}>
                {data.matches.length > 0 && <>
                  <div style={{ width: `${(data.p1Wins / data.matches.length) * 100}%`, background: 'var(--team-a)', transition: 'width 0.5s' }} />
                  <div style={{ width: `${(data.p2Wins / data.matches.length) * 100}%`, background: 'var(--team-b)', transition: 'width 0.5s' }} />
                </>}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
              {[
                { label: 'Wins', v1: data.p1Wins, v2: data.p2Wins },
                { label: 'Avg Score', v1: data.p1AvgScore, v2: data.p2AvgScore },
                { label: 'Win Rate', v1: data.matches.length ? `${Math.round((data.p1Wins/data.matches.length)*100)}%` : '—', v2: data.matches.length ? `${Math.round((data.p2Wins/data.matches.length)*100)}%` : '—' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{s.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.125rem', color: data.p1Wins >= data.p2Wins ? 'var(--gold)' : 'var(--text-primary)' }}>{s.v1}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>vs</span>
                    <span style={{ fontWeight: 900, fontSize: '1.125rem', color: data.p2Wins > data.p1Wins ? 'var(--gold)' : 'var(--text-primary)' }}>{s.v2}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Match history */}
          {data.matches.length > 0 && (
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Match History</div>
              {data.matches.map((m: any) => {
                const p1OnTeam1 = m.player1_id === p1 || m.team1_player2_id === p1;
                const myScore = p1OnTeam1 ? m.t1_score : m.t2_score;
                const theirScore = p1OnTeam1 ? m.t2_score : m.t1_score;
                const won = m.winner_id && ((p1OnTeam1 && m.winner_id === m.player1_id) || (!p1OnTeam1 && m.winner_id === m.player2_id));
                const resultColor = won ? 'var(--felt-light)' : m.winner_id ? 'var(--ember)' : 'var(--text-muted)';
                return (
                  <a key={m.id} href={`/scoresheet/${m.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: resultColor }}>
                          {won ? 'WIN' : m.winner_id ? 'LOSS' : 'DRAW'}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{fmt(m.started_at)} · {m.rounds} rounds</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                          <span style={{ color: 'var(--team-a)' }}>{myScore}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0.375rem' }}>–</span>
                          <span style={{ color: 'var(--team-b)' }}>{theirScore}</span>
                        </div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{(myScore ?? 0) + (theirScore ?? 0)} total</div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
          {data.matches.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No matches between these players yet.</div>
          )}
        </>
      )}
    </div>
  );
}
