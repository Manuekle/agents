import { ImageResponse } from "next/og";
import { BRAND, habibiFont } from "@/lib/brand";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Monogram, not the full wordmark: this renders at 16–32px in a browser tab,
// where "agents" would collapse into a smudge.
export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.ink,
          color: BRAND.paper,
          fontFamily: "Habibi",
          fontSize: 26,
          // Habibi sits high in its em box; nudge it back onto the optical centre.
          paddingBottom: 4,
        }}
      >
        a
      </div>
    ),
    { ...size, fonts: [await habibiFont()] },
  );
}
