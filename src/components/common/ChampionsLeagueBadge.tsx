/* Champions League winner mark — a black-and-gold shield carrying the number of
   titles won, echoing the OC Champions League trophy.

   Deliberately NOT a star: the gold star belongs to the Digu League champion, and
   at this size shape reads before colour, so two gold pips beside one avatar would
   look like the same award twice. A shield can never be mistaken for a star.

   The count sits inside the shield rather than in a separate bubble, so winning a
   second title changes the badge itself instead of adding more clutter next to the
   name. A single spade shows at one title; the numeral takes over from two up,
   where the number is the thing worth reading. */
export default function ChampionsLeagueBadge({
  count = 1,
  size = 18,
}: { count?: number; size?: number }) {
  const n = Math.max(1, Math.floor(count));
  const title = `Champions League winner${n > 1 ? ` · ${n} titles` : ''}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title}
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <title>{title}</title>
      <defs>
        <linearGradient id="cl-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDECA8" />
          <stop offset="0.45" stopColor="#E8C64B" />
          <stop offset="1" stopColor="#9C7A1E" />
        </linearGradient>
      </defs>

      <path d="M12 1.4l8.2 2.9v7.2c0 4.9-3.4 8.4-8.2 11.1C7.2 19.9 3.8 16.4 3.8 11.5V4.3z"
        fill="#12100C" stroke="url(#cl-gold)" strokeWidth="1.9" strokeLinejoin="round" />

      {n < 2 ? (
        <path d="M12 6.2c-2 2.7-4.2 4.1-4.2 6a2 2 0 0 0 3.3 1.5c-.2 1.2-.7 2-1.3 2.5h4.4c-.6-.5-1.1-1.3-1.3-2.5a2 2 0 0 0 3.3-1.5c0-1.9-2.2-3.3-4.2-6z"
          fill="url(#cl-gold)" />
      ) : (
        <text x="12" y="15.6" textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={n > 9 ? 8.4 : 10.6} fontWeight="700" fill="url(#cl-gold)">
          {n}
        </text>
      )}
    </svg>
  );
}
