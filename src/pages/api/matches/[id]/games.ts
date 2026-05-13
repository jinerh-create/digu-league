export const prerender = false;
import type { APIRoute } from 'astro';
import { getMatch, getGames, addGame, completeMatch } from '../../../../lib/db';
import { calculateHand } from '../../../../lib/scoring';
import { DEFAULT_SETTINGS } from '../../../../lib/types';
import type { Game } from '../../../../lib/types';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const match = await getMatch(db, params.id!);
    if (!match) return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });
    if (match.completed_at) {
      return new Response(JSON.stringify({ error: 'Match already completed' }), { status: 400 });
    }

    const body = await request.json() as {
      knocker_id?: string;
      knocker_deadwood?: number;
      defender_deadwood?: number;
      is_gin?: boolean;
    };

    if (!body.knocker_id) {
      return new Response(JSON.stringify({ error: 'knocker_id required' }), { status: 400 });
    }

    const validPlayerIds = [match.player1_id, match.player2_id];
    if (!validPlayerIds.includes(body.knocker_id)) {
      return new Response(JSON.stringify({ error: 'Invalid knocker_id' }), { status: 400 });
    }

    const knockerDeadwood = body.knocker_deadwood ?? 0;
    const defenderDeadwood = body.defender_deadwood ?? 0;
    const isGin = body.is_gin ?? false;

    const defenderId = validPlayerIds.find((id) => id !== body.knocker_id)!;

    const result = calculateHand(knockerDeadwood, defenderDeadwood, isGin, DEFAULT_SETTINGS);

    const winnerId = result.winner === 'knocker' ? body.knocker_id : defenderId;
    const loserId = result.winner === 'knocker' ? defenderId : body.knocker_id;

    const existingGames = await getGames(db, params.id!);
    const roundNumber = existingGames.length + 1;

    const game: Game = {
      id: crypto.randomUUID(),
      match_id: params.id!,
      round_number: roundNumber,
      winner_id: winnerId,
      loser_id: loserId,
      knocker_id: body.knocker_id,
      winner_deadwood: result.winner === 'knocker' ? knockerDeadwood : defenderDeadwood,
      loser_deadwood: result.winner === 'knocker' ? defenderDeadwood : knockerDeadwood,
      is_gin: isGin ? 1 : 0,
      is_undercut: result.isUndercut ? 1 : 0,
      score_awarded: result.score,
      timestamp: new Date().toISOString(),
    };

    await addGame(db, game);

    // Check if match is complete
    const allGames = [...existingGames, game];
    const p1Score = allGames
      .filter((g) => g.winner_id === match.player1_id)
      .reduce((s, g) => s + g.score_awarded, 0);
    const p2Score = allGames
      .filter((g) => g.winner_id === match.player2_id)
      .reduce((s, g) => s + g.score_awarded, 0);

    let matchWinnerId: string | null = null;
    if (p1Score >= match.target_score) matchWinnerId = match.player1_id;
    else if (p2Score >= match.target_score) matchWinnerId = match.player2_id;

    if (matchWinnerId) {
      await completeMatch(db, params.id!, matchWinnerId, new Date().toISOString());
    }

    return new Response(
      JSON.stringify({
        game,
        p1Score,
        p2Score,
        matchComplete: !!matchWinnerId,
        matchWinnerId,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
