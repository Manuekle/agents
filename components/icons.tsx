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
