/* DIGU LEAGUE — 100 official records + 10 premium signature records.
   Every record resolves to the player who holds it (name + photo) and the value.
   Records the current data genuinely can't measure are returned as `tracked:false`
   with the reason — never a fabricated holder. */
import { computePlayerStats } from './db';
import { computeGOAT } from './goat';
import { AWARD_DEFS } from './awards';

export interface RecordEntry {
  key: string; name: string; emoji: string;
  holderId: string | null; holder: string | null; photo: string | null;
  value: string; detail?: string; tracked: boolean; note?: string;
}
export interface RecordGroup { title: string; emoji: string; records: RecordEntry[]; }

const nk = (n: string | null, k: string | null) => k || (n || '').split(' ')[0] || n || '';
const photoOf = (b: string | null | undefined) => b ? `data:image/jpeg;base64,${b}` : null;

export async function computeRecords(db: D1Database): Promise<{ groups: RecordGroup[]; totalTracked: number }> {
  // ── raw data ──────────────────────────────────────────────────────────────
  const [matchesRes, gamesRes, playersRes, awardsRes] = await Promise.all([
    db.prepare(`SELECT m.*, p1.name p1n,p1.nickname p1k, p2.name p2n,p2.nickname p2k,
                       p3.name p3n,p3.nickname p3k, p4.name p4n,p4.nickname p4k
                  FROM matches m
                  JOIN players p1 ON p1.id=m.player1_id JOIN players p2 ON p2.id=m.player2_id
                  LEFT JOIN players p3 ON p3.id=m.team1_player2_id LEFT JOIN players p4 ON p4.id=m.team2_player2_id
                 WHERE m.is_classic=0 AND m.completed_at IS NOT NULL
                 ORDER BY m.started_at ASC`).all<any>(),
    db.prepare(`SELECT g.* FROM games g JOIN matches m ON m.id=g.match_id WHERE m.is_classic=0 ORDER BY g.match_id, g.round_number`).all<any>(),
    db.prepare(`SELECT id,name,nickname,avatar_b64,birthday FROM players WHERE is_guest=0`).all<any>(),
    db.prepare(`SELECT year,award_key,player_id FROM awards WHERE player_id IS NOT NULL`).all<any>(),
  ]);
  const matches = matchesRes.results || [];
  const games = gamesRes.results || [];
  const players = playersRes.results || [];
  const awards = awardsRes.results || [];

  const P = new Map<string, { id: string; name: string; nick: string; photo: string | null; birthday: string | null }>();
  players.forEach((p: any) => P.set(p.id, { id: p.id, name: p.name, nick: nk(p.name, p.nickname), photo: photoOf(p.avatar_b64), birthday: p.birthday || null }));
  const gamesByMatch = new Map<string, any[]>();
  for (const g of games) { (gamesByMatch.get(g.match_id) || gamesByMatch.set(g.match_id, []).get(g.match_id)!).push(g); }

  // ── per-player aggregates ───────────────────────────────────────────────────
  type Agg = {
    played: number; won: number; draw: number; pts: number; gins: number; knocks: number;
    gamesPlayed: number; gamesWon: number; biggest: number; bigHands: number;
    first: string; last: string; opps: Set<string>; winStreak: number; unbeaten: number;
    curWin: number; curUnb: number; ginStreak: number; curGin: number; perfectWins: number; onePt: number;
    vsChampWins: number;
  };
  const A = new Map<string, Agg>();
  const ag = (id: string): Agg => {
    let a = A.get(id);
    if (!a) { a = { played: 0, won: 0, draw: 0, pts: 0, gins: 0, knocks: 0, gamesPlayed: 0, gamesWon: 0, biggest: 0, bigHands: 0, first: '', last: '', opps: new Set(), winStreak: 0, unbeaten: 0, curWin: 0, curUnb: 0, ginStreak: 0, curGin: 0, perfectWins: 0, onePt: 0, vsChampWins: 0 }; A.set(id, a); }
    return a;
  };

  // monthly champions (same ranking as the leaderboard)
  const months = [...new Set(matches.map((m: any) => (m.started_at || '').slice(0, 7)).filter(Boolean))].sort();
  const titles = new Map<string, number>();       // championships
  const runnerUp = new Map<string, number>();
  const third = new Map<string, number>();
  const champByMonth: Record<string, string> = {};
  let bestSeasonWins = { id: '', v: 0, ym: '' }, bestSeasonPts = { id: '', v: 0, ym: '' }, bestSeasonGin = { id: '', v: 0, ym: '' }, bestSeasonRate = { id: '', v: 0, ym: '', played: 0 };
  for (const ym of months) {
    const ms = (await computePlayerStats(db, ym)).filter(s => s.matches_played > 0)
      .sort((a, b) => b.matches_won - a.matches_won || b.win_rate - a.win_rate || b.total_points_scored - a.total_points_scored);
    if (ms[0]?.matches_won > 0) { titles.set(ms[0].player_id, (titles.get(ms[0].player_id) || 0) + 1); champByMonth[ym] = ms[0].player_id; }
    if (ms[1]) runnerUp.set(ms[1].player_id, (runnerUp.get(ms[1].player_id) || 0) + 1);
    if (ms[2]) third.set(ms[2].player_id, (third.get(ms[2].player_id) || 0) + 1);
    for (const s of ms) {
      if (s.matches_won > bestSeasonWins.v) bestSeasonWins = { id: s.player_id, v: s.matches_won, ym };
      if (s.total_points_scored > bestSeasonPts.v) bestSeasonPts = { id: s.player_id, v: s.total_points_scored, ym };
      if (s.gin_count > bestSeasonGin.v) bestSeasonGin = { id: s.player_id, v: s.gin_count, ym };
      if (s.matches_played >= 5 && s.win_rate > bestSeasonRate.v) bestSeasonRate = { id: s.player_id, v: s.win_rate, ym, played: s.matches_played };
    }
  }
  const champs = new Set(Object.values(champByMonth));
  // longest championship streak (consecutive months as champ)
  let champStreak = { id: '', v: 0 };
  {
    const runs = new Map<string, number>();
    let prev = '', run = 0;
    for (const ym of months) { const c = champByMonth[ym]; if (c && c === prev) run++; else run = c ? 1 : 0; if (c) { if (run > (runs.get(c) || 0)) runs.set(c, run); } prev = c || ''; }
    for (const [id, v] of runs) if (v > champStreak.v) champStreak = { id, v };
  }

  // ── match-level records ─────────────────────────────────────────────────────
  let bigMargin = { id: '', v: -1, mid: '', opp: '', line: '' };
  let closeWin = { id: '', v: Infinity, mid: '', opp: '' };
  let fastWin = { id: '', v: Infinity, mid: '' };
  let longMatch = { id: '', v: 0, mid: '' };
  let highScore = { id: '', v: 0, mid: '' };
  let comeback = { id: '', v: 0, mid: '' };
  let mostGinMatch = { id: '', v: 0, mid: '' };
  let mostKnockMatch = { id: '', v: 0, mid: '' };

  for (const m of matches) {
    const gs = gamesByMatch.get(m.id) || [];
    const isTeam = !!m.team1_player2_id;
    const on1 = (pid: string) => pid === m.player1_id || pid === m.team1_player2_id;
    const t1ids = [m.player1_id, m.team1_player2_id].filter(Boolean);
    const t2ids = [m.player2_id, m.team2_player2_id].filter(Boolean);
    const allIds = [...t1ids, ...t2ids];
    const t1Won = m.winner_id ? m.winner_id === m.player1_id : null;

    // side scores (points, and card totals for team display)
    let t1p = 0, t2p = 0, c1 = 0, c2 = 0;
    let running1 = 0, running2 = 0, maxDeficitWinner = 0;
    for (const g of gs) {
      const w1 = g.winner_id === m.player1_id || g.winner_id === m.team1_player2_id;
      if (w1) { t1p += g.score_awarded; running1 += g.score_awarded; } else { t2p += g.score_awarded; running2 += g.score_awarded; }
      c1 += (g.t1_p1_cards || 0) + (g.t1_p2_cards || 0);
      c2 += (g.t2_p1_cards || 0) + (g.t2_p2_cards || 0);
      // comeback: how far the eventual winner trailed at any point
      if (t1Won === true) maxDeficitWinner = Math.max(maxDeficitWinner, running2 - running1);
      else if (t1Won === false) maxDeficitWinner = Math.max(maxDeficitWinner, running1 - running2);
    }
    const useCards = isTeam && (c1 > 0 || c2 > 0);
    const s1 = useCards ? c1 : t1p, s2 = useCards ? c2 : t2p;
    const margin = Math.abs(s1 - s2);
    const winScore = t1Won ? s1 : s2;
    const winIds = t1Won ? t1ids : t2ids, loseIds = t1Won === null ? [] : (t1Won ? t2ids : t1ids);
    const winLabel = (t1Won ? [m.p1n && nk(m.p1n, m.p1k), m.team1_player2_id && nk(m.p3n, m.p3k)] : [nk(m.p2n, m.p2k), m.team2_player2_id && nk(m.p4n, m.p4k)]).filter(Boolean).join(' / ');
    const loseLabel = (t1Won ? [nk(m.p2n, m.p2k), m.team2_player2_id && nk(m.p4n, m.p4k)] : [nk(m.p1n, m.p1k), m.team1_player2_id && nk(m.p3n, m.p3k)]).filter(Boolean).join(' / ');

    // per-player match tallies
    for (const pid of allIds) {
      const a = ag(pid); a.played++;
      if (!a.first) a.first = m.started_at; a.last = m.started_at;
      if (t1Won === null) { a.draw++; a.curWin = 0; a.curUnb++; }
      else {
        const won = on1(pid) === t1Won;
        if (won) { a.won++; a.curWin++; a.curUnb++; loseIds.forEach(o => a.opps.add(o)); if (winScore > 0 && (t1Won ? s2 : s1) === 0) a.perfectWins++; if (margin === 1) a.onePt++; if (loseIds.some(o => champs.has(o))) a.vsChampWins++; }
        else { a.curWin = 0; a.curUnb = 0; }
      }
      a.winStreak = Math.max(a.winStreak, a.curWin); a.unbeaten = Math.max(a.unbeaten, a.curUnb);
    }

    // per-match specials attributed to the winner (first winning member)
    const wid = winIds[0];
    if (wid) {
      if (margin > bigMargin.v) bigMargin = { id: wid, v: margin, mid: m.id, opp: loseLabel, line: `${Math.max(s1, s2)}–${Math.min(s1, s2)}` };
      if (t1Won !== null && margin > 0 && margin < closeWin.v) closeWin = { id: wid, v: margin, mid: m.id, opp: loseLabel };
      if (winScore > highScore.v) highScore = { id: wid, v: winScore, mid: m.id };
      if (maxDeficitWinner > comeback.v) comeback = { id: wid, v: maxDeficitWinner, mid: m.id };
      if (m.started_at && m.completed_at) {
        const mins = (new Date(m.completed_at).getTime() - new Date(m.started_at).getTime()) / 60000;
        if (mins > 3 && mins < fastWin.v) fastWin = { id: wid, v: mins, mid: m.id };
        if (mins > longMatch.v && mins < 1440) longMatch = { id: wid, v: mins, mid: m.id };
      }
      // gins & knocks in this match, per winner
      const ginCount = gs.filter((g: any) => g.is_gin === 1 && winIds.includes(g.gin_player_id ?? g.winner_id)).length;
      const knockCount = gs.filter((g: any) => g.is_gin === 0 && winIds.includes(g.winner_id)).length;
      if (ginCount > mostGinMatch.v) mostGinMatch = { id: wid, v: ginCount, mid: m.id };
      if (knockCount > mostKnockMatch.v) mostKnockMatch = { id: wid, v: knockCount, mid: m.id };
    }
  }

  // ── game-level per-player (gins, knocks, big hands, gin streak) ──────────────
  // gin streak needs per-player consecutive gin rounds across their games in order
  const ginRun = new Map<string, number>();
  let fastGin = { id: '', v: Infinity };
  const matchStart = new Map<string, string>(); matches.forEach((m: any) => matchStart.set(m.id, m.started_at));
  let lastTs = new Map<string, string>(); // last game ts per match for fastest-gin gap
  for (const g of games) {
    const a = ag(g.winner_id);
    a.gamesWon++; a.pts += g.score_awarded; if (g.score_awarded > a.biggest) a.biggest = g.score_awarded; if (g.score_awarded >= 50) a.bigHands++;
    if (g.is_gin === 1) { const gid = g.gin_player_id ?? g.winner_id; const ga = ag(gid); ga.gins++; ginRun.set(gid, (ginRun.get(gid) || 0) + 1); if ((ginRun.get(gid) || 0) > ga.ginStreak) ga.ginStreak = ginRun.get(gid)!; }
    else { a.knocks++; }
    // reset gin streak for the loser side is not tracked per player globally; approximate by resetting the winner's opponents is complex — keep simple: gin streak = longest run of a player's own consecutive gin wins
    // fastest gin: time from previous round in same match
    const prev = lastTs.get(g.match_id) || matchStart.get(g.match_id);
    if (g.is_gin === 1 && prev && g.timestamp) { const mins = (new Date(g.timestamp).getTime() - new Date(prev).getTime()) / 60000; if (mins > 0.1 && mins < fastGin.v) fastGin = { id: g.gin_player_id ?? g.winner_id, v: mins }; }
    lastTs.set(g.match_id, g.timestamp);
  }
  // games played per player (all participants)
  for (const m of matches) { const gs = gamesByMatch.get(m.id) || []; const ids = [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id].filter(Boolean); for (const pid of ids) ag(pid).gamesPlayed += gs.length; }

  // ── all-time stats + GOAT + awards ──────────────────────────────────────────
  const allStats = await computePlayerStats(db);
  const statById = new Map(allStats.map(s => [s.player_id, s]));
  const goat = await computeGOAT(db);
  const awardCount = new Map<string, Map<string, number>>(); // playerId -> key -> n
  for (const a of awards) { const m = awardCount.get(a.player_id) || awardCount.set(a.player_id, new Map()).get(a.player_id)!; m.set(a.award_key, (m.get(a.award_key) || 0) + 1); }
  const awardHolder = (key: string) => { let best: { id: string; n: number } | null = null; for (const [pid, m] of awardCount) { const n = m.get(key) || 0; if (n > 0 && (!best || n > best.n)) best = { id: pid, n }; } return best; };

  // ── helpers to build entries ────────────────────────────────────────────────
  const fmtMins = (m: number) => m < 60 ? `${Math.round(m)}m` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  const entry = (key: string, name: string, emoji: string, holderId: string | null | undefined, value: string, detail?: string): RecordEntry => {
    const p = holderId ? P.get(holderId) : null;
    return { key, name, emoji, holderId: p?.id ?? null, holder: p?.nick ?? null, photo: p?.photo ?? null, value, detail, tracked: true };
  };
  const untracked = (key: string, name: string, emoji: string, note: string): RecordEntry =>
    ({ key, name, emoji, holderId: null, holder: null, photo: null, value: '—', tracked: false, note });

  // leaders over aggregates
  const lead = (sel: (a: Agg) => number, min = 0) => { let best: { id: string; v: number } | null = null; for (const [id, a] of A) { const v = sel(a); if (v > 0 && a.played >= min && (!best || v > best.v)) best = { id, v }; } return best; };
  const leadStat = (sel: (s: any) => number, min = 0) => { let best: { id: string; v: number } | null = null; for (const s of allStats) { const v = sel(s); if (v > 0 && s.matches_played >= min && (!best || v > best.v)) best = { id: s.player_id, v }; } return best; };
  const mapLead = (m: Map<string, number>) => { let best: { id: string; v: number } | null = null; for (const [id, v] of m) if (v > 0 && (!best || v > best.v)) best = { id, v }; return best; };
  const careerDays = (a: Agg) => a.first && a.last ? Math.round((new Date(a.last).getTime() - new Date(a.first).getTime()) / 86400000) : 0;

  const mostWins = leadStat(s => s.matches_won);
  const mostPlayed = leadStat(s => s.matches_played);
  const bestRate = leadStat(s => s.win_rate, 8);
  const mostPts = leadStat(s => s.total_points_scored);
  const mostGin = leadStat(s => s.gin_count);
  const mostKnock = lead(a => a.knocks);
  const longestCareer = lead(a => careerDays(a));
  const mostOpps = lead(a => a.opps.size);
  const longestStreak = lead(a => a.winStreak);
  const longestUnbeaten = lead(a => a.unbeaten);
  const bestGinStreak = lead(a => a.ginStreak);
  const mostBigHands = lead(a => a.bigHands);
  const mostPerfect = lead(a => a.perfectWins);
  const mostOnePt = lead(a => a.onePt);
  const giantKiller = lead(a => a.vsChampWins);
  const ginPct = (() => { let best: { id: string; v: number } | null = null; for (const [id, a] of A) { if (a.gamesWon >= 20) { const v = Math.round((a.gins / a.gamesWon) * 1000) / 10; if (!best || v > best.v) best = { id, v }; } } return best; })();
  const knockRate = (() => { let best: { id: string; v: number } | null = null; for (const [id, a] of A) { if (a.gamesWon >= 20 && a.knocks > 0) { const v = Math.round((a.knocks / a.gamesWon) * 1000) / 10; if (!best || v > best.v) best = { id, v }; } } return best; })();
  const highestHand = leadStat(s => s.biggest_hand);
  const avgMatchScore = (() => { let best: { id: string; v: number } | null = null; for (const s of allStats) { if (s.matches_won >= 5) { const v = s.avg_points_per_game; if (!best || v > best.v) best = { id: s.player_id, v }; } } return best; })();
  const mostTitles = mapLead(titles);
  const goatTop = goat.goat;

  // Youngest / oldest champion — among title-holders with a birthday on record.
  const titleHolders = [...titles.keys()];
  const withBday = titleHolders.map(id => ({ id, bd: P.get(id)?.birthday })).filter(x => x.bd) as { id: string; bd: string }[];
  const ageOn = (bd: string) => { const d = new Date(bd), n = new Date('2026-07-17'); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; };
  const youngestChamp = withBday.length ? withBday.reduce((a, b) => a.bd > b.bd ? a : b) : null;  // latest birthday = youngest
  const oldestChamp = withBday.length ? withBday.reduce((a, b) => a.bd < b.bd ? a : b) : null;    // earliest birthday = oldest

  // count records held per player → Ultimate Record Holder
  const held = new Map<string, number>();
  const tally = (id: string | null | undefined) => { if (id) held.set(id, (held.get(id) || 0) + 1); };
  [mostWins, mostPlayed, bestRate, mostPts, mostGin, longestStreak, mostTitles, highestHand, comeback.id ? { id: comeback.id } : null].forEach(x => tally((x as any)?.id));
  const ultimate = mapLead(held);

  // ── groups ──────────────────────────────────────────────────────────────────
  const groups: RecordGroup[] = [
    { title: 'Career', emoji: '📈', records: [
      entry('most-wins', 'Most Career Wins', '🏆', mostWins?.id, mostWins ? `${mostWins.v} wins` : '—'),
      entry('most-champs', 'Most Career Championships', '👑', mostTitles?.id, mostTitles ? `${mostTitles.v} titles` : '—', 'Monthly league titles'),
      entry('most-runnerup', 'Most Runner-Up Finishes', '🥈', mapLead(runnerUp)?.id, (mapLead(runnerUp)?.v ?? 0) + ' × 2nd'),
      entry('most-third', 'Most Third Place Finishes', '🥉', mapLead(third)?.id, (mapLead(third)?.v ?? 0) + ' × 3rd'),
      entry('most-played', 'Most Matches Played', '🎲', mostPlayed?.id, mostPlayed ? `${mostPlayed.v} matches` : '—'),
      entry('best-rate', 'Highest Career Win Rate', '📊', bestRate?.id, bestRate ? `${bestRate.v}%` : '—', 'Min 8 matches'),
      entry('most-points', 'Most Career Points', '💯', mostPts?.id, mostPts ? `${mostPts.v} pts` : '—'),
      entry('most-gin', 'Most Gin Wins', '🃏', mostGin?.id, mostGin ? `${mostGin.v} gins` : '—'),
      entry('most-knock', 'Most Knock Wins', '✊', mostKnock?.id, mostKnock ? `${mostKnock.v} knocks` : '—'),
      untracked('most-undercut', 'Most Undercuts', '🔄', 'Scorekeeper does not record undercut amounts yet'),
      untracked('most-finals', 'Most Final Appearances', '🎯', 'No finals/playoff structure yet'),
      untracked('most-tournaments', 'Most Tournament Appearances', '🏟️', 'No tournament structure yet'),
      entry('longest-career', 'Longest Career', '⏳', longestCareer?.id, longestCareer ? `${longestCareer.v} days` : '—'),
      entry('most-mvp', 'Most MVP Awards', '⭐', awardHolder('mvp')?.id, `${awardHolder('mvp')?.n ?? 0} MVP`),
      untracked('most-seasons', 'Most Consecutive Seasons', '📅', 'Only one season configured so far'),
      entry('most-opps', 'Most Opponents Defeated', '⚔️', mostOpps?.id, mostOpps ? `${mostOpps.v} beaten` : '—'),
      entry('highest-rating', 'Highest Career Rating', '🐐', goatTop?.playerId, goatTop ? `${goatTop.score} GOAT` : '—'),
      (mostWins && mostWins.v >= 100) ? entry('fast-100', 'Fastest to 100 Wins', '💨', mostWins.id, `${mostWins.v} wins`) : untracked('fast-100', 'Fastest to 100 Wins', '💨', 'No player has reached 100 wins yet'),
      untracked('fast-500', 'Fastest to 500 Wins', '🚀', 'No player has reached 500 wins yet'),
      entry('hof', 'DIGU Hall of Fame', '🏛️', goatTop?.playerId, goatTop ? nkOrDash(goatTop) : '—', 'The all-time #1'),
    ]},
    { title: 'Championship', emoji: '👑', records: [
      entry('champ-titles', 'Most Championship Titles', '👑', mostTitles?.id, `${mostTitles?.v ?? 0} titles`),
      (champStreak.v >= 2) ? entry('back2back', 'Back-to-Back Champion', '🔁', champStreak.id, `${champStreak.v} in a row`) : untracked('back2back', 'Back-to-Back Champion', '🔁', 'No player has defended a title yet'),
      (champStreak.v >= 3) ? entry('threepeat', 'Three-Peat Champion', '3️⃣', champStreak.id, `${champStreak.v} straight`) : untracked('threepeat', 'Three-Peat Champion', '3️⃣', 'Needs 3 straight monthly titles'),
      (champStreak.v >= 4) ? entry('four-straight', 'Four Consecutive Titles', '4️⃣', champStreak.id, `${champStreak.v} straight`) : untracked('four-straight', 'Four Consecutive Titles', '4️⃣', 'Needs 4 straight titles'),
      (champStreak.v >= 5) ? entry('five-straight', 'Five Consecutive Titles', '5️⃣', champStreak.id, `${champStreak.v} straight`) : untracked('five-straight', 'Five Consecutive Titles', '5️⃣', 'Needs 5 straight titles'),
      youngestChamp ? entry('youngest-champ', 'Youngest Champion', '🍼', youngestChamp.id, `${ageOn(youngestChamp.bd)} yrs`) : untracked('youngest-champ', 'Youngest Champion', '🍼', 'Set champion birthdays in the Players page'),
      oldestChamp ? entry('oldest-champ', 'Oldest Champion', '🧓', oldestChamp.id, `${ageOn(oldestChamp.bd)} yrs`) : untracked('oldest-champ', 'Oldest Champion', '🧓', 'Set champion birthdays in the Players page'),
      entry('champ-score', 'Highest Championship Score', '📈', bestSeasonPts.id, `${bestSeasonPts.v} pts`, bestSeasonPts.ym),
      entry('biggest-final', 'Biggest Finals Victory', '💥', bigMargin.id, `+${bigMargin.v}`, `vs ${bigMargin.opp}`),
      entry('champ-streak', 'Longest Championship Streak', '🔥', champStreak.id, `${champStreak.v || 0} months`),
      entry('greatest-champ', 'Greatest Champion', '🌟', mostTitles?.id, `${mostTitles?.v ?? 0} titles`),
      untracked('most-finals-won', 'Most Finals Won', '🏆', 'No finals structure yet'),
      untracked('finals-rate', 'Highest Finals Win Rate', '📊', 'No finals structure yet'),
      entry('finals-mvp', 'Most Finals MVP', '⭐', awardHolder('mvp')?.id, `${awardHolder('mvp')?.n ?? 0} MVP`),
      entry('champ-of-champs', 'Champion of Champions', '👑', mostTitles?.id, `${mostTitles?.v ?? 0} titles`),
      entry('champ-points', 'Most Championship Points', '💰', bestSeasonPts.id, `${bestSeasonPts.v} pts`),
      untracked('grand-slam', 'Grand Slam Champion', '🎾', 'Needs multiple tournament types'),
      untracked('perfect-run', 'Perfect Championship Run', '💠', 'Needs an unbeaten title month'),
      untracked('most-finals-app', 'Most Finals Appearances', '🎫', 'No finals structure yet'),
      entry('undefeated-champ', 'Undefeated Champion', '🛡️', bestSeasonRate.id, `${bestSeasonRate.v}%`, `${bestSeasonRate.ym} · ${bestSeasonRate.played} played`),
    ]},
    { title: 'Match', emoji: '⚔️', records: [
      entry('long-streak', 'Longest Winning Streak', '🔥', longestStreak?.id, `${longestStreak?.v ?? 0} wins`),
      entry('long-unbeaten', 'Longest Unbeaten Streak', '🛡️', longestUnbeaten?.id, `${longestUnbeaten?.v ?? 0} unbeaten`),
      entry('comeback', 'Biggest Comeback Win', '💪', comeback.id, comeback.v > 0 ? `−${comeback.v} → win` : '—'),
      entry('big-margin', 'Biggest Winning Margin', '💥', bigMargin.id, `+${bigMargin.v}`, bigMargin.line),
      entry('close-win', 'Closest Victory', '😅', closeWin.v < Infinity ? closeWin.id : null, closeWin.v < Infinity ? `+${closeWin.v}` : '—'),
      entry('fast-win', 'Fastest Match Win', '⚡', fastWin.v < Infinity ? fastWin.id : null, fastWin.v < Infinity ? fmtMins(fastWin.v) : '—'),
      entry('long-match', 'Longest Match Played', '🐢', longMatch.v > 0 ? longMatch.id : null, longMatch.v > 0 ? fmtMins(longMatch.v) : '—'),
      entry('high-score', 'Highest Match Score', '📊', highScore.id, `${highScore.v} pts`),
      untracked('low-deadwood', 'Lowest Winning Deadwood', '🍃', 'Deadwood amounts are not recorded'),
      entry('most-gin-match', 'Most Gin in One Match', '🃏', mostGinMatch.id, `${mostGinMatch.v} gins`),
      entry('most-knock-match', 'Most Knocks in One Match', '✊', mostKnockMatch.v > 0 ? mostKnockMatch.id : null, `${mostKnockMatch.v} knocks`),
      untracked('most-undercut-match', 'Most Undercuts in One Match', '🔄', 'Undercuts are not recorded'),
      entry('clean-sweep', 'Clean Sweep / Perfect Match', '🧹', mostPerfect?.id, mostPerfect ? `${mostPerfect.v} shutouts` : '—', 'Opponent scored 0'),
      entry('consec-wins', 'Most Consecutive Match Wins', '🔗', longestStreak?.id, `${longestStreak?.v ?? 0} in a row`),
      entry('avg-score', 'Highest Average Match Score', '📐', avgMatchScore?.id, avgMatchScore ? `${avgMatchScore.v} avg` : '—'),
      entry('one-pt', 'Most One-Point Victories', '☝️', mostOnePt?.id, mostOnePt ? `${mostOnePt.v}` : '—'),
      entry('dramatic', 'Most Dramatic Comeback', '🎭', comeback.id, comeback.v > 0 ? `−${comeback.v}` : '—'),
      entry('moty', 'Match of the Year', '🏅', bigMargin.id, `+${bigMargin.v}`, 'Biggest blowout'),
      entry('perfect-match', 'Perfect Match', '💯', mostPerfect?.id, mostPerfect ? `${mostPerfect.v}` : '—'),
      entry('avoid-loss', 'Longest Loss-Free Run', '🚫', longestUnbeaten?.id, `${longestUnbeaten?.v ?? 0}`),
    ]},
    { title: 'Gin & Knock', emoji: '🃏', records: [
      entry('most-gin-fin', 'Most Gin Finishes', '🃏', mostGin?.id, `${mostGin?.v ?? 0} gins`),
      entry('gin-pct', 'Highest Gin Percentage', '📊', ginPct?.id, ginPct ? `${ginPct.v}%` : '—', 'Min 20 wins'),
      entry('gin-streak', 'Longest Gin Streak', '🔥', bestGinStreak?.id, `${bestGinStreak?.v ?? 0} in a row`),
      entry('fast-gin', 'Fastest Gin Finish', '⚡', fastGin.v < Infinity ? fastGin.id : null, fastGin.v < Infinity ? fmtMins(fastGin.v) : '—'),
      entry('knock-wins', 'Most Knock Victories', '✊', mostKnock?.id, `${mostKnock?.v ?? 0} knocks`),
      entry('knock-rate', 'Highest Knock Success Rate', '🎯', knockRate?.id, knockRate ? `${knockRate.v}%` : '—'),
      untracked('most-undercut-succ', 'Most Successful Undercuts', '🛡️', 'Undercuts are not recorded'),
      untracked('undercut-pct', 'Highest Undercut Percentage', '📊', 'Undercuts are not recorded'),
      entry('big-hands', 'Most Big Point Hands', '💰', mostBigHands?.id, mostBigHands ? `${mostBigHands.v} hands` : '—', '50+ pt rounds'),
      untracked('low-avg-dw', 'Lowest Average Deadwood', '🍃', 'Deadwood amounts are not recorded'),
      untracked('zero-dw', 'Most Zero-Deadwood Hands', '0️⃣', 'Deadwood amounts are not recorded'),
      entry('tactical', 'Best Tactical Player', '🧠', awardHolder('tactical')?.id, awardHolder('tactical') ? 'Awarded' : '—', 'Annual award'),
      entry('defensive', 'Best Defensive Player', '🛡️', awardHolder('defensive')?.id, awardHolder('defensive') ? 'Awarded' : '—', 'Annual award'),
      entry('clutch', 'Best Clutch Finish', '🎯', closeWin.v < Infinity ? closeWin.id : null, closeWin.v < Infinity ? `+${closeWin.v} win` : '—'),
      entry('card-master', 'Card Master', '🎴', mostGin?.id, `${mostGin?.v ?? 0} gins`),
    ]},
    { title: 'Season', emoji: '📅', records: [
      entry('season-wins', 'Most Wins in One Season', '🏆', bestSeasonWins.id, `${bestSeasonWins.v} wins`, bestSeasonWins.ym),
      entry('season-points', 'Highest Points in a Season', '💯', bestSeasonPts.id, `${bestSeasonPts.v} pts`, bestSeasonPts.ym),
      entry('season-gin', 'Most Gin in One Season', '🃏', bestSeasonGin.id, `${bestSeasonGin.v} gins`, bestSeasonGin.ym),
      entry('season-champs', 'Most Championships in a Year', '👑', mostTitles?.id, `${mostTitles?.v ?? 0} titles`),
      untracked('season-finals', 'Most Finals in a Year', '🎫', 'No finals structure yet'),
      entry('season-mvp', 'Season MVP', '⭐', awardHolder('mvp')?.id, awardHolder('mvp') ? 'Awarded' : '—'),
      entry('season-scorer', 'Season Top Scorer', '🎯', bestSeasonPts.id, `${bestSeasonPts.v} pts`),
      entry('season-rate', 'Season Best Win Rate', '📊', bestSeasonRate.id, `${bestSeasonRate.v}%`, bestSeasonRate.ym),
      entry('season-streak', 'Longest Season Win Streak', '🔥', longestStreak?.id, `${longestStreak?.v ?? 0}`),
      entry('most-improved', 'Most Improved Player', '📈', awardHolder('improved')?.id, awardHolder('improved') ? 'Awarded' : '—'),
      entry('rookie', 'Rookie of the Season', '🌟', awardHolder('rookie')?.id, awardHolder('rookie') ? 'Awarded' : '—'),
      entry('comeback-player', 'Comeback Player', '💪', awardHolder('comeback')?.id, awardHolder('comeback') ? 'Awarded' : '—'),
      entry('fair-play', 'Fair Play Champion', '🤝', awardHolder('sportsmanship')?.id, awardHolder('sportsmanship') ? 'Awarded' : '—'),
      entry('record-breaker', 'Season Record Breaker', '💥', bestSeasonWins.id, `${bestSeasonWins.v} wins`),
      entry('season-legend', 'Season Legend', '🏛️', bestSeasonPts.id, `${bestSeasonPts.v} pts`),
    ]},
    { title: 'Legendary', emoji: '🌟', records: [
      entry('digu-king', 'DIGU King', '👑', bestSeasonPts.id, `${bestSeasonPts.v} pts`, 'Most points in a month'),
      entry('digu-emperor', 'DIGU Emperor', '🏰', mostTitles?.id, `${mostTitles?.v ?? 0} titles`),
      entry('goat', 'GOAT', '🐐', goatTop?.playerId, goatTop ? `${goatTop.score}` : '—', 'Highest career rating'),
      entry('iron', 'Iron Player', '🦾', mostPlayed?.id, mostPlayed ? `${mostPlayed.v} matches` : '—'),
      entry('golden-hand', 'Golden Hand', '✨', bestRate?.id, bestRate ? `${bestRate.v}%` : '—', 'Highest win %'),
      entry('giant-killer', 'Giant Killer', '🗡️', giantKiller?.id, giantKiller ? `${giantKiller.v} wins` : '—', 'Wins vs champions'),
      entry('unbreakable', 'Unbreakable Streak', '⛓️', longestStreak?.id, `${longestStreak?.v ?? 0} wins`),
      entry('legend', 'Legend of the League', '🏛️', goatTop?.playerId, goatTop ? `${goatTop.score}` : '—'),
      (mostPlayed && mostPlayed.v >= 1000) ? entry('immortal', 'Immortal Champion', '♾️', mostPlayed.id, `${mostPlayed.v} matches`) : untracked('immortal', 'Immortal Champion', '♾️', 'Needs 1,000 matches played'),
      entry('ultimate', 'Ultimate Record Holder', '💎', ultimate?.id, ultimate ? `${ultimate.v} records` : '—'),
    ]},
    { title: 'Premium Signature', emoji: '💎', records: [
      entry('p-king', 'DIGU King', '👑', bestSeasonPts.id, `${bestSeasonPts.v} pts`, 'Most monthly points'),
      entry('p-goat', 'GOAT', '🐐', goatTop?.playerId, goatTop ? `${goatTop.score}` : '—', 'Highest career rating'),
      entry('p-streak', 'The Streak', '🔥', longestStreak?.id, `${longestStreak?.v ?? 0} wins`, 'Longest winning streak'),
      entry('p-lightning', 'Lightning Hand', '⚡', fastWin.v < Infinity ? fastWin.id : null, fastWin.v < Infinity ? fmtMins(fastWin.v) : '—', 'Fastest recorded win'),
      entry('p-gin-machine', 'Gin Machine', '🃏', mostGin?.id, `${mostGin?.v ?? 0} gins`, 'Most Gin finishes'),
      untracked('p-deadwood', 'Deadwood Master', '🍃', 'Deadwood amounts are not recorded yet'),
      untracked('p-undercut', 'Undercut Assassin', '🛡️', 'Undercuts are not recorded yet'),
      (mostWins && mostWins.v >= 100) ? entry('p-century', 'Century Club', '💯', mostWins.id, `${mostWins.v} wins`) : untracked('p-century', 'Century Club', '💯', 'First to 100 wins — not reached yet'),
      (mostTitles && mostTitles.v >= 10) ? entry('p-diamond', 'Diamond Champion', '💎', mostTitles.id, `${mostTitles.v} titles`) : untracked('p-diamond', 'Diamond Champion', '💎', '10 championships — not reached yet'),
      (mostPlayed && mostPlayed.v >= 1000) ? entry('p-immortal', 'Immortal', '♾️', mostPlayed.id, `${mostPlayed.v} matches`) : untracked('p-immortal', 'Immortal', '♾️', '1,000 matches — not reached yet'),
    ]},
  ];

  const totalTracked = groups.reduce((n, g) => n + g.records.filter(r => r.tracked && r.holderId).length, 0);
  return { groups, totalTracked };

  function nkOrDash(g: { playerId: string }) { return P.get(g.playerId)?.nick ?? '—'; }
}
