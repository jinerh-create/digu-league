/* Gold verified badge — Facebook-style scalloped seal with a clean white check.
   Existing players were grandfathered verified (migration 0013); new players
   request verification and an admin approves. */
export default function VerifiedBadge({ size = 16, title = 'Verified player' }: { size?: number; title?: string }) {
  // 12-point scalloped circle (the Meta verified shape): alternating outer/inner
  // radii around the centre, built once so the seal edge reads correctly.
  const cx = 12, cy = 12, outer = 11.3, inner = 9.4, points = 12;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)} `;
  }
  d += 'Z';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title}
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <title>{title}</title>
      <defs>
        <linearGradient id="vb-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F4D160" />
          <stop offset="0.5" stop-color="#E1B12C" />
          <stop offset="1" stop-color="#C79415" />
        </linearGradient>
      </defs>
      <path d={d} fill="url(#vb-gold)" />
      <path d="M7.4 12.3l3 3 6.1-6.5" fill="none" stroke="#fff" stroke-width="2.3"
        stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
