import { useState } from 'react';

/* Shown on an unverified player's profile. Any signed-in viewer can request
   verification (it only raises a flag); an admin approves it from the Players
   admin page. Grandfathered players never see this. */
export default function VerifyControl({ playerId, requested }: { playerId: string; requested: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>(requested ? 'done' : 'idle');

  async function request() {
    setState('sending');
    const r = await fetch('/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, action: 'request' }),
    });
    setState(r.ok ? 'done' : 'idle');
  }

  if (state === 'done') {
    return (
      <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#D4AF37', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        ⏳ Verification requested — awaiting an admin
      </div>
    );
  }
  return (
    <button onClick={request} disabled={state === 'sending'}
      style={{ marginTop: '0.5rem', padding: '0.3rem 0.7rem', borderRadius: 8, border: '1px solid rgba(212,175,55,0.6)', background: 'transparent', color: '#D4AF37', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', opacity: state === 'sending' ? 0.6 : 1 }}>
      {state === 'sending' ? 'Sending…' : '✦ Request verification'}
    </button>
  );
}
