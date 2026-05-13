/* SVG icons matched to the Samriddhi design system: 1.6 stroke, rounded
 * line caps and joins, 18px square frame inheriting currentColor. */

type IconProps = { size?: number; className?: string };

const baseProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

export function Plus({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function Search({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

export function Settings({ size = 16, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Download({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function Chev({ size = 12, dir = "r", className }: IconProps & { dir?: "r" | "l" | "u" | "d" }) {
  const rot = { r: 0, l: 180, d: 90, u: -90 }[dir];
  return (
    <svg {...baseProps(size, className)} strokeWidth={1.8} style={{ transform: `rotate(${rot}deg)` }}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export function Send({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function X({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Lock({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function Check({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)} strokeWidth={2}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function Panel({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

export function Filter({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

/* Brand mark: hairline rounded square with a Ledger Blue diamond. */
export function BrandMark({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="1" y="1" width="16" height="16" rx="1.5" stroke="#14181F" strokeWidth="1.2" />
      <path d="M5 9 L 9 5 L 13 9 L 9 13 Z" fill="#1F3A5F" />
    </svg>
  );
}
