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
      {/* arrow */}
      <polygon points="14 7 12.6 8.4 15.2 11 8 11 8 13 15.2 13 12.6 15.6 14 17 19 12 14 7" />
    </svg>
  );
}

export function MenuIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5" width="18" height="2" />
      <rect x="3" y="11" width="18" height="2" />
      <rect x="3" y="17" width="18" height="2" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="19 6 17 4 12 9 7 4 5 6 10 11 5 16 7 18 12 13 17 18 19 16 14 11 19 6" />
    </svg>
  );
}

// Stroked, not filled — the success-check animation draws this path with
// stroke-dashoffset, which a filled polygon cannot do. Square caps keep it
// in the hard-edged house style; --check-path-len in globals.css is this
// path's getTotalLength() rounded up.
export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      className={className}
    >
      <path d="M14 25 L21 32 L34 17" />
    </svg>
  );
}
