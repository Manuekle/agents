import { fnv1a } from "@/components/dither-kit/pixel";

/**
 * A hue for <DitherAvatar>, pinned inside this palette's warm band.
 *
 * Left alone the pack draws one of 180 hues, and half of them — chartreuse,
 * cyan, magenta — belong to a different site than this one. What identifies an
 * avatar is its pattern; the hue only has to stay out of the way, so this maps
 * the name onto 350°–45°, deep red through amber, with --coral's 8° sitting in
 * the middle of it.
 *
 * Passing `hue` does not disturb the glyph: the pack draws the hue from the
 * same PRNG stream whether or not the prop overrides it, so the pattern for a
 * given name is the same either way.
 */
export function avatarHue(seed: string): number {
  return (350 + (fnv1a(seed) % 56)) % 360;
}
