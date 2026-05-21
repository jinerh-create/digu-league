import { useState, useEffect } from 'react';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function nick(name: string, nickname?: string) { return nickname || name.split(' ')[0]; }

type RecordCard = { icon: string; title: string; value: string; sub: string; matchId?: string };

export default function RecordsBoard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/records').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="loading">Loading records…</div>;
  if (!data) return null;

  const { highestHand, mostDigu, highestMatchScore, mostMatches, biggestWin } = data;

  const cards: RecordCard[] = [
    {
      icon: '⚡',
      title: 'Highest Single Hand',
      value: highestHand ? `${highestHand.score_awarded} pts` : '—',
      sub: highestHand ? `${nick(highestHand.winner_name, highestHand.winner_nick)} · ${fmt(highestHand.started_at)}` : '',
      matchId: highestHand?.match_id,
    },
    {
      icon: '🃏',
      title: 'Most Digu in a Match',
      value: mostDigu ? `${mostDigu.cnt} digus` : '—',
      sub: mostDigu ? `${nick(mostDigu.player_name, mostDigu.player_nick)} · ${fmt(mostDigu.started_at)}` : '',
      matchId: mostDigu?.match_id,
    },
    {
      icon: '🏆',
      title: 'Highest Match Score',
      value: highestMatchScore ? `${highestMatchScore.total} pts` : '—',
      sub: highestMatchScore ? `${nick(highestMatchScore.winner_name, highestMatchScore.winner_nick)} · ${fmt(highestMatchScore.started_at)}` : '',
      matchId: highestMatchScore?.match_id,
    },
    {
      icon: '🎯',
      title: 'Most Matches Played',
      value: mostMatches ? `${mostMatches.cnt} matches` : '—',
      sub: mostMatches ? nick(mostMatches.name, mostMatches.nickname) : '',
    },
    {
      icon: '💥',
      title: 'Biggest Winning Margin',
      value: biggestWin ? `${Math.abs(biggestWin.t1 - biggestWin.t2)} pts` : '—',
      sub: biggestWin
        ? `${nick(biggestWin.p1_name, biggestWin.p1_nick)} vs ${nick(biggestWin.p2_name, biggestWin.p2_nick)} · ${fmt(biggestWin.started_at)}`
        : '',
      matchId: biggestWin?.match_id,
    },
  ];

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {cards.map(c => (
          <div key={c.title} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '2rem', lineHeight: 1 }}>{c.icon}</div>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{c.title}</div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gold)', letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>{c.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.sub}</div>
            {c.matchId && (
              <a href={`/scoresheet/${c.matchId}`} style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.6875rem', color: 'var(--felt-light)', textDecoration: 'none' }}>
                View scoresheet →
              </a>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href="/h2h" className="btn btn-secondary" style={{ marginRight: '0.75rem' }}>⚔ Head to Head</a>
        <a href="/leaderboard" className="btn btn-secondary">← Rankings</a>
      </div>
    </div>
  );
}
