import { useState, useEffect } from 'react';

/* Special Annual Awards — trophy case. One winner per award per YEAR.
   Manually assigned by an admin (house rule — same as the Digu King badge);
   data-backed awards show a one-click suggestion computed server-side. */

type Def = { key: string; emoji: string; name: string; desc: string; suggest?: string };
type Row = { award_key: string; player_id: string | null; recipient_name: string | null; note: string | null; player_name?: string; player_nickname?: string };
type Sug = { playerId: string; name: string; detail: string };
type Player = { id: string; name: string; nickname?: string };

const nick = (name?: string, nickname?: string | null) => nickname || (name || '').split(' ')[0] || name || '';

export default function AwardsBoard({ isAdmin, year: initialYear }: { isAdmin: boolean; year: number }) {
  const [year, setYear] = useState(initialYear);
  const [defs, setDefs] = useState<Def[]>([]);
  const [awards, setAwards] = useState<Record<string, Row>>({});
  const [sugs, setSugs] = useState<Record<string, Sug>>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Def | null>(null);
  const [pick, setPick] = useState('');
  const [freeText, setFreeText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function load(y: number) {
    setLoading(true);
    fetch(`/api/awards?year=${y}`).then(r => r.json()).then((d: { defs?: Def[]; suggestions?: Record<string, Sug>; awards?: Row[] }) => {
      setDefs(d.defs || []);
      setSugs(d.suggestions || {});
      const map: Record<string, Row> = {};
      (d.awards || []).forEach((a) => { map[a.award_key] = a; });
      setAwards(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => { load(year); }, [year]);
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/players').then(r => r.json()).then((d: Player[] | { players?: Player[] }) => setPlayers(Array.isArray(d) ? d : d.players || [])).catch(() => {});
  }, [isAdmin]);

  function openAssign(d: Def) {
    const cur = awards[d.key];
    setEditing(d);
    setPick(cur?.player_id || sugs[d.key]?.playerId || '');
    setFreeText(cur?.recipient_name || '');
    setNote(cur?.note || '');
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    const res = await fetch('/api/awards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, key: editing.key, playerId: pick || null, recipientName: pick ? null : freeText, note }),
    });
    setBusy(false);
    if (res.ok) { setEditing(null); load(year); }
    else alert(((await res.json()) as { error?: string }).error || 'Could not save');
  }
  async function unassign(key: string) {
    if (!confirm('Remove this award?')) return;
    await fetch('/api/awards', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, key }) });
    load(year);
  }

  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear; y >= 2024; y--) years.push(y);
  const awarded = Object.keys(awards).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)}
              style={{ padding: '6px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                border: `1.5px solid ${y === year ? 'rgba(212,175,55,0.8)' : 'var(--border)'}`,
                background: y === year ? 'rgba(212,175,55,0.14)' : 'var(--card)',
                color: y === year ? '#D4AF37' : 'var(--text-secondary)' }}>{y}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{awarded} / {defs.length || 15} awarded</span>
      </div>

      {loading ? <div className="loading">Loading awards…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 12 }}>
          {defs.map(d => {
            const a = awards[d.key];
            const s = sugs[d.key];
            const winner = a ? (a.player_id ? nick(a.player_name, a.player_nickname) : a.recipient_name) : null;
            return (
              <div key={d.key} style={{
                background: a ? 'linear-gradient(160deg, rgba(212,175,55,0.12), var(--card))' : 'var(--card)',
                border: `1.5px solid ${a ? 'rgba(212,175,55,0.55)' : 'var(--border)'}`,
                borderRadius: 14, padding: '16px 14px', position: 'relative',
                boxShadow: a ? '0 0 18px rgba(212,175,55,0.12)' : 'none',
              }}>
                <div style={{ fontSize: 34, lineHeight: 1, filter: a ? 'none' : 'grayscale(.75) opacity(.55)' }}>{d.emoji}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: '8px 0 3px' }}>{d.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, minHeight: 33 }}>{d.desc}</div>

                {winner ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#D4AF37' }}>{year} Winner</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{winner}</div>
                    {a?.note && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{a.note}</div>}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Not awarded yet
                    {s && <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>📊 Data says: <b style={{ color: 'var(--accent)' }}>{s.name}</b> — {s.detail}</div>}
                  </div>
                )}

                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={() => openAssign(d)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-raised)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{a ? 'Change' : 'Assign'}</button>
                    {a && <button onClick={() => unassign(d.key)} aria-label="Remove" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ember)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✕</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setEditing(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(4,8,16,0.7)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--card)', border: '1.5px solid rgba(212,175,55,0.5)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 28 }}>{editing.emoji}</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: '6px 0 2px', color: 'var(--text-primary)' }}>{editing.name} · {year}</h3>
            {sugs[editing.key] && (
              <button onClick={() => setPick(sugs[editing.key].playerId)} style={{ margin: '6px 0', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                📊 Use suggestion: {sugs[editing.key].name} ({sugs[editing.key].detail})
              </button>
            )}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: '10px 0 4px' }}>Player</label>
            <select value={pick} onChange={e => setPick(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-raised)', color: 'var(--text-primary)' }}>
              <option value="">— not a player (type below) —</option>
              {players.map(p => <option key={p.id} value={p.id}>{nick(p.name, p.nickname)}</option>)}
            </select>
            {!pick && (
              <>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: '10px 0 4px' }}>Recipient (e.g. a club or venue)</label>
                <input value={freeText} onChange={e => setFreeText(e.target.value)} placeholder="Recipient name" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-raised)', color: 'var(--text-primary)' }} />
              </>
            )}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: '10px 0 4px' }}>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. 7-win streak in March" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-raised)', color: 'var(--text-primary)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#D4AF37', color: '#141B2D', fontWeight: 800, cursor: 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Saving…' : 'Award it'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
