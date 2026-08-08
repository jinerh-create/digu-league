export const prerender = false;
import type { APIRoute } from 'astro';
import { computeRecords } from '../../lib/records';

/* Records held, optionally filtered to one player.
   Recomputed per request from the match table — the same numbers the Records page
   shows, so a profile can never disagree with it. Untracked entries and records
   with no holder are dropped: "nobody holds this yet" is not an honour. */
export const GET: APIRoute = async ({ locals, url }) => {
  const db = (locals as { runtime?: { env?: { DB?: D1Database } } }).runtime?.env?.DB;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });

  if (!db) return json({ records: [] });

  try {
    const holder = url.searchParams.get('holder');
    const { groups } = await computeRecords(db);
    const records = groups.flatMap((g) =>
      g.records
        .filter((r) => r.tracked && r.holderId && (!holder || r.holderId === holder))
        .map((r) => ({
          id: r.id,
          name: r.name,
          emoji: r.emoji,
          value: r.value,
          holderId: r.holderId,
          group: g.title,
          groupEmoji: g.emoji,
        })),
    );
    return json({ records });
  } catch {
    return json({ records: [] }, 500);
  }
};
