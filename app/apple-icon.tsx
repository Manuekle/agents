import { ImageResponse } from "next/og";
import { BRAND, habibiFont } from "@/lib/brand";

// 180px is the size iOS asks for when a visitor adds the site to a home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          fontSize: 132,
          paddingBottom: 20,
        }}
      >
        a
      </div>
    ),
    { ...size, fonts: [await habibiFont()] },
  );
}
