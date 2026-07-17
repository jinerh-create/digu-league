/* Gold verified badge — a filled rosette check. Shown next to a verified player's
   name. Existing players were grandfathered verified (migration 0013); new players
   request verification and an admin approves. */
export default function VerifiedBadge({ size = 15, title = 'Verified player' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title}
      style={{ flexShrink: 0, verticalAlign: 'middle', filter: 'drop-shadow(0 1px 1px rgba(184,138,0,0.4))' }}>
      <title>{title}</title>
      <path fill="#D4AF37" d="M12 1.5l2.35 1.7 2.9-.05 1.15 2.66 2.5 1.5-.55 2.85 1.35 2.59-2 2.08.05 2.9-2.76 1-1.5 2.5-2.84-.6-2.55 1.4-2.55-1.4-2.84.6-1.5-2.5-2.76-1 .05-2.9-2-2.08 1.35-2.59L1.55 7.3l2.5-1.5L5.2 3.15l2.9.05L12 1.5z"/>
      <path fill="none" stroke="#3a2b00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M8 12.2l2.6 2.6L16 9.4"/>
    </svg>
  );
}
