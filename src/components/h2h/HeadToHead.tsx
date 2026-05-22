import { useState, useEffect } from 'react';

function nick(name: string, nickname?: string) { return nickname || name.split(' ')[0]; }
function fmt(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function Avatar({ name, b64, size = 56 }: { name: string; b64?: string; size?: number }) {
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (b64) return <img src={`data:image/jpeg;base64,${b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#DDD1BF', border: '2px solid var(--border)' }}>
      {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
    </div>
  );
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

  function share() {
    const url = `${window.location.origin}/h2h?p1=${p1}&p2=${p2}`;
    if (navigator.share) {
      navigator.share({ title: 'Head to Head', url });
    } else {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        <span style={{ color: 'var(--team-a)' }}>{myScore}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0.375rem' }}>–</span>
                        <span style={{ color: 'var(--team-b)' }}>{theirScore}</span>
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
