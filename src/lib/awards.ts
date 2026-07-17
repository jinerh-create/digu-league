/* Special Annual Awards — definitions + data access.
   House rule (same as the Digu King badge): awards are MANUALLY assigned by an
   admin, never auto-assigned. Where the match data can genuinely rank players,
   we compute a *suggestion* the admin can accept with one click — and we only
   suggest for awards the data can actually measure. Subjective honours
   (Sportsmanship, Fan Favorite, Tactical…) get no fake suggestion. */
import { getPlayerForm } from './db';

export interface AwardDef {
  key: string; emoji: string; name: string; desc: string;
  /** which computed suggestion applies, if any */
  suggest?: 'champion' | 'streak' | 'active' | 'improved' | 'fastest' | 'comeback';
}

export const AWARD_DEFS: AwardDef[] = [
  { key: 'champion',      emoji: '🏆', name: 'Champion of the Year',        desc: 'The player who ended the year on top of the league.', suggest: 'champion' },
  { key: 'digu-king',     emoji: '👑', name: 'Digu King',                   desc: 'The crown. The table knows who wore it.' },
  { key: 'mvp',           emoji: '⭐', name: 'Most Valuable Player',        desc: 'The player the league could not have done without.' },
  { key: 'win-streak',    emoji: '🔥', name: 'Best Win Streak',             desc: 'The longest unbroken run of wins this year.', suggest: 'streak' },
  { key: 'fastest-win',   emoji: '⚡', name: 'Fastest Match Winner',        desc: 'Shortest completed match win of the year.', suggest: 'fastest' },
  { key: 'tactical',      emoji: '🎯', name: 'Best Tactical Player',        desc: 'Knock timing, discard reading, cold-blooded decisions.' },
  { key: 'defensive',     emoji: '🛡️', name: 'Best Defensive Player',       desc: 'Hardest player to score against all year.' },
  { key: 'comeback',      emoji: '💪', name: 'Comeback Player of the Year', desc: 'Fell the furthest, climbed the highest.', suggest: 'comeback' },
  { key: 'sportsmanship', emoji: '🤝', name: 'Sportsmanship Award',         desc: 'Played hard, played fair, kept the table honest.' },
  { key: 'rookie',        emoji: '🌟', name: 'Rookie of the Year',          desc: 'Best first-year player in the league.' },
  { key: 'club',          emoji: '🎖️', name: 'Club of the Year',            desc: 'The venue, crew or club that carried the season.' },
  { key: 'fan-favorite',  emoji: '❤️', name: 'Fan Favorite Player',         desc: 'The one everyone comes to watch.' },
  { key: 'improved',      emoji: '📈', name: 'Most Improved Player',        desc: 'Biggest form climb from the first half of the year to the second.', suggest: 'improved' },
  { key: 'active',        emoji: '🎲', name: 'Most Active Player',          desc: 'Most league matches played this year.', suggest: 'active' },
  { key: 'lifetime',      emoji: '💎', name: 'Lifetime Achievement Award',  desc: 'For everything, across every season.' },
];

export interface AwardRow { id: string; year: number; award_key: string; player_id: string | null; recipient_name: string | null; note: string | null; awarded_at: string; player_name?: string; player_nickname?: string; }

export async function getAwards(db: D1Database, year: number): Promise<AwardRow[]> {
  const res = await db.prepare(
    `SELECT a.*, p.name AS player_name, p.nickname AS player_nickname
       FROM awards a LEFT JOIN players p ON p.id = a.player_id
      WHERE a.year = ?`,
  ).bind(year).all<AwardRow>();
  return res.results || [];
}

export async function setAward(db: D1Database, year: number, key: string, playerId: string | null, recipientName: string | null, note: string | null) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO awards (id, year, award_key, player_id, recipient_name, note, awarded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(year, award_key) DO UPDATE SET
       player_id = excluded.player_id, recipient_name = excluded.recipient_name,
       note = excluded.note, awarded_at = excluded.awarded_at`,
  ).bind(id, year, key, playerId, recipientName, note, new Date().toISOString()).run();
}

export async function removeAward(db: D1Database, year: number, key: string) {
  await db.prepare(`DELETE FROM awards WHERE year = ? AND award_key = ?`).bind(year, key).run();
}

export interface Suggestion { playerId: string; name: string; detail: string; }

/** Data-backed suggestions for the year. Only for awards the data can measure. */
export async function computeSuggestions(db: D1Database, year: number): Promise<Record<string, Suggestion>> {
  const out: Record<string, Suggestion> = {};

  // Form-based: champion / streak / active / improved / comeback — reuse the
  // team-aware win logic in getPlayerForm rather than re-deriving it.
  const { series } = await getPlayerForm(db, 9999, { activeOnly: false });
  const inYear = (at: string) => at.startsWith(String(year));
  type YearAgg = { id: string; name: string; played: number; final: number; bestWin: number; firstHalf: number; secondHalf: number; low: number; };
  const aggs: YearAgg[] = [];
  for (const p of series) {
    const pts = p.points.filter(pt => inYear(pt.at));
    if (!pts.length) continue;
    let final = 0, best = 0, cur = 0, low = 0;
    const half = Math.ceil(pts.length / 2);
    let firstHalf = 0, secondHalf = 0;
    pts.forEach((pt, i) => {
      const d = pt.r === 'W' ? 1 : pt.r === 'L' ? -1 : 0;
      final += d;
      cur = pt.r === 'W' ? cur + 1 : 0;
      best = Math.max(best, cur);
      low = Math.min(low, final);
      if (i < half) firstHalf += d; else secondHalf += d;
    });
    aggs.push({ id: p.id, name: p.name, played: pts.length, final, bestWin: best, firstHalf, secondHalf, low });
  }
  const top = <T,>(arr: T[], score: (x: T) => number) =>
    arr.reduce<T | null>((a, b) => (a === null || score(b) > score(a) ? b : a), null);

  const champ = top(aggs, a => a.final);
  if (champ && champ.final > 0) out['champion'] = { playerId: champ.id, name: champ.name, detail: `+${champ.final} net wins in ${year}` };

  const streak = top(aggs, a => a.bestWin);
  if (streak && streak.bestWin >= 2) out['win-streak'] = { playerId: streak.id, name: streak.name, detail: `${streak.bestWin} wins in a row` };

  const active = top(aggs, a => a.played);
  if (active) out['active'] = { playerId: active.id, name: active.name, detail: `${active.played} matches played` };

  const improved = top(aggs.filter(a => a.played >= 6), a => a.secondHalf - a.firstHalf);
  if (improved && improved.secondHalf > improved.firstHalf)
    out['improved'] = { playerId: improved.id, name: improved.name, detail: `${improved.firstHalf >= 0 ? '+' : ''}${improved.firstHalf} first half → ${improved.secondHalf >= 0 ? '+' : ''}${improved.secondHalf} second half` };

  const comeback = top(aggs.filter(a => a.low <= -2), a => a.final - a.low);
  if (comeback && comeback.final - comeback.low >= 4)
    out['comeback'] = { playerId: comeback.id, name: comeback.name, detail: `climbed ${comeback.final - comeback.low} from ${comeback.low}` };

  // Fastest match win — real timestamps, winner's side credited (team-aware).
  const fast = await db.prepare(
    `SELECT m.winner_id, m.player1_id, m.team1_player2_id, m.player2_id, m.team2_player2_id,
            pw.name AS wname, pw.nickname AS wnick,
            (julianday(m.completed_at) - julianday(m.started_at)) * 24 * 60 AS mins
       FROM matches m JOIN players pw ON pw.id = m.winner_id
      WHERE m.is_classic = 0 AND m.completed_at IS NOT NULL AND m.winner_id IS NOT NULL
        AND m.started_at LIKE ? AND (julianday(m.completed_at) - julianday(m.started_at)) * 24 * 60 > 3
      ORDER BY mins ASC LIMIT 1`,
  ).bind(`${year}%`).first<any>();
  if (fast) out['fastest-win'] = { playerId: fast.winner_id, name: fast.wnick || (fast.wname || '').split(' ')[0], detail: `won a match in ${Math.round(fast.mins)} min` };

  return out;
}
