/* Champions League winner mark — a heater-shield crest in onyx and gold, carrying
   the number of titles won. Echoes the OC Champions League trophy.

   Deliberately NOT a star: the gold star belongs to the Digu League champion, and
   at this size shape reads before colour, so two gold pips beside one avatar would
   look like the same award twice. A shield can never be mistaken for a star.

   The count lives inside the crest rather than in a separate bubble, so a second
   title changes the badge itself instead of adding clutter beside the name. A spade
   shows at one title; from two up the numeral takes over, since by then the number
   is the thing worth reading. */
export default function ChampionsLeagueBadge({
  count = 1,
  size = 18,
}: { count?: number; size?: number }) {
  const n = Math.max(1, Math.floor(count));
  const title = `Champions League winner${n > 1 ? ` · ${n} titles` : ''}`;
  // Unique gradient ids — several badges render on one page, and duplicate ids
  // would make every shield inherit the first one's fill.
  const uid = `cl${n}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title}
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <title>{title}</title>
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDECA8" />
          <stop offset="0.4" stopColor="#E8C64B" />
          <stop offset="0.62" stopColor="#C99A22" />
          <stop offset="1" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id={`${uid}-onyx`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#332D24" />
          <stop offset="0.55" stopColor="#12100C" />
          <stop offset="1" stopColor="#241F18" />
        </linearGradient>
      </defs>

      {/* crest body */}
      <path d="M3.9 3.1h16.2v8.4c0 5.3-3.6 9-8.1 11.4C7.5 20.5 3.9 16.8 3.9 11.5z"
        fill={`url(#${uid}-onyx)`}
        stroke={`url(#${uid}-gold)`} strokeWidth="1.8" strokeLinejoin="round" />

      {/* chief — the gold band across the head of the shield */}
      <path d="M4.6 4.9h14.8v1.9H4.6z" fill={`url(#${uid}-gold)`} opacity="0.95" />

      {/* inner rule, the detail that makes it read as a crest rather than a blob */}
      <path d="M6.3 8.1h11.4v3.3c0 3.9-2.5 6.7-5.7 8.5-3.2-1.8-5.7-4.6-5.7-8.5z"
        fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="0.7" opacity="0.5" />

      {n < 2 ? (
        <path d="M12 8.4c-1.8 2.4-3.7 3.6-3.7 5.3a1.8 1.8 0 0 0 2.9 1.3c-.2 1-.6 1.7-1.1 2.2h3.8c-.5-.5-.9-1.2-1.1-2.2a1.8 1.8 0 0 0 2.9-1.3c0-1.7-1.9-2.9-3.7-5.3z"
          fill={`url(#${uid}-gold)`} />
      ) : (
        <text x="12" y="17.4" textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={n > 9 ? 7.6 : 9.6} fontWeight="700"
          fill={`url(#${uid}-gold)`}>
          {n}
        </text>
      )}
    </svg>
  );
}
