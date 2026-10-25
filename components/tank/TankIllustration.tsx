import { fmtInt } from "@/lib/format";

/** Tinaco drawing filled to the current level, with liters and percent. */
export default function TankIllustration({
  liters,
  capacityL,
}: {
  liters: number;
  capacityL: number;
}) {
  const level = Math.min(1, Math.max(0, liters / capacityL));
  // Body spans y=40..230 inside a 200×240 viewBox.
  const top = 40;
  const bottom = 230;
  const waterY = bottom - level * (bottom - top);
  const wave = `M20 ${waterY} q22.5 -8 45 0 t45 0 t45 0 t45 0 V${bottom} H20 Z`;

  return (
    <figure className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 240"
        className="h-64 w-auto"
        role="img"
        aria-label={`${fmtInt(liters)} litros de ${fmtInt(capacityL)}, ${Math.round(level * 100)}%`}
      >
        <defs>
          <clipPath id="tank-body">
            <rect x="22" y="40" width="156" height="190" rx="26" />
          </clipPath>
        </defs>
        <rect x="70" y="12" width="60" height="30" rx="8" fill="#e2e8f0" stroke="#1e3a5f" strokeWidth="3" />
        <rect x="22" y="40" width="156" height="190" rx="26" fill="#eff6ff" />
        <path d={wave} fill="#93c5fd" clipPath="url(#tank-body)" />
        <rect x="22" y="40" width="156" height="190" rx="26" fill="none" stroke="#1e3a5f" strokeWidth="3" />
        <text x="100" y="128" textAnchor="middle" fontSize="34" fontWeight="700" fill="#0f172a">
          {fmtInt(liters)} L
        </text>
        <text x="100" y="156" textAnchor="middle" fontSize="16" fill="#1e293b">
          de {fmtInt(capacityL)} L
        </text>
        <text x="100" y="182" textAnchor="middle" fontSize="18" fontWeight="600" fill="#1e293b">
          {Math.round(level * 100)}%
        </text>
      </svg>
    </figure>
  );
}
