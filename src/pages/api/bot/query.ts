export const prerender = false;
import type { APIRoute } from 'astro';
import { computePlayerStats, getMatches, getActivePlayers } from '../../../lib/db';
import { computeGOAT } from '../../../lib/goat';
import { computeRecords } from '../../../lib/records';
import type { Match, PlayerStats, Player } from '../../../lib/types';

function getEnv(locals: unknown): Record<string, string> | undefined {
  return (locals as any)?.runtime?.env;
}
function getDb(locals: unknown): D1Database {
  const env = getEnv(locals);
  if (!env?.DB) throw new Error('DB binding not found');
  return env.DB as unknown as D1Database;
}

const norm = (s: string) => (s || '').trim().toLowerCase();
const displayName = (p: { name: string; nickname: string | null }) => p.nickname || p.name;

/** Find a player by name or nickname (case-insensitive, partial match allowed). */
function matchPlayer<T extends { name: string; nickname: string | null }>(list: T[], q: string): T | null {
  const n = norm(q);
  if (!n) return null;
  return (
    list.find(p => norm(p.name) === n || norm(p.nickname || '') === n) ||
    list.find(p => norm(p.name).startsWith(n) || norm(p.nickname || '').startsWith(n)) ||
    list.find(p => norm(p.name).includes(n) || norm(p.nickname || '').includes(n)) ||
    null
  );
}

function slimStats(s: PlayerStats) {
  return {
    name: displayName(s),
    matches_played: s.matches_played,
    matches_won: s.matches_won,
    matches_lost: s.matches_lost,
    win_rate: s.win_rate,
    league_points: s.league_points,
    games_won: s.games_won,
    games_played: s.games_played,
    digus: s.gin_count,
    undercuts: s.undercut_count,
    biggest_hand: s.biggest_hand,
    total_points: s.total_points_scored,
  };
}

function slimMatch(m: Match) {
  const isTeam = !!m.team1_player2_id;
  const sideA = isTeam
    ? `${displayName({ name: m.player1_name || '', nickname: m.player1_nickname || null })} & ${m.team1_player2_nickname || m.team1_player2_name || ''}`
    : displayName({ name: m.player1_name || '', nickname: m.player1_nickname || null });
  const sideB = isTeam
    ? `${displayName({ name: m.player2_name || '', nickname: m.player2_nickname || null })} & ${m.team2_player2_nickname || m.team2_player2_name || ''}`
    : displayName({ name: m.player2_name || '', nickname: m.player2_nickname || null });
  return {
    date: (m.completed_at || m.started_at || '').slice(0, 10),
    type: isTeam ? '2v2' : '1v1',
    sideA, sideB,
    winner: m.winner_name || null,
    king: m.king_name || null,
    king_digus: m.king_digus || null,
    completed: !!m.completed_at,
  };
}

export const GET: APIRoute = async ({ locals, url, request }) => {
  const env = getEnv(locals);
  const secret = (env?.BOT_API_SECRET ?? import.meta.env.BOT_API_SECRET)?.trim();
  const provided = (request.headers.get('x-bot-secret') ?? url.searchParams.get('key') ?? '').trim();
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const db = getDb(locals);
  const type = url.searchParams.get('type') || 'leaderboard';
  const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

  try {
    switch (type) {
      case 'players': {
        const players = await getActivePlayers(db);
        return json({ players: players.map(displayName) });
      }

      case 'leaderboard': {
        const stats = (await computePlayerStats(db))
          .filter(s => s.matches_played > 0)
          .sort((a, b) => b.league_points - a.league_points || b.win_rate - a.win_rate);
        return json({ leaderboard: stats.map((s, i) => ({ rank: i + 1, ...slimStats(s) })) });
      }

      case 'player': {
        const q = url.searchParams.get('name') || '';
        const stats = await computePlayerStats(db);
        const found = matchPlayer(stats, q);
        if (!found) return json({ error: `No player matching "${q}"`, known: stats.map(displayName) });
        const rank = [...stats]
          .filter(s => s.matches_played > 0)
          .sort((a, b) => b.league_points - a.league_points).findIndex(s => s.player_id === found.player_id) + 1;
        return json({ player: { ...slimStats(found), rank: rank || null } });
      }

      case 'goat': {
        const { board } = await computeGOAT(db);
        return json({ goat: board.slice(0, 15).map(r => ({
          rank: r.rank, name: r.nickname || r.name, score: r.score,
          titles: r.titles, win_rate: r.winRate, game_pct: r.gamePct, digus: r.digus, played: r.played,
        })) });
      }

      case 'records': {
        const { groups } = await computeRecords(db);
        const out = groups.map(g => ({
          group: g.title,
          records: g.records.filter(r => r.tracked && r.holder).map(r => ({
            name: r.name, holder: r.holder, value: r.value, detail: r.detail || null,
          })),
        })).filter(g => g.records.length > 0);
        return json({ records: out });
      }

      case 'recent': {
        const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10)));
        const matches = await getMatches(db, 40);
        const done = matches.filter(m => m.completed_at).slice(0, limit);
        return json({ matches: done.map(slimMatch) });
      }

      case 'h2h': {
        const stats = await computePlayerStats(db);
        const pa = matchPlayer(stats, url.searchParams.get('a') || '');
        const pb = matchPlayer(stats, url.searchParams.get('b') || '');
        if (!pa || !pb) return json({ error: 'Could not identify both players', known: stats.map(displayName) });
        const matches = await getMatches(db, 500);
        let aWins = 0, bWins = 0, total = 0;
        for (const m of matches) {
          if (!m.completed_at || !m.winner_id) continue;
          const sideA = [m.player1_id, m.team1_player2_id].filter(Boolean) as string[];
          const sideB = [m.player2_id, m.team2_player2_id].filter(Boolean) as string[];
          const aInA = sideA.includes(pa.player_id), aInB = sideB.includes(pa.player_id);
          const bInA = sideA.includes(pb.player_id), bInB = sideB.includes(pb.player_id);
          const opposed = (aInA && bInB) || (aInB && bInA);
          if (!opposed) continue;
          total++;
          const winningSide = m.winner_id === m.player1_id ? 'A' : m.winner_id === m.player2_id ? 'B' : null;
          if (!winningSide) continue;
          const aWon = (winningSide === 'A' && aInA) || (winningSide === 'B' && aInB);
          if (aWon) aWins++; else bWins++;
        }
        return json({ h2h: { a: displayName(pa), b: displayName(pb), meetings: total, a_wins: aWins, b_wins: bWins } });
      }

      default:
        return json({ error: `Unknown type "${type}"`, valid: ['players', 'leaderboard', 'player', 'goat', 'records', 'recent', 'h2h'] });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
