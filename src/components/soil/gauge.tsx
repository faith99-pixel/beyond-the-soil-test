"use client";

interface GaugeProps {
  value: number; // 0-100
  label: string;
  sublabel?: string;
  size?: number;
}

/**
 * Half-donut gauge (0-100 score visualisation).
 * Uses SVG with the soil/forest palette.
 */
export function Gauge({ value, label, sublabel, size = 160 }: GaugeProps) {
  const v = Math.max(0, Math.min(100, value));
  const radius = size / 2 - 10;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (v / 100) * circumference;

  // Color band based on score
  const color =
    v >= 70
      ? "oklch(0.46 0.1 150)" // forest green
      : v >= 45
      ? "oklch(0.7 0.14 85)" // amber earth
      : "oklch(0.6 0.13 50)"; // clay

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="oklch(0.92 0.012 70)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: size * 0.18, fontWeight: 700 }}
        >
          {v.toFixed(0)}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: size * 0.08 }}
        >
          / 100
        </text>
      </svg>
      <div className="text-center">
        <div className="text-sm font-medium">{label}</div>
        {sublabel ? <div className="text-xs text-muted-foreground">{sublabel}</div> : null}
      </div>
    </div>
  );
}
