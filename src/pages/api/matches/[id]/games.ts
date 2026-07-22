export const prerender = false;
import type { APIRoute } from 'astro';
import { getMatch, getGames, addGame, completeMatch } from '../../../../lib/db';
import { verifySession } from '../../../../lib/auth';
import type { Game } from '../../../../lib/types';

const GIN_BONUS = 25;

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

function getSecret(locals: Record<string, unknown>): string | undefined {
  const runtime = locals.runtime as { env: Record<string, string> } | undefined;
  return (runtime?.env.SESSION_SECRET ?? (import.meta.env.SESSION_SECRET as string | undefined))?.trim();
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const match = await getMatch(db, params.id!);
    if (!match) return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });
    // A finished match is locked — except an admin can add the missing rounds of a
    // rounds-based match that was finished early (so they don't have to delete + re-enter).
    if (match.completed_at) {
      const secret = getSecret(locals as Record<string, unknown>);
      let isAdmin = !secret; // no secret configured (dev) → allow
      if (secret) {
        const { role } = await verifySession(request.headers.get('cookie'), secret);
        isAdmin = role === 'admin';
      }
      const existing = await getGames(db, params.id!);
      const roundsIncomplete = match.max_rounds > 0 && existing.length < match.max_rounds;
      if (!(isAdmin && roundsIncomplete)) {
        return new Response(JSON.stringify({ error: 'Match already completed' }), { status: 400 });
      }
    }

    const body = await request.json() as {
      // 1v1 format
      winner_id?: string;
      score?: number;
      is_gin?: boolean;
      gin_player_id?: string;
      // 2v2 format
      t1_p1_cards?: number;
      t1_p2_cards?: number;
      t2_p1_cards?: number;
      t2_p2_cards?: number;
    };

    const isTeam = !!match.team1_player2_id;
    let winnerId: string;
    let loserId: string;
    let scoreAwarded: number;
    let isGin: boolean;
    let ginPlayerId: string | null = null;
    let t1p1: number | null = null, t1p2: number | null = null;
    let t2p1: number | null = null, t2p2: number | null = null;

    if (isTeam) {
      if (body.t1_p1_cards === undefined || body.t1_p2_cards === undefined ||
          body.t2_p1_cards === undefined || body.t2_p2_cards === undefined) {
        return new Response(JSON.stringify({ error: 'Card counts required for team match' }), { status: 400 });
      }
      t1p1 = body.t1_p1_cards;
      t1p2 = body.t1_p2_cards;
      t2p1 = body.t2_p1_cards;
      t2p2 = body.t2_p2_cards;
      isGin = body.is_gin ?? false;
      ginPlayerId = body.gin_player_id ?? null;

      const team1Total = t1p1 + t1p2;
      const team2Total = t2p1 + t2p2;
      const team1Wins = team1Total >= team2Total;
      winnerId = team1Wins ? match.player1_id : match.player2_id;
      loserId = team1Wins ? match.player2_id : match.player1_id;
      const winningTotal = team1Wins ? team1Total : team2Total;
      const losingTotal = team1Wins ? team2Total : team1Total;
      scoreAwarded = isGin ? winningTotal + GIN_BONUS : Math.max(0, winningTotal - losingTotal);
    } else {
      if (!body.winner_id || body.score === undefined) {
        return new Response(JSON.stringify({ error: 'winner_id and score required' }), { status: 400 });
      }
      if (![match.player1_id, match.player2_id].includes(body.winner_id)) {
        return new Response(JSON.stringify({ error: 'Invalid winner_id' }), { status: 400 });
      }
      winnerId = body.winner_id;
      loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
      scoreAwarded = Math.max(0, body.score);
      isGin = body.is_gin ?? false;
      ginPlayerId = isGin ? winnerId : null;
    }

    const existingGames = await getGames(db, params.id!);
    const roundNumber = existingGames.length + 1;

    const game: Game = {
      id: crypto.randomUUID(),
      match_id: params.id!,
      round_number: roundNumber,
      winner_id: winnerId,
      loser_id: loserId,
      knocker_id: winnerId,
      winner_deadwood: 0,
      loser_deadwood: 0,
      is_gin: isGin ? 1 : 0,
      is_undercut: 0,
      score_awarded: scoreAwarded,
      timestamp: new Date().toISOString(),
      t1_p1_cards: t1p1,
      t1_p2_cards: t1p2,
      t2_p1_cards: t2p1,
      t2_p2_cards: t2p2,
      gin_player_id: ginPlayerId,
    };

    await addGame(db, game);

    const allGames = [...existingGames, game];
    const p1Score = allGames.filter(g => g.winner_id === match.player1_id).reduce((s, g) => s + g.score_awarded, 0);
    const p2Score = allGames.filter(g => g.winner_id === match.player2_id).reduce((s, g) => s + g.score_awarded, 0);

    // If an admin is filling rounds of an already-finished match, keep the recorded
    // winner in sync with the new totals (same rule as Finish: higher total wins).
    if (match.completed_at) {
      const w = p1Score > p2Score ? match.player1_id : p2Score > p1Score ? match.player2_id : null;
      await completeMatch(db, params.id!, w as string, match.completed_at);
    }

    return new Response(
      JSON.stringify({ game, p1Score, p2Score, matchComplete: false, matchWinnerId: null }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
