/* Greatest of All Time — a live composite ranking.
   Combines four earned metrics, each normalised across the eligible field, so the
   GOAT genuinely shifts as players win titles, rack up digus, and hold their rates:

     • League titles  — months finished #1 on the leaderboard   (weight 0.35)
     • Win rate       — matches won / played                     (weight 0.30)
     • Game %         — rounds won / rounds played               (weight 0.20)
     • Digus          — total gins                               (weight 0.15)

   A minimum-matches gate keeps a one-game wonder off the throne. Everything is
   derived from the same numbers the leaderboard uses — nothing is stored, so it
   updates the moment a match is recorded. */
import { computePlayerStats } from './db';
import type { PlayerStats } from './types';

/** Lightweight match row — just what monthly-title ranking needs. */
export interface TitleMatch { winner_id: string | null; player1_id: string; player2_id: string; team1_player2_id: string | null; team2_player2_id: string | null; started_at: string; }

/** Monthly champions computed IN MEMORY from matches (no per-month DB round-trips).
 *  Ranks each month by wins → win rate, matching the leaderboard. Returns titles
 *  per player + the champion of each month. This replaces N× computePlayerStats. */
export function monthlyTitles(matches: TitleMatch[]): { titles: Record<string, number>; champByMonth: Record<string, string>; months: string[] } {
  const byMonth = new Map<string, Map<string, { won: number; played: number }>>();
  for (const m of matches) {
    const ym = (m.started_at || '').slice(0, 7);
    if (!ym) continue;
    const t1Won = m.winner_id ? m.winner_id === m.player1_id : null;
    const tab = byMonth.get(ym) || byMonth.set(ym, new Map()).get(ym)!;
    const ids: [string | null, boolean][] = [[m.player1_id, true], [m.player2_id, false], [m.team1_player2_id, true], [m.team2_player2_id, false]];
    for (const [pid, on1] of ids) {
      if (!pid) continue;
      const e = tab.get(pid) || tab.set(pid, { won: 0, played: 0 }).get(pid)!;
      e.played++;
      if (t1Won !== null && on1 === t1Won) e.won++;
    }
  }
  const months = [...byMonth.keys()].sort();
  const titles: Record<string, number> = {}; const champByMonth: Record<string, string> = {};
  for (const ym of months) {
    const ranked = [...byMonth.get(ym)!.entries()]
      .map(([id, s]) => ({ id, won: s.won, rate: s.played ? s.won / s.played : 0 }))
      .sort((a, b) => b.won - a.won || b.rate - a.rate);
    const champ = ranked[0];
    if (champ && champ.won > 0) { titles[champ.id] = (titles[champ.id] || 0) + 1; champByMonth[ym] = champ.id; }
  }
  return { titles, champByMonth, months };
}

export interface GoatRow {
  playerId: string; name: string; nickname: string | null; avatar_b64: string | null;
  titles: number; winRate: number; gamePct: number; digus: number;
  played: number; won: number; score: number; rank: number;
}

const WEIGHTS = { titles: 0.35, winRate: 0.30, gamePct: 0.20, digus: 0.15 };
const MIN_MATCHES = 8; // below this, a player is ranked but can't realistically top

export async function computeGOAT(
  db: D1Database,
  shared?: { allStats?: PlayerStats[]; titles?: Record<string, number> },
): Promise<{ goat: GoatRow | null; board: GoatRow[]; totalTitles: number }> {
  // All-time stats — reuse the caller's if provided (records page shares one).
  const all = shared?.allStats ?? await computePlayerStats(db);

  // League titles — reuse the caller's, or compute in ONE lightweight matches
  // fetch (was N× computePlayerStats, one per month).
  let titles = shared?.titles;
  if (!titles) {
    const mres = await db.prepare(
      `SELECT winner_id, player1_id, player2_id, team1_player2_id, team2_player2_id, started_at
         FROM matches WHERE is_classic = 0 AND completed_at IS NOT NULL AND started_at IS NOT NULL`,
    ).all<TitleMatch>();
    titles = monthlyTitles(mres.results || []).titles;
  }
  const totalTitles = Object.values(titles).reduce((a, b) => a + b, 0);

  // Assemble raw rows (only players who have actually played).
  const raw = all
    .filter(s => s.matches_played > 0)
    .map(s => ({
      playerId: s.player_id, name: s.name, nickname: s.nickname, avatar_b64: s.avatar_b64,
      titles: titles[s.player_id] || 0,
      winRate: s.win_rate,
      gamePct: s.games_played > 0 ? Math.round((s.games_won / s.games_played) * 1000) / 10 : 0,
      digus: s.gin_count,
      played: s.matches_played, won: s.matches_won,
    }));

  // Normalise each metric to the field max, then weight. A player under the match
  // gate keeps their metrics but takes a proportional penalty so they can't leapfrog
  // a proven player on a tiny sample.
  const max = (sel: (r: typeof raw[0]) => number) => Math.max(1, ...raw.map(sel));
  const mTitles = max(r => r.titles), mWin = max(r => r.winRate), mGame = max(r => r.gamePct), mDig = max(r => r.digus);

  const board: GoatRow[] = raw.map(r => {
    const gate = Math.min(1, r.played / MIN_MATCHES);
    const score = (
      WEIGHTS.titles * (r.titles / mTitles) +
      WEIGHTS.winRate * (r.winRate / mWin) +
      WEIGHTS.gamePct * (r.gamePct / mGame) +
      WEIGHTS.digus * (r.digus / mDig)
    ) * 100 * gate;
    return { ...r, score: Math.round(score * 10) / 10, rank: 0 };
  }).sort((a, b) => b.score - a.score || b.titles - a.titles || b.winRate - a.winRate);

  board.forEach((r, i) => { r.rank = i + 1; });
  return { goat: board[0] || null, board, totalTitles };
}
