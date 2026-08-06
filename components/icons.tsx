// Pixel icons — crisp-edged, currentColor fill. viewBox 0 0 24 24.

type IconProps = { size?: number; className?: string };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  fill: "currentColor",
  shapeRendering: "crispEdges",
  "aria-hidden": true,
});

export function GitHubIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 9 23 15 22 15 22 17 21 17 21 19 20 19 20 20 19 20 19 21 18 21 18 22 16 22 16 23 15 23 15 18 14 18 14 17 15 17 15 16 17 16 17 15 18 15 18 14 19 14 19 9 18 9 18 6 16 6 16 7 15 7 15 8 14 8 14 7 10 7 10 8 9 8 9 7 8 7 8 6 6 6 6 9 5 9 5 14 6 14 6 15 7 15 7 16 9 16 9 18 7 18 7 17 6 17 6 16 4 16 4 17 5 17 5 19 6 19 6 20 9 20 9 23 8 23 8 22 6 22 6 21 5 21 5 20 4 20 4 19 3 19 3 17 2 17 2 15 1 15 1 9 2 9 2 7 3 7 3 5 4 5 4 4 5 4 5 3 7 3 7 2 9 2 9 1 15 1 15 2 17 2 17 3 19 3 19 4 20 4 20 5 21 5 21 7 22 7 22 9 23 9" />
    </svg>
  );
}

export function StarIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 8 23 10 22 10 22 11 21 11 21 12 20 12 20 13 19 13 19 14 18 14 18 19 19 19 19 23 17 23 17 22 15 22 15 21 13 21 13 20 11 20 11 21 9 21 9 22 7 22 7 23 5 23 5 19 6 19 6 14 5 14 5 13 4 13 4 12 3 12 3 11 2 11 2 10 1 10 1 8 8 8 8 6 9 6 9 4 10 4 10 2 11 2 11 1 13 1 13 2 14 2 14 4 15 4 15 6 16 6 16 8 23 8" />
    </svg>
  );
}

export function StarOutlineIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m16,8v-2h-1v-2h-1v-2h-1v-1h-2v1h-1v2h-1v2h-1v2H1v2h1v1h1v1h1v1h1v1h1v5h-1v4h2v-1h2v-1h2v-1h2v1h2v1h2v1h2v-4h-1v-5h1v-1h1v-1h1v-1h1v-1h1v-2h-7Zm4,3h-1v1h-1v1h-1v1h-1v5h1v1h-2v-1h-2v-1h-2v1h-2v1h-2v-1h1v-5h-1v-1h-1v-1h-1v-1h-1v-1h4v-1h1v-1h1v-2h1v-2h2v2h1v2h1v1h1v1h4v1Z" />
    </svg>
  );
}

// Hollow heart — drawn as a filled path with the middle cut out, so it keeps
// the same currentColor fill and crisp edges as the rest of the set instead of
// switching to a stroke.
export function HeartIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m22,6v-1h-1v-1h-1v-1h-6v1h-1v1h-2v-1h-1v-1h-6v1h-1v1h-1v1h-1v5h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h2v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-5h-1Zm-2,4v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-3h1v-1h1v-1h4v1h1v1h1v1h2v-1h1v-1h1v-1h4v1h1v1h1v3h-1Z" />
    </svg>
  );
}

export function HeartSolidIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 6 23 11 22 11 22 12 21 12 21 13 20 13 20 14 19 14 19 15 18 15 18 16 17 16 17 17 16 17 16 18 15 18 15 19 14 19 14 20 13 20 13 21 11 21 11 20 10 20 10 19 9 19 9 18 8 18 8 17 7 17 7 16 6 16 6 15 5 15 5 14 4 14 4 13 3 13 3 12 2 12 2 11 1 11 1 6 2 6 2 5 3 5 3 4 4 4 4 3 10 3 10 4 11 4 11 5 13 5 13 4 14 4 14 3 20 3 20 4 21 4 21 5 22 5 22 6 23 6" />
    </svg>
  );
}

export function SunIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="4 5 3 5 3 4 4 4 4 3 5 3 5 4 6 4 6 5 7 5 7 6 8 6 8 7 7 7 7 8 6 8 6 7 5 7 5 6 4 6 4 5" />
      <rect x="1" y="11" width="5" height="2" />
      <polygon points="7 17 8 17 8 18 7 18 7 19 6 19 6 20 5 20 5 21 4 21 4 20 3 20 3 19 4 19 4 18 5 18 5 17 6 17 6 16 7 16 7 17" />
      <rect x="11" y="18" width="2" height="5" />
      <rect x="11" y="1" width="2" height="5" />
      <rect x="18" y="11" width="5" height="2" />
      <polygon points="17 7 16 7 16 6 17 6 17 5 18 5 18 4 19 4 19 3 20 3 20 4 21 4 21 5 20 5 20 6 19 6 19 7 18 7 18 8 17 8 17 7" />
      <polygon points="21 19 21 20 20 20 20 21 19 21 19 20 18 20 18 19 17 19 17 18 16 18 16 17 17 17 17 16 18 16 18 17 19 17 19 18 20 18 20 19 21 19" />
      <path d="m16,14h1v-4h-1v-2h-2v-1h-4v1h-2v2h-1v4h1v2h2v1h4v-1h2v-2Zm-1,0h-1v1h-4v-1h-1v-4h1v-1h4v1h1v4Z" />
    </svg>
  );
}

export function MoonIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="22 17 22 19 21 19 21 20 20 20 20 21 18 21 18 22 16 22 16 23 10 23 10 22 8 22 8 21 6 21 6 20 5 20 5 19 4 19 4 17 3 17 3 15 2 15 2 9 3 9 3 7 4 7 4 5 5 5 5 4 6 4 6 3 8 3 8 2 10 2 10 1 15 1 15 2 13 2 13 3 11 3 11 4 10 4 10 6 9 6 9 8 8 8 8 12 9 12 9 14 10 14 10 16 11 16 11 17 13 17 13 18 15 18 15 19 19 19 19 18 21 18 21 17 22 17" />
    </svg>
  );
}

export function SignOutIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      {/* door frame, open on the side the arrow leaves through */}
      <path d="M3 3h9v2H5v14h7v2H3V3Z" />
      {/* arrow — integer grid, so the diagonal is hard-edged like the rest */}
      <rect x="14" y="9" width="3" height="7" />
      <polygon points="14 9 19 12 14 15" />
    </svg>
  );
}

export function PaperclipIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="21 4 21 9 20 9 20 10 19 10 19 11 18 11 18 12 17 12 17 13 16 13 16 14 15 14 15 15 14 15 14 16 13 16 13 17 12 17 12 18 11 18 11 19 8 19 8 18 7 18 7 17 6 17 6 14 7 14 7 13 8 13 8 12 9 12 9 11 10 11 10 10 11 10 11 9 12 9 12 8 13 8 13 7 14 7 14 6 15 6 15 5 16 5 16 6 17 6 17 7 16 7 16 8 15 8 15 9 14 9 14 10 13 10 13 11 12 11 12 12 11 12 11 13 10 13 10 14 9 14 9 15 8 15 8 16 9 16 9 17 10 17 10 16 11 16 11 15 12 15 12 14 13 14 13 13 14 13 14 12 15 12 15 11 16 11 16 10 17 10 17 9 18 9 18 8 19 8 19 5 18 5 18 4 17 4 17 3 14 3 14 4 13 4 13 5 12 5 12 6 11 6 11 7 10 7 10 8 9 8 9 9 8 9 8 10 7 10 7 11 6 11 6 12 5 12 5 13 4 13 4 18 5 18 5 19 6 19 6 20 7 20 7 21 12 21 12 20 13 20 13 19 14 19 14 18 15 18 15 17 16 17 16 16 17 16 17 15 18 15 18 14 19 14 19 13 21 13 21 15 20 15 20 16 19 16 19 17 18 17 18 18 17 18 17 19 16 19 16 20 15 20 15 21 14 21 14 22 13 22 13 23 7 23 7 22 5 22 5 21 4 21 4 20 3 20 3 18 2 18 2 12 3 12 3 11 4 11 4 10 5 10 5 9 6 9 6 8 7 8 7 7 8 7 8 6 9 6 9 5 10 5 10 4 11 4 11 3 12 3 12 2 14 2 14 1 18 1 18 2 19 2 19 3 20 3 20 4 21 4" />
    </svg>
  );
}

export function SaveIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m22,7v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1H2v1h-1v20h1v1h20v-1h1V7h-1Zm-13,12v-4h1v-1h4v1h1v4h-1v1h-4v-1h-1Zm7-9H4v-6h12v6Z" />
    </svg>
  );
}

export function ShareIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="22 4 22 6 21 6 21 8 20 8 20 9 15 9 15 8 13 8 13 9 12 9 12 10 11 10 11 14 12 14 12 15 13 15 13 16 15 16 15 15 20 15 20 16 21 16 21 18 22 18 22 20 21 20 21 22 20 22 20 23 15 23 15 22 14 22 14 20 13 20 13 18 12 18 12 17 11 17 11 16 10 16 10 15 9 15 9 16 4 16 4 15 3 15 3 13 2 13 2 11 3 11 3 9 4 9 4 8 9 8 9 9 10 9 10 8 11 8 11 7 12 7 12 6 13 6 13 4 14 4 14 2 15 2 15 1 20 1 20 2 21 2 21 4 22 4" />
    </svg>
  );
}

export function AngleLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="11 13 12 13 12 14 13 14 13 15 14 15 14 16 15 16 15 17 16 17 16 18 17 18 17 19 16 19 16 20 15 20 15 19 14 19 14 18 13 18 13 17 12 17 12 16 11 16 11 15 10 15 10 14 9 14 9 13 8 13 8 11 9 11 9 10 10 10 10 9 11 9 11 8 12 8 12 7 13 7 13 6 14 6 14 5 15 5 15 4 16 4 16 5 17 5 17 6 16 6 16 7 15 7 15 8 14 8 14 9 13 9 13 10 12 10 12 11 11 11 11 13" />
    </svg>
  );
}

export function AngleDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="20 8 20 9 19 9 19 10 18 10 18 11 17 11 17 12 16 12 16 13 15 13 15 14 14 14 14 15 13 15 13 16 11 16 11 15 10 15 10 14 9 14 9 13 8 13 8 12 7 12 7 11 6 11 6 10 5 10 5 9 4 9 4 8 5 8 5 7 6 7 6 8 7 8 7 9 8 9 8 10 9 10 9 11 10 11 10 12 11 12 11 13 13 13 13 12 14 12 14 11 15 11 15 10 16 10 16 9 17 9 17 8 18 8 18 7 19 7 19 8 20 8" />
    </svg>
  );
}

export function DownloadIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="5 10 4 10 4 8 6 8 6 9 7 9 7 10 8 10 8 11 9 11 9 12 10 12 10 13 11 13 11 1 13 1 13 13 14 13 14 12 15 12 15 11 16 11 16 10 17 10 17 9 18 9 18 8 20 8 20 10 19 10 19 11 18 11 18 12 17 12 17 13 16 13 16 14 15 14 15 15 14 15 14 16 13 16 13 17 11 17 11 16 10 16 10 15 9 15 9 14 8 14 8 13 7 13 7 12 6 12 6 11 5 11 5 10" />
      <rect x="2" y="21" width="20" height="2" />
    </svg>
  );
}

export function AngleDownSolidIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="5 7 7 7 7 8 8 8 8 9 9 9 9 10 10 10 10 11 11 11 11 12 13 12 13 11 14 11 14 10 15 10 15 9 16 9 16 8 17 8 17 7 19 7 19 8 20 8 20 10 19 10 19 11 18 11 18 12 17 12 17 13 16 13 16 14 15 14 15 15 14 15 14 16 13 16 13 17 11 17 11 16 10 16 10 15 9 15 9 14 8 14 8 13 7 13 7 12 6 12 6 11 5 11 5 10 4 10 4 8 5 8 5 7" />
    </svg>
  );
}

export function PlusIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 11 23 13 22 13 22 14 14 14 14 22 13 22 13 23 11 23 11 22 10 22 10 14 2 14 2 13 1 13 1 11 2 11 2 10 10 10 10 2 11 2 11 1 13 1 13 2 14 2 14 10 22 10 22 11 23 11" />
    </svg>
  );
}

export function MinusIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 11 23 13 22 13 22 14 2 14 2 13 1 13 1 11 2 11 2 10 22 10 22 11 23 11" />
    </svg>
  );
}

export function MenuIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="1" y="3" width="22" height="2" />
      <rect x="1" y="11" width="22" height="2" />
      <rect x="1" y="19" width="22" height="2" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="14 13 15 13 15 14 16 14 16 15 17 15 17 16 18 16 18 17 19 17 19 18 20 18 20 19 21 19 21 20 22 20 22 21 21 21 21 22 20 22 20 21 19 21 19 20 18 20 18 19 17 19 17 18 16 18 16 17 15 17 15 16 14 16 14 15 13 15 13 14 11 14 11 15 10 15 10 16 9 16 9 17 8 17 8 18 7 18 7 19 6 19 6 20 5 20 5 21 4 21 4 22 3 22 3 21 2 21 2 20 3 20 3 19 4 19 4 18 5 18 5 17 6 17 6 16 7 16 7 15 8 15 8 14 9 14 9 13 10 13 10 11 9 11 9 10 8 10 8 9 7 9 7 8 6 8 6 7 5 7 5 6 4 6 4 5 3 5 3 4 2 4 2 3 3 3 3 2 4 2 4 3 5 3 5 4 6 4 6 5 7 5 7 6 8 6 8 7 9 7 9 8 10 8 10 9 11 9 11 10 13 10 13 9 14 9 14 8 15 8 15 7 16 7 16 6 17 6 17 5 18 5 18 4 19 4 19 3 20 3 20 2 21 2 21 3 22 3 22 4 21 4 21 5 20 5 20 6 19 6 19 7 18 7 18 8 17 8 17 9 16 9 16 10 15 10 15 11 14 11 14 13" />
    </svg>
  );
}

// Four corner brackets pointing out — the canvas grows to fill the screen.
export function ExpandIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="9 20 9 23 2 23 2 22 1 22 1 15 4 15 4 20 9 20" />
      <polygon points="9 1 9 4 4 4 4 9 1 9 1 2 2 2 2 1 9 1" />
      <polygon points="23 15 23 22 22 22 22 23 15 23 15 20 20 20 20 15 23 15" />
      <polygon points="23 2 23 9 20 9 20 4 15 4 15 1 22 1 22 2 23 2" />
    </svg>
  );
}

// The same brackets pointing in. Paired with ExpandIcon on one button, so the
// icon alone says which way the next press goes.
export function CollapseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 6 23 9 16 9 16 8 15 8 15 1 18 1 18 6 23 6" />
      <polygon points="23 15 23 18 18 18 18 23 15 23 15 16 16 16 16 15 23 15" />
      <polygon points="8 16 9 16 9 23 6 23 6 18 1 18 1 15 8 15 8 16" />
      <polygon points="9 1 9 8 8 8 8 9 1 9 1 6 6 6 6 1 9 1" />
    </svg>
  );
}

export function LockOpenIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 6 23 11 20 11 20 6 19 6 19 5 15 5 15 6 14 6 14 11 17 11 17 12 18 12 18 21 17 21 17 22 2 22 2 21 1 21 1 12 2 12 2 11 11 11 11 6 12 6 12 4 13 4 13 3 15 3 15 2 19 2 19 3 21 3 21 4 22 4 22 6 23 6" />
    </svg>
  );
}

export function LockIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m21,12v-1h-3v-6h-1v-2h-1v-1h-2v-1h-4v1h-2v1h-1v2h-1v6h-3v1h-1v10h1v1h18v-1h1v-10h-1Zm-6-1h-6v-6h1v-1h4v1h1v6Z" />
    </svg>
  );
}

// Pixel check, same grid as the rest of the set. The success-check animation
// (fade + rotate + bob) still runs on the wrapper; the old stroke-draw no
// longer applies to a filled polygon, so the check is simply there.
export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="22 4 22 6 21 6 21 7 20 7 20 8 19 8 19 9 18 9 18 10 17 10 17 11 16 11 16 12 15 12 15 13 14 13 14 14 13 14 13 15 12 15 12 16 11 16 11 17 10 17 10 18 8 18 8 17 7 17 7 16 6 16 6 15 5 15 5 14 4 14 4 13 3 13 3 12 2 12 2 10 4 10 4 11 5 11 5 12 6 12 6 13 7 13 7 14 8 14 8 15 10 15 10 14 11 14 11 13 12 13 12 12 13 12 13 11 14 11 14 10 15 10 15 9 16 9 16 8 17 8 17 7 18 7 18 6 19 6 19 5 20 5 20 4 22 4" />
    </svg>
  );
}
