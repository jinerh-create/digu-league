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

export interface GoatRow {
  playerId: string; name: string; nickname: string | null; avatar_b64: string | null;
  titles: number; winRate: number; gamePct: number; digus: number;
  played: number; won: number; score: number; rank: number;
}

const WEIGHTS = { titles: 0.35, winRate: 0.30, gamePct: 0.20, digus: 0.15 };
const MIN_MATCHES = 8; // below this, a player is ranked but can't realistically top

export async function computeGOAT(db: D1Database): Promise<{ goat: GoatRow | null; board: GoatRow[]; totalTitles: number }> {
  // All-time stats (no month filter).
  const all = await computePlayerStats(db);

  // League titles: the #1 player of each completed month, using the SAME ranking
  // the leaderboard applies (wins → win rate → points).
  const monthsRes = await db.prepare(
    `SELECT DISTINCT strftime('%Y-%m', started_at) AS ym
       FROM matches WHERE completed_at IS NOT NULL AND is_classic = 0 AND started_at IS NOT NULL
      ORDER BY ym`,
  ).all<{ ym: string }>();
  const months = (monthsRes.results || []).map(r => r.ym).filter(Boolean);

  const titles: Record<string, number> = {};
  for (const ym of months) {
    const monthStats = await computePlayerStats(db, ym);
    const ranked = monthStats
      .filter(s => s.matches_played > 0)
      .sort((a, b) =>
        b.matches_won - a.matches_won ||
        b.win_rate - a.win_rate ||
        b.total_points_scored - a.total_points_scored);
    const champ = ranked[0];
    if (champ && champ.matches_won > 0) titles[champ.player_id] = (titles[champ.player_id] || 0) + 1;
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
