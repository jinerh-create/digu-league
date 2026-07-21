import { useState, useEffect, useRef } from 'react';
import type { Player } from '../../lib/types';
import VerifiedBadge from '../common/VerifiedBadge';

function Avatar({ name, avatar_b64, size = 40 }: { name: string; avatar_b64: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#2B4F37', '#78270D', '#1a3a5c', '#4a2060', '#2c4a1a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (avatar_b64) {
    return <img src={`data:image/jpeg;base64,${avatar_b64}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#DDD1BF', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function resizeImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl.replace('data:image/jpeg;base64,', ''));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function PlayerList() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [nickEditId, setNickEditId] = useState<string | null>(null);
  const [nickDraft, setNickDraft] = useState('');
  const [savingNickId, setSavingNickId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  function fetchPlayers() {
    return fetch('/api/players')
      .then(r => r.json())
      .then((data: Player[]) => setPlayers(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchPlayers(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    setAdding(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json() as Player & { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed'); setAdding(false); return; }
      setPlayers(prev => [...prev, data]);
      setNewName('');
    } catch { setError('Network error'); }
    finally { setAdding(false); }
  }

  async function handleDeactivate(id: string) {
    await fetch(`/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: 0 }),
    });
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  async function handleVerify(id: string) {
    const r = await fetch('/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: id, action: 'approve' }),
    });
    if (r.ok) setPlayers(prev => prev.map(p => p.id === id ? ({ ...p, verified: 1, verify_requested: 0 }) : p));
  }

  function startEdit(p: Player) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditNickname(p.nickname ?? '');
    setEditBirthday((p as { birthday?: string | null }).birthday ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditNickname('');
    setEditBirthday('');
  }

  async function handleSaveName(id: string) {
    if (!editName.trim()) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), nickname: editNickname.trim() || null, birthday: editBirthday || null }),
      });
      const updated = await res.json() as Player;
      setPlayers(prev => prev.map(p => p.id === id ? updated : p));
      setEditingId(null);
    } catch { /* silent */ }
    finally { setSavingId(null); }
  }

  async function handleSaveNickname(id: string) {
    setSavingNickId(id);
    try {
      const res = await fetch(`/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickDraft.trim() || null }),
      });
      const updated = await res.json() as Player;
      setPlayers(prev => prev.map(p => p.id === id ? updated : p));
      setNickEditId(null);
    } catch { /* silent */ }
    finally { setSavingNickId(null); }
  }

  function handleAvatarClick(playerId: string) {
    uploadTargetId.current = playerId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId.current) return;
    const id = uploadTargetId.current;
    setUploadingId(id);
    try {
      const b64 = await resizeImage(file);
      const res = await fetch(`/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_b64: b64 }),
      });
      const updated = await res.json() as Player;
      setPlayers(prev => prev.map(p => p.id === id ? updated : p));
    } catch { /* silent */ }
    finally { setUploadingId(null); e.target.value = ''; }
  }

  if (loading) return <div className="loading">Loading players…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <style>{`@keyframes goldShimmer { 0%{left:-100%} 60%{left:150%} 100%{left:150%} }`}</style>
      {/* Add Player Form */}
      <div className="card">
        <div className="form-label" style={{ marginBottom: '0.75rem' }}>Add New Player</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.625rem' }}>
          <input
            className="form-input"
            type="text"
            placeholder="Player name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={50}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ flexShrink: 0 }}>
            {adding ? '…' : 'Add'}
          </button>
        </form>
        {error && <div className="error-message" style={{ marginTop: '0.5rem' }}>{error}</div>}
      </div>

      {/* Player List */}
      {!players.length && (
        <div className="empty-state"><p>No players yet. Add your first player above!</p></div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {players.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', border: '1.5px solid rgba(212,175,55,0.45)', boxShadow: '0 0 14px rgba(212,175,55,0.1), inset 0 1px 0 rgba(212,175,55,0.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '2px', background: 'linear-gradient(90deg,transparent,rgba(212,175,55,0.9),rgba(255,255,255,0.6),rgba(212,175,55,0.9),transparent)', animation: 'goldShimmer 3.5s ease-in-out infinite' }} />
            <button
              type="button"
              onClick={() => handleAvatarClick(p.id)}
              style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              title="Upload photo"
            >
              {uploadingId === p.id
                ? <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', color: 'var(--text-muted)' }}>…</div>
                : <Avatar name={p.name} avatar_b64={p.avatar_b64} />
              }
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem' }}>📷</span>
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === p.id ? (
                <form onSubmit={e => { e.preventDefault(); handleSaveName(p.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <input
                    className="form-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    maxLength={50}
                    autoFocus
                    placeholder="Full name"
                    style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', minHeight: 'auto' }}
                  />
                  <input
                    className="form-input"
                    value={editNickname}
                    onChange={e => setEditNickname(e.target.value)}
                    maxLength={20}
                    placeholder="Nickname (optional)"
                    style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', minHeight: 'auto' }}
                  />
                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🎂 Birthday
                    <input
                      className="form-input"
                      type="date"
                      value={editBirthday}
                      onChange={e => setEditBirthday(e.target.value)}
                      max="2026-12-31"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', minHeight: 'auto', flex: 1 }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={savingId === p.id} style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', minHeight: 'auto' }}>
                      {savingId === p.id ? '…' : 'Save'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={cancelEdit} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', minHeight: 'auto' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 'clamp(0.82rem, 3.6vw, 1.1rem)', letterSpacing: '0.02em', color: '#F2F5FA', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                    {(p as { verified?: number }).verified ? <VerifiedBadge /> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                    {nickEditId === p.id ? (
                      <form onSubmit={e => { e.preventDefault(); handleSaveNickname(p.id); }} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input
                          autoFocus
                          className="form-input"
                          value={nickDraft}
                          onChange={e => setNickDraft(e.target.value)}
                          placeholder="Nickname"
                          maxLength={20}
                          style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', minHeight: 'auto', width: 100 }}
                        />
                        <button type="submit" className="btn btn-primary" disabled={savingNickId === p.id} style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem', minHeight: 'auto' }}>
                          {savingNickId === p.id ? '…' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setNickEditId(null)} style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem', minHeight: 'auto' }}>✕</button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setNickEditId(p.id); setNickDraft(p.nickname ?? ''); }}
                        style={{ background: 'none', border: p.nickname ? '1px dashed rgba(212,175,55,0.45)' : '1px dashed var(--border)', borderRadius: 4, padding: '0.1rem 0.4rem', cursor: 'pointer', fontSize: '0.6875rem', color: p.nickname ? 'var(--gold, #FFD700)' : 'var(--text-muted)', fontWeight: p.nickname ? 700 : 400, textTransform: p.nickname ? 'uppercase' : 'none', letterSpacing: p.nickname ? '0.03em' : 0 }}
                      >
                        {p.nickname ? `"${p.nickname}"` : '+ nickname'}
                      </button>
                    )}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Joined {new Date(p.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </>
              )}
            </div>

            {editingId !== p.id && (
              <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                {!(p as { verified?: number }).verified && (p as { verify_requested?: number }).verify_requested ? (
                  <button type="button" onClick={() => handleVerify(p.id)}
                    style={{ fontSize: '0.72rem', padding: '0.375rem 0.7rem', minHeight: 'auto', borderRadius: 6, border: '1px solid #D4AF37', background: 'rgba(212,175,55,0.14)', color: '#D4AF37', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    ✦ Verify
                  </button>
                ) : null}
                <a
                  href={`/players/${p.id}`}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center' }}
                >
                  Profile
                </a>
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', minHeight: 'auto' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeactivate(p.id)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', minHeight: 'auto' }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
